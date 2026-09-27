-- =============================================================================
-- Clarus Health Portal — Phase 3B Schema
-- Run AFTER phase1_schema.sql, phase2_schema.sql, phase3A_schema.sql
-- DO NOT execute automatically. Run manually.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BREAK-GLASS ACCESS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS break_glass_requests (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    doctor_id       INT NOT NULL,
    patient_id      INT NOT NULL,
    justification   TEXT NOT NULL,
    status          ENUM('ACTIVE','EXPIRED','REVOKED') NOT NULL DEFAULT 'ACTIVE',
    granted_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      DATETIME NOT NULL,
    revoked_at      DATETIME NULL,
    revoked_by      INT NULL,
    CONSTRAINT fk_bg_doctor  FOREIGN KEY (doctor_id)  REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bg_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bg_revoker FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_bg_doctor   (doctor_id),
    INDEX idx_bg_patient  (patient_id),
    INDEX idx_bg_status   (status),
    INDEX idx_bg_granted  (granted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tracks actions performed DURING an emergency access window
CREATE TABLE IF NOT EXISTS break_glass_actions (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    request_id      INT UNSIGNED NOT NULL,
    action          VARCHAR(80) NOT NULL,   -- e.g. RECORD_VIEWED, SHARE_CREATED
    target_type     VARCHAR(60) NULL,
    target_id       INT NULL,
    details         JSON NULL,
    performed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bga_request FOREIGN KEY (request_id) REFERENCES break_glass_requests(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_bga_request (request_id),
    INDEX idx_bga_action  (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Abuse detection window counters (rolling 30-min, unique patients)
-- We derive this from break_glass_requests with a query; no extra table needed.

-- -----------------------------------------------------------------------------
-- 2. DOCUMENT DISPUTES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_disputes (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id      INT NOT NULL,
    record_id       INT NOT NULL,          -- report_records.id
    group_id        INT NOT NULL,          -- report_groups.id
    reason          ENUM('WRONG_PATIENT','NOT_MY_REPORT','WRONG_DOCUMENT','DUPLICATE','OTHER') NOT NULL,
    explanation     TEXT NOT NULL,
    status          ENUM('OPEN','UNDER_REVIEW','QUARANTINED','REASSIGNED','RESOLVED','DISMISSED') NOT NULL DEFAULT 'OPEN',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Admin review
    reviewed_by     INT NULL,
    reviewed_at     DATETIME NULL,
    review_notes    TEXT NULL,
    -- Reassignment
    reassigned_to_patient_id INT NULL,
    reassigned_at   DATETIME NULL,
    CONSTRAINT fk_disp_patient   FOREIGN KEY (patient_id)   REFERENCES users(id)           ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_disp_record    FOREIGN KEY (record_id)    REFERENCES report_records(id)  ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_disp_group     FOREIGN KEY (group_id)     REFERENCES report_groups(id)   ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_disp_reviewer  FOREIGN KEY (reviewed_by)  REFERENCES users(id)           ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_disp_reassign  FOREIGN KEY (reassigned_to_patient_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_disp_patient (patient_id),
    INDEX idx_disp_record  (record_id),
    INDEX idx_disp_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only history of admin actions on disputes
CREATE TABLE IF NOT EXISTS dispute_audit_entries (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dispute_id      INT UNSIGNED NOT NULL,
    actor_id        INT NULL,
    action          VARCHAR(80) NOT NULL,
    notes           TEXT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dae_dispute FOREIGN KEY (dispute_id) REFERENCES document_disputes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_dae_actor   FOREIGN KEY (actor_id)   REFERENCES users(id)             ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_dae_dispute (dispute_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. BREAK-GLASS SUSPENSION RECORDS (extra metadata for admin panel)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS break_glass_suspension_events (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    doctor_id       INT NOT NULL,
    trigger_count   TINYINT UNSIGNED NOT NULL DEFAULT 4,
    window_start    DATETIME NOT NULL,
    window_end      DATETIME NOT NULL,
    patient_ids     JSON NOT NULL,          -- list of distinct patient ids in window
    suspended_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Admin restoration
    restored_by     INT NULL,
    restored_at     DATETIME NULL,
    restore_notes   TEXT NULL,
    CONSTRAINT fk_bgse_doctor   FOREIGN KEY (doctor_id)   REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bgse_restorer FOREIGN KEY (restored_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_bgse_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. PROVENANCE TRACEABILITY — access events per record (for patient activity)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS record_access_events (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    record_id       INT NOT NULL,
    group_id        INT NULL,
    patient_id      INT NOT NULL,           -- for fast patient-centric queries
    actor_id        INT NULL,
    actor_role      VARCHAR(30) NULL,
    event_type      VARCHAR(80) NOT NULL,   -- VIEWED, DOWNLOADED, SHARED, ZIP_EXPORTED, etc.
    details         JSON NULL,
    break_glass_request_id INT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rae_record  FOREIGN KEY (record_id)  REFERENCES report_records(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rae_patient FOREIGN KEY (patient_id) REFERENCES users(id)          ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rae_actor   FOREIGN KEY (actor_id)   REFERENCES users(id)          ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_rae_bg      FOREIGN KEY (break_glass_request_id) REFERENCES break_glass_requests(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_rae_patient   (patient_id),
    INDEX idx_rae_record    (record_id),
    INDEX idx_rae_event     (event_type),
    INDEX idx_rae_created   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. EXTEND NOTIFICATION TYPES (ALTER ENUM)
--    MySQL requires full re-definition for ENUM columns.
-- -----------------------------------------------------------------------------
ALTER TABLE notifications MODIFY COLUMN type ENUM(
    'ACCOUNT_APPROVED',
    'ACCOUNT_REJECTED',
    'ACCOUNT_SUSPENDED',
    'ACCOUNT_REACTIVATED',
    'SPEC_CHANGE_REQUESTED',
    'SPEC_CHANGE_APPROVED',
    'SPEC_CHANGE_REJECTED',
    'REPORT_SHARED',
    'SHARE_PERMISSION_CHANGED',
    'SHARE_REVOKED',
    'EXTERNAL_SHARE_CREATED',
    'SYSTEM',
    'GENERAL',
    -- Phase 3A
    'CORRECTION_CREATED',
    'RECORD_SUSPENDED',
    'RECORD_RESTORED',
    'RECORD_PERMANENTLY_DELETED',
    'TECHNICIAN_VIEWED',
    'DOCTOR_DOWNLOADED',
    'ZIP_EXPORTED',
    'ZIP_IMPORTED',
    -- Phase 3B
    'BREAK_GLASS_REQUEST',
    'BREAK_GLASS_SUSPENSION',
    'BREAK_GLASS_RESTORED',
    'DOCUMENT_DISPUTE_CREATED',
    'DOCUMENT_DISPUTE_UPDATED',
    'DOCUMENT_DISPUTE_RESOLVED',
    'DOCTOR_VIEWED',
    'EMERGENCY_SHARE_CREATED',
    'RECORD_QUARANTINED',
    'SUSPICIOUS_ACTIVITY',
    'RECORD_ACCESS_ALERT',
    'DISPUTE_QUARANTINED',
    'DISPUTE_REASSIGNED'
) NOT NULL DEFAULT 'GENERAL';

-- -----------------------------------------------------------------------------
-- 6. INDEXES for abuse detection query performance
-- -----------------------------------------------------------------------------
-- Already have idx_bg_doctor and idx_bg_granted on break_glass_requests
-- Add composite for rolling window query:
ALTER TABLE break_glass_requests
    ADD INDEX IF NOT EXISTS idx_bg_doctor_granted (doctor_id, granted_at);

-- For record_access_events patient timeline feed:
ALTER TABLE record_access_events
    ADD INDEX IF NOT EXISTS idx_rae_patient_created (patient_id, created_at DESC);

-- =============================================================================
-- END Phase 3B Schema
-- =============================================================================
