// ── Reports Controller ──

const path = require('path');
const fs = require('fs');
const pool = require('../config/db');

/**
 * GET /api/reports
 * Returns reports filtered by the user's role:
 *   - Patient: only their own reports
 *   - Doctor:  all reports (with optional patient_id filter)
 *   - LabTechnician: reports they uploaded
 *   - Admin: all reports
 */
async function getReports(req, res) {
  try {
    const { role, id: userId } = req.user;
    const { patient_id, department, status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let baseQuery = `
      SELECT r.*, 
             p.full_name AS patient_name, p.email AS patient_email,
             u.full_name AS uploader_name
      FROM MedicalReports r
      JOIN Users p ON r.patient_id = p.id
      JOIN Users u ON r.uploaded_by = u.id
    `;
    let countQuery = 'SELECT COUNT(*) AS total FROM MedicalReports r';
    const conditions = [];
    const params = [];

    // Role-based filtering
    if (role === 'Patient') {
      conditions.push('r.patient_id = ?');
      params.push(userId);
    } else if (role === 'LabTechnician') {
      conditions.push('r.uploaded_by = ?');
      params.push(userId);
    }

    // Optional filters
    if (patient_id) {
      conditions.push('r.patient_id = ?');
      params.push(parseInt(patient_id));
    }
    if (department) {
      conditions.push('r.department = ?');
      params.push(department);
    }
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      baseQuery += whereClause;
      countQuery += whereClause;
    }

    baseQuery += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';

    const countParams = [...params];
    params.push(parseInt(limit), offset);

    const [reports] = await pool.execute(baseQuery, params);
    const [countResult] = await pool.execute(countQuery, countParams);

    res.json({
      success: true,
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('GetReports error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch reports.' });
  }
}

/**
 * GET /api/reports/:id
 */
async function getReportById(req, res) {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const [rows] = await pool.execute(
      `SELECT r.*, 
              p.full_name AS patient_name, p.email AS patient_email,
              u.full_name AS uploader_name
       FROM MedicalReports r
       JOIN Users p ON r.patient_id = p.id
       JOIN Users u ON r.uploaded_by = u.id
       WHERE r.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = rows[0];

    // Patient can only see their own reports
    if (role === 'Patient' && report.patient_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Audit log
    await pool.execute(
      'INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'REPORT_VIEW', 'MedicalReports', id, req.ip, JSON.stringify({ patient_id: report.patient_id })]
    );

    res.json({ success: true, report });
  } catch (err) {
    console.error('GetReportById error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch report.' });
  }
}

/**
 * POST /api/reports/upload
 * LabTechnician or Admin can upload files.
 */
async function uploadReport(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { patient_id, title, department, notes } = req.body;

    if (!patient_id || !title || !department) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'patient_id, title, and department are required.' });
    }

    // Verify patient exists
    const [patient] = await pool.execute('SELECT id FROM Users WHERE id = ? AND role = "Patient"', [patient_id]);
    if (patient.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const filePath = `uploads/${req.file.filename}`;
    const [result] = await pool.execute(
      `INSERT INTO MedicalReports (patient_id, uploaded_by, title, department, file_path, file_type, file_size, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [patient_id, req.user.id, title, department, filePath, req.file.mimetype, req.file.size, notes || null]
    );

    // Audit log
    await pool.execute(
      'INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'REPORT_UPLOAD', 'MedicalReports', result.insertId, req.ip,
       JSON.stringify({ file_type: req.file.mimetype, department, patient_id: parseInt(patient_id) })]
    );

    res.status(201).json({
      success: true,
      message: 'Report uploaded successfully.',
      reportId: result.insertId,
    });
  } catch (err) {
    console.error('UploadReport error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload report.' });
  }
}

/**
 * GET /api/reports/:id/download
 */
async function downloadReport(req, res) {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const [rows] = await pool.execute('SELECT * FROM MedicalReports WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = rows[0];

    if (role === 'Patient' && report.patient_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const filePath = path.join(__dirname, '..', report.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on disk.' });
    }

    // Audit log
    await pool.execute(
      'INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'REPORT_DOWNLOAD', 'MedicalReports', id, req.ip, JSON.stringify({ file_type: report.file_type })]
    );

    res.download(filePath, `${report.title}${path.extname(report.file_path)}`);
  } catch (err) {
    console.error('DownloadReport error:', err);
    res.status(500).json({ success: false, message: 'Failed to download report.' });
  }
}

/**
 * PATCH /api/reports/:id/status
 * Admin or Doctor can change report status.
 */
async function updateReportStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'Verified', 'Flagged'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Valid: ${validStatuses.join(', ')}` });
    }

    const [existing] = await pool.execute('SELECT status FROM MedicalReports WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    await pool.execute('UPDATE MedicalReports SET status = ? WHERE id = ?', [status, id]);

    // Audit log
    await pool.execute(
      'INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'REPORT_STATUS_UPDATE', 'MedicalReports', id, req.ip,
       JSON.stringify({ previous_status: existing[0].status, new_status: status })]
    );

    res.json({ success: true, message: 'Report status updated.' });
  } catch (err) {
    console.error('UpdateReportStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
}

module.exports = { getReports, getReportById, uploadReport, downloadReport, updateReportStatus };
