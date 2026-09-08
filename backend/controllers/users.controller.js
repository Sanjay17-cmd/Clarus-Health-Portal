// ── Users Controller ──

const pool = require('../config/db');

/**
 * GET /api/users/patients
 * Returns list of patients (for Doctor patient lookup).
 */
async function getPatients(req, res) {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT u.id, u.email, u.full_name, u.phone, u.created_at,
             COUNT(r.id) AS report_count,
             MAX(r.created_at) AS last_report_date
      FROM Users u
      LEFT JOIN MedicalReports r ON u.id = r.patient_id
      WHERE u.role = 'Patient'
    `;
    let countQuery = "SELECT COUNT(*) AS total FROM Users WHERE role = 'Patient'";
    const params = [];
    const countParams = [];

    if (search) {
      query += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
      countQuery += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' GROUP BY u.id ORDER BY u.full_name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [patients] = await pool.execute(query, params);
    const [countResult] = await pool.execute(countQuery, countParams);

    res.json({
      success: true,
      patients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('GetPatients error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch patients.' });
  }
}

/**
 * GET /api/users/:id
 */
async function getUserById(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      'SELECT id, email, full_name, role, department, phone, avatar_url, is_active, created_at FROM Users WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('GetUserById error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch user.' });
  }
}

module.exports = { getPatients, getUserById };
