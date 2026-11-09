# Project Continuity — eTMF Pro

## Project Identity
- **Project**: eTMF Pro (Electronic Trial Master File)
- **Architecture**: Vite + React 19 SPA Frontend, Express 4 + Better-SQLite3 Backend
- **Compliance**: ICH E6(R2), 21 CFR Part 11, EU Annex 11, ALCOA+, DIA TMF Reference Model v3.2
- **User Guide Reference**: Clinevo eTMF 4.3 / 4.4 User Guide

## Current Active Sprint
- **Sprint**: Sprint 1 — Document Context Action Modals (PDF §8.10) [COMPLETED]
- **Goal**: Implement high-fidelity modal dialogs for the 25 document context actions (Metadata Editor, Redaction Canvas, Sticky Notes, Blinding/Unblinding, Raise Query, Link/Delink, Document History, and Compliant Download with Coverpage/Watermark) replacing generic alert stubs.
- **Evidence**:
  - `frontend/src/components/document/` contains 8 production-grade modals.
  - `frontend/src/App.jsx` context menu completely wired to modal triggers and live API mutations.
  - `npm run build` in `frontend/`: 0 errors (75 modules transformed, 287 kB bundle).
  - `npm test` in backend: 49/49 tests passed (100%).

## Next Sprint
- **Sprint 2**: Folder Operations & Right-Click Context Menu (PDF §8.7 & §8.8)
- **Goal**: Implement Folder Context Menu (`FolderContextMenu.jsx`), EDL / File Plan assignment modal (`FilePlanModal.jsx`), and Add Placeholder dialog (`AddPlaceholderModal.jsx`).

## Working Memory Log
- [2026-11-09]: CORS 500 preflight resolved; PORT isolated to 3002; `ROLE_CAPS['TMF Manager']` updated with `canAdmin: true`.
- [2026-11-09]: eTMF 4.3 functional audit completed (56 implemented, 32 partial, 15 missing); comprehensive roadmap published to `roadmap.md` and committed to git (`5ad9687`).
- [2026-11-09]: CodyMaster protocol activated. Sprint 1 completed with all 8 modals, test suite 100% green, and frontend build verified.
