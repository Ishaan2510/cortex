<div align="center">

# AI Task Platform — Architecture Document

</div>

---

## System Overview

AI Task Platform is a distributed task processing system built on the MERN stack with a Python worker service. Users submit text processing tasks through a React frontend. The backend queues each task into Redis, and one or more Python workers consume from the queue asynchronously, updating task status in MongoDB as they progress from `pending` to `running` to `success` or `failed`.

![Dashboard](https://raw.githubusercontent.com/Ishaan2510/ai-task-platform/main/docs/dashboard.png)

---

## Component Architecture

```
 +---------------------------------------------------------+
 |                   React Frontend                        |
 |           (Nginx, Docker, Kubernetes)                   |
 |      Login / Register / Dashboard / Task Modal          |
 +-------------------------+-------------------------------+
                           |
                    REST API over HTTP
                           |
                           v
 +---------------------------------------------------------+
 |              Node.js + Express API                      |
 |           (Docker, Kubernetes, 1 replica)               |
 |   JWT Auth  /  Task CRUD  /  Redis Queue Dispatch       |
 +------------------+-----------------------+--------------+
                    |                       |
         +----------v----------+  +---------v-----------+
         |      MongoDB        |  |        Redis         |
         |  (tasks, users)     |  |   (task_queue list)  |
         |  Kubernetes PVC     |  |  Kubernetes Service  |
         +----------^----------+  +---------+-----------+
                    |                       |
 +---------------------------------------------------------+
 |              Python Worker Service                      |
 |          (Docker, Kubernetes, 2 replicas)               |
 |   brpop from Redis  →  process  →  update MongoDB      |
 +---------------------------------------------------------+
```

![Task Detail with Logs](https://raw.githubusercontent.com/Ishaan2510/ai-task-platform/main/docs/task-detail.png)

---

## Worker Scaling Strategy

The worker service is stateless by design. Each worker instance runs an infinite loop that calls `brpop` on the Redis `task_queue` list with a 5 second timeout. `brpop` is a blocking operation at the Redis level, meaning a worker only wakes up when a job exists. This avoids wasted CPU cycles from polling.

Because each worker independently pops from the same queue, Redis guarantees that any given task ID is delivered to exactly one worker. There is no coordination overhead between workers and no risk of double processing.

Scaling is achieved by increasing the replica count on the worker Kubernetes Deployment. The current configuration runs 2 replicas. To handle higher load, the replica count is increased via a manifest update which Argo CD then automatically applies to the cluster. A Horizontal Pod Autoscaler can be added later to scale replicas based on a custom Redis queue depth metric exposed via a Prometheus exporter.

```yaml
spec:
  replicas: 2   # increase this value to scale out
```

---

## Handling 100,000 Tasks Per Day

At 100,000 tasks per day, the system processes approximately 1.16 tasks per second on average, with realistic peak bursts of 10 to 20 tasks per second during high traffic windows.

**Queue throughput.** Redis can handle hundreds of thousands of operations per second on commodity hardware. The `task_queue` list never becomes the bottleneck at this scale. Each `lPush` from the backend and each `brpop` from a worker is an O(1) operation.

**Worker throughput.** Each worker processes one task at a time sequentially. A single worker can complete approximately 200 to 500 simple string operations per second given the overhead of two MongoDB writes per task — one for `running`, one for `success` or `failed`. At 2 replicas, the fleet handles 400 to 1,000 tasks per second, well above the 1.16 per second daily average and sufficient for realistic peak bursts.

**Database throughput.** MongoDB handles the write volume comfortably. Each task lifecycle generates 3 MongoDB operations: one insert on creation and two updates during processing. At 100,000 tasks per day, that is 300,000 operations per day or roughly 3.5 operations per second on average. MongoDB on modest hardware handles tens of thousands of operations per second.

**Scaling path for higher load.** If task volume increases by 10x or 100x, the following changes apply in order: increase worker replicas, add a read replica for MongoDB task listing queries, shard the tasks collection by `userId`, and introduce a Redis Cluster for queue throughput above 100,000 operations per second.

---

## Database Indexing Strategy

The `tasks` collection has one explicit index defined on `userId`:

```javascript
userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true,
  index: true,
}
```

This index is the most critical one in the system. The most frequent query pattern is fetching all tasks belonging to a specific user, executed on every dashboard load:

```javascript
Task.find({ userId: req.user.id }).sort({ createdAt: -1 })
```

Without the index, this query performs a full collection scan across all tasks from all users. With the index, MongoDB narrows the scan to only documents matching the `userId`, making the query O(log n) in the index lookup phase.

**Secondary indexes to add at scale.** As the tasks collection grows, a compound index on `{ userId: 1, createdAt: -1 }` would allow MongoDB to satisfy the sort within the index itself without a separate sort step, reducing memory usage and query time further. A partial index on `{ status: 1 }` filtered to `pending` and `running` documents would accelerate admin or monitoring queries that check for stuck tasks.

**The users collection** has an implicit unique index on `email` enforced by the `unique: true` field option in the Mongoose schema, which MongoDB converts to a unique index automatically.

---

## Handling Redis Failure

Redis is the queue layer between the backend and the worker. A Redis failure affects two things: new tasks cannot be enqueued, and workers cannot pick up tasks.

**Impact on task creation.** The backend calls `redisClient.lPush()` after creating the task in MongoDB. If Redis is unavailable, this call throws an error. The task record exists in MongoDB with status `pending` but will never be processed automatically. The backend returns a 500 to the user.

**Impact on the worker.** Workers call `brpop` in a loop with exception handling. If the Redis connection drops, the exception is caught, logged, and the worker sleeps for 2 seconds before retrying. Workers do not crash on Redis failure.

**Recovery path.** When Redis comes back online, workers reconnect automatically. Tasks that were pushed to the queue before the failure are still in Redis since Redis persists the list in memory. Tasks that failed to enqueue during the outage have their IDs in MongoDB and can be re-queued by a recovery script:

```python
pending_tasks = db.tasks.find({"status": "pending"})
for task in pending_tasks:
    redis_client.lpush("task_queue", str(task["_id"]))
```

**Production hardening.** For production, Redis should be deployed with a replica and Redis Sentinel or Redis Cluster for automatic failover. The backend should implement a retry with exponential backoff on the `lPush` call rather than immediately returning a 500.

---

## Staging and Production Environments

The GitOps model with Argo CD makes multi-environment deployment straightforward. Each environment is a separate Argo CD Application pointing to a different path in the infra repository.

**Staging environment setup.** Create a `k8s-staging/` directory in the infra repository mirroring the structure of `k8s/` but with different values: fewer worker replicas (1 instead of 2), smaller resource limits, and environment-specific ConfigMaps pointing to a staging MongoDB and Redis instance. A staging Argo CD Application is configured to watch `k8s-staging/`:

```yaml
source:
  path: k8s-staging
```

**Production environment setup.** The existing `k8s/` directory serves production. The production Argo CD Application watches the `main` branch of the infra repo. The CI/CD pipeline updates image tags in `k8s/` deployments on every push to the application repo's `main` branch.

**Promotion flow.** A developer merges a feature branch into a `staging` branch of the app repo. A separate GitHub Actions workflow builds images tagged with the staging commit SHA and updates `k8s-staging/` in the infra repo. After validation on staging, the change is merged to `main`, which triggers the production pipeline updating `k8s/`.

**Environment separation in practice.** The only differences between staging and production manifests are the image tags, replica counts, resource limits, and ConfigMap values such as MongoDB URI, Redis URL, and JWT secret. All structural Kubernetes manifests including Deployments, Services, Ingress, and probes are identical, ensuring staging accurately reflects what production will run.

---

## CI/CD Pipeline

![GitHub Actions Pipeline](https://raw.githubusercontent.com/Ishaan2510/ai-task-platform/main/docs/pipeline.png)

The pipeline has three stages that run sequentially on every push to `main`.

**Lint.** ESLint runs on the backend and frontend source code. Failures block all subsequent stages.

**Build and Push.** Docker images are built for all three services using multi-stage Dockerfiles. Images are tagged with both `latest` and the short Git commit SHA (7 characters). Both tags are pushed to Docker Hub under the `ishaan102` namespace.

**Update Infra Repo.** The pipeline checks out the `ai-task-platform-infra` repository using a GitHub Personal Access Token stored as a secret. It runs `sed` to replace the image tag in each deployment manifest with the new commit SHA tag, commits the change, and pushes. Argo CD detects the change within minutes and applies it to the cluster automatically.

---

## GitOps with Argo CD

![Argo CD Dashboard](https://raw.githubusercontent.com/Ishaan2510/ai-task-platform/main/docs/argocd.png)

Argo CD runs in the `argocd` namespace of the same Kubernetes cluster. It is configured with auto-sync enabled, meaning any change pushed to the `k8s/` directory in the infra repository is automatically applied to the cluster without manual intervention.

The Application manifest sets `prune: true` so resources removed from the manifests are also removed from the cluster, and `selfHeal: true` so any manual `kubectl` changes that drift from the declared state are automatically reverted.

---

## Security

Passwords are hashed using bcrypt with a cost factor of 12 before storage. JWTs are signed with HS256 using a secret stored as a Kubernetes Secret injected as an environment variable at runtime. All API routes except `/api/auth/register`, `/api/auth/login`, and `/health` require a valid JWT in the `Authorization` header.

Rate limiting is applied to the auth endpoints: 10 requests per 15-minute window per IP, enforced by `express-rate-limit`. The Helmet middleware sets secure HTTP headers on all responses. No secrets or credentials are committed to either repository. All sensitive values flow through Kubernetes Secrets or GitHub Actions secrets at runtime.

Docker images are built with non-root users in both the backend and worker containers, reducing the blast radius of any container escape. Multi-stage builds ensure that development dependencies, build tools, and source files that are not needed at runtime are excluded from the final image layer.