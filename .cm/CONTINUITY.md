# Project Continuity — eTMF Pro

## Project Identity & Architecture
- **Project**: eTMF Pro (Enterprise Electronic Trial Master File)
- **Target Architecture**: Next.js App Router (Frontend) → Express / Go (API Gateway) → Python FastAPI AI Engine backed by SQLite/PostgreSQL
- **Compliance Standards**: ICH GCP E6(R2), 21 CFR Part 11, EU Annex 11, ALCOA+, DIA TMF Reference Model v3.2
- **User Guide Reference**: Clinevo eTMF 4.3 / 4.4 Enterprise User Guide

## Core Operational Rules
> **Mandatory Branching Protocol**: For any new feature development or testing:
> 1. Always branch off `main` to a dedicated branch: `git checkout -b feature/<feature-name>` (or `test/<feature-name>`).
> 2. Implement, test, and perform clean code gates exclusively on the branch.
> 3. Verify all test suites (unit, integration, build, lint) pass 100%.
> 4. Merge back to `main` only after full verification is complete and confirmed.

## Completed Milestones
- **Audit Deliverable**: Full 216-capability audit completed; `ETMF_FEATURE_GAP_ANALYSIS.md` (2,763 lines, 238 KB) generated; `teamwork_victory_auditor` confirmed `VICTORY CONFIRMED`.
- **Sprint 1-5**: Core document modals, DIA TMF Folder Tree & EDL File Plan, 21 CFR Part 11 Electronic Signatures, Ingestion & Bulk Download, Regulatory Inspection Mode & Quality Control Center.
- **In-App Document Viewer**: Inline viewer with stream endpoint `GET /api/documents/:id/view` and Part 11 metadata sidebar.
- **KPI Metrics Fix**: Status filtering rectified to achieve exact equality (`Published + Approved + In QC / Review = Total Records`).

## Active Initiative
- **Initiative**: Phase-Wise Implementation of 99 Partially Implemented Features
- **Current Phase**: Planning & User Alignment (`cm-planning` & `/plan`)
- **Active Goal**: Bring 99 partially implemented eTMF capabilities to 100% full implementation across 5 structured phases.
- **Next Actions**:
  1. `1.1`: Dual-component e-signature re-authentication (username + password)
  2. `1.2`: Binary file SHA-256 digest hashing upon upload
  3. `1.3`: Server-side PDF rendition engine for cover pages, manifests, and watermarks
- **Working Context & Key Decisions**:
  - Phase 1 focuses strictly on 21 CFR Part 11, cryptographic non-repudiation, and authentication security.
  - In-process `pdf-lib` chosen for lightweight, deterministic cover page/signature manifest generation.
  - Branching rule strictly enforced: each phase begins with a dedicated `git checkout -b feature/...` branch.
