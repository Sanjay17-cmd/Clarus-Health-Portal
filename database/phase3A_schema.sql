-- =============================================================================
-- Clarus Health Portal — Phase 3A Database Schema
-- =============================================================================
-- Prerequisites: Phase 1 + Phase 2 schemas must already be applied.
-- Run manually in MySQL:
--
--   USE clarus_health;
--   SOURCE /path/to/database/phase3A_schema.sql;
--
-- IMPORTANT: Antigravity did NOT execute this file. Run it yourself.
-- Existing rows in Phase 1/2 tables are preserved.
-- No fake business data is inserted.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ---------------------------------------------------------------------------
-- 1. Extend report_records with suspension / quarantine tracking
-- ---------------------------------------------------------------------------
ALTER TABLE `report_records`
    ADD COLUMN IF NOT EXISTS `suspension_status`
        ENUM('ACTIVE','SUSPENDED','PERMANENTLY_DELETED')
        NOT NULL DEFAULT 'ACTIVE'
        COMMENT 'ACTIVE=normal, SUSPENDED=quarantine pending admin review, PERMANENTLY_DELETED=removed'
        AFTER `is_active`,

    ADD COLUMN IF NOT EXISTS `suspension_reason`
        TEXT NULL DEFAULT NULL
        COMMENT 'Reason provided by the requester when requesting deletion'
        AFTER `suspension_status`,

    ADD COLUMN IF NOT EXISTS `suspended_by`
        INT UNSIGNED NULL DEFAULT NULL
        COMMENT 'User who requested suspension/deletion'
        AFTER `suspension_reason`,

    ADD COLUMN IF NOT EXISTS `suspended_at`
        DATETIME NULL DEFAULT NULL
        COMMENT 'When the suspension was applied'
        AFTER `suspended_by`;

ALTER TABLE `report_records`
    ADD INDEX IF NOT EXISTS `idx_rr_suspension_status` (`suspension_status`);

