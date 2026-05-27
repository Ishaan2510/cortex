<div align="center">

# Cortex — Architecture Document

</div>

---

## System Overview

Cortex is a multi-user AI workspace built as a distributed task processing system on the MERN stack with a Python worker service. Users submit text, PDFs, or images through a React frontend and select one of ten preset operations or supply a custom system prompt. The backend persists the task in MongoDB and pushes its ID onto a Redis queue. A Python worker consumes from the queue asynchronously, downloads and extracts any attached file, builds the appropriate system prompt, routes the request through one of four LLM providers using task-aware logic, and writes the result back along with the full provider chain attempted.

As the worker streams tokens from the upstream LLM, it publishes each chunk to a per-task pub/sub channel. The backend exposes a Server-Sent Events endpoint that subscribes to that channel and forwards tokens to the browser over a single open HTTP connection. The frontend renders tokens live via `EventSource` — no polling, no waiting for the full response.

![Dashboard](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/dashboard.png)

---

## Component Architecture

```
 +----------------------------------------------------------+
 |                   React Frontend                         |
 |           (Nginx, Docker, Kubernetes)                    |
 |      Login / Register / Dashboard / Task Modal           |
 +-------------------------+--------------------------------+
                           |
                  REST API  +  SSE token stream
                           |
                           v
 +----------------------------------------------------------+
 |              Node.js + Express API                       |
 |           (Docker, Kubernetes, 1 replica)                |
 |   JWT Auth  /  Task CRUD  /  Multer + Cloudinary         |
 |   Redis Queue Dispatch  /  SSE endpoint                  |
 +------+----------------+----------------+----------------+
        |                |                |
        v                v                v
 +-------------+  +-------------+  +-------------+
 |  MongoDB    |  |   Redis     |  | Cloudinary  |
 | tasks/users |  | queue +     |  | file store  |
 |  K8s PVC    |  | pub/sub     |  |  external   |
 +------^------+  +------^------+  +------^------+
        |                |                |
 +----------------------------------------------------------+
 |              Python Worker Service                       |
 |          (Docker, Kubernetes, 2 replicas)                |
 |  brpop → fetch file → extract text → route → stream LLM  |
 |          → publish tokens → write final result           |
 +-----------------------+----------------------------------+
                         |
                         v
              +---------------------+
              |   LLM Providers     |
              | Groq / Cerebras /   |
              | Gemini / OpenRouter |
              +---------------------+
```

The worker is the only component that talks to LLM providers directly. The backend never holds an LLM API key, which keeps the attack surface small and means provider credentials only need to be present on the worker deployment.

Redis serves a dual role in this topology — it's both the task queue (`brpop`/`lpush` on `task_queue`) and the streaming bus (`publish`/`subscribe` on `task_updates:{taskId}`). Using one Redis for both is a deliberate simplification; under sustained load these would split into separate Redis instances.

![Task Detail with Logs](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/task-detail.png)

---

## LLM Routing Strategy

The most architecturally interesting part of Cortex is the worker's routing layer in `worker/llm_router.py`. Each task selects a provider chain based on three input signals — the operation, the input length, and whether the input contains an image. The worker attempts the providers in order, and on rate limit, quota exhaustion, or error it falls back to the next provider in the chain.

**Three routing axes.**

| Signal | Why it matters | Routing decision |
|---|---|---|
| Image input | Only Gemini supports multimodal input among the four providers | Gemini first, OpenRouter fallback |
| Input length > 15,000 chars | Gemini's 1M context window handles arbitrarily long input where Groq and Cerebras would hit their token limits | Gemini → Cerebras → OpenRouter |
| Reasoning operations | Action items, key decisions, and "explain simply" benefit from a slightly more deliberate model | Groq → Cerebras → Gemini → OpenRouter |
| Default (speed) | Most operations are short transformations where Groq's tokens-per-second is the dominant factor | Groq → Cerebras → Gemini → OpenRouter |

