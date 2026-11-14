# Design: Migration to Target Microservices Architecture

## Context & Technical Approach
The user requested moving the eTMF system from the monolithic Express + Vite setup to the target enterprise architecture specified in the eTMF Master Agent documentation:
1. **Frontend**: Next.js (App Router / SSR)
2. **API Gateway**: Go API Gateway
3. **AI Processing Service**: Python / FastAPI microservice (Gemini 1.5 Flash + text-embedding-004 + DIA Reference Model v3.2 mapping)

## Architectural Blueprint

```
                      ┌────────────────────────────────────────┐
                      │          Next.js Frontend              │
                      │       (App Router, SSR, Tailwind/CSS)  │
                      └───────────────────┬────────────────────┘
                                          │ HTTP / JSON
                                          ▼
                      ┌────────────────────────────────────────┐
                      │            Go API Gateway              │
                      │  (Gin/Chi, 21 CFR Part 11 Audit, JWT)   │
                      └─────────┬────────────────────┬─────────┘
                                │                    │
                HTTP / gRPC     │                    │  SQL
                                ▼                    ▼
       ┌───────────────────────────────┐     ┌────────────────┐
       │   Python / FastAPI AI Service │     │  eTMF Database │
       │  (Gemini 1.5, DIA v3.2 Engine)│     │  (SQLite / PG) │
       └───────────────────────────────┘     └────────────────┘
```

## Proposed Changes

### 1. Go API Gateway (`services/api-gateway/`)
- Pure Go HTTP router (using Go standard library or Gin)
- Modules:
  - Authentication & 21 CFR Part 11 JWT sessions
  - Document Management, Check-in/out, Versioning
  - DIA TMF v3.2 Reference Model hierarchy
  - Workflow State Machine transitions & e-signatures
  - Quality Control (QC) query management
  - Reverse proxy / delegate to AI service for `/api/ai/orchestrate`
  - Health check (`GET /health`)

### 2. Python FastAPI AI Service (`services/ai-service/`)
- FastAPI app running on port 8000 (or proxy port)
- Endpoints:
  - `POST /api/v1/orchestrate`: Ingests document text, runs Gemini 1.5 Flash client with exact structured JSON schema, evaluates Condition A / B / C, returns deterministic routing payload.
  - `GET /api/v1/schema`: Exposes DIA Reference Model v3.2 schema.
  - `GET /health`: Microservice health check.
- High-fidelity clinical NLP fallback engine when GEMINI_API_KEY is not set.

### 3. Next.js Frontend (`frontend/` or `apps/web/`)
- Next.js (App Router, React 19)
- Layout (`app/layout.jsx`), Main Dashboard (`app/page.jsx`)
- Full port of interactive consoles:
  - Repository (FolderTree + Document Table)
  - My Tasks (SLA tracker + e-signatures)
  - Quality Control (Defect logging + resolution)
  - Forms/Logs (ICH GCP log builder + one-click eTMF push)
  - Reports & Analytics Suite (8 tabs)
  - Security Admin (Users, Groups, 21 Functional Roles)
  - Application Admin & Study Setup Wizard (4-step guided wizard)
  - System Admin & Manage Enterprise

## Verification Strategy
- Go unit & integration tests (`go test ./...`)
- Python pytest suite (`pytest tests/`)
- Next.js build verification (`npm run build`)
- End-to-end integration test verifying Go Gateway -> FastAPI AI Service -> Next.js Frontend