-- ---------------------------------------------------------------------------
-- 2. deletion_requests
-- Tracks non-admin deletion/suspension requests, awaiting admin decision.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `deletion_requests` (
    `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `record_id`     INT UNSIGNED    NOT NULL
                    COMMENT 'The report_record that is requested for deletion',
    `requested_by`  INT UNSIGNED    NOT NULL
                    COMMENT 'Patient, technician or any non-admin user who requested',
    `reason`        TEXT            NOT NULL
                    COMMENT 'Mandatory reason for the deletion request',
    `status`        ENUM('PENDING','RESTORED','PERMANENTLY_DELETED')
                    NOT NULL DEFAULT 'PENDING',
    `reviewed_by`   INT UNSIGNED    NULL DEFAULT NULL
                    COMMENT 'Admin who reviewed this request',
    `reviewed_at`   DATETIME        NULL DEFAULT NULL,
    `review_notes`  TEXT            NULL,
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_dr_record_id`      (`record_id`),
    KEY `idx_dr_requested_by`   (`requested_by`),
    KEY `idx_dr_status`         (`status`),
    KEY `idx_dr_created_at`     (`created_at`),

    CONSTRAINT `fk_dr_record`
        FOREIGN KEY (`record_id`)
        REFERENCES `report_records` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT `fk_dr_requested_by`
        FOREIGN KEY (`requested_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT `fk_dr_reviewed_by`
        FOREIGN KEY (`reviewed_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Non-admin deletion requests awaiting admin Restore or Permanent Delete decision';

-- ---------------------------------------------------------------------------
-- 3. group_shares
-- Patient grants a doctor or specialization access to N most recent records
-- within a report group (version-limited sharing).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `group_shares` (
    `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `group_id`          INT UNSIGNED    NOT NULL
                        COMMENT 'The report_group being shared',
    `granted_by`        INT UNSIGNED    NOT NULL
                        COMMENT 'Patient who created the share',
    `grantee_type`      ENUM('USER','SPECIALIZATION')
                        NOT NULL,
    `grantee_user_id`   INT UNSIGNED    NULL DEFAULT NULL
                        COMMENT 'Doctor user ID when grantee_type = USER',
    `grantee_spec_id`   INT UNSIGNED    NULL DEFAULT NULL
                        COMMENT 'Specialization ID when grantee_type = SPECIALIZATION',
    `max_versions`      SMALLINT UNSIGNED NOT NULL DEFAULT 0
                        COMMENT '0 = all records; N > 0 = only the N most recent active records',
    `can_view`          TINYINT(1)      NOT NULL DEFAULT 1,
    `can_download`      TINYINT(1)      NOT NULL DEFAULT 0,
    `can_share`         TINYINT(1)      NOT NULL DEFAULT 0,
    `is_active`         TINYINT(1)      NOT NULL DEFAULT 1,
    `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_gs_group_id`           (`group_id`),
    KEY `idx_gs_granted_by`         (`granted_by`),
    KEY `idx_gs_grantee_user_id`    (`grantee_user_id`),
    KEY `idx_gs_grantee_spec_id`    (`grantee_spec_id`),
    KEY `idx_gs_is_active`          (`is_active`),

    CONSTRAINT `fk_gs_group`
        FOREIGN KEY (`group_id`)
        REFERENCES `report_groups` (`id`)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT `fk_gs_granted_by`
        FOREIGN KEY (`granted_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT `fk_gs_grantee_user`
        FOREIGN KEY (`grantee_user_id`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE CASCADE,

    CONSTRAINT `fk_gs_grantee_spec`
        FOREIGN KEY (`grantee_spec_id`)
        REFERENCES `specializations` (`id`)
        ON UPDATE CASCADE ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Version-limited group-level share grants';

-- ---------------------------------------------------------------------------
-- 4. zip_exports
-- Provenance record for every ZIP bundle downloaded.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `zip_exports` (
    `id`                CHAR(36)        NOT NULL
                        COMMENT 'UUID v4 export ID included inside the ZIP metadata',
    `exported_by`       INT UNSIGNED    NOT NULL
                        COMMENT 'Doctor or patient who exported',
    `patient_id`        INT UNSIGNED    NOT NULL
                        COMMENT 'Patient whose records were exported',
    `group_id`          INT UNSIGNED    NOT NULL
                        COMMENT 'Report group that was exported',
    `record_ids`        JSON            NOT NULL
                        COMMENT 'Array of report_record IDs included',
    `file_count`        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `technician_id`     INT UNSIGNED    NULL DEFAULT NULL
                        COMMENT 'Primary lab technician of the exported records (if single)',
    `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_ze_exported_by`    (`exported_by`),
    KEY `idx_ze_patient_id`     (`patient_id`),
    KEY `idx_ze_group_id`       (`group_id`),
    KEY `idx_ze_created_at`     (`created_at`),

    CONSTRAINT `fk_ze_exported_by`
        FOREIGN KEY (`exported_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT `fk_ze_patient`
        FOREIGN KEY (`patient_id`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT `fk_ze_group`
        FOREIGN KEY (`group_id`)
        REFERENCES `report_groups` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit provenance for every ZIP archive export';

-- ---------------------------------------------------------------------------
-- 5. zip_imports
-- Provenance record for every ZIP bundle imported by a doctor.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `zip_imports` (
    `id`                    CHAR(36)        NOT NULL
                            COMMENT 'UUID v4 import ID',
    `original_export_id`    CHAR(36)        NULL DEFAULT NULL
                            COMMENT 'The export_id from metadata.json of the imported ZIP',
    `imported_by`           INT UNSIGNED    NOT NULL
                            COMMENT 'Doctor who imported',
    `patient_id`            INT UNSIGNED    NOT NULL
                            COMMENT 'Patient the imported records were attached to',
    `group_id`              INT UNSIGNED    NULL DEFAULT NULL
                            COMMENT 'Report group the records were attached to (NULL if new group created)',
    `original_exporter_id`  INT UNSIGNED    NULL DEFAULT NULL
                            COMMENT 'Doctor who originally exported (from metadata.json)',
    `record_ids_imported`   JSON            NOT NULL
                            COMMENT 'Array of newly created report_record IDs',
    `file_count`            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `import_notes`          TEXT            NULL,
    `created_at`            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_zi_imported_by`        (`imported_by`),
    KEY `idx_zi_patient_id`         (`patient_id`),
    KEY `idx_zi_original_export_id` (`original_export_id`),
    KEY `idx_zi_created_at`         (`created_at`),

    CONSTRAINT `fk_zi_imported_by`
        FOREIGN KEY (`imported_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT `fk_zi_patient`
        FOREIGN KEY (`patient_id`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit provenance for every ZIP archive import';

-- ---------------------------------------------------------------------------
-- 6. Extend notifications ENUM with Phase 3A types
--    MySQL requires dropping and re-adding the column to extend ENUM.
--    We use MODIFY COLUMN with the full new ENUM list.
-- ---------------------------------------------------------------------------
ALTER TABLE `notifications`
    MODIFY COLUMN `type`
        ENUM(
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
            'ZIP_IMPORTED'
        )
        NOT NULL DEFAULT 'GENERAL'
        COMMENT 'Notification category — extended for Phase 3A';

-- ---------------------------------------------------------------------------
-- Done
-- ---------------------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 1;

-- Run order reminder:
--   1. phase1_schema.sql
--   2. phase2_schema.sql
--   3. phase3A_schema.sql   ← this file