**Why this chain.** Groq and Cerebras both serve fast Llama-class inference and are among the fastest providers in production today. Groq's free tier has higher rate limits in practice, so it sits at the head of the default chain. Cerebras catches the spillover when Groq is rate-limited. Gemini handles anything that needs long context or multimodal input. OpenRouter sits at the tail of every chain as a universal fallback because its free Llama 3.3 70B endpoint, while slower, almost never returns 429.

**Fallback detection.** The worker treats any of `429`, `rate limit`, `quota`, `resource_exhausted`, or `too many` in the exception message as a rate-limit signal worth retrying on the next provider. Any other exception also triggers a fallback but is logged as an error rather than a warning. The chain attempted is persisted on the task so failures are observable without grepping pod logs.

```python
def route_and_call(system_prompt, user_message, operation, input_length, has_image, image_data):
    chain = get_provider_chain(operation, input_length, has_image)
    for provider in chain:
        try:
            result = PROVIDER_CALLERS[provider](system_prompt, user_message)
            return result, attempted
        except Exception as e:
            # rate-limit aware: continue to next provider
            continue
    raise Exception('All providers failed')
```

---

## Real-time Streaming Layer

LLM outputs arrive token by token, and shipping the entire response only after the model is done leaves the user staring at a blank loader for 4–8 seconds on a 200-word response. Cortex streams tokens from the provider to the browser the moment they emit, using Server-Sent Events over a per-task event bus.

**End-to-end path.** The worker (or backend processor in the live demo topology) calls the upstream LLM with `stream: true` and does not wait for the full response. Each chunk is forwarded to a publish-subscribe channel keyed by task ID. A separate SSE endpoint on the backend subscribes to that channel for the duration of the client request and serializes events to the browser over the open HTTP connection. The frontend opens an `EventSource` to that endpoint and renders tokens as they arrive.

**Per-task event bus.** The bus is abstracted behind a `subscribe(taskId, handler) → unsubscribe` interface. Two implementations exist:

| Topology | Implementation | Why |
|---|---|---|
| Live demo (`main`) | In-process EventEmitter, garbage-collected when the last subscriber disconnects | Backend and processor share one Node process — pub/sub between them is a function call |
| Production (`kubernetes`) | Redis pub/sub on channel `task_updates:{taskId}` | Worker pods publish, backend pods subscribe — different processes, possibly different nodes |

The external interface is identical, which means the SSE endpoint and frontend code do not change between topologies. Swapping the implementation is a localized change to `eventBus.js`.

**Event types.** The stream is multi-event:

| Event | Payload | When emitted |
|---|---|---|
| `snapshot` | Full task document | Immediately on connection — gives the client the current state without a separate fetch |
| `progress` | Status update | When the task transitions to `running` |
| `token` | Token chunk | For each chunk forwarded from the upstream LLM |
| `provider_switch` | New provider name | When the chain falls through mid-stream and tokens already emitted must be discarded |
| `complete` | Final task document | On terminal state (`success` or `failed`) |
| `end` | — | Closes the stream from the server side |

**Mid-stream fallback.** A provider can drop its connection mid-stream after emitting some tokens. The router catches this, advances to the next provider, and emits a `provider_switch` event before resuming token emission. The frontend clears the partial output because the new provider has no context for what was already written — the alternative is rendering an inconsistent, half-spliced response. A subtle banner says "switched to {provider}". This matches the behavior of the synchronous fallback path and is honest about what is happening under the hood.

**Auth design.** `EventSource` cannot set custom HTTP headers, so the standard `Authorization: Bearer <jwt>` flow does not work for SSE. The endpoint authenticates via an httpOnly session cookie set at login alongside the Bearer token. The cookie carries the same signed JWT, so the existing token-verification middleware is reused unchanged. The cookie is `Secure` and `SameSite=None` in production to allow the cross-origin Vercel-to-Render path. Legacy logged-in users obtain the cookie silently on app mount via `POST /api/auth/refresh-cookie`, so no re-login is required after the streaming layer was added.

