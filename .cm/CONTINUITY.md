# Project Continuity — eTMF Pro

## Project Identity
- **Project**: eTMF Pro (Electronic Trial Master File)
- **Architecture**: Vite + React 19 SPA Frontend, Express 4 + Better-SQLite3 Backend
- **Compliance**: ICH E6(R2), 21 CFR Part 11, EU Annex 11, ALCOA+, DIA TMF Reference Model v3.2
- **User Guide Reference**: Clinevo eTMF 4.3 / 4.4 User Guide

## Current Active Sprint
- **Sprint**: Sprint 4 — Ingestion Engine & Bulk Upload (PDF §8.6) [COMPLETED]
- **Goal**: Implement multi-file drag-and-drop batch ingestion, automatic DIA Reference Model zone/section extraction from filenames, pre-upload file validation (up to 500 MB), multi-selection table checkboxes, and compliant bulk export package builder.
- **Evidence**:
  - `DocumentUploadModal.jsx` (§8.6) provides multi-file intake queue, auto-parsing `ZZ.SS.AA` DIA codes, metadata configuration, and multipart upload to `POST /api/documents`.
  - `BulkDownloadModal.jsx` (§8.10.10) generates controlled ZIP / merged PDF packages with audit trail stamps and watermark overlays.
  - Table selection checkboxes wired in `App.jsx` for granular multi-document operations.
  - `npm run build` in `frontend/`: 0 errors (88 modules transformed, 343 kB bundle).
  - `npm test` in backend: 49/49 tests passed (100% idempotent).

## Next Sprint
- **Sprint 5**: Regulatory Inspection Mode & Quality Control (§8.14 & §9)
- **Goal**: Implement Inspector-Read-Only Mode toggle, regulatory blind enforcement, QC review findings dashboard, and inspection package lockdown.

## Working Memory Log
- [2026-11-09]: CORS 500 preflight resolved; PORT isolated to 3002; `ROLE_CAPS['TMF Manager']` updated with `canAdmin: true`.
- [2026-11-09]: eTMF 4.3 functional audit completed (56 implemented, 32 partial, 15 missing); comprehensive roadmap published to `roadmap.md` and committed to git (`5ad9687`).
- [2026-11-09]: Sprint 1 completed with all 8 modals, test suite 100% green, and committed (`1358702`).
- [2026-11-09]: Sprint 2 completed with DIA TMF Folder Tree, Folder Context Menu, Add Placeholder, File Plan EDL, test suite 49/49 green (`a9ba461`).
- [2026-11-09]: Clean code refactor modularized LoginScreen, DocumentViewer, DynamicModule, DocumentContextMenu (`dedf42b`).
- [2026-11-09]: Sprint 3 completed with WorkflowAdvanceModal, ESignatureModal, AuditHistoryModal, test suite 49/49 green (`1c62571`).
- [2026-11-09]: Sprint 4 completed with DocumentUploadModal, BulkDownloadModal, multi-select checkboxes, test suite 49/49 green.
