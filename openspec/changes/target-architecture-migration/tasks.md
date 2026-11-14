# Implementation Checklist: Target Architecture Migration

## 1. Python FastAPI AI Processing Service (`services/ai-service/`)
- [ ] 1.1 Create `services/ai-service/app/schemas.py` defining Pydantic models for DIA v3.2 mapping & QC flags.
- [ ] 1.2 Create `services/ai-service/app/orchestrator.py` implementing Gemini 1.5 Flash client with retry and clinical fallback.
- [ ] 1.3 Create `services/ai-service/app/routing.py` implementing Condition A, Condition B, Condition C routing logic.
- [ ] 1.4 Create `services/ai-service/app/main.py` with FastAPI endpoints (`/api/v1/orchestrate`, `/api/v1/schema`, `/health`).
- [ ] 1.5 Create requirements.txt and automated verification test script `services/ai-service/test_ai_service.py`.

## 2. Go API Gateway (`services/api-gateway/`)
- [ ] 2.1 Initialize Go module (`go.mod`) with Go 1.24.
- [ ] 2.2 Create `services/api-gateway/internal/models/` defining Go structs for Auth, Documents, Queries, Audit, and AI payloads.
- [ ] 2.3 Create `services/api-gateway/internal/handlers/` implementing Health, Auth, Documents, Studies, QC, and AI delegation.
- [ ] 2.4 Create `services/api-gateway/cmd/server/main.go` wiring routes, CORS, 21 CFR Part 11 headers, and server startup.
- [ ] 2.5 Create Go test suite `services/api-gateway/cmd/server/main_test.go` and verify with `go test ./...`.

## 3. Next.js Frontend Migration (`frontend/`)
- [ ] 3.1 Install and configure Next.js in `frontend/` (Next.js App Router).
- [ ] 3.2 Create `frontend/app/layout.jsx` and `frontend/app/page.jsx` integrating the complete eTMF Pro workspaces.
- [ ] 3.3 Ensure all 10 clinical consoles connect to the Go API Gateway and AI Orchestrator.
- [ ] 3.4 Verify clean build with `npm --prefix frontend run build`.

## 4. End-to-End System Verification
- [ ] 4.1 Run integration test verifying Go API Gateway, Python FastAPI service, and Next.js bundle.
- [ ] 4.2 Verify 100% green test passes across all services.
