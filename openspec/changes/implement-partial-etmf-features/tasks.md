# Implementation Checklist: 99 Partially Implemented eTMF Capabilities

## Phase 1: 21 CFR Part 11 Compliance & Core Security Hardening (18 items)
- [ ] **1.1 Dual-Component Re-Authentication**: Update `ESignatureModal.jsx` and `POST /api/workflow/:docId/transition` to require both `username` and `password` on every electronic signature action (§11.200).
- [ ] **1.2 Binary File Digest Hashing**: Compute SHA-256 digest of file binary on upload in `src/routes/documents.js`; store `file_sha256` in `documents` table and cryptographically bind to signature records (§11.70).
- [ ] **1.3 Server-Side PDF Rendition Pipeline**: Install `pdf-lib` and implement `src/services/pdfRendition.js` to dynamically generate Cover Pages, Signature Manifests, and Watermarks on document download/export (§11.50).
- [ ] **1.4 Password Policy Enforcement**: Enforce minimum length (8), uppercase, lowercase, digit, special char, and 90-day expiry in `src/routes/auth.js` and `LoginScreen.jsx` (§3).
- [ ] **1.5 Password Reuse Cycle**: Implement `password_history` table in `src/database.js` to reject reuse of the previous 5 passwords.
- [ ] **1.6 Account Lockout Logic**: Track `failed_login_attempts` in `users` table; lock user account after 3 consecutive invalid attempts (§3).
- [ ] **1.7 First-Time Login Mandatory Reset**: Enforce `must_change_password` flag redirecting user to password change screen on initial login.
- [ ] **1.8 Session Inactivity Timeout**: Implement 10-minute idle session detection via `useIdleTimer` in `frontend/src/App.jsx` with automatic logout (§5).
- [ ] **1.9 Dynamic Tenant Context**: Remove hardcoded `tenant-001` in `frontend/src/api.js`; derive tenant strictly from authenticated JWT token.
- [ ] **1.10 Part 11 Logout Audit**: Log explicit user logout events with IP and session duration to `audit_trail` table.
- [ ] **1.11 Multi-Factor Authentication Verification**: Complete TOTP MFA verification flow with recovery codes in `src/routes/auth.js`.
- [ ] **1.12 Verification Gate Phase 1**: Run `npm test`, verify dual-auth signature with test documents, verify SHA-256 binding, test idle timeout, and run `npm --prefix frontend run build`.

## Phase 2: Clinical Workflow State Machine & Task Grid SLA Engine (18 items)
- [ ] **2.1 Extended Lifecycle States**: Expand `WF_TRANSITIONS` in `src/routes/workflow.js` to support `Under Review`, `Review Rejected`, `Approve Rejected`, `Pending Signoff`, `Signed Off`, `Pending Publish`, `Published`, and `Unpublish`.
- [ ] **2.2 Segregation of Duties**: Enforce validation guards in `src/routes/workflow.js` prohibiting document author from self-reviewing or self-approving (`req.user.id !== document.author_id`).
- [ ] **2.3 Configurable Workflow Archetypes**: Build logic for 6 workflow models (AutoPublish, Review & Approve, All Reviewers, Only Review, Only Approve) in `src/routes/workflow.js`.
- [ ] **2.4 Task Grid Buckets**: Update `MyTasksWorkspace.jsx` and backend `GET /api/workflow/tasks` to partition tasks into Pending Review, Pending Approval, Pending Signoff, and Pending Publish.
- [ ] **2.5 SLA Calculation Engine**: Implement automated SLA deadline calculation based on workflow configuration and document creation timestamp.
- [ ] **2.6 SLA Visual Indicators**: Add color-coded badges (RED overdue, YELLOW due in <48h, GREEN on track) in `MyTasksWorkspace.jsx` and `RepositoryTable.jsx`.
- [ ] **2.7 Task Grid Context Actions**: Enable right-click / action menu directly on Task Grid rows.
- [ ] **2.8 Task Grid Direct Navigation**: Ensure clicking task links navigates directly to document and selects the active folder.
- [ ] **2.9 Verification Gate Phase 2**: Run workflow transition test suites across all 15 states, test author-rejection guard, test SLA calculation, and run `npm --prefix frontend run build`.