**UI batching.** Groq emits about 70 chunks per second. Calling React's `setState` on every chunk would trigger 70 markdown re-parses per second and visibly stutter the UI. The modal accumulates incoming tokens in a `useRef` and flushes to state every 33 milliseconds via a scheduled timer, capping render frequency at ~30 fps without dropping a single token.

**Keep-alive.** Render's free-tier proxy closes idle HTTP connections after about 30 seconds. The SSE endpoint writes a comment line (`: keepalive`) every 15 seconds, which keeps the TCP connection alive and does not trigger any client-side event.

**Cleanup.** When the client disconnects (tab close, modal close, navigation), the `req.close` handler removes the subscriber. If it was the last subscriber on that task, the event bus removes the channel entirely. There is no per-task memory accumulation across the process lifetime, and a terminated task's resources free immediately.

---

## File Processing Pipeline

File uploads flow through Cloudinary as a managed object store rather than being mounted into the worker container. This keeps the worker stateless and avoids the operational headache of persistent volumes on multiple replicas.

**Upload path.** When a multipart request hits `POST /api/tasks`, Multer streams the file directly to Cloudinary using `multer-storage-cloudinary`. The Cloudinary URL and public ID are persisted on the Task document. The backend never writes to local disk. PDFs are uploaded with `resource_type: raw` and images with `resource_type: image` so Cloudinary applies the right delivery pipeline.

**Extraction path.** When the worker picks up a task with a `fileUrl`, it downloads the file from Cloudinary. For PDFs, `PyMuPDF` (`fitz`) walks each page and extracts text, then truncates to 80,000 characters to stay safely within token limits across all providers. For images, the worker reads the bytes into base64 and passes them as a `Part.from_bytes` to Gemini's multimodal API. No OCR is performed — Gemini handles image understanding natively.

**Size and type guardrails.** The backend rejects anything other than PDF, JPEG, PNG, or WebP at the Multer file filter, and caps file size at 10MB. Per-user filenames embed the user ID and a timestamp to avoid collisions in the shared Cloudinary folder.

---

## Worker Scaling Strategy

The worker service is stateless. Each worker instance runs an infinite loop that calls `brpop` on the Redis `task_queue` list with a 5 second timeout. `brpop` is a blocking operation at the Redis level, meaning a worker only wakes up when a job exists. This avoids wasted CPU cycles from polling.

Because each worker independently pops from the same queue, Redis guarantees any given task ID is delivered to exactly one worker. There is no coordination overhead and no risk of double processing.

Scaling is achieved by increasing the replica count on the worker Kubernetes Deployment. The current configuration runs 2 replicas. To handle higher load, the replica count is increased via a manifest update which Argo CD then automatically applies to the cluster. A Horizontal Pod Autoscaler can be added later to scale replicas based on Redis queue depth exposed via a Prometheus exporter.

```yaml
spec:
  replicas: 2   # increase this value to scale out
```

The natural limit on Cortex worker scaling is not Redis or MongoDB throughput — it is the free-tier rate limits of the upstream LLM providers. With four providers in the chain, the effective ceiling for a single user is comfortably above what any individual portfolio project will see, but at multi-tenant scale the right move is paid API keys plus per-user rate limiting at the backend layer.

---

## Database Schema and Indexing

The `tasks` collection schema (defined in `backend/src/models/Task.js`) holds everything needed to render a task from any client without re-running the LLM call:

| Field | Purpose |
|---|---|
| `userId` | Owner — every task query is scoped by this |
| `title` | User-supplied label |
| `operationType` | `preset` or `custom` |
| `operation` | One of ten preset operations, or `custom` |
| `customPrompt` | Only set when `operationType = custom` |
| `inputText`, `fileUrl`, `fileType`, `filePublicId` | The task input |
| `status` | `pending`, `running`, `success`, `failed` |
| `result` | The LLM output |
| `providerUsed`, `providerChain` | Final provider plus the full ordered chain attempted |
| `logs` | Timestamped worker log lines for the task |

