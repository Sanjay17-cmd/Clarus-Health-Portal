// ── Share Links Controller ──

const crypto = require('crypto');
const QRCode = require('qrcode');
const pool = require('../config/db');

/**
 * POST /api/share/create
 * Creates a time-limited share token for a report.
 */
async function createShareLink(req, res) {
  try {
    const { report_id, expires_in_hours = 24, max_views = 5 } = req.body;
    const userId = req.user.id;

    if (!report_id) {
      return res.status(400).json({ success: false, message: 'report_id is required.' });
    }

    // Verify report exists and user has access
    const [reports] = await pool.execute('SELECT * FROM MedicalReports WHERE id = ?', [report_id]);
    if (reports.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = reports[0];

    // Only the patient who owns the report, admin, or doctor can create share links
    if (req.user.role === 'Patient' && report.patient_id !== userId) {
      return res.status(403).json({ success: false, message: 'You can only share your own reports.' });
    }

    // Generate cryptographic token
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiry
    const expiresAt = new Date(Date.now() + (parseInt(expires_in_hours) * 60 * 60 * 1000));

    await pool.execute(
      'INSERT INTO ShareLinks (report_id, created_by, token, expires_at, max_views) VALUES (?, ?, ?, ?, ?)',
      [report_id, userId, token, expiresAt, parseInt(max_views)]
    );

    // Audit log
    await pool.execute(
      'INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'SHARE_CREATE', 'ShareLinks', report_id, req.ip,
       JSON.stringify({ expires_in_hours, max_views, token_prefix: token.substring(0, 8) })]
    );

    const shareUrl = `${req.protocol}://${req.get('host')}/api/share/verify/${token}`;

    res.status(201).json({
      success: true,
      share: {
        token,
        url: shareUrl,
        expires_at: expiresAt.toISOString(),
        max_views: parseInt(max_views),
      },
    });
  } catch (err) {
    console.error('CreateShareLink error:', err);
    res.status(500).json({ success: false, message: 'Failed to create share link.' });
  }
}

/**
 * GET /api/share/verify/:token
 * Verifies and returns the report associated with a share token.
 */
async function verifyShareToken(req, res) {
  try {
    const { token } = req.params;

    const [links] = await pool.execute(
      `SELECT sl.*, r.title, r.department, r.file_path, r.file_type, r.file_size, r.notes, r.status, r.created_at AS report_date,
              p.full_name AS patient_name
       FROM ShareLinks sl
       JOIN MedicalReports r ON sl.report_id = r.id
       JOIN Users p ON r.patient_id = p.id
       WHERE sl.token = ?`,
      [token]
    );

    if (links.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid share token.' });
    }

    const link = links[0];

    // Check if link is active
    if (!link.is_active) {
      return res.status(410).json({ success: false, message: 'This share link has been deactivated.' });
    }

    // Check expiry
    if (new Date(link.expires_at) < new Date()) {
      await pool.execute('UPDATE ShareLinks SET is_active = 0 WHERE id = ?', [link.id]);
      return res.status(410).json({ success: false, message: 'This share link has expired.' });
    }

    // Check view limit
    if (link.current_views >= link.max_views) {
      await pool.execute('UPDATE ShareLinks SET is_active = 0 WHERE id = ?', [link.id]);
      return res.status(410).json({ success: false, message: 'This share link has reached its maximum view count.' });
    }

    // Increment view count
    await pool.execute(
      'UPDATE ShareLinks SET current_views = current_views + 1 WHERE id = ?',
      [link.id]
    );

    // Audit log
    await pool.execute(
      'INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [null, 'SHARE_ACCESS', 'ShareLinks', link.report_id, req.ip,
       JSON.stringify({ token_prefix: token.substring(0, 8), view_number: link.current_views + 1 })]
    );

    res.json({
      success: true,
      report: {
        title:        link.title,
        department:   link.department,
        file_type:    link.file_type,
        file_size:    link.file_size,
        notes:        link.notes,
        status:       link.status,
        report_date:  link.report_date,
        patient_name: link.patient_name,
        download_url: `/${link.file_path}`,
      },
      share: {
        expires_at:    link.expires_at,
        views_used:    link.current_views + 1,
        max_views:     link.max_views,
      },
    });
  } catch (err) {
    console.error('VerifyShareToken error:', err);
    res.status(500).json({ success: false, message: 'Failed to verify share token.' });
  }
}

/**
 * GET /api/share/qr/:token
 * Returns a QR code image (PNG data URL) for the share token.
 */
async function getShareQR(req, res) {
  try {
    const { token } = req.params;

    const [links] = await pool.execute('SELECT id FROM ShareLinks WHERE token = ?', [token]);
    if (links.length === 0) {
      return res.status(404).json({ success: false, message: 'Invalid share token.' });
    }

    const shareUrl = `${req.protocol}://${req.get('host')}/api/share/verify/${token}`;
    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#0A2540', light: '#FFFFFF' },
    });

    res.json({ success: true, qr: qrDataUrl, url: shareUrl });
  } catch (err) {
    console.error('GetShareQR error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate QR code.' });
  }
}

/**
 * GET /api/share/my-links
 * Returns share links created by the authenticated user.
 */
async function getMyShareLinks(req, res) {
  try {
    const [links] = await pool.execute(
      `SELECT sl.*, r.title AS report_title, r.department
       FROM ShareLinks sl
       JOIN MedicalReports r ON sl.report_id = r.id
       WHERE sl.created_by = ?
       ORDER BY sl.created_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, links });
  } catch (err) {
    console.error('GetMyShareLinks error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch share links.' });
  }
}

module.exports = { createShareLink, verifyShareToken, getShareQR, getMyShareLinks };
