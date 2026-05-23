<div align="center">

# Cortex

**A multi-provider LLM orchestration platform with intelligent routing, multimodal input, and GitOps-driven Kubernetes deployment.**

Cortex treats LLM calls as a managed resource — routing each request to the optimal provider based on operation class, input size, and modality, with automatic failover across a four-provider chain.

### [→ Live Demo](https://cortex-ai-task-platform.vercel.app)

[![GitHub Actions](https://img.shields.io/badge/CI/CD-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/Ishaan2510/cortex/actions)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://hub.docker.com/u/ishaan102)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Orchestrated-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)](https://github.com/Ishaan2510/cortex-infra)
[![Argo CD](https://img.shields.io/badge/Argo_CD-GitOps-EF7B4D?style=for-the-badge&logo=argo&logoColor=white)](https://github.com/Ishaan2510/cortex-infra)

</div>

---

## What This Solves

Single-provider LLM applications are brittle. Free-tier rate limits trigger at the worst moments. One provider's outage takes the whole product down. Long-context tasks fail on providers with small context windows. Multimodal inputs only work on a subset of providers. Hardcoding any one provider into the application means accepting all of these failure modes.

Cortex addresses this with a routing layer that selects providers per-request based on the input. The application code never talks to a specific provider — it submits a task to the router, which picks the right chain and handles failover automatically. The chain attempted and the final provider used are both persisted on the task and displayed in the UI, so failures are observable and routing decisions are auditable.

---

## How Routing Works

Each task selects a provider chain based on three signals — the operation, the input length, and whether the input contains an image. The first provider in the chain is tried first; on rate limit (429), quota exhaustion, or any other error, the worker falls through to the next provider automatically. Across four providers in the chain, the probability of all four failing simultaneously is effectively zero.

| Signal | Routing decision | Why |
|---|---|---|
| Image input | Gemini → OpenRouter | Gemini is the only multimodal provider in the chain |
| Input > 15,000 chars | Gemini → Cerebras → OpenRouter | Gemini's 1M context window handles arbitrarily long input |
| Reasoning operations (action items, key decisions, explain simply) | Groq → Cerebras → Gemini → OpenRouter | Slightly more deliberate output benefits these ops |
| Default (speed) | Groq → Cerebras → Gemini → OpenRouter | Groq's tokens-per-second is the dominant factor |

Rate-limit detection looks for `429`, `rate limit`, `quota`, `resource_exhausted`, or `too many` in the exception message, advances to the next provider on a hit, and logs at warn level. Any other exception also triggers fallback but logs at error level. If the entire chain fails the task is marked `failed` and the full chain is persisted for diagnostics.

---

## Live Demo Screenshots

![Dashboard](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/dashboard.png)

![Task Detail](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/task-detail.png)

---

## Two Deployment Topologies

Cortex ships in two configurations. The live demo runs the simplified single-process topology to fit free-tier hosting constraints. The production-grade topology with a Python worker, Redis queue, Kubernetes, and Argo CD is documented in [ARCHITECTURE.md](ARCHITECTURE.md) and lives on the `kubernetes` branch.

### Live Demo Topology — `main` branch

```
 React (Vercel) ──HTTPS──▶ Node + Express (Render free) ──▶ MongoDB Atlas M0
                                  │                  │
                                  │                  └──▶ Cloudinary (files)
                                  │
                                  └─▶ LLM routing in-process
                                       Groq · Cerebras · Gemini · OpenRouter
```

The Node backend hosts the LLM routing layer directly. Tasks are created synchronously, persisted to MongoDB as `pending`, and processed by an async function in the same process that updates the document as it transitions through `running` → `success`/`failed`. The frontend polls `/api/tasks/:id` every 1.5 seconds until terminal. Total cost: zero. Total credit cards required: zero.

### Production Topology — `kubernetes` branch + [cortex-infra](https://github.com/Ishaan2510/cortex-infra)

```
 React (Nginx) ──▶ Node + Express ──┬──▶ MongoDB (StatefulSet, PVC)
                                    │
                                    └──▶ Redis (queue) ─┐
                                                        │
                                  Python Worker × N ───┘
                                  │
                                  └─▶ LLM routing + PyMuPDF extraction
```

Three Deployments (frontend, backend, worker), each behind a Service. Worker runs at 2 replicas by default, scaling out via replica count — `brpop` on Redis guarantees exactly-once delivery per task. Argo CD watches the infra repo with `auto-sync`, `prune`, and `selfHeal` enabled. GitHub Actions builds and pushes images on every commit to `main`, then `sed`-updates the image tags in the infra repo, which Argo CD picks up within minutes.

The production topology is the one documented in [ARCHITECTURE.md](ARCHITECTURE.md). Most architectural depth — worker scaling math, Redis failure recovery, multi-environment promotion — applies to this topology.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Backend API | Node.js, Express 5, JWT (HS256), bcrypt, Multer |
| Worker (K8s topology) | Python 3.11, pymongo, redis-py, PyMuPDF |
| LLM Providers | Groq (Llama 3.3 70B), Cerebras (Llama 3.3 70B), Google Gemini 2.0 Flash, OpenRouter (Llama 3.3 70B free) |
| File Storage | Cloudinary |
| Database | MongoDB 7 (Atlas M0 in live demo, self-hosted in K8s topology) |
| Queue (K8s topology) | Redis 7 |
| Containerization | Docker with multi-stage builds and non-root users |
| Orchestration | Kubernetes on Docker Desktop |
| GitOps | Argo CD with auto-sync, prune, and self-heal |
| CI/CD | GitHub Actions |
| Registry | Docker Hub |
| Hosting (live demo) | Vercel (frontend), Render (backend), MongoDB Atlas, Cloudinary |

---

## Supported Operations

Ten preset operations plus a fully custom prompt mode. Each preset has a hand-tuned system prompt.

| Operation | Description |
|---|---|
| Summarize | Condense input into 3 to 5 key bullet points |
| Extract Action Items | Identify all tasks and follow-ups with owners |
| Rewrite — Formal | Refine text to a professional tone |
| Rewrite — Casual | Make text warm and conversational |
| LinkedIn Post | Craft an engaging post with hook, body, and CTA |
| Draft Email | Write a polished email with subject and sign-off |
| Extract Key Decisions | Surface decisions made and open questions |
| Explain Simply | Simplify complex content for a 16-year-old reader |
| Tweet Thread | Convert ideas to a 5–8 tweet thread |
| Translate to Hindi | Natural Hindi translation in Devanagari |
| Custom Prompt | Provide your own system prompt for full control |

Each operation accepts text input, a PDF or image attachment (up to 10 MB), or both. PDFs are extracted via PyMuPDF and truncated to 80,000 characters before being passed to the LLM. Images are sent as base64 to Gemini's multimodal endpoint.

---

## Local Development

### Live demo topology (Node-only, no worker, no Redis)

```bash
# from backend/
npm install
npm run dev

# from frontend/, in another terminal
npm install
npm run dev
```

Set `MONGO_URI` in `backend/.env.local` to either a local MongoDB or an Atlas free cluster. Set the four LLM API keys and Cloudinary credentials in the same file. Open `http://localhost:5173`.

### Production topology (Python worker + Redis + Docker)

Switch to the `kubernetes` branch first, then:

```bash
# Start MongoDB and Redis
docker compose up mongodb redis -d

# Backend
cd backend && npm install && npm run dev

# Worker (in another terminal)
cd worker && pip install -r requirements.txt && python worker.py

# Frontend (in another terminal)
cd frontend && npm install && npm run dev
```

Or run everything in containers:

```bash
docker compose up --build
```

---

## Environment Variables

**`backend/.env.local`** (both topologies, but the K8s topology also needs `REDIS_URL`)

```
NODE_ENV=development
PORT=5000
APP_ENV=local

MONGO_URI=mongodb://admin:adminpass@localhost:27017/aitaskplatform?authSource=admin
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# LLM providers (live demo topology only — in K8s topology these go to the worker)
GROQ_API_KEY=your_groq_key
CEREBRAS_API_KEY=your_cerebras_key
GOOGLE_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key
```

All four LLM provider keys and Cloudinary are free to obtain — sign up at `console.groq.com`, `cloud.cerebras.ai`, `aistudio.google.com`, `openrouter.ai`, and `cloudinary.com`.

---

## Kubernetes Deployment

Manifests live in the companion repository [cortex-infra](https://github.com/Ishaan2510/cortex-infra). Apply them in order:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/mongodb/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/worker/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress/
```

See [cortex-infra](https://github.com/Ishaan2510/cortex-infra) for Argo CD setup.

---

## CI/CD Pipeline

![Pipeline](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/pipeline.png)

Every push to `main` triggers a three-stage GitHub Actions pipeline:

1. **Lint** — ESLint runs on backend and frontend source. Failures block all subsequent stages.
2. **Build and Push** — Docker images are built for all three services using multi-stage Dockerfiles and pushed to Docker Hub tagged with both `latest` and the short commit SHA.
3. **Update Infra Repo** — The pipeline checks out [cortex-infra](https://github.com/Ishaan2510/cortex-infra) using a stored secret token, updates the image tags in each deployment manifest via `sed`, commits, and pushes. Argo CD detects the change within minutes and applies it to the cluster.

---

## Argo CD (GitOps)

![Argo CD](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/argocd.png)

Argo CD runs in the `argocd` namespace and watches the `k8s/` directory of the infra repository. Auto-sync, prune, and self-heal are all enabled. Any drift between the cluster and the declared manifests is automatically corrected.

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture document — LLM routing internals, file processing pipeline, worker scaling, database indexing, Redis failure recovery, provider failure modes, and multi-environment deployment.

---

## Repository Structure

```
cortex/
├── backend/
│   ├── src/
│   │   ├── config/          db.js, cloudinary.js, upload.js
│   │   ├── middleware/       auth.js
│   │   ├── models/           User.js, Task.js
│   │   ├── routes/           auth.js, tasks.js
│   │   └── services/         llmRouter.js, operations.js, fileProcessor.js, taskProcessor.js
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/              axios.js, tasks.js
│   │   ├── components/       TaskCard.jsx, TaskForm.jsx, TaskModal.jsx
│   │   ├── context/          AuthContext.js, AuthProvider.jsx, useAuth.js
│   │   └── pages/            Login.jsx, Register.jsx, Dashboard.jsx
│   ├── nginx.conf
│   └── Dockerfile
├── docs/
│   └── dashboard.png, task-detail.png, argocd.png, pipeline.png
├── ARCHITECTURE.md
└── README.md
```

The `kubernetes` branch additionally includes `worker/` (Python), `docker-compose.yml`, and the original Redis-backed routing in the Node backend.

---

*Built by [Ishaan Goswami](https://github.com/Ishaan2510) — CS undergrad, PDEU + IIT Madras*