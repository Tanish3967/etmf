# OpenSpec Design: Sprint 5 — Regulatory Inspection Mode & Quality Control

## 1. Context & Regulatory Intent
During health authority inspections (FDA 21 CFR Part 11, EMA Annex 11, MHRA GCP), inspectors must be provided immediate, secure, read-only access to clinical records without allowing any modification, deletion, or premature unblinding of randomized data (ICH E6(R2) §5.5).
Furthermore, Sponsors and CROs require a dedicated **Quality Control (QC) Center** (User Guide §9) to triage queries, review defects, log resolutions, and maintain an inspection-ready state.

## 2. Technical Architecture
- **`InspectorModeBanner.jsx`**: Global persistent inspection banner highlighting active audit authority, read-only lockout, and inspector logging.
- **`QualityControlCenter.jsx`**: Clinical QC dashboard rendering findings metrics (Open, Critical, Resolved, Pass Rate), severity badges, defect categorization, and resolution dialogs connecting to `/api/qc`.
- **Inspector Mode Enforcements**:
  - Hides modifying actions (+ Add Document, Checkout, Redact, Inactivate).
  - Enforces blinded document protection.
  - Automatically logs inspector views to the backend audit log.
