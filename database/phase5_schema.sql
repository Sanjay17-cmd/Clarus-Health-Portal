-- Clarus Health Portal — emergency-share and admin-approval tables.
-- Run after phase3B_schema.sql. Phase 3B creates break-glass request tables.

CREATE TABLE IF NOT EXISTS break_glass_shares (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    request_id INT UNSIGNED NOT NULL,
    group_id INT UNSIGNED NOT NULL,
    shared_by INT UNSIGNED NOT NULL,
    recipient_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bg_share_recipient (request_id, group_id, recipient_id),
    KEY idx_bg_share_group (group_id),
    KEY idx_bg_share_recipient (recipient_id),
    CONSTRAINT fk_bgs_request FOREIGN KEY (request_id) REFERENCES break_glass_requests(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bgs_group FOREIGN KEY (group_id) REFERENCES report_groups(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bgs_sharer FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bgs_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_permission_requests (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(40) NOT NULL,
    requester_id INT UNSIGNED NOT NULL,
    patient_id INT UNSIGNED NOT NULL,
    group_id INT UNSIGNED NOT NULL,
    break_glass_request_id INT UNSIGNED NULL,
    target_doctor_ids JSON NULL,
    justification TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    decided_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at DATETIME NULL,
    consumed_at DATETIME NULL,
    KEY idx_apr_status (status),
    KEY idx_apr_requester (requester_id, action, group_id),
    KEY idx_apr_patient (patient_id),
    CONSTRAINT fk_apr_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_apr_patient FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_apr_group FOREIGN KEY (group_id) REFERENCES report_groups(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_apr_bg_request FOREIGN KEY (break_glass_request_id) REFERENCES break_glass_requests(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_apr_admin FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;