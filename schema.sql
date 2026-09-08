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
-- 5. SEED DATA
-- ============================================================

-- Passwords (plaintext → bcrypt):
--   admin@clarus.health        → admin123
--   dr.chen@clarus.health      → doctor123
--   lab.martinez@clarus.health → lab123
--   emily.wilson@email.com     → patient123
--   robert.taylor@email.com   → patient123

INSERT INTO Users (email, password_hash, full_name, role, department, phone) VALUES
('admin@clarus.health', '$2a$10$V1a.qrgvvzUCLGfX6dA/DuMQcaIs23Rk77rnmK4BqilNwP6CEnBXa', 'Dr. Sarah Mitchell', 'Admin', 'Administration', '+1-555-0100');

INSERT INTO Users (email, password_hash, full_name, role, department, phone) VALUES
('dr.chen@clarus.health', '$2a$10$n8R9HHhW6Fnwn4xxRwEqtOOGZiEqjfuOcxeUHeszJ9I4z00OruPvG', 'Dr. James Chen', 'Doctor', 'Cardiology', '+1-555-0201');

INSERT INTO Users (email, password_hash, full_name, role, department, phone) VALUES
('lab.martinez@clarus.health', '$2a$10$S1NFFD1UUMq6y/A5SWGGvuaqMgz2Pdj/fiPqOEcJANiPdo4tCDHMy', 'Maria Martinez', 'LabTechnician', 'Pathology', '+1-555-0301');

INSERT INTO Users (email, password_hash, full_name, role, department, phone) VALUES
('emily.wilson@email.com', '$2a$10$WNKzjKzygA3gYmgDoNB9sulirdEvpaal9pvBIxhT.EflNqioEeqlC', 'Emily Wilson', 'Patient', NULL, '+1-555-0401');

INSERT INTO Users (email, password_hash, full_name, role, department, phone) VALUES
('robert.taylor@email.com', '$2a$10$rOMNZ38g/iT6iLOuSWD0t.NKgIXWNbHyEFN2nwvP88EdQHPLyAx86', 'Robert Taylor', 'Patient', NULL, '+1-555-0402');

-- Sample Medical Reports
INSERT INTO MedicalReports (patient_id, uploaded_by, title, department, file_path, file_type, file_size, notes, status) VALUES
(4, 3, 'Complete Blood Count — September 2026',  'Pathology',   'uploads/sample_cbc_report.pdf',  'application/pdf', 245000,  'Routine CBC panel. All markers within normal range.', 'Verified'),
(4, 3, 'Chest X-Ray — Anterior-Posterior View',   'Radiology',   'uploads/sample_xray.pdf',        'application/pdf', 1200000, 'No abnormalities detected. Clear lung fields.',       'Verified'),
(5, 3, 'Lipid Panel — Fasting',                   'Pathology',   'uploads/sample_lipid.pdf',       'application/pdf', 198000,  'LDL slightly elevated. Recommend dietary changes.',   'Pending'),
(4, 3, 'Thyroid Function Panel (TSH, T3, T4)',     'Endocrinology','uploads/sample_thyroid.pdf',     'application/pdf', 210000,  'TSH within normal limits. T4 borderline low.',        'Verified'),
(5, 3, 'Urinalysis — Routine',                    'Pathology',   'uploads/sample_urinalysis.pdf',  'application/pdf', 175000,  'Normal findings. No proteinuria.',                    'Verified');

-- Sample Audit Logs
INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES
(3, 'REPORT_UPLOAD',  'MedicalReports', 1, '192.168.1.10', '{"file_type":"application/pdf","department":"Pathology"}'),
(3, 'REPORT_UPLOAD',  'MedicalReports', 2, '192.168.1.10', '{"file_type":"application/pdf","department":"Radiology"}'),
(1, 'REPORT_VERIFY',  'MedicalReports', 1, '192.168.1.5',  '{"previous_status":"Pending","new_status":"Verified"}'),
(1, 'USER_LOGIN',     NULL,             NULL, '192.168.1.5',  '{"method":"credentials"}'),
(2, 'REPORT_VIEW',    'MedicalReports', 1, '192.168.1.20', '{"patient_id":4}');
