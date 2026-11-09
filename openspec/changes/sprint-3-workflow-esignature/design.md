# OpenSpec Design: Sprint 3 — Workflow Orchestration & 21 CFR Part 11 Electronic Signature

## 1. Context & Regulatory Intent
In clinical eTMF operations (ICH E6(R2) & 21 CFR Part 11 §11.200), document lifecycle progression cannot occur through arbitrary database flags. Documents must strictly follow a defined state machine:
`Draft` → `Pending Review` → `Review Complete` → `Pending Approval` → `Approved` → `Published` / `Superseded`.
Furthermore, transitioning to `Approved` legally requires an Electronic Signature (e-signature) consisting of:
1. Biometric / Password Re-authentication (verifying the identity of the current logged-in user at the moment of signing).
2. Printed Name of the Signer.
3. User Role & Date/Timestamp.
4. Mandatory Legal Meaning of Signature (e.g. "I approve this document for trial operations").
5. Non-repudiation cryptographic checksum (SHA-256 signature hash).

## 2. Technical Architecture
- **`WorkflowAdvanceModal.jsx`**: Modal showing allowed next states calculated dynamically from current state, comment box for audit trail, and capability validation.
- **`ESignatureModal.jsx`**: High-security dialog executing 21 CFR Part 11 electronic signature capture with password re-auth, legal meaning dropdown, and live signature preview.
- **`AuditHistoryModal.jsx`**: Detailed audit trail viewer listing all past transitions, user signatures, timestamps, IP addresses, and transition notes.
- **Integration Points**:
  - `DocumentContextMenu.jsx`: "Advance Workflow" item.
  - `DocumentViewer.jsx`: "Advance Workflow" and "Sign Document" buttons in the top navbar.
  - Live reload of document table and viewer upon completion.

## 3. Endpoints Wired
- `POST /api/workflow/:docId/transition` with payload `{ nextState, comment, credentials: { password, meaning } }`
- `GET /api/documents/:id/versions`
- `GET /api/workflow/tasks`
