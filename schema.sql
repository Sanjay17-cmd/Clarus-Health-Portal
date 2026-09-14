-- ============================================================
-- Clarus Health Portal — Database Initialization Script
-- Version: 1.0.0
-- Engine:  MySQL 8.x
-- ============================================================

-- Create Database
CREATE DATABASE IF NOT EXISTS clarus_health
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE clarus_health;

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS Users (
  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255)    NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,
  full_name     VARCHAR(150)    NOT NULL,
  role          ENUM('Admin','Doctor','LabTechnician','Patient')
                                NOT NULL DEFAULT 'Patient',
  department    VARCHAR(100)    DEFAULT NULL,
  phone         VARCHAR(20)     DEFAULT NULL,
  avatar_url    VARCHAR(500)    DEFAULT NULL,
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE INDEX idx_users_email  (email),
  INDEX        idx_users_role   (role),
  INDEX        idx_users_dept   (department)
) ENGINE=InnoDB;

-- ============================================================
-- 2. MEDICAL REPORTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS MedicalReports (
  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  patient_id    INT UNSIGNED    NOT NULL,
  uploaded_by   INT UNSIGNED    NOT NULL,
  title         VARCHAR(255)    NOT NULL,
  department    VARCHAR(100)    NOT NULL,
  file_path     VARCHAR(500)    NOT NULL,
  file_type     VARCHAR(20)     NOT NULL,
  file_size     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  notes         TEXT            DEFAULT NULL,
  status        ENUM('Pending','Verified','Flagged')
                                NOT NULL DEFAULT 'Pending',
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_reports_patient   (patient_id),
  INDEX idx_reports_uploader  (uploaded_by),
  INDEX idx_reports_dept      (department),
  INDEX idx_reports_status    (status),
  INDEX idx_reports_created   (created_at),

  CONSTRAINT fk_reports_patient
    FOREIGN KEY (patient_id) REFERENCES Users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_reports_uploader
    FOREIGN KEY (uploaded_by) REFERENCES Users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 3. SHARE LINKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS ShareLinks (
  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  report_id     INT UNSIGNED    NOT NULL,
  created_by    INT UNSIGNED    NOT NULL,
  token         VARCHAR(128)    NOT NULL,
  expires_at    TIMESTAMP       NOT NULL,
  max_views     INT UNSIGNED    NOT NULL DEFAULT 5,
  current_views INT UNSIGNED    NOT NULL DEFAULT 0,
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE INDEX idx_share_token    (token),
  INDEX        idx_share_report   (report_id),
  INDEX        idx_share_creator  (created_by),
  INDEX        idx_share_expires  (expires_at),

  CONSTRAINT fk_share_report
    FOREIGN KEY (report_id) REFERENCES MedicalReports(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_share_creator
    FOREIGN KEY (created_by) REFERENCES Users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 4. AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS AuditLogs (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED    DEFAULT NULL,
  action        VARCHAR(100)    NOT NULL,
  entity_type   VARCHAR(50)     DEFAULT NULL,
  entity_id     INT UNSIGNED    DEFAULT NULL,
  ip_address    VARCHAR(45)     DEFAULT NULL,
  metadata      JSON            DEFAULT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_audit_user    (user_id),
  INDEX idx_audit_action  (action),
  INDEX idx_audit_entity  (entity_type, entity_id),
  INDEX idx_audit_created (created_at),

  CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id) REFERENCES Users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 5. CLEAN INITIALIZATION (NO SEED DATA)
-- ============================================================
-- Database initialized clean with no pre-existing users or reports.
-- Use the Register form on the frontend login page to create accounts.

