# eTMF Pro 4.3 — Complete Functional Specification & Implementation Roadmap
**Based on Clinevo Technologies Electronic Trial Master File Application User Guide v4.3 / 4.4 & SRS v4.0**  
**Compliance Standards:** ICH E6(R2) | 21 CFR Part 11 | EU Annex 11 | ALCOA+ | DIA TMF Reference Model v3.2

---

## 1. System Architecture & User Guide Mapping

| User Guide Section | Module / Feature Name | Core Capabilities & UI Specifications | Status in Codebase |
|---|---|---|---|
| **§3 & §4** | **Login, Logout & Landing Page** | Enterprise ID, Email/Username, Password, First-time password change, Password complexity rules, Account lockout after `LOGIN_ATTEMPTS` (5 failed), Forgot Password temporary credential flow, Session timeout redirect. | ✅ Fully Implemented (`LoginScreen`, `auth.js`) |
| **§6 & §7** | **Breadcrumbs & Grid Icons** | Dynamic location trail (`Repository > Study > Zone > Section > Artifact`), Grid collapse, expand, zoom in/out, and refresh icons. Back button folder navigation. | ✅ Implemented in `App.jsx` |
| **§8.1** | **Header Toolbar** | Enterprise logo, Application name, Home shortcut, Notification center bell with badge counter, User profile avatar with role and timezone display, Logout button. | ✅ Implemented in `App.jsx` |
| **§8.2 & §8.3** | **Task Grid & My Tasks Pane** | 3 Task Grid tabs: **Documents Tab** (Open, Pending Review, Approval, Signoff, Publish; SLA highlighting: Red = overdue after 2 reminders, Yellow = overdue after 1 reminder, Green = on track), **Expiry Documents Tab** (N-day horizon), **Queries Tab** (Open query tracker). | ✅ Core table built; Tabs & filter dropdowns in progress |
| **§8.4** | **Document Search Bar** | 3 search modes: By Document ID, By Document Name (with `%` wildcards), By Document Display Name. Returns modal with Version, Status, Folder Path, and User Privilege. | ✅ Global search input built; Type selector modal in progress |
| **§8.5.1** | **Security Administration** | **User Management** (§8.5.1.1: Add User, Add AD User, Reset Password, Assign Functional Role), **User Groups** (§8.5.1.2: Users tab with Author/Reviewer/Approver/Downloader/Blinded checkboxes; Folders tab with cascade privileges), **Functional Role Setup** (§8.5.1.3), **Functional Roles** (§8.5.1.4: 21 standard roles). | ✅ User table live; Functional role assigner & User Group folder matrix in progress |
| **§8.5.2** | **Application Administration** | **Department Master** (§8.5.2.1), **Designation Master** (§8.5.2.2), **Document Type Master** (§8.5.2.3), **Document Classification** (§8.5.2.4: 3 levels, auto-publish, retention, digit length, cover page config), **Metadata Setup** (§8.5.2.5: up to 30 custom columns, date formats, display/download filename patterns), **Enable Debug** (§8.5.2.6), **Folder Structure** (§8.5.2.7: study/country/site templates, import/export structure, file plan), **Forms/Logs Setup** (§8.5.2.8: Sections Form/Grid, fields per line 1-4), **Remove Document** (§8.5.2.9), **Reason for Signature Template** (§8.5.2.10: Approver, Author, QA, Reviewer, Trainer reasons), **Schedule Inactive Doc Removal** (§8.5.2.11), **Schedule Reminder** (§8.5.2.12), **Workflow Manager** (§8.5.2.13: Reviewer, Approver, Signoff Levels 1-5, Publisher tabs with reminders & e-sig toggles). | ✅ API endpoints & dynamic tables ready; Dedicated builder modals in progress |
| **§8.5.3** | **System Administration** | **Organization Profile** (§8.5.3.1: 32 configurable parameters including `ALLOW_PAST_EFFECTIVE_FROM_DATE`, `BLOB_FILE_EXTNS`, `DATE_FORMAT`, `REDACTION_ENABLED`, `WATERMARK_MESSAGE_FORMAT`, `LOGIN_ATTEMPTS`), **Register Database User** (§8.5.3.2: CTMS/DMS external interfaces), **System Codelists** (§8.5.3.3: approver/reviewer system scripts). | ✅ Codelists & profiles live in SQLite; Organization profile editor in progress |
| **§8.6 & §8.7** | **Repository & Folder Context Menu** | Central file explorer, study creation with auto-imported DIA hierarchy, Sort/Filter (A-Z, Z-A, Latest/Old, Doc ID, Workflow, Doc Type). **Folder Right-Click Context Menu**: Assign User Group (§8.7.1), Revoke Privileges (§8.7.2), Lock (§8.7.3), Edit (§8.7.4), Distribution (§8.7.5), Additional Notification (§8.7.6), Export Documents (§8.7.7), Pin/Unpin (§8.7.8/9), Update Status (§8.7.10: Milestone actual/plan date update), Properties (§8.7.11), View History (§8.7.12). | ✅ Core Repository & Zone pills built; Folder right-click context menu in progress |
| **§8.8** | **Folder Action Menu** | Action bar for folders: **File Plan** (§8.8.1: Doc count, mandatory flag, milestone status, QC required, workflow assignment, syncup & resync), **Milestone Due Date** (§8.8.2: Planned vs Actual dates), **Add Placeholder** (§8.8.3), **Add Document** (§8.8.4: Assign Authors, Reviewers, Approvers, Signoff users), **Copy Documents** (§8.8.5), **Move Documents** (§8.8.6), **View Inventory** (§8.8.7: Excel/PDF export, column chooser), **Bulk Download** (§8.8.8: Original vs rendition with watermark), **Index** (§8.8.9: upload/download index file). | ✅ Backend endpoints exist; Action bar modals in progress |
| **§8.9 & §8.10** | **Document Context Menu (25 Actions)** | **Check-In/Out** (§8.10.2/6), **Blind/Unblind** (§8.10.3/12), **Properties** (§8.10.4), **Download Original & Download Rendition** (§8.10.5/10/19: with cover page, revision history, watermark, footer), **Document History** (§8.10.9), **Document View** (§8.10.11: in-system preview), **Inactivate / Soft Delete** (§8.10.13), **Redaction** (§8.10.14: blackout tool), **Copy/Move** (§8.10.15/16), **Quality Check** (§8.10.17), **Sticky Notes** (§8.10.18), **Link/Delink** (§8.10.20), **Access History** (§8.10.21), **Convert/Upload PDF** (§8.10.22), **Self-Assign / Release** (§8.10.24), **Raise Query** (§8.10.25). | ✅ Implemented in context menu; Visual modals being connected |
| **§8.11** | **Placeholder Context Menu** | Add Document to Placeholder (§8.11.1), Set Optional / Set Mandatory (§8.11.2), Remove Placeholder (§8.11.3 with justification). | ✅ Backend complete; Placeholder context handler in progress |
| **§8.12 & §8.13** | **Electronic Signatures & Versioning** | 21 CFR Part 11 compliant approval signature manifest on cover page (Signatory Name, Role, Date/Time UTC, Reason, Signature ID), immutable version history (Major.Minor). | ✅ Built in workflow engine & document viewer |
| **§8.16** | **Dashboard / Curator** | Colored circular KPI rings: Total Documents, Completed Documents, In Progress Documents, In QC Documents, Missing Documents, Expected Documents. Clickable drilldown to Missing/Expected items with one-click placeholder removal. | ✅ Built on repository screen |
| **§9 & §10** | **Quick View & Link Documents** | Quick View: side-by-side comparison of up to 2 documents or versions. Link Document: bi-directional relationship linking with "upgrade all to latest version" option. | ⚠️ Quick View side-by-side layout in progress |
| **§11** | **Quality Control Module** | Audit Plan (create audit, assign participants, response tab with excel/pdf export), Monitor Audit Activities (track queries, auditor-auditee response loop). | ✅ Backend complete; UI tables live |
| **§12** | **Forms/Logs Module** | Fill activated forms (e.g. Study Log, Site Log, DOA Log), add multiple section grid records, Lock form, Freeze form, Generate PDF report, Push generated report directly to eTMF folder. | ⚠️ Schema runner built; Push-to-folder workflow in progress |
| **§13** | **Reports Suite (19 Reports)** | 1. Application Users, 2. Blinded/Unblinded, 3. Completeness (interactive pie charts & bar graphs), 4. Compliance, 5. Controlled Document Tracking (with Destroy button), 6. Document Copy Log, 7. Document Expiry, 8. Document Exports, 9. Document Workflows (Milestones & Missed Milestones), 10. Document Move Log, 11. Inactivate Documents, 12. Inventory (with Reviewer/Approver/Signoff checkboxes), 13. Folder History (5 tabs: Folder, User Group, File Plan, Milestone, Document), 14. Notes, 15. Quality (QC Completion Rate & Rejection Reason pie charts), 16. Queries, 17. Removed Documents, 18. Scheduled Jobs, 19. Timeliness (Overall Completion bar chart, Status pie chart, Expiration pie chart). | ✅ All 19 backend report engines ready; Interactive chart widgets in progress |