**Indexes.** Two indexes are defined:

```javascript
userId: { type: ObjectId, ref: 'User', required: true, index: true }
taskSchema.index({ userId: 1, createdAt: -1 })
```

The compound `{ userId: 1, createdAt: -1 }` index serves the dashboard query `Task.find({ userId }).sort({ createdAt: -1 })` directly from the index — MongoDB walks the index entries already in sort order, so no in-memory sort step is needed. The single-field `userId` index supports counts and lookups by user without the sort key.

The `users` collection has an implicit unique index on `email` enforced by `unique: true` in the Mongoose schema, which MongoDB compiles to a unique index automatically.

**Indexes to add at scale.** A partial index on `{ status: 1 }` filtered to `pending` and `running` documents would accelerate operational queries that check for stuck tasks. A TTL index on `createdAt` for failed tasks older than 30 days would cap storage growth.

---

## Handling Redis Failure

Redis is the queue layer between the backend and the worker, and the pub/sub layer for streaming. A Redis failure affects three things: new tasks cannot be enqueued, workers cannot pick up tasks, and active SSE streams stop receiving tokens.

**Impact on task creation.** The backend calls `redisClient.lPush()` after creating the task in MongoDB. If Redis is unavailable, this call throws and the request returns 500. The task record exists in MongoDB with status `pending` but will never be processed automatically — it sits as an orphan until a manual re-queue.

**Impact on the worker.** Workers call `brpop` in a loop with broad exception handling. If the Redis connection drops, the exception is caught, logged, and the worker sleeps for 2 seconds before retrying. Workers do not crash on Redis failure.

**Impact on active streams.** When the streaming Redis connection drops, the SSE endpoint catches the error, sends a `disconnected` event to subscribed clients, and closes the stream. Clients can reconnect — the SSE endpoint always replays a snapshot from MongoDB on reconnection, so no state is lost. Tokens emitted during the outage are not recoverable, but the final result will eventually be written to MongoDB by the worker and surfaced on reconnect.

**Recovery path.** When Redis comes back online, workers reconnect automatically. Tasks pushed to the queue before the failure are still in Redis because Redis persists the list in memory (and on disk if AOF is enabled). Tasks that failed to enqueue during the outage have their IDs in MongoDB and can be re-queued by a recovery script:

```python
pending_tasks = db.tasks.find({"status": "pending"})
for task in pending_tasks:
    redis_client.lpush("task_queue", str(task["_id"]))
```

**Production hardening.** For production, Redis should be deployed with a replica and Redis Sentinel or Redis Cluster for automatic failover. The backend should implement retry with exponential backoff on `lPush` rather than immediately returning a 500 — a few hundred milliseconds of retry typically masks transient Redis blips entirely.

---

## Provider Failure Modes

LLM providers fail in three distinct ways, each handled differently by the routing layer:

| Failure mode | Detection | Response |
|---|---|---|
| Rate limit (429) | Substring match on common keywords in the exception | Log at warn level, advance to next provider |
| Quota exhausted | Same substring match | Same — advance to next |
| Hard error (timeout, malformed response, network) | Any other exception | Log at error level, advance to next |
| Mid-stream disconnection | Stream iterator raises after some tokens emitted | Emit `provider_switch`, clear client buffer, start next provider fresh |
| All providers failed | Chain exhausted | Raise final exception, task marked `failed` |

The single-task chain-wide failure case is rare in practice because the four providers do not share rate limit buckets. The likely cause of a chain-wide failure is the input being malformed in a way that all providers reject, or a network partition affecting the worker pod.

