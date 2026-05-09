<div align="center">

# AI Task Platform

**A production-grade distributed task processing system built on the MERN stack with a Python worker, Redis queue, Docker, and Kubernetes.**

Async task execution · Real-time status tracking · GitOps deployment · Full CI/CD pipeline

[![GitHub Actions](https://img.shields.io/badge/CI/CD-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/Ishaan2510/ai-task-platform/actions)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://hub.docker.com/u/ishaan102)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Orchestrated-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)](https://github.com/Ishaan2510/ai-task-platform-infra)
[![Argo CD](https://img.shields.io/badge/Argo_CD-GitOps-EF7B4D?style=for-the-badge&logo=argo&logoColor=white)](https://github.com/Ishaan2510/ai-task-platform-infra)

</div>

---

## What This Is

AI Task Platform lets users submit text processing tasks through a React frontend. Each task is queued into Redis, picked up asynchronously by a Python worker, and tracked from `pending` to `running` to `success` or `failed` in real time. The entire system runs on Kubernetes with GitOps-driven deployments via Argo CD.

This is not a tutorial project. Every component runs in a container, every deployment is declared as Kubernetes manifests, and every push to `main` triggers a full build-and-deploy pipeline that updates the cluster automatically.

---

## Screenshots

![Dashboard](https://raw.githubusercontent.com/Ishaan2510/ai-task-platform/main/docs/dashboard.png)

![Task Detail](https://raw.githubusercontent.com/Ishaan2510/ai-task-platform/main/docs/task-detail.png)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Backend API | Node.js, Express 5, JWT (HS256), bcrypt |
| Worker | Python 3.11, pymongo, redis-py |
| Database | MongoDB 7 |
| Queue | Redis 7 |
| Containerization | Docker with multi-stage builds and non-root users |
| Orchestration | Kubernetes on Docker Desktop |
| GitOps | Argo CD with auto-sync, prune, and self-heal |
| CI/CD | GitHub Actions |
| Registry | Docker Hub |

---

## Supported Operations

| Operation | Description |
|---|---|
| `uppercase` | Converts input text to uppercase |
| `lowercase` | Converts input text to lowercase |
| `reverse` | Reverses the entire input string |
| `word_count` | Counts words and returns the total |

---

## How It Works

A user submits a task with a title, input text, and an operation. The Express backend creates a task record in MongoDB with status `pending` and pushes the task ID onto a Redis list using `lPush`. A Python worker calls `brpop` in a blocking loop, picks up the ID, marks the task as `running` in MongoDB, executes the operation, and writes the result back with status `success` or `failed` along with timestamped logs. The React frontend polls every 1.5 seconds until the task reaches a terminal state and displays the result inline.

---

## Local Development

**Step 1.** Start MongoDB and Redis via Docker Compose, from the repo root:

```bash
docker compose up mongodb redis -d
```

**Step 2.** Start the backend, from `backend/`:

```bash
npm install
npm run dev
```

**Step 3.** Start the Python worker, from `worker/`:

```bash
pip install -r requirements.txt
python worker.py
```

**Step 4.** Start the frontend, from `frontend/`:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Full Stack via Docker

Run all services together from the repo root:

```bash
docker compose up --build
```

Open `http://localhost:3000`.

---

## Environment Variables

**`backend/.env`**

```
MONGO_URI=mongodb://admin:adminpass@localhost:27017/aitaskplatform?authSource=admin
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=7d
PORT=5000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

**`worker/.env`**

```
MONGO_URI=mongodb://admin:adminpass@localhost:27017/aitaskplatform?authSource=admin
REDIS_URL=redis://localhost:6379
```

---

## Kubernetes Deployment

Manifests live in the companion repository [ai-task-platform-infra](https://github.com/Ishaan2510/ai-task-platform-infra). Apply them in order:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/mongodb/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/worker/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress/
```

---

## CI/CD Pipeline

![Pipeline](https://raw.githubusercontent.com/Ishaan2510/ai-task-platform/main/docs/pipeline.png)

Every push to `main` triggers a three-stage GitHub Actions pipeline:

1. **Lint** — ESLint runs on backend and frontend source. Failures block all subsequent stages.
2. **Build and Push** — Docker images are built for all three services using multi-stage Dockerfiles and pushed to Docker Hub tagged with both `latest` and the short commit SHA.
3. **Update Infra Repo** — The pipeline checks out `ai-task-platform-infra` using a stored secret token, updates the image tags in each deployment manifest via `sed`, commits, and pushes. Argo CD detects the change within minutes and applies it to the cluster.

---

## Argo CD (GitOps)

![Argo CD](https://raw.githubusercontent.com/Ishaan2510/ai-task-platform/main/docs/argocd.png)

Argo CD runs in the `argocd` namespace and watches the `k8s/` directory of the infra repository. Auto-sync, prune, and self-heal are all enabled. Any drift between the cluster and the declared manifests is automatically corrected.

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture document covering worker scaling, high-volume task handling, database indexing strategy, Redis failure recovery, and multi-environment deployment.

---

## Repository Structure

```
ai-task-platform/
├── backend/
│   ├── src/
│   │   ├── config/          db.js, redis.js
│   │   ├── middleware/       auth.js
│   │   ├── models/           User.js, Task.js
│   │   └── routes/           auth.js, tasks.js
│   ├── Dockerfile
│   ├── .dockerignore
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/              axios.js, tasks.js
│   │   ├── components/       TaskCard.jsx, TaskForm.jsx, TaskModal.jsx
│   │   ├── context/          AuthContext.js, AuthProvider.jsx, useAuth.js
│   │   └── pages/            Login.jsx, Register.jsx, Dashboard.jsx
│   ├── nginx.conf
│   └── Dockerfile
├── worker/
│   ├── worker.py
│   ├── requirements.txt
│   └── Dockerfile
├── docs/
│   └── dashboard.png, task-detail.png, argocd.png, pipeline.png
├── docker-compose.yml
├── ARCHITECTURE.md
└── .github/
    └── workflows/
        └── ci-cd.yaml
```

---

*Built by [Ishaan Goswami](https://github.com/Ishaan2510) — CS undergrad, PDEU + IIT Madras*
