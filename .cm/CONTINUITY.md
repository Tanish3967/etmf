# Project Continuity — eTMF Pro

## Project Identity & Architecture
- **Project**: eTMF Pro (Enterprise Electronic Trial Master File)
- **Target Architecture**: Next.js App Router (Frontend) → Go 1.24 (API Gateway) → Kafka (Event Queue) → Python 3.10 FastAPI (AI Orchestration Engine) backed by SQLite/Postgres (Audit & Storage)
- **Compliance Standards**: ICH GCP E6(R2), 21 CFR Part 11, EU Annex 11, ALCOA+, DIA TMF Reference Model v3.2
- **User Guide Reference**: Clinevo eTMF 4.3 / 4.4 Enterprise User Guide

## Core Operational Rules
> **Mandatory Branching Protocol**: For any new feature development or testing:
> 1. Always branch off `main` to a dedicated branch: `git checkout -b feature/<feature-name>` (or `test/<feature-name>`).
> 2. Implement, test, and perform clean code gates exclusively on the branch.
> 3. Verify all test suites (unit, integration, build, lint) pass 100%.
> 4. Merge back to `main` only after full verification is complete and confirmed.

## Completed Milestones
- **Sprint 1-5**: 8 Core document modals, DIA TMF Folder Tree & EDL File Plan, 21 CFR Part 11 Electronic Signatures, Ingestion & Bulk Download, Regulatory Inspection Mode & Quality Control Center.
- **AI Document Orchestration**: Google AI Studio Gemini 1.5 Flash client with DIA v3.2 schema, clinical NLP fallback, and Condition A/B/C state routing.
- **Target Microservices**: Go 1.24 API Gateway (`services/api-gateway`), Python FastAPI AI Engine (`services/ai-service`), Next.js App Router (`frontend/src/app`).
- **Clean Code Hygiene**: 0 lint errors, 0 warnings across frontend and microservices.

## Current Active Sprint
- **Sprint**: Sprint 5 — Regulatory Inspection Mode & Quality Control (§8.14 & §9) [COMPLETED]
- **Goal**: Implement FDA/EMA/MHRA Regulatory Inspection Mode toggle, read-only mutation lockout, persistent golden audit banner, and dedicated Quality Control Center dashboard with defect triage and ALCOA+ resolution logging.
- **Evidence**:
  - `InspectorModeBanner.jsx` (§8.14) renders persistent regulatory audit banner and enforces read-only controls.
  - `QualityControlCenter.jsx` (§9) provides KPI defect metrics (Open, Critical, Pass Rate), severity filters, and resolution flow to `PATCH /api/qc/:id`.
  - Inspector Mode toggle active in `App.jsx` header.
  - `npm run build` in `frontend/`: 0 errors (90 modules transformed, 356 kB bundle).
  - `npm test` in backend: 49/49 tests passed (100% idempotent).

## Next Sprint
- **Sprint 6**: AI Assisted Auto-Classification & Quality Scoring (§8.6.2 & §8.9)
- **Goal**: Visual confidence gauges (Green >85%, Amber 60-85%, Red <60%), AI recommendation review banner, human-in-the-loop override logging to `ai_audit`.

## Working Memory Log
- [2026-11-09]: CORS 500 preflight resolved; PORT isolated to 3002; `ROLE_CAPS['TMF Manager']` updated with `canAdmin: true`.
- [2026-11-09]: eTMF 4.3 functional audit completed (56 implemented, 32 partial, 15 missing); comprehensive roadmap published to `roadmap.md` and committed to git (`5ad9687`).
- [2026-11-09]: Sprint 1 completed with all 8 modals, test suite 100% green, and committed (`1358702`).
- [2026-11-09]: Sprint 2 completed with DIA TMF Folder Tree, Folder Context Menu, Add Placeholder, File Plan EDL, test suite 49/49 green (`a9ba461`).
- [2026-11-09]: Clean code refactor modularized LoginScreen, DocumentViewer, DynamicModule, DocumentContextMenu (`dedf42b`).
- [2026-11-09]: Sprint 3 completed with WorkflowAdvanceModal, ESignatureModal, AuditHistoryModal, test suite 49/49 green (`1c62571`).
- [2026-11-09]: Sprint 4 completed with DocumentUploadModal, BulkDownloadModal, multi-select checkboxes, test suite 49/49 green (`ced8fe1`).
- [2026-11-09]: Sprint 5 completed with InspectorModeBanner, QualityControlCenter, test suite 49/49 green.
