# OpenSpec Design: Sprint 2 — Folder Operations & Right-Click Context Menu

## 1. Context & Business Intent
In the Clinevo eTMF 4.3 User Guide (§8.7 & §8.8), the eTMF Repository is structured according to the **DIA TMF Reference Model v3.2** (11 Zones, multiple Sections, and hundreds of Artifacts). Users navigate this folder hierarchy to inspect clinical artifacts, configure Expected Document Lists (EDL / File Plans), add placeholders for expected documents, lock/unlock folders during regulatory lock periods, export folder zip archives, and generate compliant TMF indices.

## 2. Technical Architecture & Components
- **`FolderTree.jsx`**: Left-pane interactive tree component rendering the DIA TMF Reference Model (Zone 01 Trial Management through Zone 11 Statistics). Supports expand/collapse, search filtering, document count badges, and right-click context menu invocation.
- **`FolderContextMenu.jsx`**: Popover context menu triggered on tree node right-click, offering:
  - Add Placeholder (`+ Placeholder`)
  - File Plan / EDL Mapping
  - Generate TMF Index
  - Export Folder (ZIP Archive)
  - Lock / Unlock Folder (Security Admin / TMF Manager)
- **`AddPlaceholderModal.jsx`**: Modal dialog adhering to §8.8 for defining an expected document record before the actual physical document is collected or uploaded.
- **`FilePlanModal.jsx`**: Modal dialog adhering to §8.7 for viewing and adjusting Expected Document List thresholds and milestone delivery targets.

## 3. Backend Endpoints Wired
- `GET /api/folders?studyId=:studyId`
- `POST /api/folders/placeholders`
- `GET /api/folders/file-plans/study/:studyId`
- `GET /api/folders/:id/tmf-index`
- `GET /api/folders/:id/export`
- `POST /api/folders/:id/lock` & `POST /api/folders/:id/unlock`
