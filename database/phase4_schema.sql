-- ============================================================================
-- Clarus Health Portal — Phase 4 FINAL FIX SQL
-- Run this ONCE. Exactly what is still missing as of 2026-09-27.
--
-- Already done (DO NOT re-run):
--   group_shares columns: status, parent_share_id, can_delegate,
--                         accepted_at, revoked_at, revoked_by
--   notifications.type enum already updated
--   granular_shares / granular_share_records / granular_share_files /
--   doctor_share_inbox / share_delegations already exist
--
-- Still needed (what this file does):
--   1. Fix parent_share_id column type (INT → INT UNSIGNED to match id)
--   2. Add FK fk_group_shares_parent (self-ref)
--   3. Add FK fk_group_shares_revoked_by (→ users)
--   4. Add indexes on status, parent_share_id
--   5. CREATE group_share_records
--   6. CREATE group_share_files
--   7. CREATE share_exports
--   8. CREATE share_imports
-- ============================================================================

USE clarus_health;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. Fix parent_share_id type: INT → INT UNSIGNED (must match group_shares.id)
-- ============================================================================
ALTER TABLE `group_shares`
    MODIFY COLUMN `parent_share_id` INT UNSIGNED NULL DEFAULT NULL
    COMMENT 'Set if this is a delegated child share';

ALTER TABLE `group_shares`
    MODIFY COLUMN `revoked_by` INT UNSIGNED NULL DEFAULT NULL;

-- ============================================================================
-- 2. Foreign key: parent_share_id → group_shares.id (self-ref)
-- ============================================================================
ALTER TABLE `group_shares`
    ADD CONSTRAINT `fk_group_shares_parent`
        FOREIGN KEY (`parent_share_id`)
        REFERENCES `group_shares` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 3. Foreign key: revoked_by → users.id
-- ============================================================================
ALTER TABLE `group_shares`
    ADD CONSTRAINT `fk_group_shares_revoked_by`
        FOREIGN KEY (`revoked_by`)
        REFERENCES `users` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 4. Indexes (skip if you got duplicate key errors before on these)
-- ============================================================================
ALTER TABLE `group_shares`
    ADD INDEX `idx_group_shares_status` (`status`);

ALTER TABLE `group_shares`
    ADD INDEX `idx_group_shares_parent` (`parent_share_id`);

ALTER TABLE `group_shares`
    ADD INDEX `idx_group_shares_grantee_user_status` (`grantee_user_id`, `status`);

-- ============================================================================
-- 5. group_share_records — explicit version/record scope per share
-- ============================================================================
CREATE TABLE IF NOT EXISTS `group_share_records` (
    `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `share_id`   INT UNSIGNED NOT NULL COMMENT 'FK group_shares.id',
    `record_id`  INT UNSIGNED NOT NULL COMMENT 'FK report_records.id',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_gsr` (`share_id`, `record_id`),
    KEY `idx_gsr_share`  (`share_id`),
    KEY `idx_gsr_record` (`record_id`),
    CONSTRAINT `fk_gsr_share`
        FOREIGN KEY (`share_id`)  REFERENCES `group_shares`   (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_gsr_record`
        FOREIGN KEY (`record_id`) REFERENCES `report_records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Restricts share to specific record IDs (overrides max_versions)';

-- ============================================================================
-- 6. group_share_files — explicit file scope per (share, record)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `group_share_files` (
    `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `share_id`   INT UNSIGNED NOT NULL COMMENT 'FK group_shares.id',
    `record_id`  INT UNSIGNED NOT NULL COMMENT 'FK report_records.id',
    `file_id`    INT UNSIGNED NOT NULL COMMENT 'FK report_files.id',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_gsf` (`share_id`, `record_id`, `file_id`),
    KEY `idx_gsf_share` (`share_id`),
    KEY `idx_gsf_file`  (`file_id`),
    CONSTRAINT `fk_gsf_share`
        FOREIGN KEY (`share_id`)  REFERENCES `group_shares`   (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_gsf_record`
        FOREIGN KEY (`record_id`) REFERENCES `report_records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_gsf_file`
        FOREIGN KEY (`file_id`)   REFERENCES `report_files`   (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Restricts share to specific file IDs within each allowed record';

-- ============================================================================
-- 7. share_exports — audit trail of every ZIP export from a group share
-- ============================================================================
CREATE TABLE IF NOT EXISTS `share_exports` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `share_id`     INT UNSIGNED NOT NULL COMMENT 'FK group_shares.id',
    `exported_by`  INT UNSIGNED NOT NULL COMMENT 'FK users.id',
    `export_token` VARCHAR(80)  NOT NULL COMMENT 'UUID for this export event',
    `record_ids`   JSON         NULL     COMMENT 'Array of record IDs in this export',
    `file_ids`     JSON         NULL     COMMENT 'Array of file IDs in this export',
    `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_se_token`  (`export_token`),
    KEY `idx_se_share`        (`share_id`),
    KEY `idx_se_exporter`     (`exported_by`),
    CONSTRAINT `fk_se_share`
        FOREIGN KEY (`share_id`)    REFERENCES `group_shares` (`id`) ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT `fk_se_exporter`
        FOREIGN KEY (`exported_by`) REFERENCES `users`        (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Every ZIP export event linked to its group share';

-- ============================================================================
-- 8. share_imports — provenance chain for every ZIP import
-- ============================================================================
CREATE TABLE IF NOT EXISTS `share_imports` (
    `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `export_id`       INT UNSIGNED NULL     COMMENT 'FK share_exports.id',
    `share_id`        INT UNSIGNED NULL     COMMENT 'FK group_shares.id',
    `imported_by`     INT UNSIGNED NOT NULL COMMENT 'FK users.id',
    `patient_id`      INT UNSIGNED NULL     COMMENT 'FK users.id',
    `export_token`    VARCHAR(80)  NULL     COMMENT 'Token from metadata.json',
    `source_group_id` INT UNSIGNED NULL,
    `import_metadata` JSON         NULL     COMMENT 'Full metadata.json for audit',
    `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_si_importer` (`imported_by`),
    KEY `idx_si_patient`  (`patient_id`),
    KEY `idx_si_export`   (`export_id`),
    CONSTRAINT `fk_si_export`
        FOREIGN KEY (`export_id`)   REFERENCES `share_exports` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_si_share`
        FOREIGN KEY (`share_id`)    REFERENCES `group_shares`  (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_si_importer`
        FOREIGN KEY (`imported_by`) REFERENCES `users`         (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_si_patient`
        FOREIGN KEY (`patient_id`)  REFERENCES `users`         (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ZIP import provenance linked back to original share/export';

-- ============================================================================
SET FOREIGN_KEY_CHECKS = 1;
-- ============================================================================
-- DONE. What this script did:
--   - Fixed INT → INT UNSIGNED on parent_share_id and revoked_by
--   - Added FK fk_group_shares_parent (self-ref on group_shares)
--   - Added FK fk_group_shares_revoked_by (→ users)
--   - Added 3 indexes on group_shares
--   - Created group_share_records
--   - Created group_share_files
--   - Created share_exports
--   - Created share_imports
-- ============================================================================