## Phase 3: Repository Center, Dynamic DIA v3.2 & Folder Operations (16 items)
- [ ] **3.1 Dynamic DIA Hierarchy**: Refactor `FolderTree.jsx` to fetch active zones, sections, and artifacts from `GET /api/studies/:studyId/hierarchy` backed by `dia_model_items`.
- [ ] **3.2 Study → Country → Site Scoping**: Implement 3-tier folder relationship in `src/database.js` and frontend navigation.
- [ ] **3.3 6-Metric Node Badges**: Compute *Total, Completed, In Progress, In QC, Missing, Expected* counts per folder node in SQL and display in `FolderTree.jsx`.
- [ ] **3.4 Folder Context Menu Actions**: Complete Assign User Group, Lock/Unlock Study, Export Documents, and Properties in `FolderContextMenu.jsx`.
- [ ] **3.5 User-Level vs Enterprise Pinning**: Differentiate personal folder pins from enterprise-wide pins.
- [ ] **3.6 File Plan (EDL) Resync**: Implement EDL synchronization and reconciliation in `FilePlanModal.jsx`.
- [ ] **3.7 Milestone Due Dates**: Support Planned vs Actual milestone date entry and overdue tracking per folder.
- [ ] **3.8 Add Placeholder with Justification**: Complete placeholder modal requiring reason for omission/delay.
- [ ] **3.9 Batch Upload AI Classifier Integration**: Connect multi-file ingestion modal with classification confidence scores.
- [ ] **3.10 Verification Gate Phase 3**: Test dynamic tree loading, verify 6-metric badge counts against database, test folder locking, and run `npm --prefix frontend run build`.

## Phase 4: Document Lifecycle, Versioning & Collaboration Controls (23 items)
- [ ] **4.1 Check-Out Version Locking**: Mark document as locked by user; prevent concurrent uploads or edits until checked in.
- [ ] **4.2 Check-In Target Status**: Implement Check-In modal allowing user to specify revision notes and advance document to target status.
- [ ] **4.3 Document Blinding & Access Masks**: Implement blinding flags that redact or mask document content and metadata for unblinded user roles.
- [ ] **4.4 Sticky Notes (Note-to-File)**: Complete `StickyNotesModal.jsx` and persist notes to `document_notes` table with author and timestamp.
- [ ] **4.5 Annotation Author Reply & Resolution**: Enhance document annotation viewer to support threaded replies and resolution marking.
- [ ] **4.6 Document Copy & Move Logs**: Record source folder, destination folder, reason, user, and timestamp in `document_move_log` and `document_copy_log`.
- [ ] **4.7 Document Access History Tracking**: Record every document view and download in `document_access_log` table.
- [ ] **4.8 Inactivate (Soft Delete) with Justification**: Complete soft delete action requiring mandatory regulatory reason.
- [ ] **4.9 Verification Gate Phase 4**: Test check-out lock collision, test blinding access mask, verify sticky notes persistence, verify audit move logs, and run `npm --prefix frontend run build`.

## Phase 5: Administration Masters, Dynamic Forms Runtime & Clinical Reports Suite (24 items)
- [ ] **5.1 Master Data In-Use Validation**: Guard Department and Designation masters from deletion if active users or documents reference them.
- [ ] **5.2 Organization Profile Persistence**: Wire `organization_profiles` table to application runtime configurations.
- [ ] **5.3 Reason for Signature Templates**: Manage standardized signature reason templates in admin workspace.
- [ ] **5.4 Dynamic Forms Freeze & Lock**: Implement data grid record locking, freezing, and PDF report push to eTMF folder in `FormsLogsWorkspace.jsx`.
- [ ] **5.5 Clinical Reports Endpoints**: Implement dedicated backend SQL aggregation endpoints for Completeness, Compliance, Controlled Docs, Expiry, Copy/Move logs, Inactive docs, Queries, and Timeliness.
- [ ] **5.6 Clinical Reports Visualization & Export**: Add tabular views, SLA timeline charts, and Excel/CSV/PDF export buttons in `ReportsWorkspace.jsx`.
- [ ] **5.7 Verification Gate Phase 5**: Verify in-use master deletion rejection, test forms freeze and folder push, verify all 19 reports render and export, run full backend test suite (`npm test`), and run `npm --prefix frontend run build`.
