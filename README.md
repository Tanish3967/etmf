# eTMF Pro — Backend API

**Regulatory compliance:** ICH E6(R2) | 21 CFR Part 11 | EU Annex 11 | GDPR | ALCOA+

## Quick Start

```bash
cp .env.example .env
npm install
npm start
# API runs on http://localhost:3001
```

## Run Tests
```bash
# Start server first, then:
node tests/run.js
```

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login — returns JWT. Rate-limited to 5 attempts/15min (21 CFR Part 11) |
| POST | `/api/auth/logout` | Invalidate session token |
| GET  | `/api/auth/me` | Current user profile + capabilities |
| POST | `/api/auth/change-password` | Change password (complexity enforced) |
| POST | `/api/auth/mfa/setup` | Generate TOTP secret (returns otpauth_url for QR) |
| POST | `/api/auth/mfa/verify` | Verify TOTP code and enable MFA |
| GET  | `/api/auth/sessions` | List active sessions for current user |

**Demo credentials:** `e.vasquez@pharma.com` / `Admin1234!`

All 7 users share the same password. Each user has a different role with different capabilities.

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/documents` | List documents. Filters: `studyId`, `zone`, `section`, `status`, `search`, `page`, `limit` |
| GET    | `/api/documents/:id` | Full document detail: metadata + workflow history + queries + versions + annotations |
| POST   | `/api/documents` | Upload document (multipart/form-data). Field `data` = JSON metadata, `file` = file |
| PATCH  | `/api/documents/:id/metadata` | Edit metadata. **Reason required** for Approved docs (ALCOA+) |
| POST   | `/api/documents/:id/checkout` | Check out — locks doc to current user |
| POST   | `/api/documents/:id/checkin` | Check in — owner or admin only |
| GET    | `/api/documents/:id/versions` | Version history |
| GET    | `/api/documents/:id/download` | Download file (streams file or 204 in demo mode) |

### Workflow
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/workflow/:docId/transition` | Transition document state. Requires `nextState`, optional `comment`. Approval requires `credentials.password` (re-auth, 21 CFR Part 11) |
| GET    | `/api/workflow/tasks` | Personalised task list with SLA levels (green/amber/red) |
| GET    | `/api/workflow/sla` | SLA dashboard — all in-workflow documents with breach analysis |

**Workflow state machine:**
```
Draft → Pending Review → Review Complete → Pending Approval → Approved
                      ↘ More Info Requested ↗
                      ↘ Rejected → Draft
```

**E-signature (21 CFR Part 11 §11.200):**  
`POST /api/workflow/:id/transition` with `nextState: "Approved"` requires re-authentication:
```json
{
  "nextState": "Approved",
  "credentials": { "password": "Admin1234!", "meaning": "Approved" }
}
```

### Queries
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/queries` | List queries. Filters: `studyId`, `status`, `severity`, `docId` |
| POST   | `/api/queries` | Raise query: `{ documentId, studyId, queryType, severity, text, assignedTo, dueDate }` |
| PATCH  | `/api/queries/:id/close` | Close query with resolution |

### Audit Trail
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/audit` | Immutable audit log. Filters: `studyId`, `userId`, `action`, `docId`, `from`, `to`. Paginated. **No write endpoints** (append-only per 21 CFR Part 11) |

### Studies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/studies` | List studies with doc/site counts |
| POST   | `/api/studies` | Create study |
| POST   | `/api/studies/:id/lock` | Lock study — pre-lock checklist validation |
| GET    | `/api/studies/:id/completeness` | Real-time completeness by zone |

### EDL (Expected Document List)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/edl?studyId=` | Full EDL with filed status per artifact |
| PATCH  | `/api/edl/:id/na` | Designate placeholder as N/A (reason required) |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/reports/completeness` | TMF completeness by zone |
| GET    | `/api/reports/expiry` | Documents expiring within N days (default 90) |
| GET    | `/api/reports/workflow` | Workflow status and overdue count |
| GET    | `/api/reports/audit` | Audit trail report |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/users` | List all users in tenant |
| GET    | `/api/users/:id` | User profile |
| PATCH  | `/api/users/:id` | Update role/dept/active (admin only) |
| DELETE | `/api/users/:id` | Revoke access — soft delete (admin only) |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/ai/audit` | AI classification audit trail |
| POST   | `/api/ai/classify/audit` | Record AI classification result |
| POST   | `/api/ai/search` | Log semantic search event |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/notifications` | User's notifications (last 50) |
| PATCH  | `/api/notifications/:id/read` | Mark as read |
| PATCH  | `/api/notifications/read-all` | Mark all as read |

### Admin (System Administrator role only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/admin/stats` | Tenant statistics |
| GET    | `/api/admin/tenant` | Tenant configuration |
| PATCH  | `/api/admin/tenant` | Update tenant settings / branding |
| GET    | `/api/admin/user-groups` | List user groups |
| POST   | `/api/admin/user-groups` | Create user group with zone access |

## Database Schema

SQLite in development. All tables include `tenant_id` for multi-tenancy isolation.

**Core tables:** `tenants`, `users`, `sessions`, `studies`, `sites`, `documents`, `document_versions`, `workflow_history`, `electronic_signatures`, `queries`, `annotations`, `placeholders`, `notifications`, `audit_log`, `ai_audit`, `user_groups`, `user_group_members`

**Audit trail:** Append-only. No `UPDATE` or `DELETE` on `audit_log`. Every document mutation, login, config change, and security event is recorded with `user_name`, `ip_address`, `session_id`, `old_value`, `new_value`, and `created_at` (UTC).

## Security

- **JWT** with 8h expiry + server-side session table (revocable)
- **Rate limiting:** 5 login attempts per 15 min per IP, 300 API requests/min
- **Account lockout:** 30 min after 5 failed attempts
- **Password policy:** Min 12 chars, complexity enforced on change
- **MFA:** TOTP (Google Authenticator compatible) via `speakeasy`
- **Helmet:** CSP, HSTS, X-Frame-Options
- **CORS:** Allowlist-only, credentials mode
- **Role-based access control:** 7 roles × 6 capabilities, enforced per endpoint
- **Study lock guard:** Mutations blocked on locked studies
- **Inspector guard:** Write operations blocked for Inspector role

## Regulatory Notes

| Requirement | Implementation |
|-------------|---------------|
| 21 CFR Part 11 §11.200 | Re-authentication per document approval; no batch signing |
| 21 CFR Part 11 §11.10 | Audit trail: immutable, tamper-evident, append-only |
| ALCOA+ | Reason for change mandatory on approved document edits |
| ICH E6(R2) | 9-state workflow; e-signature manifest per approval |
| EU Annex 11 | Data integrity checks; session management; access controls |
| GDPR | Tenant data isolation; minimal data collection |
"# etmf" 
