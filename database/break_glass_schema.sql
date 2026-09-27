-- ============================================================================
-- Clarus Health Portal — Break-Glass Enhancement Schema
-- Adds: bg_download_requests, bg_share_requests
--
-- Run AFTER all previous schema files have been applied.
-- DO NOT execute automatically — run manually in MySQL Workbench.
-- Compatible: MySQL 5.7+ and MySQL 8.x
-- ============================================================================
USE clarus_health;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. bg_download_requests
--    Doctor requests admin approval to download specific files from a
--    Break-Glass event. Scope is locked to the exact requested files.
-- ============================================================================
CREATE TABLE IF NOT EXISTS `bg_download_requests` (
    `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `bg_request_id`      INT UNSIGNED NOT NULL COMMENT 'FK break_glass_requests.id',
    `doctor_id`          INT UNSIGNED NOT NULL COMMENT 'FK users.id — requesting doctor',
    `patient_id`         INT UNSIGNED NOT NULL COMMENT 'FK users.id — patient',
    `group_id`           INT UNSIGNED NOT NULL COMMENT 'FK report_groups.id',
    `record_ids`         JSON         NOT NULL COMMENT 'Array of record IDs in download scope',
    `file_ids`           JSON         NOT NULL COMMENT 'Array of file IDs in download scope',
    `reason`             TEXT         NOT NULL COMMENT 'Doctor-provided download justification',
    `status`             ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewed_by`        INT UNSIGNED NULL COMMENT 'FK users.id — admin who reviewed',
    `reviewed_at`        DATETIME     NULL,
    `review_notes`       TEXT         NULL,
    `download_performed` TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 when actual download occurred',
    `downloaded_at`      DATETIME     NULL,
    `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_bgdl_bg`      (`bg_request_id`),
    KEY `idx_bgdl_doctor`  (`doctor_id`),
    KEY `idx_bgdl_patient` (`patient_id`),
    KEY `idx_bgdl_status`  (`status`),
    CONSTRAINT `fk_bgdl_bg`
        FOREIGN KEY (`bg_request_id`) REFERENCES `break_glass_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_bgdl_doctor`
        FOREIGN KEY (`doctor_id`)     REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_bgdl_patient`
        FOREIGN KEY (`patient_id`)    REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_bgdl_group`
        FOREIGN KEY (`group_id`)      REFERENCES `report_groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_bgdl_reviewer`
        FOREIGN KEY (`reviewed_by`)   REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Admin-approval-required download requests for Break-Glass records';


-- ============================================================================
-- 2. bg_share_requests
--    When a BG doctor has already made 3 emergency shares from the same
--    BG event, the 4th+ requires admin approval before the recipient
--    receives any access.
-- ============================================================================
CREATE TABLE IF NOT EXISTS `bg_share_requests` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `bg_request_id`    INT UNSIGNED NOT NULL COMMENT 'FK break_glass_requests.id',
    `requesting_doctor_id` INT UNSIGNED NOT NULL COMMENT 'FK users.id',
    `recipient_doctor_id`  INT UNSIGNED NOT NULL COMMENT 'FK users.id',
    `patient_id`       INT UNSIGNED NOT NULL COMMENT 'FK users.id',
    `group_id`         INT UNSIGNED NOT NULL COMMENT 'FK report_groups.id',
    `record_ids`       JSON         NULL  COMMENT 'Specific records in share scope (null = all BG records)',
    `file_ids`         JSON         NULL  COMMENT 'Specific files in share scope (null = all files)',
    `can_download`     TINYINT(1)   NOT NULL DEFAULT 0,
    `share_count`      TINYINT UNSIGNED NOT NULL DEFAULT 4 COMMENT 'Share number that triggered this (>=4)',
    `reason`           TEXT         NULL,
    `status`           ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewed_by`      INT UNSIGNED NULL COMMENT 'FK users.id — admin reviewer',
    `reviewed_at`      DATETIME     NULL,
    `review_notes`     TEXT         NULL,
    -- Once approved, a group_share row is created and its id stored here
    `group_share_id`   INT UNSIGNED NULL COMMENT 'FK group_shares.id — created after approval',
    `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_bgsr_bg`       (`bg_request_id`),
    KEY `idx_bgsr_doctor`   (`requesting_doctor_id`),
    KEY `idx_bgsr_patient`  (`patient_id`),
    KEY `idx_bgsr_status`   (`status`),
    CONSTRAINT `fk_bgsr_bg`
        FOREIGN KEY (`bg_request_id`)       REFERENCES `break_glass_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_bgsr_req_doctor`
        FOREIGN KEY (`requesting_doctor_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_bgsr_rec_doctor`
        FOREIGN KEY (`recipient_doctor_id`)  REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_bgsr_patient`
        FOREIGN KEY (`patient_id`)           REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_bgsr_group`
        FOREIGN KEY (`group_id`)             REFERENCES `report_groups` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_bgsr_reviewer`
        FOREIGN KEY (`reviewed_by`)          REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_bgsr_group_share`
        FOREIGN KEY (`group_share_id`)       REFERENCES `group_shares` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Admin-approval-required emergency shares when count >= 4';


SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- MANUAL RUN INSTRUCTIONS
-- ============================================================================
-- 1. Open MySQL Workbench
-- 2. Connect to localhost with user: root / password: root
-- 3. Open this file: database/break_glass_schema.sql
-- 4. Click "Run" (lightning bolt)
-- 5. Verify: SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
--            WHERE TABLE_SCHEMA='clarus_health'
--            AND TABLE_NAME IN ('bg_download_requests','bg_share_requests');
-- ============================================================================
-- Tables created:
--   bg_download_requests — admin-approved download scope per BG event
--   bg_share_requests    — admin-approval-required 4th+ emergency share
-- ============================================================================
