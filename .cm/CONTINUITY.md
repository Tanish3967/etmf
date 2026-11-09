# Project Continuity — eTMF Pro

## Project Identity
- **Project**: eTMF Pro (Electronic Trial Master File)
- **Architecture**: Vite + React 19 SPA Frontend, Express 4 + Better-SQLite3 Backend
- **Compliance**: ICH E6(R2), 21 CFR Part 11, EU Annex 11, ALCOA+, DIA TMF Reference Model v3.2
- **User Guide Reference**: Clinevo eTMF 4.3 / 4.4 User Guide

## Current Active Sprint
- **Sprint**: Sprint 2 — Folder Operations & Right-Click Context Menu (PDF §8.7 & §8.8) [COMPLETED]
- **Goal**: Implement DIA TMF Model v3.2 tree navigation (`FolderTree.jsx`), folder context menu (`FolderContextMenu.jsx`), Expected Document List / File Plan modal (`FilePlanModal.jsx`), and Add Placeholder dialog (`AddPlaceholderModal.jsx`).
- **Evidence**:
  - `FolderTree.jsx` renders complete 11-Zone DIA TMF Reference Model hierarchy with live search and expand/collapse.
  - Repository view in `App.jsx` elevated to full split-pane view (tree navigation + document records).
  - `FolderContextMenu.jsx` triggers Add Placeholder, File Plan, TMF Index generation, Folder Export, and Lock/Unlock.
  - `npm run build` in `frontend/`: 0 errors (79 modules transformed, 311 kB bundle).
  - `npm test` in backend: 49/49 tests passed (100% idempotent).

## Next Sprint
- **Sprint 3**: Workflow Orchestration & 21 CFR Part 11 Electronic Signature Modal (PDF §8.11, §8.12, §8.13)
- **Goal**: Transition documents through states (`Draft` -> `Pending Review` -> `Review Complete` -> `Pending Approval` -> `Approved` / `Published`), with authentic 21 CFR Part 11 electronic signature modal requiring re-authentication, signer role, and ALCOA+ meaning of signing.

## Working Memory Log
- [2026-11-09]: CORS 500 preflight resolved; PORT isolated to 3002; `ROLE_CAPS['TMF Manager']` updated with `canAdmin: true`.
- [2026-11-09]: eTMF 4.3 functional audit completed (56 implemented, 32 partial, 15 missing); comprehensive roadmap published to `roadmap.md` and committed to git (`5ad9687`).
- [2026-11-09]: Sprint 1 completed with all 8 modals, test suite 100% green, and committed (`1358702`).
- [2026-11-09]: Sprint 2 completed with DIA TMF Folder Tree, Folder Context Menu, Add Placeholder, File Plan EDL, test suite 49/49 green.
