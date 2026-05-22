<div align="center">

# Cortex

**A multi-user AI-powered content processing workspace built on the MERN stack with a Python worker, intelligent multi-provider LLM routing, Redis queue, Docker, and Kubernetes.**

Task-aware LLM routing with automatic fallback · File-aware processing (PDF and images) · Real-time task tracking · GitOps deployment

[![GitHub Actions](https://img.shields.io/badge/CI/CD-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/Ishaan2510/cortex/actions)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://hub.docker.com/u/ishaan102)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Orchestrated-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)](https://github.com/Ishaan2510/cortex-infra)
[![Argo CD](https://img.shields.io/badge/Argo_CD-GitOps-EF7B4D?style=for-the-badge&logo=argo&logoColor=white)](https://github.com/Ishaan2510/cortex-infra)

</div>

---

## What This Is

Cortex is a personal AI workspace where users submit text, PDFs, or images and run one of ten preset operations or a fully custom prompt against them. Each task is queued into Redis, picked up asynchronously by a Python worker, and routed across four LLM providers — Groq, Cerebras, Gemini, and OpenRouter — using task-aware intelligent routing with automatic fallback on rate limit or error. The entire system runs on Kubernetes with GitOps-driven deployments via Argo CD.

This is not a tutorial project. Every component runs in a container, every deployment is declared as Kubernetes manifests, and every push to `main` triggers a full build-and-deploy pipeline that updates the cluster automatically.

---

## Screenshots

![Dashboard](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/dashboard.png)

![Task Detail](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/task-detail.png)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Backend API | Node.js, Express 5, JWT (HS256), bcrypt, Multer |
| Worker | Python 3.11, pymongo, redis-py, PyMuPDF |
| LLM Providers | Groq (Llama 3.3 70B), Cerebras (Llama 3.3 70B), Google Gemini 2.0 Flash, OpenRouter (Llama 3.3 70B free) |
| File Storage | Cloudinary |
| Database | MongoDB 7 |
| Queue | Redis 7 |
| Containerization | Docker with multi-stage builds and non-root users |
| Orchestration | Kubernetes on Docker Desktop |
| GitOps | Argo CD with auto-sync, prune, and self-heal |
| CI/CD | GitHub Actions |
| Registry | Docker Hub |

---

## Supported Operations

Ten preset operations plus a fully custom prompt mode. Each preset has a hand-tuned system prompt defined in `worker/operations.py`.

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

---

## LLM Routing Strategy

The worker selects an ordered chain of providers per task based on three signals: the operation, the input length, and whether the input contains an image. The first provider in the chain is tried first; on rate limit (429), quota exhaustion, or any other error the worker falls back to the next provider in the chain automatically.

| Signal | Routing decision |
|---|---|
| Image input | Gemini first (only multimodal provider in the chain), OpenRouter fallback |
| Long input (>15,000 chars) | Gemini first (1M context window), then Cerebras, then OpenRouter |
| Reasoning operations (action items, key decisions, explain simply) | Groq → Cerebras → Gemini → OpenRouter |
| Speed operations (default) | Groq → Cerebras → Gemini → OpenRouter |

The full chain attempted is stored on the task in `providerChain` along with the final provider in `providerUsed`. The UI displays both so the user can see exactly how the result was produced and which fallbacks were hit.

---

## How It Works

A user submits a task with a title, an operation (preset or custom), and either text input, a file (PDF or image up to 10MB), or both. The Express backend uploads any attached file directly to Cloudinary via Multer's `CloudinaryStorage`, creates a task record in MongoDB with status `pending`, and pushes the task ID onto a Redis list using `lPush`. A Python worker calls `brpop` in a blocking loop, picks up the ID, marks the task as `running` in MongoDB, downloads and extracts the file content (PyMuPDF for PDFs, base64 for images), builds a system prompt for the selected operation, routes the request through the appropriate provider chain, and writes the result back with status `success` or `failed` along with timestamped logs and the full provider chain attempted. The React frontend polls every 1.5 seconds until the task reaches a terminal state and displays the result inline with markdown rendering.

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

The backend and worker both load environment variables from `.env.local` (local dev) or `.env.docker` (when running in containers), selected via the `APP_ENV` variable.

**`backend/.env.local`**

```
APP_ENV=local
MONGO_URI=mongodb://admin:adminpass@localhost:27017/aitaskplatform?authSource=admin
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=7d
PORT=5000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**`worker/.env.local`**

```
APP_ENV=local
MONGO_URI=mongodb://admin:adminpass@localhost:27017/aitaskplatform?authSource=admin
REDIS_URL=redis://localhost:6379

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

GROQ_API_KEY=your_groq_key
CEREBRAS_API_KEY=your_cerebras_key
GOOGLE_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key
```

All four LLM provider keys are free to obtain — sign up at `console.groq.com`, `cloud.cerebras.ai`, `aistudio.google.com`, and `openrouter.ai`. Cloudinary also has a generous free tier that covers this project comfortably.

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

---

## CI/CD Pipeline

![Pipeline](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/pipeline.png)

Every push to `main` triggers a three-stage GitHub Actions pipeline:

1. **Lint** — ESLint runs on backend and frontend source. Failures block all subsequent stages.
2. **Build and Push** — Docker images are built for all three services using multi-stage Dockerfiles and pushed to Docker Hub tagged with both `latest` and the short commit SHA.
3. **Update Infra Repo** — The pipeline checks out the infra repository using a stored secret token, updates the image tags in each deployment manifest via `sed`, commits, and pushes. Argo CD detects the change within minutes and applies it to the cluster.

---

## Argo CD (GitOps)

![Argo CD](https://raw.githubusercontent.com/Ishaan2510/cortex/main/docs/argocd.png)

Argo CD runs in the `argocd` namespace and watches the `k8s/` directory of the infra repository. Auto-sync, prune, and self-heal are all enabled. Any drift between the cluster and the declared manifests is automatically corrected.

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full architecture document covering LLM routing, file processing, worker scaling, high-volume task handling, database indexing, Redis failure recovery, and multi-environment deployment.

---

## Repository Structure

```
cortex/
├── backend/
│   ├── src/
│   │   ├── config/          db.js, redis.js, cloudinary.js, upload.js
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
│   ├── llm_router.py
│   ├── operations.py
│   ├── file_processor.py
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