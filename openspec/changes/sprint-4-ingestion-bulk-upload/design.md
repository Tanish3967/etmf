# OpenSpec Design: Sprint 4 — Ingestion Engine & Bulk Upload

## 1. Context & Business Intent
Under **Clinevo eTMF 4.3 §8.6**, the ingestion engine is the primary entry point for trial documents. Documents arrive from CROs, investigators, and laboratory vendors. The ingestion system must support:
1. Multi-file Drag & Drop batch intake.
2. DIA TMF Reference Model Auto-Classification (parsing filenames matching `ZZ.SS.AA` pattern into Zone, Section, and Artifact).
3. Pre-upload format and size verification (PDF, DOCX, XLSX, MSG, ZIP <= 500MB).
4. Metadata assignment (Study, Site, Country, Version, Confidentiality).
5. Progress reporting per file with upload error recovery.
6. Multi-select bulk export/download for auditor inspections.

## 2. Technical Architecture
- **`DocumentUploadModal.jsx`**: Drag-and-drop zone with multi-file queue, auto-parsing DIA codes, metadata editor form, and multipart `FormData` dispatcher to `POST /api/documents`.
- **`BulkDownloadModal.jsx`**: Batch zip/download packager for selected documents in the repository grid.
- **Integration in `App.jsx`**:
  - `+ Add Document` button launches `DocumentUploadModal`.
  - `◪ Bulk Download` button launches `BulkDownloadModal` for checked documents.
  - Checkbox selection in repository table synced with bulk download state.
