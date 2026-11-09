/**
 * eTMF Pro — Database Layer
 * SQLite for dev; swap DATABASE_URL to postgres:// for production
 * All tables include tenant_id for multi-tenancy (SRS §3)
 * Audit trail is append-only — no UPDATE or DELETE on audit_log (21 CFR Part 11)
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '../../etmf.db');

let db;

export function getDB() {
  if (!db) throw new Error('DB not initialised — call initDB() first');
  return db;
}

export async function initDB() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    -- ── TENANTS ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS tenants (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      slug          TEXT UNIQUE NOT NULL,
      logo_url      TEXT,
      primary_color TEXT DEFAULT '#0ABFB8',
      active        INTEGER DEFAULT 1,
      created_at    TEXT DEFAULT (datetime('now')),
      settings      TEXT DEFAULT '{}'
    );

    -- ── USERS ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL REFERENCES tenants(id),
      name              TEXT NOT NULL,
      email             TEXT NOT NULL,
      password_hash     TEXT NOT NULL,
      role              TEXT NOT NULL,
      dept              TEXT,
      active            INTEGER DEFAULT 1,
      mfa_secret        TEXT,
      mfa_enabled       INTEGER DEFAULT 0,
      failed_attempts   INTEGER DEFAULT 0,
      locked_until      TEXT,
      last_login        TEXT,
      password_changed  TEXT DEFAULT (datetime('now')),
      created_at        TEXT DEFAULT (datetime('now')),
      created_by        TEXT,
      UNIQUE(tenant_id, email)
    );

    -- ── USER SESSIONS ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sessions (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id),
      tenant_id    TEXT NOT NULL,
      token_hash   TEXT NOT NULL,
      ip_address   TEXT,
      user_agent   TEXT,
      expires_at   TEXT NOT NULL,
      created_at   TEXT DEFAULT (datetime('now')),
      revoked      INTEGER DEFAULT 0
    );

    -- ── STUDIES ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS studies (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL REFERENCES tenants(id),
      protocol_number   TEXT NOT NULL,
      title             TEXT NOT NULL,
      phase             TEXT NOT NULL,
      therapeutic_area  TEXT,
      sponsor_name      TEXT,
      cro_name          TEXT,
      status            TEXT DEFAULT 'Setup',
      tmf_model_version TEXT DEFAULT 'DIA v3.2',
      start_date        TEXT,
      planned_end_date  TEXT,
      actual_end_date   TEXT,
      locked            INTEGER DEFAULT 0,
      locked_by         TEXT,
      locked_at         TEXT,
      created_at        TEXT DEFAULT (datetime('now')),
      created_by        TEXT NOT NULL,
      UNIQUE(tenant_id, protocol_number)
    );

    -- ── SITES ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sites (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      study_id      TEXT NOT NULL REFERENCES studies(id),
      site_code     TEXT NOT NULL,
      name          TEXT NOT NULL,
      country       TEXT NOT NULL,
      pi_name       TEXT,
      status        TEXT DEFAULT 'Pending',
      activation_date TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    -- ── DOCUMENTS ────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS documents (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      study_id         TEXT NOT NULL REFERENCES studies(id),
      artifact_code    TEXT NOT NULL,
      artifact_name    TEXT NOT NULL,
      zone             TEXT NOT NULL,
      zone_label       TEXT,
      section          TEXT NOT NULL,
      section_label    TEXT,
      title            TEXT NOT NULL,
      version          TEXT NOT NULL DEFAULT '1.0',
      status           TEXT NOT NULL DEFAULT 'Draft',
      file_path        TEXT,
      file_name        TEXT,
      file_type        TEXT,
      file_size        INTEGER,
      pages            INTEGER,
      confidential     INTEGER DEFAULT 0,
      mandatory        INTEGER DEFAULT 1,
      country          TEXT,
      site_id          TEXT,
      effective_date   TEXT,
      expiry_date      TEXT,
      author_id        TEXT REFERENCES users(id),
      reviewer_id      TEXT REFERENCES users(id),
      approver_id      TEXT REFERENCES users(id),
      checked_out_by   TEXT REFERENCES users(id),
      checked_out_at   TEXT,
      ai_classified    INTEGER DEFAULT 0,
      ai_confidence    REAL,
      ai_overridden    INTEGER DEFAULT 0,
      metadata         TEXT DEFAULT '{}',
      active           INTEGER DEFAULT 1,
      is_pinned        INTEGER DEFAULT 0,
      is_redacted      INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now')),
      created_by       TEXT NOT NULL
    );

    -- ── DOCUMENT VERSION HISTORY ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS document_versions (
      id            TEXT PRIMARY KEY,
      document_id   TEXT NOT NULL REFERENCES documents(id),
      tenant_id     TEXT NOT NULL,
      version       TEXT NOT NULL,
      status        TEXT NOT NULL,
      file_path     TEXT,
      file_name     TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      created_by    TEXT NOT NULL,
      change_reason TEXT
    );

    -- ── WORKFLOW HISTORY ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS workflow_history (
      id          TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id),
      tenant_id   TEXT NOT NULL,
      from_state  TEXT,
      to_state    TEXT NOT NULL,
      user_id     TEXT NOT NULL REFERENCES users(id),
      comment     TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      esig_id     TEXT REFERENCES electronic_signatures(id)
    );

    -- ── ELECTRONIC SIGNATURES (21 CFR Part 11) ───────────────────────
    CREATE TABLE IF NOT EXISTS electronic_signatures (
      id           TEXT PRIMARY KEY,
      document_id  TEXT NOT NULL REFERENCES documents(id),
      tenant_id    TEXT NOT NULL,
      user_id      TEXT NOT NULL REFERENCES users(id),
      meaning      TEXT NOT NULL,
      signed_at    TEXT NOT NULL DEFAULT (datetime('now')),
      sig_hash     TEXT NOT NULL,
      ip_address   TEXT,
      manifest_url TEXT
    );

    -- ── QUERIES ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS queries (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      document_id   TEXT NOT NULL REFERENCES documents(id),
      study_id      TEXT NOT NULL,
      query_type    TEXT NOT NULL,
      severity      TEXT NOT NULL DEFAULT 'Major',
      text          TEXT NOT NULL,
      raised_by     TEXT NOT NULL REFERENCES users(id),
      assigned_to   TEXT REFERENCES users(id),
      due_date      TEXT,
      status        TEXT DEFAULT 'Open',
      resolution    TEXT,
      closed_by     TEXT REFERENCES users(id),
      closed_at     TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    -- ── ANNOTATIONS / STICKY NOTES ───────────────────────────────────
    CREATE TABLE IF NOT EXISTS annotations (
      id          TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id),
      tenant_id   TEXT NOT NULL,
      user_id     TEXT NOT NULL REFERENCES users(id),
      text        TEXT NOT NULL,
      page_number INTEGER,
      x_pos       REAL,
      y_pos       REAL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- ── PLACEHOLDERS (EDL) ───────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS placeholders (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      study_id      TEXT NOT NULL REFERENCES studies(id),
      artifact_code TEXT NOT NULL,
      artifact_name TEXT NOT NULL,
      zone          TEXT NOT NULL,
      zone_label    TEXT,
      section       TEXT NOT NULL,
      section_label TEXT,
      mandatory     INTEGER DEFAULT 1,
      expected_by   TEXT,
      na_designated INTEGER DEFAULT 0,
      na_reason     TEXT,
      na_by         TEXT REFERENCES users(id),
      na_at         TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      UNIQUE(study_id, artifact_code)
    );

    -- ── NOTIFICATIONS ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS notifications (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      user_id     TEXT NOT NULL REFERENCES users(id),
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT,
      priority    TEXT DEFAULT 'medium',
      read        INTEGER DEFAULT 0,
      read_at     TEXT,
      link        TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- ── DOCUMENT LINKS ───────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS document_links (
      id            TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      source_id     TEXT NOT NULL REFERENCES documents(id),
      target_id     TEXT NOT NULL REFERENCES documents(id),
      relationship  TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      created_by    TEXT NOT NULL REFERENCES users(id)
    );

    -- ── FOLDER CONFIGS ───────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS folder_configs (
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL,
      study_id       TEXT NOT NULL REFERENCES studies(id),
      path           TEXT NOT NULL,
      locked         INTEGER DEFAULT 0,
      locked_by      TEXT REFERENCES users(id),
      locked_at      TEXT,
      allowed_groups TEXT DEFAULT '[]',
      dist_list      TEXT DEFAULT '[]',
      created_at     TEXT DEFAULT (datetime('now')),
      UNIQUE(study_id, path, tenant_id)
    );

    -- ── AUDIT LOG (append-only — never UPDATE or DELETE) ─────────────
    CREATE TABLE IF NOT EXISTS audit_log (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      study_id    TEXT,
      document_id TEXT,
      user_id     TEXT,
      user_name   TEXT NOT NULL,
      user_role   TEXT,
      action      TEXT NOT NULL,
      object_type TEXT,
      object_id   TEXT,
      object_name TEXT,
      detail      TEXT,
      old_value   TEXT,
      new_value   TEXT,
      ip_address  TEXT,
      user_agent  TEXT,
      session_id  TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- ── AI CLASSIFICATION AUDIT ───────────────────────────────────────
    CREATE TABLE IF NOT EXISTS ai_audit (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      document_id     TEXT REFERENCES documents(id),
      user_id         TEXT REFERENCES users(id),
      file_name       TEXT,
      model_version   TEXT DEFAULT 'nlp-v1.0',
      suggested_code  TEXT,
      final_code      TEXT,
      confidence      REAL,
      action          TEXT,
      qc_results      TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- ── USER GROUPS ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS user_groups (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL,
      name         TEXT NOT NULL,
      description  TEXT,
      zones        TEXT DEFAULT '[]',
      is_active    INTEGER DEFAULT 1,
      created_at   TEXT DEFAULT (datetime('now')),
      created_by   TEXT,
      updated_at   TEXT,
      updated_by   TEXT
    );

    CREATE TABLE IF NOT EXISTS user_group_members (
      group_id  TEXT NOT NULL REFERENCES user_groups(id),
      user_id   TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY(group_id, user_id)
    );

    -- ── FUNCTIONAL ROLES ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS functional_roles (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL,
      name         TEXT NOT NULL,
      description  TEXT,
      capabilities TEXT DEFAULT '[]', -- JSON array of system caps (e.g. canUpload, canAdmin)
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_functional_roles (
      user_id   TEXT NOT NULL REFERENCES users(id),
      role_id   TEXT NOT NULL REFERENCES functional_roles(id),
      PRIMARY KEY(user_id, role_id)
    );

    -- ── SYSTEM CODELISTS ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS system_codelists (
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL,
      code           TEXT NOT NULL,
      name           TEXT NOT NULL,
      group_name     TEXT NOT NULL,
      is_active      INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now')),
      created_by     TEXT,
      UNIQUE(code, group_name, tenant_id)
    );

    -- ── ORGANIZATION PROFILES ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS organization_profiles (
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL,
      profile_type   TEXT NOT NULL, -- 'Configurable', 'Non-Configurable', 'Common'
      name           TEXT NOT NULL,
      description    TEXT,
      value_str      TEXT,
      created_at     TEXT DEFAULT (datetime('now')),
      created_by     TEXT,
      UNIQUE(name, tenant_id)
    );

    -- ── STUDY SETUP & DIA MODEL ──────────────────────────────────────
    CREATE TABLE IF NOT EXISTS trial_templates (
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL,
      name           TEXT NOT NULL,
      description    TEXT,
      version        TEXT DEFAULT '1.0',
      is_active      INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now')),
      created_by     TEXT
    );

    CREATE TABLE IF NOT EXISTS dia_model_items (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      trial_template_id TEXT REFERENCES trial_templates(id),
      zone             TEXT NOT NULL,
      zone_name        TEXT NOT NULL,
      section          TEXT NOT NULL,
      section_name     TEXT NOT NULL,
      artifact         TEXT NOT NULL,
      artifact_name    TEXT NOT NULL,
      level            TEXT, -- 'Trial', 'Country', 'Site'
      is_mandatory     INTEGER DEFAULT 0,
      sponsor_overlay  INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    -- ── FORMS & LOGS ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS forms_schemas (
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL,
      name           TEXT NOT NULL,
      description    TEXT,
      schema_json    TEXT NOT NULL,
      is_active      INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now')),
      created_by     TEXT
    );

    CREATE TABLE IF NOT EXISTS forms_data (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      form_schema_id   TEXT NOT NULL REFERENCES forms_schemas(id),
      study_id         TEXT REFERENCES studies(id),
      data_json        TEXT NOT NULL,
      created_at       TEXT DEFAULT (datetime('now')),
      created_by       TEXT NOT NULL REFERENCES users(id)
    );

    -- ── WORKFLOW EXTENSIONS ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL,
      name           TEXT NOT NULL,
      description    TEXT,
      steps_json     TEXT NOT NULL,
      is_active      INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now')),
      created_by     TEXT
    );

    CREATE TABLE IF NOT EXISTS user_delegations (
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL,
      delegator_id   TEXT NOT NULL REFERENCES users(id),
      delegatee_id   TEXT NOT NULL REFERENCES users(id),
      start_date     TEXT NOT NULL,
      end_date       TEXT,
      is_active      INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      document_id      TEXT NOT NULL REFERENCES documents(id),
      user_id          TEXT NOT NULL REFERENCES users(id),
      annotation_type  TEXT NOT NULL, -- Note, Signature, Redaction
      annotation_text  TEXT,
      page_number      INTEGER DEFAULT 1,
      position_x       REAL DEFAULT 0,
      position_y       REAL DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    -- ── REPOSITORY & PLACEHOLDERS ────────────────────────────────────
    CREATE TABLE IF NOT EXISTS placeholders (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      study_id         TEXT NOT NULL REFERENCES studies(id),
      folder_id        TEXT REFERENCES folder_configs(id),
      artifact_code    TEXT NOT NULL,
      artifact_name    TEXT NOT NULL,
      zone             TEXT,
      section          TEXT,
      expected_by_date TEXT,
      is_mandatory     INTEGER DEFAULT 1,
      na_designated    INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now')),
      created_by       TEXT
    );

    CREATE TABLE IF NOT EXISTS file_plans (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      study_id         TEXT NOT NULL REFERENCES studies(id),
      plan_name        TEXT NOT NULL,
      plan_json        TEXT NOT NULL,
      milestone_date   TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    -- ── INDEXES ──────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_docs_study      ON documents(study_id, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_docs_status     ON documents(status, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_docs_artifact   ON documents(artifact_code, study_id);
    CREATE INDEX IF NOT EXISTS idx_audit_doc       ON audit_log(document_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_log(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_tenant    ON audit_log(tenant_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_queries_doc     ON queries(document_id);
    CREATE INDEX IF NOT EXISTS idx_queries_status  ON queries(status, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_notifs_user     ON notifications(user_id, read);
    CREATE INDEX IF NOT EXISTS idx_wf_doc          ON workflow_history(document_id);
    -- ── MIGRATIONS (Safe column additions) ───────────────────────────
  `);

  const addColumn = (table, col, def) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch (e) {}
  };
  addColumn('documents', 'active', 'INTEGER DEFAULT 1');
  addColumn('documents', 'is_pinned', 'INTEGER DEFAULT 0');
  addColumn('documents', 'is_redacted', 'INTEGER DEFAULT 0');
  
  // Phase 2: User profile enhancements
  addColumn('users', 'first_name', 'TEXT');
  addColumn('users', 'last_name', 'TEXT');
  addColumn('users', 'designation', 'TEXT');
  addColumn('users', 'description', 'TEXT');
  
  // Phase 3: QC Enhancements
  addColumn('queries', 'severity', "TEXT DEFAULT 'Medium'");
  addColumn('queries', 'responses', "TEXT DEFAULT '[]'");
  addColumn('queries', 'audit_comments', 'TEXT');

  // Phase 4: Forms & Logs Enhancements
  addColumn('forms_data', 'is_locked', 'INTEGER DEFAULT 0');
  addColumn('forms_data', 'locked_by', 'TEXT');
  addColumn('forms_data', 'locked_at', 'TEXT');
  addColumn('forms_schemas', 'zone', "TEXT DEFAULT '05'");
  addColumn('forms_schemas', 'section', "TEXT DEFAULT '05.02'");
  addColumn('forms_schemas', 'artifact_code', "TEXT DEFAULT '05.02.01'");

  await seedClinicalForms();
  await seedDemoData();
  console.log('✅ Database initialised');
  return db;
}

async function seedClinicalForms() {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM forms_schemas').get().c;
    if (count > 0) return;

    const tenantId = 'tenant-001';
    const schemas = [
      {
        id: 'form-schema-001',
        name: 'Site Delegation of Authority Log (DOA)',
        description: 'ICH GCP E6(R2) §4.1.5 — Principal Investigator staff responsibility delegation records',
        zone: '05',
        section: '05.02',
        artifact_code: '05.02.01',
        schema_json: JSON.stringify({
          sections: [
            { id: 'site_header', title: 'Site Information', fields: ['protocol_number', 'site_number', 'pi_name'] },
            { id: 'staff_grid', title: 'Delegated Personnel & Duties', fields: ['staff_name', 'study_role', 'delegated_tasks', 'start_date', 'end_date', 'pi_initials'] }
          ]
        })
      },
      {
        id: 'form-schema-002',
        name: 'Monitoring Visit Log',
        description: 'ICH GCP E6(R2) §5.18 — Site visit log for CRA / Monitor site visits',
        zone: '05',
        section: '05.01',
        artifact_code: '05.01.01',
        schema_json: JSON.stringify({
          sections: [
            { id: 'visit_header', title: 'Visit Details', fields: ['site_number', 'visitor_name', 'organization', 'visit_date', 'visit_type'] },
            { id: 'visit_log', title: 'Visit Findings & Actions', fields: ['purpose', 'findings_summary', 'action_items', 'follow_up_date'] }
          ]
        })
      },
      {
        id: 'form-schema-003',
        name: 'Subject Screening & Enrollment Log',
        description: 'ICH GCP E6(R2) §4.3 — Subject identification, screening consent, and trial cohort randomization',
        zone: '06',
        section: '06.01',
        artifact_code: '06.01.01',
        schema_json: JSON.stringify({
          sections: [
            { id: 'trial_header', title: 'Enrollment Cohort Information', fields: ['study_id', 'target_accrual', 'site_id'] },
            { id: 'subject_grid', title: 'Screened Candidates', fields: ['screening_id', 'icf_date', 'eligibility_status', 'randomization_date', 'assigned_arm'] }
          ]
        })
      }
    ];

    const insert = db.prepare(`
      INSERT INTO forms_schemas (id, tenant_id, name, description, zone, section, artifact_code, schema_json, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'system')
    `);

    schemas.forEach(s => {
      insert.run(s.id, tenantId, s.name, s.description, s.zone, s.section, s.artifact_code, s.schema_json);
    });

    // Seed one sample DOA entry so users immediately see live records
    const sampleDoa = {
      protocol_number: 'TRIAL-2024-001',
      site_number: 'Site-001',
      pi_name: 'Dr. Sarah Chen',
      staff_records: [
        { staff_name: 'Emily Watson, RN', study_role: 'Study Coordinator', delegated_tasks: 'Informed Consent, AE Reporting, Vital Signs', start_date: '2024-02-01', end_date: '', pi_initials: 'SC' },
        { staff_name: 'David Miller, PharmD', study_role: 'Unblinded Pharmacist', delegated_tasks: 'Investigational Product Dispensing & Accountability', start_date: '2024-02-01', end_date: '', pi_initials: 'SC' }
      ]
    };
    db.prepare(`
      INSERT INTO forms_data (id, tenant_id, form_schema_id, study_id, data_json, created_by)
      VALUES ('form-data-001', 'tenant-001', 'form-schema-001', 'study-001', ?, 'usr-002')
    `).run(JSON.stringify(sampleDoa));

    console.log('✅ Standard clinical forms seeded');
  } catch (e) {
    console.error('Error seeding clinical forms:', e.message);
  }
}

async function seedDemoData() {
  const existing = db.prepare('SELECT id FROM tenants WHERE id = ?').get('tenant-001');
  if (existing) return;

  const tenantId = 'tenant-001';
  const now = new Date().toISOString();

  // Seed tenant
  db.prepare(`INSERT INTO tenants (id, name, slug, active) VALUES (?, ?, ?, 1)`)
    .run(tenantId, 'PharmaCo Ltd', 'pharmacolid');

  // Seed users
  const pwHash = await bcrypt.hash('Admin1234!', 12);
  const users = [
    { id:'usr-001', name:'Elena Vasquez',   email:'e.vasquez@pharma.com',  role:'TMF Manager',             dept:'TMF Ops'    },
    { id:'usr-002', name:'Dr. Sarah Chen',  email:'s.chen@site.org',       role:'Principal Investigator',  dept:'Clinical'   },
    { id:'usr-003', name:'Marcus Williams', email:'m.williams@cro.com',    role:'CRA / Reviewer',          dept:'Monitoring' },
    { id:'usr-004', name:'Priya Sharma',    email:'p.sharma@pharma.com',   role:'Regulatory Approver',     dept:'Regulatory' },
    { id:'usr-005', name:"James O'Brien",   email:'j.obrien@pharma.com',   role:'Data Manager / Author',   dept:'Data Mgmt'  },
    { id:'usr-006', name:'Aisha Patel',     email:'a.patel@pharma.com',    role:'System Administrator',    dept:'IT'         },
    { id:'usr-007', name:'Tom Eriksen',     email:'t.eriksen@ema.europa.eu',role:'Inspector / Auditor',    dept:'Authority'  },
  ];
  const insertUser = db.prepare(`INSERT OR IGNORE INTO users (id,tenant_id,name,email,password_hash,role,dept,active,created_at,created_by) VALUES (?,?,?,?,?,?,?,1,?,?)`);
  users.forEach(u => insertUser.run(u.id, tenantId, u.name, u.email, pwHash, u.role, u.dept, now, 'system'));

  // Seed study
  db.prepare(`INSERT OR IGNORE INTO studies (id,tenant_id,protocol_number,title,phase,sponsor_name,status,start_date,planned_end_date,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run('study-001', tenantId, 'TRIAL-2024-001', 'Phase III Oncology Study — BRCA1 Inhibitor', 'III', 'PharmaCo Ltd', 'Active', '2024-01-15', '2026-12-31', now, 'usr-001');

  // Seed sites
  const sites = [
    { id:'site-001', code:'Site-001', name:'Berlin Clinical Centre',    country:'Germany' },
    { id:'site-002', code:'Site-002', name:'London Oncology Institute', country:'UK'      },
    { id:'site-003', code:'Site-003', name:'Boston Medical Center',     country:'USA'     },
    { id:'site-004', code:'Site-004', name:'Mumbai Cancer Institute',   country:'India'   },
  ];
  const insertSite = db.prepare(`INSERT OR IGNORE INTO sites (id,tenant_id,study_id,site_code,name,country,status,activation_date,created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
  sites.forEach(s => insertSite.run(s.id, tenantId, 'study-001', s.code, s.name, s.country, 'Active', '2024-02-01', now));

  // Seed a few documents
  const docs = [
    { id:'doc-001', code:'TMF-01.02.001', name:'Protocol and Amendments',     zone:'01', zoneLabel:'Trial Management',       section:'01.02', sectionLabel:'Protocol',     status:'Approved',        version:'2.0' },
    { id:'doc-002', code:'TMF-03.02.001', name:'Informed Consent Form',       zone:'03', zoneLabel:'Site Documents',          section:'03.02', sectionLabel:'Subject Prot.', status:'Approved',        version:'1.0' },
    { id:'doc-003', code:'TMF-03.03.001', name:'Monitoring Visit Report',     zone:'03', zoneLabel:'Site Documents',          section:'03.03', sectionLabel:'Monitoring',    status:'Pending Review',  version:'1.0' },
    { id:'doc-004', code:'TMF-04.02.001', name:'Ethics Committee Approval',   zone:'04', zoneLabel:'Country Documents',       section:'04.02', sectionLabel:'Ethics Comm.',  status:'Approved',        version:'1.0' },
    { id:'doc-005', code:'TMF-02.02.002', name:'Statistical Analysis Plan',   zone:'02', zoneLabel:'Central Trial Docs',      section:'02.02', sectionLabel:'Data Mgmt.',    status:'Draft',           version:'1.0' },
    { id:'doc-006', code:'TMF-01.04.001', name:'Clinical Trial Agreement',    zone:'01', zoneLabel:'Trial Management',        section:'01.04', sectionLabel:'Trial Agree.',  status:'Approved',        version:'1.0' },
    { id:'doc-007', code:'TMF-03.04.001', name:'Investigator CV & GCP Cert.', zone:'03', zoneLabel:'Site Documents',          section:'03.04', sectionLabel:'Investigator',  status:'Pending Approval',version:'1.0' },
    { id:'doc-008', code:'TMF-05.02.001', name:'IP Accountability Log',       zone:'05', zoneLabel:'Investigational Product', section:'05.02', sectionLabel:'IP Handling',   status:'Approved',        version:'1.0' },
  ];
  const insertDoc = db.prepare(`INSERT OR IGNORE INTO documents (id,tenant_id,study_id,artifact_code,artifact_name,zone,zone_label,section,section_label,title,version,status,mandatory,confidential,country,effective_date,created_at,created_by,author_id,reviewer_id,approver_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  docs.forEach(d => insertDoc.run(d.id, tenantId, 'study-001', d.code, d.name, d.zone, d.zoneLabel, d.section, d.sectionLabel, d.name+' v'+d.version, d.version, d.status, 1, 0, 'USA', '2024-01-15', now, 'usr-001', 'usr-002', 'usr-003', 'usr-004'));

  // Seed audit entries
  const insertAudit = db.prepare(`INSERT OR IGNORE INTO audit_log (id,tenant_id,study_id,document_id,user_id,user_name,user_role,action,object_type,object_id,object_name,detail,ip_address,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  insertAudit.run('aud-001',tenantId,'study-001','doc-001','usr-001','Elena Vasquez','TMF Manager','Approved','document','doc-001','Protocol v2.0','E-signature applied — SIG-A9F3B2','10.0.1.45','2025-03-20 14:32:00');
  insertAudit.run('aud-002',tenantId,'study-001','doc-003','usr-003','Marcus Williams','CRA / Reviewer','Submitted for Review','document','doc-003','Monitoring Visit Report','Submitted to review queue','10.0.2.12','2025-03-20 11:10:00');
  insertAudit.run('aud-003',tenantId,'study-001','doc-002','usr-002','Dr. Sarah Chen','Principal Investigator','Downloaded','document','doc-002','Informed Consent Form','Document downloaded','192.168.4.3','2025-03-19 09:22:00');

  // Seed functional roles
  const insertFRole = db.prepare(`INSERT OR IGNORE INTO functional_roles (id,tenant_id,name,description,capabilities) VALUES (?,?,?,?,?)`);
  insertFRole.run('frole-001', tenantId, 'Lead Study Manager', 'Oversees trial documentation and workflow approvals', JSON.stringify(['canView', 'canUpload', 'canReview', 'canApprove', 'canAdmin']));
  insertFRole.run('frole-002', tenantId, 'Quality Assurance Specialist', 'Conducts quality audits and QC inspections', JSON.stringify(['canView', 'canReview']));
  insertFRole.run('frole-003', tenantId, 'Site CRA / Monitor', 'Manages site visits and monitoring reports', JSON.stringify(['canView', 'canUpload']));
  insertFRole.run('frole-004', tenantId, 'Regulatory Affairs Director', 'Approves regulatory filings and protocol amendments', JSON.stringify(['canView', 'canApprove']));

  // Seed user functional roles
  const insertUFRole = db.prepare(`INSERT OR IGNORE INTO user_functional_roles (user_id, role_id) VALUES (?,?)`);
  insertUFRole.run('usr-001', 'frole-001');

  // Seed notifications
  const insertNotif = db.prepare(`INSERT OR IGNORE INTO notifications (id,tenant_id,user_id,type,title,priority,read,created_at) VALUES (?,?,?,?,?,?,?,?)`);
  insertNotif.run('notif-001',tenantId,'usr-001','task','Protocol Amendment v3.0 awaiting review','high',0,now);
  insertNotif.run('notif-002',tenantId,'usr-001','expiry','Investigator CV for Site-002 expires in 14 days','high',0,now);

  console.log('✅ Demo data seeded');
}

export function appendAudit(entry) {
  const db = getDB();
  db.prepare(`INSERT INTO audit_log (id,tenant_id,study_id,document_id,user_id,user_name,user_role,action,object_type,object_id,object_name,detail,old_value,new_value,ip_address,session_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`)
    .run(uuid(), entry.tenantId, entry.studyId||null, entry.documentId||null, entry.userId||null, entry.userName, entry.userRole||null, entry.action, entry.objectType||null, entry.objectId||null, entry.objectName||null, entry.detail||null, entry.oldValue||null, entry.newValue||null, entry.ip||null, entry.sessionId||null);
}
