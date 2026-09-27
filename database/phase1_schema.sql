-- =============================================================================
-- Clarus Health Portal — Phase 1 Database Schema
-- =============================================================================
-- Run manually in MySQL after creating the database:
--   CREATE DATABASE clarus_health CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   USE clarus_health;
--   SOURCE /path/to/phase1_schema.sql;
--
-- IMPORTANT: Antigravity did NOT execute this file. Run it yourself.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ---------------------------------------------------------------------------
-- specializations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `specializations` (
    `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `name`        VARCHAR(120)    NOT NULL,
    `description` TEXT            NULL,
    `is_active`   TINYINT(1)      NOT NULL DEFAULT 1,
    `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_specializations_name` (`name`),
    KEY `idx_specializations_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Medical specializations managed by Admin';

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id`                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `name`                VARCHAR(200)    NOT NULL,
    `email`               VARCHAR(255)    NOT NULL,
    `password_hash`       VARCHAR(255)    NOT NULL,
    `role`                ENUM('PATIENT','DOCTOR','LAB_TECHNICIAN','ADMIN')
                                          NOT NULL,
    `status`              ENUM('PENDING_APPROVAL','ACTIVE','SUSPENDED','REJECTED','DISABLED')
                                          NOT NULL DEFAULT 'PENDING_APPROVAL',

    -- Specialization (Doctors only; FK enforced at application layer too)
    `specialization_id`   INT UNSIGNED    NULL DEFAULT NULL,

    -- Timestamps
    `created_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `last_login_at`       DATETIME        NULL DEFAULT NULL,

    -- Approval / Rejection
    `approved_by`         INT UNSIGNED    NULL DEFAULT NULL
                          COMMENT 'admin user id who approved',
    `approved_at`         DATETIME        NULL DEFAULT NULL,
    `rejected_by`         INT UNSIGNED    NULL DEFAULT NULL,
    `rejected_at`         DATETIME        NULL DEFAULT NULL,
    `rejection_reason`    TEXT            NULL,

    -- Suspension
    `suspended_by`        INT UNSIGNED    NULL DEFAULT NULL,
    `suspended_at`        DATETIME        NULL DEFAULT NULL,
    `suspension_reason`   TEXT            NULL,

    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email` (`email`),
    KEY `idx_users_role`                  (`role`),
    KEY `idx_users_status`                (`status`),
    KEY `idx_users_specialization_id`     (`specialization_id`),
    KEY `idx_users_created_at`            (`created_at`),

    CONSTRAINT `fk_users_specialization`
        FOREIGN KEY (`specialization_id`)
        REFERENCES `specializations` (`id`)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT `fk_users_approved_by`
        FOREIGN KEY (`approved_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT `fk_users_rejected_by`
        FOREIGN KEY (`rejected_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT `fk_users_suspended_by`
        FOREIGN KEY (`suspended_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='All portal users across all roles';

-- ---------------------------------------------------------------------------
-- specialization_change_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `specialization_change_requests` (
    `id`                        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `doctor_id`                 INT UNSIGNED    NOT NULL,
    `current_specialization_id` INT UNSIGNED    NULL DEFAULT NULL
                                COMMENT 'Null if doctor had no specialization yet',
    `requested_specialization_id` INT UNSIGNED NOT NULL,
    `reason`                    TEXT            NULL,
    `status`                    ENUM('PENDING','APPROVED','REJECTED')
                                                NOT NULL DEFAULT 'PENDING',
    `reviewed_by`               INT UNSIGNED    NULL DEFAULT NULL,
    `reviewed_at`               DATETIME        NULL DEFAULT NULL,
    `review_notes`              TEXT            NULL,
    `created_at`                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_scr_doctor_id`     (`doctor_id`),
    KEY `idx_scr_status`        (`status`),
    KEY `idx_scr_created_at`    (`created_at`),

    CONSTRAINT `fk_scr_doctor`
        FOREIGN KEY (`doctor_id`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT `fk_scr_current_spec`
        FOREIGN KEY (`current_specialization_id`)
        REFERENCES `specializations` (`id`)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT `fk_scr_requested_spec`
        FOREIGN KEY (`requested_specialization_id`)
        REFERENCES `specializations` (`id`)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT `fk_scr_reviewed_by`
        FOREIGN KEY (`reviewed_by`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Doctor requests to change their medical specialization';

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
    `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `recipient_id`  INT UNSIGNED    NOT NULL,
    `title`         VARCHAR(255)    NOT NULL,
    `message`       TEXT            NOT NULL,
    `type`          ENUM(
                        'ACCOUNT_APPROVED',
                        'ACCOUNT_REJECTED',
                        'ACCOUNT_SUSPENDED',
                        'ACCOUNT_REACTIVATED',
                        'SPEC_CHANGE_REQUESTED',
                        'SPEC_CHANGE_APPROVED',
                        'SPEC_CHANGE_REJECTED',
                        'SYSTEM',
                        'GENERAL'
                    )               NOT NULL DEFAULT 'GENERAL',
    `is_read`       TINYINT(1)      NOT NULL DEFAULT 0,
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_notifications_recipient_id`    (`recipient_id`),
    KEY `idx_notifications_is_read`         (`is_read`),
    KEY `idx_notifications_created_at`      (`created_at`),

    CONSTRAINT `fk_notifications_recipient`
        FOREIGN KEY (`recipient_id`)
        REFERENCES `users` (`id`)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='In-app notifications for all users';

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `actor_id`      INT UNSIGNED    NULL DEFAULT NULL
                    COMMENT 'User who performed the action; null for system/unauthenticated',
    `actor_email`   VARCHAR(255)    NULL DEFAULT NULL
                    COMMENT 'Snapshot of email at time of action (actor may be deleted later)',
    `action`        VARCHAR(100)    NOT NULL
                    COMMENT 'e.g. USER_REGISTERED, USER_APPROVED, LOGIN_SUCCESS',
    `target_type`   VARCHAR(60)     NULL DEFAULT NULL
                    COMMENT 'e.g. User, Specialization, SpecializationChangeRequest',
    `target_id`     INT UNSIGNED    NULL DEFAULT NULL,
    `details`       JSON            NULL
                    COMMENT 'Extra structured context (role, status, reason, etc.)',
    `ip_address`    VARCHAR(45)     NULL DEFAULT NULL,
    `user_agent`    VARCHAR(512)    NULL DEFAULT NULL,
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (`id`),
    KEY `idx_audit_actor_id`    (`actor_id`),
    KEY `idx_audit_action`      (`action`),
    KEY `idx_audit_target`      (`target_type`, `target_id`),
    KEY `idx_audit_created_at`  (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Immutable audit trail for Phase 1 actions';

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- ADMIN SEED (optional — fill in before running)
-- =============================================================================
-- Generate a bcrypt hash for your chosen password and paste below.
-- Example Python one-liner:
--   python -c "import bcrypt; print(bcrypt.hashpw(b'YourPassword123!', bcrypt.gensalt()).decode())"
--
-- Then uncomment and run this INSERT:
--
-- INSERT INTO `users`
--     (`name`, `email`, `password_hash`, `role`, `status`, `created_at`, `updated_at`)
-- VALUES
--     ('System Admin', 'admin@clarushealth.local',
--      '$2b$12$REPLACE_WITH_YOUR_BCRYPT_HASH_HERE',
--      'ADMIN', 'ACTIVE', NOW(), NOW());
-- =============================================================================
