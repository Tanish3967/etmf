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
      username          TEXT,
      password_hash     TEXT NOT NULL,
      role              TEXT NOT NULL,
      dept              TEXT,
      active            INTEGER DEFAULT 1,
      mfa_secret        TEXT,
      mfa_enabled       INTEGER DEFAULT 0,
      mfa_recovery_codes TEXT DEFAULT '[]',
      failed_attempts   INTEGER DEFAULT 0,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until      TEXT,
      must_change_password INTEGER DEFAULT 0,
      last_login        TEXT,
      password_changed  TEXT DEFAULT (datetime('now')),
      created_at        TEXT DEFAULT (datetime('now')),
      created_by        TEXT,
      UNIQUE(tenant_id, email)
    );

    -- ── PASSWORD HISTORY (21 CFR Part 11 §3) ──────────────────────────
    CREATE TABLE IF NOT EXISTS password_history (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id),
      password_hash TEXT NOT NULL,
      created_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pwd_hist_user ON password_history(user_id, created_at);

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
      file_sha256      TEXT,
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
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      study_id         TEXT NOT NULL REFERENCES studies(id),
      folder_id        TEXT REFERENCES folder_configs(id),
      artifact_code    TEXT NOT NULL,
      artifact_name    TEXT NOT NULL,
      zone             TEXT NOT NULL,
      zone_label       TEXT,
      section          TEXT NOT NULL,
      section_label    TEXT,
      mandatory        INTEGER DEFAULT 1,
      is_mandatory     INTEGER DEFAULT 1,
      expected_by      TEXT,
      expected_by_date TEXT,
      na_designated    INTEGER DEFAULT 0,
      na_reason        TEXT,
      na_by            TEXT REFERENCES users(id),
      na_at            TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      created_by       TEXT,
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

    CREATE TABLE IF NOT EXISTS file_plans (
      id               TEXT PRIMARY KEY,
      tenant_id        TEXT NOT NULL,
      study_id         TEXT NOT NULL REFERENCES studies(id),
      plan_name        TEXT NOT NULL,
      plan_json        TEXT NOT NULL,
      milestone_date   TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    -- ── QUALITY CONTROL & AUDIT PLANS (Phase 6 §11) ──────────────────
    CREATE TABLE IF NOT EXISTS audit_plans (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL REFERENCES tenants(id),
      title             TEXT NOT NULL,
      study_id          TEXT REFERENCES studies(id),
      lead_auditor      TEXT NOT NULL,
      start_date        TEXT NOT NULL,
      end_date          TEXT NOT NULL,
      scope_description TEXT,
      status            TEXT DEFAULT 'Draft', -- 'Draft', 'Active', 'Completed'
      created_by        TEXT,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_participants (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL REFERENCES tenants(id),
      audit_plan_id     TEXT NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
      user_id           TEXT,
      user_name         TEXT NOT NULL,
      role              TEXT NOT NULL, -- 'Lead Auditor', 'Auditor', 'Auditee', 'Observer'
      notification_sent INTEGER DEFAULT 0,
      assigned_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_plan_documents (
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL REFERENCES tenants(id),
      audit_plan_id  TEXT NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
      document_id    TEXT NOT NULL REFERENCES documents(id),
      status         TEXT DEFAULT 'Pending', -- 'Pending', 'Audited', 'Conformant', 'Deficient'
      findings       TEXT,
      audited_by     TEXT,
      audited_at     TEXT,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS signature_reason_templates (
      id             TEXT PRIMARY KEY,
      tenant_id      TEXT NOT NULL REFERENCES tenants(id),
      reason_code    TEXT NOT NULL,
      description    TEXT NOT NULL,
      role_required  TEXT,
      is_active      INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now')),
      UNIQUE(tenant_id, reason_code)
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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_study_code ON sites(study_id, site_code, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_plans_tenant      ON audit_plans(tenant_id, study_id);
    CREATE INDEX IF NOT EXISTS idx_audit_participants_plan ON audit_participants(audit_plan_id, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_plan_docs_plan    ON audit_plan_documents(audit_plan_id, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_plan_docs_doc     ON audit_plan_documents(document_id);
    CREATE INDEX IF NOT EXISTS idx_sig_reasons_tenant      ON signature_reason_templates(tenant_id, reason_code);
    -- ── MIGRATIONS (Safe column additions) ───────────────────────────
  `);

  const addColumn = (table, col, def) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch (e) {}
  };
  addColumn('documents', 'active', 'INTEGER DEFAULT 1');
  addColumn('documents', 'is_pinned', 'INTEGER DEFAULT 0');
  addColumn('documents', 'is_redacted', 'INTEGER DEFAULT 0');
  addColumn('documents', 'file_sha256', 'TEXT');
  addColumn('documents', 'workflow_type', "TEXT DEFAULT 'Review and Approve'");
  addColumn('documents', 'signoff_id', 'TEXT');
  addColumn('documents', 'publisher_id', 'TEXT');
  addColumn('documents', 'display_name', 'TEXT');
  addColumn('documents', 'site_name', 'TEXT');
  try {
    db.exec(`UPDATE documents SET display_name = title WHERE display_name IS NULL OR display_name = ''`);
  } catch (e) {}

  // Phase 1: 21 CFR Part 11 & Core Security Hardening
  addColumn('users', 'username', 'TEXT');
  addColumn('users', 'failed_login_attempts', 'INTEGER DEFAULT 0');
  addColumn('users', 'locked_until', 'TEXT');
  addColumn('users', 'must_change_password', 'INTEGER DEFAULT 0');
  addColumn('users', 'mfa_recovery_codes', "TEXT DEFAULT '[]'");
  try {
    db.exec(`UPDATE users SET username = email WHERE username IS NULL OR username = ''`);
  } catch (e) {}
  try {
    db.exec(`CREATE VIEW IF NOT EXISTS audit_trail AS SELECT * FROM audit_log`);
  } catch (e) {}
  
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
  addColumn('forms_data', 'is_frozen', 'INTEGER DEFAULT 0');
  addColumn('forms_data', 'frozen_by', 'TEXT');
  addColumn('forms_data', 'frozen_at', 'TEXT');
  addColumn('forms_schemas', 'zone', "TEXT DEFAULT '05'");
  addColumn('forms_schemas', 'section', "TEXT DEFAULT '05.02'");
  addColumn('forms_schemas', 'artifact_code', "TEXT DEFAULT '05.02.01'");

  // Phase 5: Security & Application Administration Enhancements (§8.5)
  addColumn('users', 'auth_type', "TEXT DEFAULT 'DB'");
  addColumn('documents', 'is_blinded', 'INTEGER DEFAULT 0');
  addColumn('annotations', 'annotation_type', "TEXT DEFAULT 'Note'");
  addColumn('annotations', 'annotation_text', 'TEXT');
  addColumn('annotations', 'position_x', 'REAL DEFAULT 0');
  addColumn('annotations', 'position_y', 'REAL DEFAULT 0');
  addColumn('annotations', 'replies', "TEXT DEFAULT '[]'");
  addColumn('annotations', 'resolved', 'INTEGER DEFAULT 0');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS document_notes (
        id              TEXT PRIMARY KEY,
        document_id     TEXT NOT NULL REFERENCES documents(id),
        tenant_id       TEXT NOT NULL,
        user_id         TEXT NOT NULL REFERENCES users(id),
        user_name       TEXT,
        text            TEXT NOT NULL,
        visibility      TEXT DEFAULT 'Reviewer,Approver',
        note_to_file    INTEGER DEFAULT 0,
        show_all_versions INTEGER DEFAULT 1,
        created_at      TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS document_access_log (
        id              TEXT PRIMARY KEY,
        document_id     TEXT NOT NULL REFERENCES documents(id),
        tenant_id       TEXT NOT NULL,
        user_id         TEXT REFERENCES users(id),
        user_name       TEXT,
        user_role       TEXT,
        action          TEXT NOT NULL,
        version         TEXT,
        ip_address      TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS document_move_log (
        id              TEXT PRIMARY KEY,
        document_id     TEXT NOT NULL REFERENCES documents(id),
        tenant_id       TEXT NOT NULL,
        from_path       TEXT,
        to_path         TEXT,
        reason          TEXT,
        moved_by        TEXT,
        moved_by_name   TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS document_copy_log (
        id              TEXT PRIMARY KEY,
        source_doc_id   TEXT NOT NULL REFERENCES documents(id),
        target_doc_id   TEXT NOT NULL REFERENCES documents(id),
        tenant_id       TEXT NOT NULL,
        from_path       TEXT,
        to_path         TEXT,
        copied_by       TEXT,
        copied_by_name  TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );
    `);
  } catch (e) {}
  addColumn('user_groups', 'privileges', "TEXT DEFAULT '[]'");
  addColumn('user_groups', 'folder_assignments', "TEXT DEFAULT '[]'");
  addColumn('studies', 'countries', "TEXT DEFAULT '[]'");
  addColumn('folder_configs', 'milestone_date', 'TEXT');
  addColumn('folder_configs', 'actual_milestone_date', 'TEXT');
  addColumn('folder_configs', 'pinned_user_ids', "TEXT DEFAULT '[]'");
  addColumn('folder_configs', 'pinned_enterprise', 'INTEGER DEFAULT 0');
  addColumn('placeholders', 'folder_id', 'TEXT REFERENCES folder_configs(id)');
  addColumn('placeholders', 'zone_label', 'TEXT');
  addColumn('placeholders', 'section_label', 'TEXT');
  addColumn('placeholders', 'mandatory', 'INTEGER DEFAULT 1');
  addColumn('placeholders', 'is_mandatory', 'INTEGER DEFAULT 1');
  addColumn('placeholders', 'expected_by', 'TEXT');
  addColumn('placeholders', 'expected_by_date', 'TEXT');
  addColumn('placeholders', 'created_by', 'TEXT');
  addColumn('placeholders', 'na_reason', 'TEXT');
  addColumn('placeholders', 'na_by', 'TEXT');
  addColumn('placeholders', 'na_at', 'TEXT');

  // Phase 6 M3: Background Automation Daemons (Inactive Document Purge & SLA Reminders)
  addColumn('documents', 'deleted_at', 'TEXT');
  addColumn('documents', 'updated_at', 'TEXT');
  addColumn('documents', 'retention_days', 'INTEGER DEFAULT 30');
  addColumn('documents', 'sla_reminder_1_sent_at', 'TEXT');
  addColumn('documents', 'sla_reminder_2_sent_at', 'TEXT');
  addColumn('notifications', 'metadata', "TEXT DEFAULT '{}'");
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_docs_active_status ON documents(tenant_id, active, status);
      CREATE INDEX IF NOT EXISTS idx_docs_deleted_at ON documents(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_docs_sla_reminders ON documents(sla_reminder_1_sent_at, sla_reminder_2_sent_at);
    `);
  } catch (e) {}

  await seedClinicalForms();
  await seedDemoData();
  await seedSecurityAndAdminData(db);
  await seedPhase6Data(db);
  await seedPhase7ThreeReferenceSchemaAndData(db);
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
  const insertUser = db.prepare(`INSERT OR IGNORE INTO users (id,tenant_id,name,email,username,password_hash,role,dept,active,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,1,?,?)`);
  const insertPwdHist = db.prepare(`INSERT OR IGNORE INTO password_history (id, user_id, password_hash, created_at) VALUES (?, ?, ?, ?)`);
  users.forEach(u => {
    insertUser.run(u.id, tenantId, u.name, u.email, u.email, pwHash, u.role, u.dept, now, 'system');
    insertPwdHist.run(`ph-${u.id}-init`, u.id, pwHash, now);
  });

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

async function seedSecurityAndAdminData(db) {
  const tenantId = 'tenant-001';
  const now = new Date().toISOString();

  // 1. Seed 21 Standard Clinical Functional Roles (§8.5.1.3 & §8.5.1.4)
  const clinicalRoles = [
    { id: 'frole-001', name: 'Lead Study Manager', description: 'Oversees trial documentation and workflow approvals', caps: ['canView', 'canUpload', 'canReview', 'canApprove', 'canAdmin'] },
    { id: 'frole-002', name: 'Quality Assurance Specialist', description: 'Conducts quality audits and QC inspections', caps: ['canView', 'canReview'] },
    { id: 'frole-003', name: 'Site CRA / Monitor', description: 'Manages site visits and monitoring reports', caps: ['canView', 'canUpload'] },
    { id: 'frole-004', name: 'Regulatory Affairs Director', description: 'Approves regulatory filings and protocol amendments', caps: ['canView', 'canApprove'] },
    { id: 'frole-005', name: 'Principal Investigator (PI)', description: 'Responsible for overall trial conduct and subject safety at site', caps: ['canView', 'canUpload', 'canApprove'] },
    { id: 'frole-006', name: 'Sub-Investigator', description: 'Assists PI in conduct of trial procedures and protocol activities', caps: ['canView', 'canUpload'] },
    { id: 'frole-007', name: 'Clinical Research Coordinator (CRC)', description: 'Coordinates site visits, patient logs, and source documentation', caps: ['canView', 'canUpload'] },
    { id: 'frole-008', name: 'Clinical Data Manager', description: 'CRF design, data validation, query resolution, and database lock', caps: ['canView', 'canUpload', 'canReview'] },
    { id: 'frole-009', name: 'Biostatistician', description: 'Develops SAP and analyzes clinical trial endpoints', caps: ['canView', 'canUpload', 'canReview'] },
    { id: 'frole-010', name: 'Medical Monitor', description: 'Reviews safety events, protocol deviations, and SAE reporting', caps: ['canView', 'canReview', 'canApprove'] },
    { id: 'frole-011', name: 'Drug Safety / PV Associate', description: 'Processes SUSARs, CIOMS forms, and pharmacovigilance narratives', caps: ['canView', 'canUpload', 'canReview'] },
    { id: 'frole-012', name: 'TMF Specialist / Archivist', description: 'Manages eTMF filing completeness, index maintenance, and archiving', caps: ['canView', 'canUpload', 'canReview', 'canLock'] },
    { id: 'frole-013', name: 'Clinical Project Director', description: 'Executive sponsor oversight across multicenter trial programs', caps: ['canView', 'canApprove', 'canAdmin'] },
    { id: 'frole-014', name: 'Medical Writer', description: 'Authoring of clinical study protocols, CSRs, and Investigator Brochures', caps: ['canView', 'canUpload'] },
    { id: 'frole-015', name: 'Central Monitoring Specialist', description: 'Performs risk-based centralized data analytics and site surveillance', caps: ['canView', 'canReview'] },
    { id: 'frole-016', name: 'Site Contracts & Budget Specialist', description: 'Negotiates and files Clinical Trial Agreements (CTAs) and grants', caps: ['canView', 'canUpload'] },
    { id: 'frole-017', name: 'Clinical Supply & IP Manager', description: 'Oversees investigational drug shipment, temperature logs, and returns', caps: ['canView', 'canUpload', 'canReview'] },
    { id: 'frole-018', name: 'IRB / Ethics Committee Coordinator', description: 'Coordinates central and institutional ethics committee approvals', caps: ['canView', 'canUpload', 'canApprove'] },
    { id: 'frole-019', name: 'Clinical Laboratory Specialist', description: 'Maintains laboratory accreditations (CLIA/CAP) and reference ranges', caps: ['canView', 'canUpload'] },
    { id: 'frole-020', name: 'Regulatory Submissions Lead', description: 'Compiles and files IND, CTA, and NDA regulatory dossier submissions', caps: ['canView', 'canUpload', 'canReview', 'canApprove'] },
    { id: 'frole-021', name: 'System Administrator', description: 'Administers enterprise security, users, role permissions, and eTMF setup', caps: ['canView', 'canUpload', 'canReview', 'canApprove', 'canAdmin', 'canLock'] },
    // 24 Standard Clinevo Functional Role Codes (§8.5.1.3 & §8.5.1.4)
    { id: 'frole-c01', name: 'APPLICATION_ADMIN', description: 'Clinevo Application Administrator role', caps: ['canView', 'canAdmin'] },
    { id: 'frole-c02', name: 'APPROVER', description: 'Clinevo Document Approver role', caps: ['canView', 'canApprove'] },
    { id: 'frole-c03', name: 'ARCHIVAL', description: 'Clinevo Study Archival & Retention role', caps: ['canView', 'canLock'] },
    { id: 'frole-c04', name: 'AUDIT_FINAL_REPORT_APPROVER', description: 'Approves final QA audit reports', caps: ['canView', 'canApprove'] },
    { id: 'frole-c05', name: 'AUDIT_FINDINGS_RESOLVER', description: 'Resolves audit findings and CAPA actions', caps: ['canView', 'canUpload', 'canReview'] },
    { id: 'frole-c06', name: 'AUDIT_MANAGER', description: 'Manages clinical quality audits', caps: ['canView', 'canReview', 'canApprove'] },
    { id: 'frole-c07', name: 'AUTHOR', description: 'Clinevo Document Author / Uploader role', caps: ['canView', 'canUpload'] },
    { id: 'frole-c08', name: 'BLIND_UNBLIND', description: 'Authorized to blind/unblind and view blinded records', caps: ['canView', 'canBlind'] },
    { id: 'frole-c09', name: 'CHECKIN_ADMIN', description: 'Authorized to force uncheck / check-in locked documents', caps: ['canView', 'canAdmin'] },
    { id: 'frole-c10', name: 'CLINICAL_HEAD', description: 'Clinical Operations Head oversight role', caps: ['canView', 'canApprove'] },
    { id: 'frole-c11', name: 'CREATE_PLACEHOLDER', description: 'Authorized to create EDL placeholders and file plans', caps: ['canView', 'canUpload'] },
    { id: 'frole-c12', name: 'DOWNLOAD_DOCUMENT', description: 'Authorized to download original and watermarked documents', caps: ['canView', 'canDownload'] },
    { id: 'frole-c13', name: 'FILEMOVE_ADMIN', description: 'Authorized to move and copy documents across folders', caps: ['canView', 'canAdmin'] },
    { id: 'frole-c14', name: 'INDEX_UPLOAD', description: 'Authorized for bulk index upload and classification', caps: ['canView', 'canUpload'] },
    { id: 'frole-c15', name: 'LOCK_ADMIN', description: 'Authorized to lock/unlock studies and folders', caps: ['canView', 'canLock'] },
    { id: 'frole-c16', name: 'PUBLISH_COORDINATOR', description: 'Coordinates final document publishing', caps: ['canView', 'canApprove'] },
    { id: 'frole-c17', name: 'QC_ISSUE_TESTER', description: 'Executes quality check testing and defect verification', caps: ['canView', 'canReview'] },
    { id: 'frole-c18', name: 'QC_MANAGER', description: 'Manages quality control queues and SLA compliance', caps: ['canView', 'canReview', 'canApprove'] },
    { id: 'frole-c19', name: 'QUALITY_CHECK', description: 'Performs document-level quality checks', caps: ['canView', 'canReview'] },
    { id: 'frole-c20', name: 'READ_ONLY', description: 'Read-only viewer / inspector access', caps: ['canView'] },
    { id: 'frole-c21', name: 'REVIEWER', description: 'Clinevo Document Reviewer role', caps: ['canView', 'canReview'] },
    { id: 'frole-c22', name: 'ROLES_ADMIN', description: 'Manages functional roles and user group permissions', caps: ['canView', 'canAdmin'] },
    { id: 'frole-c23', name: 'SOFT_DELETE', description: 'Authorized to inactivate / soft-delete documents', caps: ['canView', 'canAdmin'] },
    { id: 'frole-c24', name: 'SUPERUSER', description: 'Enterprise Superuser with full system privileges', caps: ['canView', 'canUpload', 'canReview', 'canApprove', 'canAdmin', 'canLock', 'canBlind'] }
  ];

  const insRole = db.prepare('INSERT OR IGNORE INTO functional_roles (id, tenant_id, name, description, capabilities) VALUES (?, ?, ?, ?, ?)');
  clinicalRoles.forEach(r => insRole.run(r.id, tenantId, r.name, r.description, JSON.stringify(r.caps)));

  // Assign standard roles to existing users
  const insUFR = db.prepare('INSERT OR IGNORE INTO user_functional_roles (user_id, role_id) VALUES (?, ?)');
  insUFR.run('usr-001', 'frole-001');
  insUFR.run('usr-002', 'frole-005');
  insUFR.run('usr-003', 'frole-003');
  insUFR.run('usr-004', 'frole-004');
  insUFR.run('usr-005', 'frole-008');
  insUFR.run('usr-006', 'frole-021');

  // 2. Seed Standard User Groups (§8.5.1.2)
  const groupCount = db.prepare('SELECT COUNT(*) as c FROM user_groups WHERE tenant_id = ?').get(tenantId).c;
  if (groupCount === 0) {
    const groups = [
      {
        id: 'ugrp-001',
        name: 'Clinical Operations Leads',
        description: 'Trial managers, operational leads, and study directors',
        privileges: ['author', 'reviewer', 'approver', 'downloader'],
        zones: ['01', '02', '05'],
        folder_assignments: ['01 Trial Management', '02 Central Trial Documents', '05 Site Management'],
        members: ['usr-001']
      },
      {
        id: 'ugrp-002',
        name: 'Site CRA Monitors',
        description: 'Field clinical research associates and site monitoring teams',
        privileges: ['author', 'downloader'],
        zones: ['03', '05'],
        folder_assignments: ['03 Regulatory', '05 Site Management'],
        members: ['usr-003']
      },
      {
        id: 'ugrp-003',
        name: 'Regulatory & Ethics Approvers',
        description: 'Regulatory affairs directors and institutional review board liaisons',
        privileges: ['reviewer', 'approver', 'downloader'],
        zones: ['03', '04'],
        folder_assignments: ['03 Regulatory', '04 IRB / IEC'],
        members: ['usr-004']
      },
      {
        id: 'ugrp-004',
        name: 'Unblinded Biostatistics Team',
        description: 'Unblinded biostatisticians and independent data monitoring committee',
        privileges: ['author', 'reviewer', 'blinded'],
        zones: ['10', '11'],
        folder_assignments: ['10 Data Management', '11 Statistics'],
        members: ['usr-005']
      }
    ];

    const insGrp = db.prepare('INSERT INTO user_groups (id, tenant_id, name, description, is_active, zones, privileges, folder_assignments, created_by) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)');
    const insMem = db.prepare('INSERT OR IGNORE INTO user_group_members (group_id, user_id) VALUES (?, ?)');
    groups.forEach(g => {
      insGrp.run(g.id, tenantId, g.name, g.description, JSON.stringify(g.zones), JSON.stringify(g.privileges), JSON.stringify(g.folder_assignments), 'system');
      g.members.forEach(m => insMem.run(g.id, m));
    });
  }

  // 3. Seed Department and Designation Codelists (§8.5.2.1 & §8.5.2.2)
  const codelistCount = db.prepare('SELECT COUNT(*) as c FROM system_codelists WHERE tenant_id = ?').get(tenantId).c;
  if (codelistCount === 0) {
    const depts = [
      { code: 'DEPT-CLIN-OPS', name: 'Clinical Operations' },
      { code: 'DEPT-REG-AFF', name: 'Regulatory Affairs' },
      { code: 'DEPT-QA-COMP', name: 'Quality Assurance & Compliance' },
      { code: 'DEPT-DATA-MGMT', name: 'Data Management & Biostatistics' },
      { code: 'DEPT-MED-AFF', name: 'Medical Affairs & Pharmacovigilance' },
      { code: 'DEPT-TMF-OPS', name: 'TMF Operations & Archiving' },
      { code: 'DEPT-IT-SYS', name: 'IT & System Administration' }
    ];
    const desigs = [
      { code: 'DESIG-TMF-MGR', name: 'TMF Manager' },
      { code: 'DESIG-PI', name: 'Principal Investigator' },
      { code: 'DESIG-SR-CRA', name: 'Senior Clinical Research Associate' },
      { code: 'DESIG-REG-DIR', name: 'Regulatory Affairs Director' },
      { code: 'DESIG-LEAD-DM', name: 'Lead Clinical Data Manager' },
      { code: 'DESIG-BIOSTAT', name: 'Lead Biostatistician' },
      { code: 'DESIG-MED-MON', name: 'Medical Monitor' },
      { code: 'DESIG-QA-AUD', name: 'QA Auditor' },
      { code: 'DESIG-SYS-ADMIN', name: 'System Administrator' }
    ];

    const insCode = db.prepare('INSERT OR IGNORE INTO system_codelists (id, tenant_id, code, name, group_name, is_active, created_by) VALUES (?, ?, ?, ?, ?, 1, ?)');
    depts.forEach(d => insCode.run(uuid(), tenantId, d.code, d.name, 'Department', 'system'));
    desigs.forEach(d => insCode.run(uuid(), tenantId, d.code, d.name, 'Designation', 'system'));
  }
}

async function seedPhase6Data(db) {
  try {
    const tenantId = 'tenant-001';
    const sigReasonCount = db.prepare('SELECT COUNT(*) as c FROM signature_reason_templates WHERE tenant_id = ?').get(tenantId).c;
    if (sigReasonCount === 0) {
      const defaultReasons = [
        { reason_code: 'AUTHOR_APPROVAL', description: 'I confirm that I am the author of this document and approve its content.', role_required: 'AUTHOR' },
        { reason_code: 'QUALITY_REVIEW', description: 'I confirm that a formal quality review has been performed according to standard operating procedures.', role_required: 'QUALITY_CHECK' },
        { reason_code: 'REGULATORY_SIGNOFF', description: 'I verify that this document meets all regulatory requirements and is ready for submission.', role_required: 'APPROVER' },
        { reason_code: 'SPONSOR_VERIFICATION', description: 'I confirm that sponsor oversight and verification have been completed satisfactorily.', role_required: 'CLINICAL_HEAD' }
      ];
      const ins = db.prepare(`
        INSERT OR IGNORE INTO signature_reason_templates (id, tenant_id, reason_code, description, role_required, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
      `);
      defaultReasons.forEach(r => {
        ins.run(uuid(), tenantId, r.reason_code, r.description, r.role_required);
      });
      console.log('✅ Default signature reason templates seeded');
    }

    // Milestone M3: Seed default organization profile for REMOVE_ALL_INACTIVE_DOCUMENTS if not present
    const existingProfile = db.prepare('SELECT id FROM organization_profiles WHERE name = ? AND tenant_id = ?').get('REMOVE_ALL_INACTIVE_DOCUMENTS', tenantId);
    if (!existingProfile) {
      db.prepare(`
        INSERT INTO organization_profiles (id, tenant_id, profile_type, name, description, value_str, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuid(),
        tenantId,
        'Configurable',
        'REMOVE_ALL_INACTIVE_DOCUMENTS',
        'Automated background retention purge threshold in days for inactive documents (§8.5.2.11)',
        '30',
        'system'
      );
      console.log('✅ Default REMOVE_ALL_INACTIVE_DOCUMENTS profile seeded');
    }
  } catch (e) {
    console.error('Error seeding Phase 6 data:', e.message);
  }
}

async function seedPhase7ThreeReferenceSchemaAndData(db) {
  try {
    const addCol = (table, col, def) => {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch (e) {}
    };

    // Add Phase 7 columns to existing tables
    addCol('users', 'otp_status', "TEXT DEFAULT 'Active'");
    addCol('users', 'otp_code_hash', 'TEXT');
    addCol('users', 'otp_expires_at', 'TEXT');
    addCol('users', 'deactivation_effective_at', 'TEXT');
    addCol('users', 'deactivation_reason', 'TEXT');

    addCol('studies', 'blinding_type', "TEXT DEFAULT 'Double Blind'");
    addCol('studies', 'randomisation', "TEXT DEFAULT 'Randomised'");
    addCol('studies', 'drug_ip_name', "TEXT DEFAULT 'XYZ-001'");
    addCol('studies', 'edl_template_id', 'TEXT');
    addCol('studies', 'fpi_planned_date', 'TEXT');
    addCol('studies', 'fpi_actual_date', 'TEXT');
    addCol('studies', 'retention_years', 'INTEGER DEFAULT 25');
    addCol('studies', 'retention_end_date', 'TEXT');
    addCol('studies', 'archive_destination', "TEXT DEFAULT 'Platform Cloud Archive'");
    addCol('studies', 'archive_checksum', 'TEXT');
    addCol('studies', 'archived_at', 'TEXT');
    addCol('studies', 'ai_enabled', 'INTEGER DEFAULT 1');

    addCol('placeholders', 'level', "TEXT DEFAULT 'Study'");
    addCol('placeholders', 'country', 'TEXT');
    addCol('placeholders', 'site_id', 'TEXT');
    addCol('placeholders', 'milestone_code', "TEXT DEFAULT 'M02'");
    addCol('placeholders', 'due_status', "TEXT DEFAULT 'Pending'");
    addCol('placeholders', 'due_date', 'TEXT');
    addCol('placeholders', 'escalation_stage', "TEXT DEFAULT 'None'");
    addCol('placeholders', 'last_reminded_at', 'TEXT');
    addCol('placeholders', 'escalated_at', 'TEXT');
    addCol('placeholders', 'assigned_cra_id', 'TEXT');

    addCol('queries', 'level', "TEXT DEFAULT 'Document'");
    addCol('queries', 'country', 'TEXT');
    addCol('queries', 'site_id', 'TEXT');
    addCol('queries', 'placeholder_id', 'TEXT');
    addCol('queries', 'validated_by', 'TEXT');
    addCol('queries', 'capa_triggered', 'INTEGER DEFAULT 0');

    addCol('documents', 'language', "TEXT DEFAULT 'EN'");
    addCol('documents', 'format', "TEXT DEFAULT 'PDF/A-1b'");
    addCol('documents', 'keywords', 'TEXT');
    addCol('documents', 'sponsor_doc_code', 'TEXT');
    addCol('documents', 'doc_number', 'TEXT');

    // Create Phase 7 tables & WORM triggers on audit_log
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_update
      BEFORE UPDATE ON audit_log
      BEGIN
        SELECT RAISE(ABORT, '21 CFR Part 11 violation: audit_log is immutable (WORM) and cannot be updated');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_delete
      BEFORE DELETE ON audit_log
      BEGIN
        SELECT RAISE(ABORT, '21 CFR Part 11 violation: audit_log is immutable (WORM) and cannot be deleted');
      END;

      CREATE TABLE IF NOT EXISTS tenant_setup_progress (
        tenant_id               TEXT PRIMARY KEY,
        step1_tmf_model         INTEGER DEFAULT 1,
        step2_edl_template      INTEGER DEFAULT 1,
        step3_milestones        INTEGER DEFAULT 1,
        step4_user_management   INTEGER DEFAULT 1,
        step5_role_permissions  INTEGER DEFAULT 1,
        selected_tmf_model      TEXT DEFAULT 'v3.2',
        selected_edl_template_id TEXT DEFAULT 'edl-tpl-v32',
        updated_at              TEXT DEFAULT (datetime('now')),
        updated_by              TEXT
      );

      CREATE TABLE IF NOT EXISTS tenant_milestone_configs (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        code            TEXT NOT NULL,
        name            TEXT NOT NULL,
        study_level     INTEGER DEFAULT 1,
        country_level   INTEGER DEFAULT 1,
        site_level      INTEGER DEFAULT 1,
        due_days        INTEGER DEFAULT 30,
        milestone_type  TEXT DEFAULT 'One-time',
        UNIQUE(tenant_id, code)
      );

      CREATE TABLE IF NOT EXISTS edl_templates (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        name            TEXT NOT NULL,
        description     TEXT,
        base_version    TEXT DEFAULT 'v3.2',
        version_number  TEXT DEFAULT '1.0',
        status          TEXT DEFAULT 'Published', -- 'Default', 'Draft', 'Published', 'Deactivated'
        is_default      INTEGER DEFAULT 0,
        is_locked       INTEGER DEFAULT 0,
        study_count     INTEGER DEFAULT 156,
        country_count   INTEGER DEFAULT 100,
        site_count      INTEGER DEFAULT 95,
        optional_excluded INTEGER DEFAULT 106,
        items_json      TEXT DEFAULT '[]',
        created_by      TEXT,
        created_at      TEXT DEFAULT (datetime('now')),
        published_at    TEXT
      );

      CREATE TABLE IF NOT EXISTS tmf_overlays (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        name            TEXT NOT NULL,
        base_model      TEXT DEFAULT 'v3.2',
        changes_json    TEXT DEFAULT '[]',
        created_by      TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS study_milestones (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        study_id        TEXT NOT NULL REFERENCES studies(id),
        code            TEXT NOT NULL,
        name            TEXT NOT NULL,
        level           TEXT DEFAULT 'Study', -- 'Study', 'Country', 'Site'
        country         TEXT,
        site_id         TEXT,
        planned_date    TEXT,
        actual_date     TEXT,
        status          TEXT DEFAULT 'pending', -- 'pending', 'active', 'done', 'always', 'overdue'
        edl_triggered_count INTEGER DEFAULT 0,
        notes           TEXT,
        updated_by      TEXT,
        updated_at      TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS study_user_assignments (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        study_id        TEXT NOT NULL REFERENCES studies(id),
        user_id         TEXT NOT NULL REFERENCES users(id),
        role            TEXT NOT NULL,
        countries_json  TEXT DEFAULT '[]',
        sites_json      TEXT DEFAULT '[]',
        scope_label     TEXT DEFAULT 'All Sites',
        status          TEXT DEFAULT 'Active',
        assigned_by     TEXT,
        assigned_at     TEXT DEFAULT (datetime('now')),
        UNIQUE(tenant_id, study_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS review_rules (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        study_id        TEXT NOT NULL REFERENCES studies(id),
        name            TEXT NOT NULL,
        rule_level      TEXT NOT NULL, -- 'Artifact', 'Zone', 'Study', 'Catch-all'
        priority_order  INTEGER DEFAULT 3, -- 1=Artifact, 2=Zone, 3=Study, 4=Catch-all
        trigger_code    TEXT, -- e.g. '05.03.07' or '07' or '*'
        repository_scope TEXT DEFAULT 'All Sites',
        workflow_type   TEXT DEFAULT 'Two-Step',
        reviewer_id     TEXT,
        reviewer_name   TEXT,
        approver_id     TEXT,
        approver_name   TEXT,
        fallback_reviewer_id TEXT,
        due_days        INTEGER DEFAULT 14,
        priority_tag    TEXT DEFAULT 'Normal',
        created_by      TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ru_distributions (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        study_id        TEXT NOT NULL REFERENCES studies(id),
        document_id     TEXT NOT NULL REFERENCES documents(id),
        document_title  TEXT,
        document_version TEXT DEFAULT '1.0',
        deadline        TEXT,
        status          TEXT DEFAULT 'Open',
        created_by      TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ru_acknowledgements (
        id              TEXT PRIMARY KEY,
        distribution_id TEXT NOT NULL REFERENCES ru_distributions(id),
        tenant_id       TEXT NOT NULL,
        user_id         TEXT NOT NULL REFERENCES users(id),
        user_name       TEXT,
        user_role       TEXT,
        site_code       TEXT,
        status          TEXT DEFAULT 'Pending', -- 'Pending', 'Acknowledged', 'Overdue'
        acknowledged_at TEXT,
        esig_id         TEXT,
        ip_address      TEXT
      );

      CREATE TABLE IF NOT EXISTS inspector_access_grants (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        study_id        TEXT NOT NULL REFERENCES studies(id),
        user_id         TEXT REFERENCES users(id),
        inspector_name  TEXT NOT NULL,
        inspector_email TEXT NOT NULL,
        authority       TEXT NOT NULL, -- 'FDA', 'EMA', 'MHRA', 'BfArM', 'PMDA', 'Internal QA', 'Third-Party Auditor'
        inspector_type  TEXT NOT NULL, -- 'Regulatory Inspector', 'Internal Auditor', 'Third-Party Auditor'
        inspection_type TEXT DEFAULT 'Routine GCP',
        nda_required    INTEGER DEFAULT 0,
        nda_signed      INTEGER DEFAULT 0,
        start_date      TEXT NOT NULL,
        end_date        TEXT NOT NULL,
        status          TEXT DEFAULT 'Active',
        docs_viewed     INTEGER DEFAULT 0,
        created_by      TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS saved_searches (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        user_id         TEXT NOT NULL REFERENCES users(id),
        name            TEXT NOT NULL,
        query_json      TEXT NOT NULL,
        created_at      TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS document_applicability (
        id              TEXT PRIMARY KEY,
        tenant_id       TEXT NOT NULL,
        document_id     TEXT NOT NULL REFERENCES documents(id),
        study_id        TEXT NOT NULL,
        country         TEXT,
        site_id         TEXT,
        created_at      TEXT DEFAULT (datetime('now'))
      );
    `);

    const tenantId = 'tenant-001';

    // Ensure compatibility columns exist on all Phase 7 tables
    addCol('tenant_setup_progress', 'step4_users', 'INTEGER DEFAULT 1');
    addCol('tenant_setup_progress', 'step5_permissions', 'INTEGER DEFAULT 1');
    addCol('tenant_setup_progress', 'completed_at', 'TEXT');

    addCol('tenant_milestone_configs', 'level', "TEXT DEFAULT 'Study'");
    addCol('tenant_milestone_configs', 'edl_items_count', 'INTEGER DEFAULT 15');
    addCol('tenant_milestone_configs', 'is_ongoing', 'INTEGER DEFAULT 0');
    addCol('tenant_milestone_configs', 'updated_at', 'TEXT');

    addCol('edl_templates', 'base_model_version', "TEXT DEFAULT 'DIA v3.2'");
    addCol('edl_templates', 'version', "TEXT DEFAULT 'v1.0'");
    addCol('edl_templates', 'artifacts_json', "TEXT DEFAULT '[]'");

    addCol('tmf_overlays', 'base_version', "TEXT DEFAULT 'DIA v3.2'");
    addCol('tmf_overlays', 'version', "TEXT DEFAULT '1.0'");
    addCol('tmf_overlays', 'custom_artifacts_json', "TEXT DEFAULT '[]'");
    addCol('tmf_overlays', 'naming_aliases_json', "TEXT DEFAULT '{}'");
    addCol('tmf_overlays', 'status', "TEXT DEFAULT 'Active'");

    addCol('study_milestones', 'due_days', 'INTEGER DEFAULT 30');
    addCol('study_milestones', 'edl_items_count', 'INTEGER DEFAULT 15');
    addCol('study_milestones', 'triggered_at', 'TEXT');
    addCol('study_milestones', 'triggered_by', 'TEXT');

    addCol('study_user_assignments', 'study_role', "TEXT DEFAULT 'CRA'");
    addCol('study_user_assignments', 'scope_type', "TEXT DEFAULT 'Site'");
    addCol('study_user_assignments', 'scope_countries', "TEXT DEFAULT '[\"ALL\"]'");
    addCol('study_user_assignments', 'scope_sites', "TEXT DEFAULT '[\"ALL\"]'");
    addCol('study_user_assignments', 'created_at', "TEXT DEFAULT (datetime('now'))");

    addCol('review_rules', 'scope_type', "TEXT DEFAULT 'Zone'");
    addCol('review_rules', 'scope_target', "TEXT DEFAULT 'ALL'");
    addCol('review_rules', 'scope_label', 'TEXT');
    addCol('review_rules', 'priority', 'INTEGER DEFAULT 3');
    addCol('review_rules', 'reviewer_role', "TEXT DEFAULT 'Reviewer'");
    addCol('review_rules', 'approver_role', "TEXT DEFAULT 'Approver'");
    addCol('review_rules', 'sla_days', 'INTEGER DEFAULT 5');

    addCol('ru_distributions', 'title', 'TEXT');
    addCol('ru_distributions', 'version', "TEXT DEFAULT '1.0'");
    addCol('ru_distributions', 'reason', 'TEXT');
    addCol('ru_distributions', 'target_roles', "TEXT DEFAULT '[]'");
    addCol('ru_distributions', 'target_sites', "TEXT DEFAULT '[]'");
    addCol('ru_distributions', 'deadline_date', 'TEXT');

    addCol('ru_acknowledgements', 'signature_meaning', 'TEXT');
    addCol('ru_acknowledgements', 'signature_hash', 'TEXT');

    addCol('inspector_access_grants', 'agency', "TEXT DEFAULT 'EMA'");
    addCol('inspector_access_grants', 'scope_zones', "TEXT DEFAULT '[\"ALL\"]'");
    addCol('inspector_access_grants', 'scope_countries', "TEXT DEFAULT '[\"ALL\"]'");
    addCol('inspector_access_grants', 'scope_sites', "TEXT DEFAULT '[\"ALL\"]'");
    addCol('inspector_access_grants', 'valid_from', 'TEXT');
    addCol('inspector_access_grants', 'valid_until', 'TEXT');
    addCol('inspector_access_grants', 'nda_accepted_at', 'TEXT');

    addCol('saved_searches', 'query_text', 'TEXT');
    addCol('saved_searches', 'filters_json', "TEXT DEFAULT '{}'");
    addCol('saved_searches', 'is_shared', 'INTEGER DEFAULT 0');

    // Sync compatibility columns on seeded rows
    db.exec(`
      UPDATE tenant_setup_progress SET step4_users = COALESCE(step4_user_management, 1), step5_permissions = COALESCE(step5_role_permissions, 1);
      UPDATE tenant_milestone_configs SET is_ongoing = CASE WHEN code = 'M11' THEN 1 ELSE 0 END;
      UPDATE edl_templates SET artifacts_json = CASE WHEN artifacts_json IS NULL OR artifacts_json = '[]' THEN COALESCE(items_json, '[]') ELSE artifacts_json END, base_model_version = COALESCE(base_version, 'DIA v3.2'), version = COALESCE(version_number, '1.0');
      UPDATE study_user_assignments SET study_role = COALESCE(role, 'CRA'), scope_countries = COALESCE(countries_json, '["ALL"]'), scope_sites = COALESCE(sites_json, '["ALL"]');
      UPDATE review_rules SET scope_type = COALESCE(rule_level, 'Zone'), scope_target = COALESCE(trigger_code, '*'), scope_label = COALESCE(name, trigger_code), priority = COALESCE(priority_order, 3), sla_days = COALESCE(due_days, 14);
      UPDATE ru_distributions SET title = COALESCE(document_title, 'Protocol Amendment v2.0'), version = COALESCE(document_version, '2.0'), deadline_date = COALESCE(deadline, date('now', '+14 days'));
      UPDATE inspector_access_grants SET agency = COALESCE(authority, 'EMA'), valid_from = COALESCE(start_date, date('now')), valid_until = COALESCE(end_date, date('now', '+30 days'));
    `);

    // Seed baseline EDL placeholders for study-001 if none exist
    const phCount = db.prepare('SELECT COUNT(*) as c FROM placeholders WHERE study_id = ?').get('study-001').c;
    if (phCount === 0) {
      const seedPhs = [
        { code: '01.01.01', name: 'Trial Master File Plan', zone: '01', sec: '01.01', ms: 'M02', due: '2026-01-15' },
        { code: '01.01.08', name: 'Monitoring Plan', zone: '01', sec: '01.01', ms: 'M02', due: '2026-01-20' },
        { code: '02.01.02', name: 'Protocol', zone: '02', sec: '02.01', ms: 'M01', due: '2026-01-10' },
        { code: '03.01.02', name: 'Regulatory Authority Decision', zone: '03', sec: '03.01', ms: 'M01', due: '2026-02-01' },
        { code: '04.01.02', name: 'IRB or IEC Decision', zone: '04', sec: '04.01', ms: 'M03', due: '2026-02-10' },
        { code: '05.02.04', name: 'Principal Investigator CV', zone: '05', sec: '05.02', ms: 'M03', due: '2026-02-15' },
      ];
      const insPh = db.prepare(`
        INSERT OR IGNORE INTO placeholders (id, tenant_id, study_id, artifact_code, artifact_name, zone, section, mandatory, is_mandatory, milestone_code, due_status, due_date, expected_by, expected_by_date, escalation_stage)
        VALUES (?, ?, 'study-001', ?, ?, ?, ?, 1, 1, ?, 'Due', ?, ?, ?, 'None')
      `);
      seedPhs.forEach((p, idx) => {
        insPh.run(`ph-study-001-${idx + 1}`, tenantId, p.code, p.name, p.zone, p.sec, p.ms, p.due, p.due, p.due);
      });
    }

    // 1. Seed tenant_setup_progress
    db.prepare(`
      INSERT OR IGNORE INTO tenant_setup_progress (
        tenant_id, step1_tmf_model, step2_edl_template, step3_milestones, step4_user_management, step5_role_permissions, selected_tmf_model, selected_edl_template_id, updated_by
      ) VALUES (?, 1, 1, 1, 1, 1, 'v3.2', 'edl-tpl-v32', 'system')
    `).run(tenantId);

    // 2. Seed M01-M12 tenant_milestone_configs (Ref 1 screen-milestones)
    const msCount = db.prepare('SELECT COUNT(*) as c FROM tenant_milestone_configs WHERE tenant_id = ?').get(tenantId).c;
    if (msCount === 0) {
      const ref1Milestones = [
        { code: 'M01', name: 'First Country RA Approval', study: 1, country: 1, site: 1, days: 30, type: 'One-time' },
        { code: 'M02', name: 'Clinical Infrastructure Ready', study: 1, country: 1, site: 0, days: 30, type: 'One-time' },
        { code: 'M03', name: 'Site Live / Open for Enrollment', study: 1, country: 1, site: 1, days: 30, type: 'One-time' },
        { code: 'M04', name: 'First Monitoring Visit', study: 1, country: 1, site: 1, days: 30, type: 'One-time' },
        { code: 'M05', name: 'Significant Study Event', study: 1, country: 1, site: 1, days: 30, type: 'Next Phase' },
        { code: 'M06', name: 'Annual IRB / IEC Renewal', study: 0, country: 1, site: 1, days: 14, type: 'Next Phase' },
        { code: 'M07', name: 'Last Subject Last Visit', study: 1, country: 1, site: 1, days: 30, type: 'One-time' },
        { code: 'M08', name: 'Database Lock', study: 1, country: 0, site: 0, days: 30, type: 'One-time' },
        { code: 'M09', name: 'Close Out / Site Closed', study: 1, country: 1, site: 1, days: 30, type: 'One-time' },
        { code: 'M10', name: 'Final Report / CSR Approved', study: 1, country: 1, site: 1, days: 30, type: 'One-time' },
        { code: 'M11', name: 'Ongoing', study: 1, country: 1, site: 1, days: 0,  type: 'Always Active' },
        { code: 'M12', name: 'TMF Closure / Lock', study: 1, country: 1, site: 1, days: 30, type: 'One-time' },
      ];
      const insMs = db.prepare(`
        INSERT OR IGNORE INTO tenant_milestone_configs (id, tenant_id, code, name, study_level, country_level, site_level, due_days, milestone_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      ref1Milestones.forEach(m => {
        insMs.run(`tmc-${tenantId}-${m.code}`, tenantId, m.code, m.name, m.study, m.country, m.site, m.days, m.type);
      });
    }

    // 3. Seed Default & Custom EDL Templates (Ref 1 screen-edl-template)
    const tplCount = db.prepare('SELECT COUNT(*) as c FROM edl_templates WHERE tenant_id = ?').get(tenantId).c;
    if (tplCount === 0) {
      const sampleItems = [
        { artifact_code: '01.01.01', artifact_name: 'Trial Master File Plan', zone: '01', section: '01.01', level: 'Study', mandatory: 'Core/Mandatory', milestone: 'M02' },
        { artifact_code: '01.01.08', artifact_name: 'Monitoring Plan', zone: '01', section: '01.01', level: 'Study', mandatory: 'Core/Mandatory', milestone: 'M02' },
        { artifact_code: '01.01.16', artifact_name: 'Risk Management Plan', zone: '01', section: '01.01', level: 'Study', mandatory: 'Core/Mandatory', milestone: 'M02' },
        { artifact_code: '02.01.02', artifact_name: 'Protocol', zone: '02', section: '02.01', level: 'Study', mandatory: 'Core/Mandatory', milestone: 'M01' },
        { artifact_code: '03.01.02', artifact_name: 'Regulatory Authority Decision', zone: '03', section: '03.01', level: 'Country', mandatory: 'Core/Mandatory', milestone: 'M01' },
        { artifact_code: '04.01.02', artifact_name: 'IRB or IEC Decision', zone: '04', section: '04.01', level: 'Site', mandatory: 'Core/Mandatory', milestone: 'M03' },
        { artifact_code: '05.02.04', artifact_name: 'Principal Investigator CV', zone: '05', section: '05.02', level: 'Site', mandatory: 'Core/Mandatory', milestone: 'M03' },
        { artifact_code: '05.04.03', artifact_name: 'Monitoring Visit Report', zone: '05', section: '05.04', level: 'Site', mandatory: 'Core/Mandatory', milestone: 'M04' },
        { artifact_code: '07.02.02', artifact_name: 'SAE Report', zone: '07', section: '07.02', level: 'Study', mandatory: 'Core/Mandatory', milestone: 'M11' },
      ];
      const phase1Items = sampleItems.map(item => {
        if (item.artifact_code === '01.01.16') return { ...item, mandatory: 'Optional' };
        if (item.artifact_code === '05.02.04') return { ...item, mandatory: 'Optional' };
        if (item.artifact_code === '01.01.08') return { ...item, milestone: 'M03' };
        return item;
      });

      const insTpl = db.prepare(`
        INSERT OR IGNORE INTO edl_templates (
          id, tenant_id, name, description, base_version, version_number, status, is_default, is_locked, study_count, country_count, site_count, optional_excluded, items_json, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insTpl.run('edl-tpl-v30', tenantId, 'Default EDL Template — v3.0', 'Auto-created from DIA TMF Reference Model v3.0', 'v3.0', '1.0', 'Default', 1, 1, 156, 100, 95, 106, JSON.stringify(sampleItems), 'Platform Vendor');
      insTpl.run('edl-tpl-v32', tenantId, 'Default EDL Template — v3.2', 'Auto-created from DIA TMF Reference Model v3.2', 'v3.2', '1.0', 'Default', 1, 1, 156, 100, 95, 106, JSON.stringify(sampleItems), 'Platform Vendor');
      insTpl.run('edl-tpl-phase3', tenantId, 'AcmePharma Phase 3 Template', 'Standard template for Phase 3 oncology trials', 'v3.2', '1.0', 'Published', 0, 1, 156, 100, 95, 106, JSON.stringify(sampleItems), 'James Wright');
      insTpl.run('edl-tpl-phase1', tenantId, 'AcmePharma Phase 1 Template', 'Early phase template with streamlined optional set', 'v3.2', '1.1', 'Draft', 0, 0, 120, 80, 70, 187, JSON.stringify(phase1Items), 'James Wright');
    }

    // 4. Seed DIA TMF Reference Model v3.0 & v3.2 templates into trial_templates / dia_model_items
    const diaTplCount = db.prepare('SELECT COUNT(*) as c FROM trial_templates WHERE tenant_id = ?').get(tenantId).c;
    if (diaTplCount === 0) {
      db.prepare(`INSERT OR IGNORE INTO trial_templates (id, tenant_id, name, description, version, is_active, created_by) VALUES ('tmf-model-v30', ?, 'DIA TMF Reference Model v3.0', '11 Zones · 42 Sections · 200 Artifacts · 410 Doc Types', '3.0', 1, 'Platform Vendor')`).run(tenantId);
      db.prepare(`INSERT OR IGNORE INTO trial_templates (id, tenant_id, name, description, version, is_active, created_by) VALUES ('tmf-model-v32', ?, 'DIA TMF Reference Model v3.2', '11 Zones · 48 Sections · 250 Artifacts · 533 Doc Types', '3.2.1', 1, 'Platform Vendor')`).run(tenantId);
    }

    // 5. Seed study_milestones for study-001 (Ref 3 v-milestones)
    const smCount = db.prepare('SELECT COUNT(*) as c FROM study_milestones WHERE study_id = ?').get('study-001').c;
    if (smCount === 0) {
      const studyMs = [
        { code: 'M01', name: 'First Country RA Approval', level: 'Country', planned: '2026-01-15', actual: '2026-01-10', status: 'done', edl: 45 },
        { code: 'M02', name: 'Clinical Infrastructure Ready', level: 'Study', planned: '2026-02-01', actual: '2026-01-28', status: 'done', edl: 45 },
        { code: 'M03', name: 'Site Live / Open for Enrollment', level: 'Site', planned: '2026-03-15', actual: '2026-02-25', status: 'done', edl: 22 },
        { code: 'M04', name: 'First Monitoring Visit', level: 'Site', planned: '2026-04-15', actual: null, status: 'active', edl: 18 },
        { code: 'M05', name: 'Significant Study Event', level: 'Study', planned: null, actual: null, status: 'pending', edl: 12 },
        { code: 'M06', name: 'Annual IRB / IEC Renewal', level: 'Site', planned: '2027-04-01', actual: null, status: 'pending', edl: 8 },
        { code: 'M07', name: 'Last Subject Last Visit', level: 'Study', planned: '2027-12-31', actual: null, status: 'pending', edl: 24 },
        { code: 'M08', name: 'Database Lock', level: 'Study', planned: '2028-02-28', actual: null, status: 'pending', edl: 15 },
        { code: 'M09', name: 'Close Out Monitoring Visit', level: 'Site', planned: '2028-02-28', actual: null, status: 'pending', edl: 10 },
        { code: 'M10', name: 'Final Report / CSR Approved', level: 'Study', planned: '2028-12-31', actual: null, status: 'pending', edl: 20 },
        { code: 'M11', name: 'Ongoing — Always Active', level: 'Study', planned: null, actual: 'Always', status: 'always', edl: 106 },
        { code: 'M12', name: 'TMF Closure / Lock', level: 'Study', planned: '2029-06-30', actual: null, status: 'pending', edl: 5 },
      ];
      const insSm = db.prepare(`
        INSERT OR IGNORE INTO study_milestones (id, tenant_id, study_id, code, name, level, planned_date, actual_date, status, edl_triggered_count)
        VALUES (?, ?, 'study-001', ?, ?, ?, ?, ?, ?, ?)
      `);
      studyMs.forEach(m => {
        insSm.run(`sm-study-001-${m.code}`, tenantId, m.code, m.name, m.level, m.planned, m.actual, m.status, m.edl);
      });
    }

    // 6. Seed study_user_assignments & review_rules for study-001 (Ref 3 Steps 6 & 7)
    const suaCount = db.prepare('SELECT COUNT(*) as c FROM study_user_assignments WHERE study_id = ?').get('study-001').c;
    if (suaCount === 0) {
      const insSua = db.prepare(`
        INSERT OR IGNORE INTO study_user_assignments (id, tenant_id, study_id, user_id, role, countries_json, sites_json, scope_label, assigned_by)
        VALUES (?, ?, 'study-001', ?, ?, ?, ?, ?, 'usr-001')
      `);
      insSua.run('sua-001', tenantId, 'usr-001', 'TMF Manager', '["Germany","UK","USA","India"]', '["Site-001","Site-002","Site-003","Site-004"]', 'All Countries + All Sites (auto)');
      insSua.run('sua-002', tenantId, 'usr-002', 'Principal Investigator', '["Germany"]', '["Site-001"]', 'Germany · Site-001');
      insSua.run('sua-003', tenantId, 'usr-003', 'CRA / Reviewer', '["Germany","UK"]', '["Site-001","Site-002"]', 'Site-001, Site-002');
      insSua.run('sua-004', tenantId, 'usr-004', 'Regulatory Approver', '["Germany","UK","USA","India"]', '["Site-001","Site-002","Site-003","Site-004"]', 'All Sites (read + e-sign)');
      insSua.run('sua-005', tenantId, 'usr-005', 'Data Manager / Author', '["USA"]', '["Site-003"]', 'USA · Site-003');
    }

    const rrCount = db.prepare('SELECT COUNT(*) as c FROM review_rules WHERE study_id = ?').get('study-001').c;
    if (rrCount === 0) {
      const insRr = db.prepare(`
        INSERT OR IGNORE INTO review_rules (id, tenant_id, study_id, name, rule_level, priority_order, trigger_code, repository_scope, workflow_type, reviewer_id, reviewer_name, approver_id, approver_name, due_days, priority_tag, created_by)
        VALUES (?, ?, 'study-001', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'usr-001')
      `);
      insRr.run('rr-001', tenantId, 'Rule 13C — Artifact Level', 'Artifact', 1, '05.03.07', 'All Sites', 'Two-Step', 'usr-003', 'Marcus Williams', 'usr-004', 'Priya Sharma', 7, 'High');
      insRr.run('rr-002', tenantId, 'Rule Z7 — Zone Level', 'Zone', 2, '07', 'All Sites', 'Two-Step Urgent', 'usr-003', 'Marcus Williams', 'usr-004', 'Priya Sharma', 2, 'Urgent');
      insRr.run('rr-003', tenantId, 'Rule ALL — Study Level', 'Study', 3, '*', 'All Sites', 'Two-Step', 'usr-003', 'Marcus Williams', 'usr-004', 'Priya Sharma', 14, 'Normal');
      insRr.run('rr-004', tenantId, 'Catch-All Fallback', 'Catch-all', 4, '*', 'All Sites', 'Two-Step', 'usr-003', 'Marcus Williams (fallback)', 'usr-004', 'Priya Sharma', 14, 'Normal');
    }

    // 7. Seed sample R&U Distribution and Inspector Access Grant for study-001 (Ref 3 Steps 13 & 19)
    const ruCount = db.prepare('SELECT COUNT(*) as c FROM ru_distributions WHERE study_id = ?').get('study-001').c;
    if (ruCount === 0) {
      db.prepare(`
        INSERT OR IGNORE INTO ru_distributions (id, tenant_id, study_id, document_id, document_title, document_version, deadline, status, created_by)
        VALUES ('ru-dist-001', ?, 'study-001', 'doc-001', 'Protocol and Amendments v2.0', '2.0', date('now', '+14 days'), 'Open', 'usr-001')
      `).run(tenantId);
      db.prepare(`
        INSERT OR IGNORE INTO ru_acknowledgements (id, distribution_id, tenant_id, user_id, user_name, user_role, site_code, status, acknowledged_at)
        VALUES
          ('ru-ack-001', 'ru-dist-001', ?, 'usr-002', 'Dr. Sarah Chen', 'Principal Investigator', 'Site-001', 'Acknowledged', datetime('now', '-1 day')),
          ('ru-ack-002', 'ru-dist-001', ?, 'usr-003', 'Marcus Williams', 'CRA / Reviewer', 'Site-002', 'Pending', NULL)
      `).run(tenantId, tenantId);
    }

    const inspCount = db.prepare('SELECT COUNT(*) as c FROM inspector_access_grants WHERE study_id = ?').get('study-001').c;
    if (inspCount === 0) {
      db.prepare(`
        INSERT OR IGNORE INTO inspector_access_grants (
          id, tenant_id, study_id, user_id, inspector_name, inspector_email, authority, inspector_type, inspection_type, nda_required, nda_signed, start_date, end_date, status, docs_viewed, created_by
        ) VALUES (
          'insp-grant-001', ?, 'study-001', 'usr-007', 'Tom Eriksen', 't.eriksen@ema.europa.eu', 'EMA', 'Regulatory Inspector', 'Routine GCP', 0, 1, date('now', '-5 days'), date('now', '+30 days'), 'Active', 147, 'usr-001'
        )
      `).run(tenantId);
    }

    // Sync compatibility columns after initial seed so both schema variants are always populated
    db.exec(`
      UPDATE tenant_setup_progress SET step4_users = COALESCE(step4_user_management, 1), step5_permissions = COALESCE(step5_role_permissions, 1);
      UPDATE tenant_milestone_configs SET is_ongoing = CASE WHEN code = 'M11' THEN 1 ELSE 0 END;
      UPDATE edl_templates SET artifacts_json = CASE WHEN artifacts_json IS NULL OR artifacts_json = '[]' THEN COALESCE(items_json, '[]') ELSE artifacts_json END, base_model_version = COALESCE(base_version, 'DIA v3.2'), version = COALESCE(version_number, '1.0');
      UPDATE study_user_assignments SET study_role = COALESCE(role, 'CRA'), scope_countries = COALESCE(countries_json, '["ALL"]'), scope_sites = COALESCE(sites_json, '["ALL"]');
      UPDATE review_rules SET scope_type = COALESCE(rule_level, 'Zone'), scope_target = COALESCE(trigger_code, '*'), scope_label = COALESCE(name, trigger_code), priority = COALESCE(priority_order, 3), sla_days = COALESCE(due_days, 14);
      UPDATE ru_distributions SET title = COALESCE(document_title, 'Protocol Amendment v2.0'), version = COALESCE(document_version, '2.0'), deadline_date = COALESCE(deadline, date('now', '+14 days'));
      UPDATE inspector_access_grants SET agency = COALESCE(authority, 'EMA'), valid_from = COALESCE(start_date, date('now')), valid_until = COALESCE(end_date, date('now', '+30 days'));
    `);
  } catch (e) {
    console.error('Error seeding Phase 7 data:', e.message);
  }
}