Mid-stream disconnection is the trickiest case. The router cannot replay tokens already emitted because the next provider has no context for them, and concatenating a partial response from one model with a fresh response from another produces visible discontinuities. Discarding the partial output is the only honest option, even though it means the user briefly sees text get replaced.

---

## Prompt Eval Framework

LLM prompts and routing rules silently affect output quality. Without a regression suite, a small prompt tweak can degrade output across an entire operation and only become visible when users complain. Cortex's eval framework runs a versioned set of test cases on every PR and gates the CI build on per-operation pass rates.

**Case structure.** Each case is a YAML document declaring an input, the operation, and a list of structural checks the output must pass. Checks are concrete, deterministic, and never use LLM judgment:

```yaml
- id: business_followup
  description: "Email followup after client meeting"
  input: |
    Following up on our meeting yesterday about the Q3 budget...
  operation: draft_email
  checks:
    - type: regex_match
      pattern: "^Subject:"
    - type: must_contain
      values: ["follow", "Q3"]
    - type: min_length
      value: 200
    - type: max_length
      value: 1500
```

Five scorer types cover the realistic check space: `format_bullets`, `must_contain`, `must_not_contain`, `min_length` / `max_length`, and `regex_match`. None of them invoke another LLM — pass/fail is a pure function of the output string, which keeps the eval itself deterministic even when the model being evaluated is not.

**50 cases across 10 operations.** Each operation has 5 cases covering different input shapes — short text, long text, structured input, ambiguous prompts, edge cases. The cases live in `backend/eval/cases/{operation}.yaml`.

**Runner.** `backend/eval/runner.js` walks the case directory, calls the real LLM router for each case (including the full fallback chain), scores the output against the case's checks, and aggregates per-operation pass rates. Calls are sequential, not parallel, to respect free-tier rate limits — particularly Gemini's 5 RPM ceiling, which forces an `EVAL_DELAY_MS=13000` between cases when Gemini might be hit.

**Baseline and regression gate.** Pass rates are committed to `backend/eval/baseline.json`. If any operation's pass rate drops more than 5 percentage points below baseline, CI fails the build. The 5-point threshold is wide enough to absorb LLM nondeterminism — cases at `temperature: 0.7` flicker pass/fail run-to-run — and narrow enough to catch genuine prompt regressions. Updating the baseline requires an explicit `npm run eval -- --update-baseline` and a deliberate commit. Accepted regressions are never silent.

**CI integration.** Two modes run in GitHub Actions:

| Mode | Cases | When |
|---|---|---|
| Smoke | 10 (one per operation) | Every PR and push, sticky comment on PR with pass rates |
| Full | 50 | Manual workflow dispatch only — too slow for every commit |

The sticky PR comment uses `marocchino/sticky-pull-request-comment@v2` so successive pushes update a single comment rather than spamming the PR.

**What this catches in practice.** Prompt edits that drop a required output structure (e.g., removing the `Subject:` prefix from email drafts). Router changes that route an operation to a weaker provider. Token-budget tweaks that truncate the system prompt below its critical instructions. The framework does not catch subjective regressions — "the output got less interesting" — and is not meant to. Those require a different tool, likely an LLM-judge layer that would sit alongside the deterministic scorers.

---

## Staging and Production Environments

The GitOps model with Argo CD makes multi-environment deployment straightforward. Each environment is a separate Argo CD Application pointing to a different path in the infra repository.

**Staging.** Create a `k8s-staging/` directory mirroring the structure of `k8s/` but with different values: 1 worker replica, smaller resource limits, environment-specific ConfigMaps pointing to a staging Mongo, Redis, and Cloudinary folder, and ideally a separate set of LLM API keys to isolate quota usage. A staging Argo CD Application watches `k8s-staging/`.

**Production.** The existing `k8s/` directory serves production. The production Argo CD Application watches the `main` branch of the infra repo. The CI/CD pipeline updates image tags in `k8s/` deployments on every push to the application repo's `main` branch.

