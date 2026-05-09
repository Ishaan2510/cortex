# AI Task Platform

A production-grade task processing platform built with the MERN stack, a Python worker service, Redis queue, Docker, and Kubernetes. Users submit text processing tasks through a React frontend. Each task is queued in Redis and processed asynchronously by a Python worker that updates task status in real time.

![Dashboard]([docs/images/dashboard.png](https://github.com/Ishaan2510/ai-task-platform/blob/main/docs/dashboard.png))

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Backend API | Node.js, Express 5, JWT (HS256) |
| Worker | Python 3.11, pymongo, redis-py |
| Database | MongoDB 7 |
| Queue | Redis 7 |
| Container | Docker (multi-stage builds, non-root users) |
| Orchestration | Kubernetes (Docker Desktop) |
| GitOps | Argo CD with auto-sync |
| CI/CD | GitHub Actions |

## Supported Operations

| Operation | Description |
|---|---|
| uppercase | Converts input text to uppercase |
| lowercase | Converts input text to lowercase |
| reverse | Reverses the input string |
| word_count | Counts words and returns the total |

## How It Works

A user submits a task with a title, input text, and operation. The backend creates a task record in MongoDB with status `pending` and pushes the task ID to a Redis list. A Python worker picks up the ID using a blocking pop, marks the task as `running`, executes the operation, and writes the result back to MongoDB with status `success` or `failed` along with timestamped logs. The frontend polls the task every 1.5 seconds until it reaches a terminal state and displays the result inline.

![Task Detail](docs/images/task-detail.png)

## Local Development

Start MongoDB and Redis via Docker Compose, then run each service separately.

**Step 1.** Start infrastructure:

```bash
docker compose up mongodb redis -d
```

**Step 2.** Start the backend (inside `backend/`):

```bash
npm install
npm run dev
```

**Step 3.** Start the Python worker (inside `worker/`):

```bash
pip install -r requirements.txt
python worker.py
```

**Step 4.** Start the frontend (inside `frontend/`):

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Docker (Full Stack)

Run all services together:

```bash
docker compose up --build
```

Open `http://localhost:3000`.

## Environment Variables

**Backend** (`backend/.env`):
MONGO_URI=mongodb://admin:adminpass@localhost:27017/aitaskplatform?authSource=admin
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=7d
PORT=5000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

**Worker** (`worker/.env`):
MONGO_URI=mongodb://admin:adminpass@localhost:27017/aitaskplatform?authSource=admin
REDIS_URL=redis://localhost:6379

## Kubernetes Deployment

Manifests live in the companion repository `ai-task-platform-infra`. Apply them with:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/mongodb/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/worker/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress/
```

## CI/CD Pipeline

![GitHub Actions](docs/images/pipeline.png)

Every push to `main` triggers a three-stage pipeline. Lint checks run first. On success, Docker images are built and pushed to Docker Hub tagged with the commit SHA. The pipeline then updates the image tags in the infra repository, which Argo CD detects and applies to the cluster within minutes.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture document covering worker scaling, high volume handling, database indexing, Redis failure recovery, and multi-environment deployment.

## Repository Structure
ai-task-platform/
├── backend/
│   ├── src/
│   │   ├── config/          (db.js, redis.js)
│   │   ├── middleware/       (auth.js)
│   │   ├── models/           (User.js, Task.js)
│   │   └── routes/           (auth.js, tasks.js)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/              (axios.js, tasks.js)
│   │   ├── components/       (TaskCard, TaskForm, TaskModal)
│   │   ├── context/          (AuthContext, AuthProvider, useAuth)
│   │   └── pages/            (Login, Register, Dashboard)
│   ├── Dockerfile
│   └── nginx.conf
├── worker/
│   ├── worker.py
│   ├── requirements.txt
│   └── Dockerfile
├── docs/
│   └── images/
├── docker-compose.yml
├── ARCHITECTURE.md
└── .github/workflows/ci-cd.yaml


Updated README.md in ai-task-platform-infra:
md# AI Task Platform — Infrastructure

Kubernetes manifests for the AI Task Platform, managed via Argo CD using a GitOps workflow. Every change pushed to this repository is automatically detected and applied to the cluster.

## Argo CD Dashboard

The application is configured with auto-sync, prune, and self-heal enabled. Any drift between the cluster state and this repository is automatically corrected.

## Repository Structure
ai-task-platform-infra/
├── k8s/
│   ├── namespace.yaml
│   ├── backend/
│   │   ├── configmap.yaml
│   │   ├── secret.yaml
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── worker/
│   │   └── deployment.yaml
│   ├── mongodb/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── secret.yaml
│   │   └── pvc.yaml
│   ├── redis/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── ingress/
│       └── ingress.yaml
└── argocd/
└── application.yaml

## Applying Manifests Manually

To apply all manifests to a running Kubernetes cluster:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/mongodb/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/worker/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress/
```

## Installing Argo CD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Access the UI:

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Get the initial admin password:

```bash
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 --decode
```

Apply the application manifest to register the app with Argo CD:

```bash
kubectl apply -f argocd/application.yaml
```

## Namespace

All resources deploy into the `ai-task-platform` namespace. The Argo CD Application manifest creates this namespace automatically via the `CreateNamespace=true` sync option.

## Worker Scaling

The worker Deployment runs 2 replicas by default. To scale:

```bash
kubectl scale deployment worker --replicas=N -n ai-task-platform
```

Or update the `replicas` field in `k8s/worker/deployment.yaml` and push. Argo CD will apply the change automatically.

## Image Tags

Image tags in the deployment manifests are updated automatically by the CI/CD pipeline in the application repository on every push to `main`. Each tag corresponds to the 7-character Git commit SHA of the application build that produced it.