---

## 2. Step-by-Step Implementation Sprints

### Sprint 1: Interactive Document Context Modals (PDF §8.10)
- **Objective**: Wire up the 25 document actions from user guide §8.10 to full rich modals instead of generic browser alerts:
  1. `MetadataEditorModal`: Full form to view and edit metadata fields per §8.10.23.
  2. `RedactionModal`: Visual redaction blackout tool on document preview with confirmation dialog per §8.10.14.
  3. `StickyNotesModal`: Add, edit, and delete notes targeting Reviewers, Approvers, or Viewers per §8.10.18.
  4. `BlindingModal`: Blind/Unblind toggle with audit justification per §8.10.3 and §8.10.12.
  5. `RaiseQueryModal`: Formal query creation modal linked to document/placeholder per §8.10.25.
  6. `LinkDocumentModal`: Multi-folder document selector with "Upgrade to latest version" action per §10.

### Sprint 2: Folder Action & Context Engine (PDF §8.7 & §8.8)
- **Objective**: Right-click folder actions and folder toolbar action menu:
  1. Right-click context menu on folders: **Assign User Group**, **Lock Study**, **Update Status (Milestones)**, **Folder Properties**, **View History**.
  2. Folder Action Toolbar: **File Plan Manager** (view artifact expected counts, toggle mandatory, resync file plan), **Add Placeholder Modal**, **Bulk Download Modal** (with cover page, revision history, and watermark toggles per §8.8.8).