**Promotion flow.** Feature branch → merge to `staging` branch → workflow builds images tagged with the staging commit SHA → updates `k8s-staging/` → validate → merge `staging` to `main` → workflow updates `k8s/` → production picks up the change via Argo CD.

**What differs between staging and production.** Image tags, replica counts, resource limits, ConfigMap values (Mongo URI, Redis URL, JWT secret, Cloudinary folder, LLM API keys). All structural manifests — Deployments, Services, Ingress, probes — are identical, ensuring staging accurately reflects what production will run.

---

## CI/CD Pipeline

![GitHub Actions Pipeline](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/pipeline.png)

The pipeline has three stages that run sequentially on every push to `main`.

**Lint.** ESLint runs on the backend and frontend source code. Failures block all subsequent stages.

**Build and Push.** Docker images are built for all three services using multi-stage Dockerfiles. Images are tagged with both `latest` and the short Git commit SHA (7 characters). Both tags are pushed to Docker Hub under the `ishaan102` namespace.

**Update Infra Repo.** The pipeline checks out the infra repository using a GitHub Personal Access Token stored as a secret. It runs `sed` to replace the image tag in each deployment manifest with the new commit SHA tag, commits the change, and pushes. Argo CD detects the change within minutes and applies it to the cluster automatically.

A separate **LLM Eval** workflow runs on every push and PR that touches the router, prompts, or eval cases. It does not block builds on application-only changes, but it is required for any change that crosses the prompt or routing layer.

---

## GitOps with Argo CD

![Argo CD Dashboard](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/argocd.png)

Argo CD runs in the `argocd` namespace of the same Kubernetes cluster. It is configured with auto-sync enabled, meaning any change pushed to the `k8s/` directory in the infra repository is automatically applied to the cluster without manual intervention.

The Application manifest sets `prune: true` so resources removed from the manifests are also removed from the cluster, and `selfHeal: true` so any manual `kubectl` changes that drift from the declared state are automatically reverted.

---

## Security

Passwords are hashed using bcrypt with a cost factor of 12 before storage. JWTs are signed with HS256 using a secret stored as a Kubernetes Secret injected as an environment variable at runtime. All API routes except `/api/auth/register`, `/api/auth/login`, and `/health` require a valid JWT in the `Authorization` header.

Rate limiting is applied to the auth endpoints: 10 requests per 15-minute window per IP, enforced by `express-rate-limit`. The Helmet middleware sets secure HTTP headers on all responses. CORS is enforced against an allowlist built from `FRONTEND_URL` / `FRONTEND_URLS` environment variables — anything not on the list is rejected.

**Streaming auth.** Server-Sent Events cannot send custom HTTP headers from the browser, so the SSE endpoint authenticates via an httpOnly session cookie rather than the Bearer token used by the rest of the API. The cookie carries the same signed JWT and is validated by reusing the existing token-verification middleware. In production it's set with `Secure` and `SameSite=None` to allow the cross-origin Vercel-to-Render path; in development it relaxes to `SameSite=Lax`. The cookie is never readable by JavaScript, eliminating XSS-based session theft, and expires after 7 days matching the Bearer token's expiry.

**File uploads.** Multer is configured with a strict MIME type filter (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`) and a 10MB size cap. Files never touch local disk on the backend — they stream straight to Cloudinary, scoped to a per-user folder via the user ID in the public ID.

**Secrets.** No secrets or credentials are committed to either repository. The four LLM API keys, Cloudinary credentials, JWT secret, and Mongo credentials all flow through Kubernetes Secrets or GitHub Actions secrets at runtime. The backend never holds LLM API keys — only the worker does.

**Container hardening.** Docker images are built with non-root users in both the backend and worker containers, reducing the blast radius of any container escape. Multi-stage builds ensure that development dependencies, build tools, and source files not needed at runtime are excluded from the final image layer.