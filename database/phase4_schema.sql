-- ============================================================================
-- Clarus Health Portal — Phase 4 Schema (SAFE / IDEMPOTENT VERSION)
-- Uses stored procedures to check INFORMATION_SCHEMA before adding columns.
-- Run each CALL statement one at a time if you prefer, or run all at once.
-- ============================================================================
USE clarus_health;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- HELPER: drop and recreate a procedure that safely adds a column only if
-- it doesn't already exist (works on MySQL 5.7+)
-- ============================================================================

DROP PROCEDURE IF EXISTS clarus_add_column;

DELIMITER $$
CREATE PROCEDURE clarus_add_column(
    IN p_table   VARCHAR(64),
    IN p_column  VARCHAR(64),
    IN p_ddl     TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = p_table
          AND COLUMN_NAME  = p_column
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN ', p_ddl);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- ============================================================================
-- HELPER: safely add an index only if it doesn't exist
-- ============================================================================

DROP PROCEDURE IF EXISTS clarus_add_index;

DELIMITER $$
CREATE PROCEDURE clarus_add_index(
    IN p_table  VARCHAR(64),
    IN p_index  VARCHAR(64),
    IN p_ddl    TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = p_table
          AND INDEX_NAME   = p_index
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` ', p_ddl);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- ============================================================================
-- HELPER: safely add a foreign key only if it doesn't exist
-- ============================================================================

DROP PROCEDURE IF EXISTS clarus_add_fk;

DELIMITER $$
CREATE PROCEDURE clarus_add_fk(
    IN p_table       VARCHAR(64),
    IN p_constraint  VARCHAR(64),
    IN p_ddl         TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA     = DATABASE()
          AND TABLE_NAME       = p_table
          AND CONSTRAINT_NAME  = p_constraint
          AND CONSTRAINT_TYPE  = 'FOREIGN KEY'
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_constraint, '` ', p_ddl);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- ============================================================================
-- 1. ENHANCED GROUP SHARES — safely add each new column
-- ============================================================================

CALL clarus_add_column('group_shares', 'status',
    "`status` ENUM('PENDING','ACCEPTED','REVOKED') NOT NULL DEFAULT 'PENDING'
     COMMENT 'PENDING=not noticed, ACCEPTED=doctor ack, REVOKED=patient revoked'
     AFTER `is_active`");

CALL clarus_add_column('group_shares', 'parent_share_id',
    '`parent_share_id` INT NULL DEFAULT NULL
     COMMENT ''Set if this is a delegated child share''
     AFTER `status`');

CALL clarus_add_column('group_shares', 'can_delegate',
    '`can_delegate` TINYINT(1) NOT NULL DEFAULT 0
     COMMENT ''1=doctor may re-share within original scope''
     AFTER `parent_share_id`');

CALL clarus_add_column('group_shares', 'accepted_at',
    '`accepted_at` DATETIME NULL DEFAULT NULL AFTER `can_delegate`');

CALL clarus_add_column('group_shares', 'revoked_at',
    '`revoked_at` DATETIME NULL DEFAULT NULL AFTER `accepted_at`');

CALL clarus_add_column('group_shares', 'revoked_by',
    '`revoked_by` INT NULL DEFAULT NULL AFTER `revoked_at`');

-- Indexes
CALL clarus_add_index('group_shares', 'idx_group_shares_status',
    '(`status`)');

CALL clarus_add_index('group_shares', 'idx_group_shares_parent',
    '(`parent_share_id`)');

CALL clarus_add_index('group_shares', 'idx_group_shares_grantee_user_status',
    '(`grantee_user_id`, `status`)');

-- Foreign keys
CALL clarus_add_fk('group_shares', 'fk_group_shares_parent',
    'FOREIGN KEY (`parent_share_id`) REFERENCES `group_shares`(`id`) ON DELETE SET NULL ON UPDATE CASCADE');

CALL clarus_add_fk('group_shares', 'fk_group_shares_revoked_by',
    'FOREIGN KEY (`revoked_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE');


-- ============================================================================
-- 2. VERSION-SCOPED SHARE RECORDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `group_share_records` (
    `id`         INT      NOT NULL AUTO_INCREMENT,
    `share_id`   INT      NOT NULL COMMENT 'FK group_shares.id',
    `record_id`  INT      NOT NULL COMMENT 'FK report_records.id',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_share_record` (`share_id`, `record_id`),
    KEY `idx_gsr_share`  (`share_id`),
    KEY `idx_gsr_record` (`record_id`),
    CONSTRAINT `fk_gsr_share`
        FOREIGN KEY (`share_id`)  REFERENCES `group_shares`   (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_gsr_record`
        FOREIGN KEY (`record_id`) REFERENCES `report_records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Restricts share to specific record IDs (overrides max_versions)';


-- ============================================================================
-- 3. FILE-SCOPED SHARE FILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS `group_share_files` (
    `id`         INT      NOT NULL AUTO_INCREMENT,
    `share_id`   INT      NOT NULL COMMENT 'FK group_shares.id',
    `record_id`  INT      NOT NULL COMMENT 'FK report_records.id',
    `file_id`    INT      NOT NULL COMMENT 'FK report_files.id',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_share_file` (`share_id`, `record_id`, `file_id`),
    KEY `idx_gsf_share` (`share_id`),
    KEY `idx_gsf_file`  (`file_id`),
    CONSTRAINT `fk_gsf_share`
        FOREIGN KEY (`share_id`)  REFERENCES `group_shares`   (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_gsf_record`
        FOREIGN KEY (`record_id`) REFERENCES `report_records` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_gsf_file`
        FOREIGN KEY (`file_id`)   REFERENCES `report_files`   (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Restricts share to specific file IDs per record';


-- ============================================================================
-- 4. SHARE EXPORT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS `share_exports` (
    `id`           INT         NOT NULL AUTO_INCREMENT,
    `share_id`     INT         NOT NULL,
    `exported_by`  INT         NOT NULL,
    `export_token` VARCHAR(80) NOT NULL,
    `record_ids`   JSON        NULL,
    `file_ids`     JSON        NULL,
    `created_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_se_token`  (`export_token`),
    KEY `idx_se_share`        (`share_id`),
    KEY `idx_se_exporter`     (`exported_by`),
    CONSTRAINT `fk_se_share`
        FOREIGN KEY (`share_id`)    REFERENCES `group_shares` (`id`) ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT `fk_se_exporter`
        FOREIGN KEY (`exported_by`) REFERENCES `users`        (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit trail of every ZIP export from a share';


-- ============================================================================
-- 5. SHARE IMPORT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS `share_imports` (
    `id`              INT         NOT NULL AUTO_INCREMENT,
    `export_id`       INT         NULL,
    `share_id`        INT         NULL,
    `imported_by`     INT         NOT NULL,
    `patient_id`      INT         NULL,
    `export_token`    VARCHAR(80) NULL,
    `source_group_id` INT         NULL,
    `import_metadata` JSON        NULL,
    `created_at`      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
-- CLEANUP helper procedures (optional — keeps DB clean)
-- ============================================================================
DROP PROCEDURE IF EXISTS clarus_add_column;
DROP PROCEDURE IF EXISTS clarus_add_index;
DROP PROCEDURE IF EXISTS clarus_add_fk;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- DONE. Tables added:
--   group_share_records, group_share_files, share_exports, share_imports
-- Columns added to group_shares (if not already present):
--   status, parent_share_id, can_delegate, accepted_at, revoked_at, revoked_by
-- ============================================================================