### Sprint 3: Study Setup & Workflow Administration (PDF §8.5.2 & §8.8.4)
- **Objective**: Guided creation and configuration wizards:
  1. **Study Setup Wizard**: Multi-step modal to create study, pick DIA taxonomy structure, select countries and sites, and auto-initialize EDL placeholders.
  2. **Workflow Manager Modal** (§8.5.2.13): Tabs for Reviewer, Approver, Signoff Levels 1-5, and Publisher with reminder days and electronic signature requirements.
  3. **Forms & Logs Interactive Workspace** (§12): Dynamic multi-section form renderer allowing users to add records, lock/freeze forms, and "Push to Folder".

### Sprint 4: Reports Suite with Interactive Data Visualizations (PDF §13)
- **Objective**: Complete graphical dashboards for the 19 standard reports:
  1. **Completeness Report**: Interactive overall document status pie chart, In-progress/In-QC pie chart, and classification bar graph per §8.14.3.
  2. **Timeliness Report**: Overall completion duration bar chart and status distribution chart per §8.14.19.
  3. **Quality Report**: QC completion rate and rejection reason breakdown charts per §8.14.15.
  4. **Folder History Multi-Tab Viewer**: 5 tabs (Folder, User Group, File Plan, Milestone, Document) per §8.14.13.

### Sprint 5: Verification & GxP Compliance Package
- Run full regression tests against 21 CFR Part 11 and ICH E6(R2) rules.
- Test e-signature re-authentication, audit trail immutability, role isolation across all 7 personas.
- Perform automated build and lint checks.
