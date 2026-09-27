-- =============================================================================
-- Clarus Health Portal — Phase 2 Database Schema
-- =============================================================================
-- Prerequisites: Phase 1 schema must already be applied.
-- Run manually in MySQL:
--
--   USE clarus_health;
--   SOURCE /path/to/database/phase2_schema.sql;
--
-- IMPORTANT: Antigravity did NOT execute this file. Run it yourself.
-- Phase 1 tables (users, specializations, notifications, audit_logs,
-- specialization_change_requests) are NOT modified here.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ---------------------------------------------------------------------------
-- report_groups
-- Represents a named category of reports for one patient.
-- Example: "Blood Sugar", "Chest X-Ray", "CBC"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_groups` (
    `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `patient_id`    INT UNSIGNED    NOT NULL
                    COMMENT 'The patient this group belongs to',
    `title`         VARCHAR(200)    NOT NULL
                    COMMENT 'E.g. Blood Sugar, Chest X-Ray',
    `test_type`     VARCHAR(120)    NOT NULL
                    COMMENT 'E.g. Haematology, Radiology, Biochemistry',
    `description`   TEXT            NULL,
    `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
    `created_by`    INT UNSIGNED    NOT NULL
                    COMMENT 'Lab Technician or Admin who created this group',
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_rg_patient_id`     (`patient_id`),
    KEY `idx_rg_created_by`     (`created_by`),
    KEY `idx_rg_test_type`      (`test_type`),
    KEY `idx_rg_is_active`      (`is_active`),
    KEY `idx_rg_created_at`     (`created_at`),

    CONSTRAINT `fk_rg_patient`
        FOREIGN KEY (`patient_id`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT `fk_rg_created_by`
        FOREIGN KEY (`created_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Named report categories belonging to a patient';

-- ---------------------------------------------------------------------------
-- report_records
-- One dated entry within a report group.
-- record_type: ORIGINAL | HISTORICAL | CORRECTION
-- Corrections reference the record they correct via corrects_record_id.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_records` (
    `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `group_id`              INT UNSIGNED    NOT NULL
                            COMMENT 'The parent report group',
    `record_type`           ENUM('ORIGINAL','HISTORICAL','CORRECTION')
                                            NOT NULL DEFAULT 'ORIGINAL',
    `corrects_record_id`    INT UNSIGNED    NULL DEFAULT NULL
                            COMMENT 'If CORRECTION: the record this corrects',
    `record_date`           DATETIME        NOT NULL
                            COMMENT 'Date/time of the clinical event',
    `notes`                 TEXT            NULL
                            COMMENT 'Technician or clinical notes for this entry',
    `lab_technician_id`     INT UNSIGNED    NOT NULL
                            COMMENT 'Uploader / responsible technician',
    `lab_technician_name`   VARCHAR(200)    NOT NULL
                            COMMENT 'Snapshot of technician name at upload time',
    `is_active`             TINYINT(1)      NOT NULL DEFAULT 1,
    `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_rr_group_id`               (`group_id`),
    KEY `idx_rr_record_type`            (`record_type`),
    KEY `idx_rr_corrects_record_id`     (`corrects_record_id`),
    KEY `idx_rr_lab_technician_id`      (`lab_technician_id`),
    KEY `idx_rr_record_date`            (`record_date`),
    KEY `idx_rr_created_at`             (`created_at`),

    CONSTRAINT `fk_rr_group`
        FOREIGN KEY (`group_id`)
        REFERENCES `report_groups` (`id`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT `fk_rr_corrects`
        FOREIGN KEY (`corrects_record_id`)
        REFERENCES `report_records` (`id`)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT `fk_rr_technician`
        FOREIGN KEY (`lab_technician_id`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Dated entries in a report group; preserves full history';

-- ---------------------------------------------------------------------------
-- report_files
-- Physical files attached to a report record.
-- stored_path is an internal opaque reference — never served directly to clients.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_files` (
    `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `record_id`     INT UNSIGNED    NOT NULL,
    `original_name` VARCHAR(512)    NOT NULL
                    COMMENT 'Original filename supplied by uploader (display only)',
    `stored_path`   VARCHAR(1024)   NOT NULL
                    COMMENT 'Internal filesystem path; NEVER exposed to clients',
    `mime_type`     VARCHAR(120)    NOT NULL
                    COMMENT 'application/pdf | image/png | image/jpeg',
    `file_size`     BIGINT UNSIGNED NOT NULL DEFAULT 0
                    COMMENT 'File size in bytes',
    `sort_order`    INT UNSIGNED    NOT NULL DEFAULT 0
                    COMMENT 'Display order within the record',
    `uploaded_by`   INT UNSIGNED    NOT NULL,
    `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_rf_record_id`      (`record_id`),
    KEY `idx_rf_uploaded_by`    (`uploaded_by`),
    KEY `idx_rf_created_at`     (`created_at`),
    KEY `idx_rf_sort_order`     (`record_id`, `sort_order`),

    CONSTRAINT `fk_rf_record`
        FOREIGN KEY (`record_id`)
        REFERENCES `report_records` (`id`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT `fk_rf_uploaded_by`
        FOREIGN KEY (`uploaded_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Physical files attached to a report record';

-- ---------------------------------------------------------------------------
-- report_permissions
-- Internal sharing: a patient grants a specific doctor OR an entire
-- specialization access to one report record.
-- grantee_type: USER | SPECIALIZATION
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_permissions` (
    `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `record_id`         INT UNSIGNED    NOT NULL,
    `granted_by`        INT UNSIGNED    NOT NULL
                        COMMENT 'Patient who granted this permission',
    `grantee_type`      ENUM('USER','SPECIALIZATION')
                                        NOT NULL,
    `grantee_user_id`       INT UNSIGNED NULL DEFAULT NULL
                            COMMENT 'Populated when grantee_type = USER',
    `grantee_spec_id`       INT UNSIGNED NULL DEFAULT NULL
                            COMMENT 'Populated when grantee_type = SPECIALIZATION',
    `can_view`          TINYINT(1)      NOT NULL DEFAULT 1,
    `can_download`      TINYINT(1)      NOT NULL DEFAULT 0,
    `can_share`         TINYINT(1)      NOT NULL DEFAULT 0,
    `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_rp_record_id`          (`record_id`),
    KEY `idx_rp_granted_by`         (`granted_by`),
    KEY `idx_rp_grantee_user`       (`grantee_user_id`),
    KEY `idx_rp_grantee_spec`       (`grantee_spec_id`),
    -- Prevent duplicate grants to the same user/spec on the same record
    UNIQUE KEY `uq_rp_user`         (`record_id`, `grantee_user_id`),
    UNIQUE KEY `uq_rp_spec`         (`record_id`, `grantee_spec_id`),

    CONSTRAINT `fk_rp_record`
        FOREIGN KEY (`record_id`)
        REFERENCES `report_records` (`id`)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT `fk_rp_granted_by`
        FOREIGN KEY (`granted_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT `fk_rp_grantee_user`
        FOREIGN KEY (`grantee_user_id`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT `fk_rp_grantee_spec`
        FOREIGN KEY (`grantee_spec_id`)
        REFERENCES `specializations` (`id`)
        ON UPDATE CASCADE
        ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Internal report-level sharing permissions per user or specialization';

-- ---------------------------------------------------------------------------
-- report_shares
-- External sharing via a secure random token.
-- Access is view-only (download and delegate are NOT permitted externally).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_shares` (
    `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `record_id`     INT UNSIGNED    NOT NULL,
    `created_by`    INT UNSIGNED    NOT NULL
                    COMMENT 'Patient or delegated user who created the share',
    `token`         VARCHAR(80)     NOT NULL
                    COMMENT 'Cryptographically random URL-safe token; opaque to clients',
    `label`         VARCHAR(200)    NULL DEFAULT NULL
                    COMMENT 'Optional human label for the share (e.g. "For Dr. Kumar")',
    `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
    `access_count`  INT UNSIGNED    NOT NULL DEFAULT 0
                    COMMENT 'Times the external share has been accessed',
    `last_accessed_at` DATETIME     NULL DEFAULT NULL,
    `expires_at`    DATETIME        NULL DEFAULT NULL
                    COMMENT 'NULL = no expiry; reserved for Phase 3',
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_rs_token`        (`token`),
    KEY `idx_rs_record_id`          (`record_id`),
    KEY `idx_rs_created_by`         (`created_by`),
    KEY `idx_rs_is_active`          (`is_active`),

    CONSTRAINT `fk_rs_record`
        FOREIGN KEY (`record_id`)
        REFERENCES `report_records` (`id`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT `fk_rs_created_by`
        FOREIGN KEY (`created_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='External view-only share tokens for report records';

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- INDEXES SUMMARY
-- =============================================================================
-- report_groups     : patient_id, created_by, test_type, is_active, created_at
-- report_records    : group_id, record_type, corrects_record_id, technician_id,
--                     record_date, created_at
-- report_files      : record_id, uploaded_by, created_at, (record_id, sort_order)
-- report_permissions: record_id, granted_by, grantee_user_id, grantee_spec_id
--                     UNIQUE (record_id, grantee_user_id)
--                     UNIQUE (record_id, grantee_spec_id)
-- report_shares     : UNIQUE token, record_id, created_by, is_active
-- =============================================================================
