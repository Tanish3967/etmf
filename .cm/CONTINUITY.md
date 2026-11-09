# Project Continuity — eTMF Pro

## Project Identity
- **Project**: eTMF Pro (Electronic Trial Master File)
- **Architecture**: Vite + React 19 SPA Frontend, Express 4 + Better-SQLite3 Backend
- **Compliance**: ICH E6(R2), 21 CFR Part 11, EU Annex 11, ALCOA+, DIA TMF Reference Model v3.2
- **User Guide Reference**: Clinevo eTMF 4.3 / 4.4 User Guide

## Current Active Sprint
- **Sprint**: Sprint 3 — Workflow Orchestration & 21 CFR Part 11 Electronic Signature (PDF §8.11, §8.12, §8.13) [COMPLETED]
- **Goal**: Full lifecycle state machine transitions (`Draft` ➔ `Pending Review` ➔ `Review Complete` ➔ `Pending Approval` ➔ `Approved` ➔ `Superseded`), with legally binding 21 CFR Part 11 electronic signature modal requiring password re-authentication, signer role, and ALCOA+ meaning of signing.
- **Evidence**:
  - `WorkflowAdvanceModal.jsx` (§8.11) implements dynamic next-state calculation and SLA deadline guidance.
  - `ESignatureModal.jsx` (§8.12) enforces password re-authentication, Part 11 legal declaration, and SHA-256 digital seal.
  - `AuditHistoryModal.jsx` (§8.13) renders full timeline lineage with inspector certificate export.
  - `DocumentContextMenu.jsx` and `DocumentViewer.jsx` wired with live transition and signing triggers.
  - `npm run build` in `frontend/`: 0 errors (86 modules transformed, 329 kB bundle).
  - `npm test` in backend: 49/49 tests passed (100% idempotent).

## Next Sprint
- **Sprint 4**: Ingestion Engine & Bulk Upload (PDF §8.6)
- **Goal**: Implement Drag-and-drop batch file ingestion, automatic DIA Reference Model zone/section extraction, duplicate detection, and file quarantine inspection.

## Working Memory Log
- [2026-11-09]: CORS 500 preflight resolved; PORT isolated to 3002; `ROLE_CAPS['TMF Manager']` updated with `canAdmin: true`.
- [2026-11-09]: eTMF 4.3 functional audit completed (56 implemented, 32 partial, 15 missing); comprehensive roadmap published to `roadmap.md` and committed to git (`5ad9687`).
- [2026-11-09]: Sprint 1 completed with all 8 modals, test suite 100% green, and committed (`1358702`).
- [2026-11-09]: Sprint 2 completed with DIA TMF Folder Tree, Folder Context Menu, Add Placeholder, File Plan EDL, test suite 49/49 green (`a9ba461`).
- [2026-11-09]: Clean code refactor modularized LoginScreen, DocumentViewer, DynamicModule, DocumentContextMenu (`dedf42b`).
- [2026-11-09]: Sprint 3 completed with WorkflowAdvanceModal, ESignatureModal, AuditHistoryModal, test suite 49/49 green.
