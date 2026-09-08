// ── Admin Controller ──

const pool = require('../config/db');

/**
 * GET /api/admin/metrics
 * Returns dashboard metrics for the admin console.
 */
async function getMetrics(req, res) {
  try {
    const [[{ total_users }]]     = await pool.execute('SELECT COUNT(*) AS total_users FROM Users');
    const [[{ total_reports }]]   = await pool.execute('SELECT COUNT(*) AS total_reports FROM MedicalReports');
    const [[{ total_shares }]]    = await pool.execute('SELECT COUNT(*) AS total_shares FROM ShareLinks');
    const [[{ active_shares }]]   = await pool.execute('SELECT COUNT(*) AS active_shares FROM ShareLinks WHERE is_active = 1 AND expires_at > NOW()');
    const [[{ total_logs }]]      = await pool.execute('SELECT COUNT(*) AS total_logs FROM AuditLogs');
    const [[{ pending_reports }]] = await pool.execute("SELECT COUNT(*) AS pending_reports FROM MedicalReports WHERE status = 'Pending'");
    const [[{ verified_reports }]]= await pool.execute("SELECT COUNT(*) AS verified_reports FROM MedicalReports WHERE status = 'Verified'");
    const [[{ flagged_reports }]] = await pool.execute("SELECT COUNT(*) AS flagged_reports FROM MedicalReports WHERE status = 'Flagged'");

    // Role distribution
    const [roleCounts] = await pool.execute(
      'SELECT role, COUNT(*) AS count FROM Users GROUP BY role'
    );

    // Recent activity (last 7 days)
    const [recentActivity] = await pool.execute(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM AuditLogs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    // Department report distribution
    const [deptDistribution] = await pool.execute(
      'SELECT department, COUNT(*) AS count FROM MedicalReports GROUP BY department ORDER BY count DESC'
    );

    res.json({
      success: true,
      metrics: {
        total_users,
        total_reports,
        total_shares,
        active_shares,
        total_logs,
        pending_reports,
        verified_reports,
        flagged_reports,
        role_distribution: roleCounts,
        recent_activity: recentActivity,
        department_distribution: deptDistribution,
      },
    });
  } catch (err) {
    console.error('GetMetrics error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch metrics.' });
  }
}

/**
 * GET /api/admin/audit-logs
 */
async function getAuditLogs(req, res) {
  try {
    const { action, user_id, entity_type, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT al.*, u.full_name AS user_name, u.role AS user_role
      FROM AuditLogs al
      LEFT JOIN Users u ON al.user_id = u.id
    `;
    let countQuery = 'SELECT COUNT(*) AS total FROM AuditLogs al';
    const conditions = [];
    const params = [];

    if (action) {
      conditions.push('al.action = ?');
      params.push(action);
    }
    if (user_id) {
      conditions.push('al.user_id = ?');
      params.push(parseInt(user_id));
    }
    if (entity_type) {
      conditions.push('al.entity_type = ?');
      params.push(entity_type);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';

    const countParams = [...params];
    params.push(parseInt(limit), offset);

    const [logs] = await pool.execute(query, params);
    const [countResult] = await pool.execute(countQuery, countParams);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('GetAuditLogs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
}

/**
 * GET /api/admin/users
 */
async function getUsers(req, res) {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = 'SELECT id, email, full_name, role, department, phone, is_active, created_at, updated_at FROM Users';
    let countQuery = 'SELECT COUNT(*) AS total FROM Users';
    const conditions = [];
    const params = [];

    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }
    if (search) {
      conditions.push('(full_name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const countParams = [...params];
    params.push(parseInt(limit), offset);

    const [users] = await pool.execute(query, params);
    const [countResult] = await pool.execute(countQuery, countParams);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        pages: Math.ceil(countResult[0].total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('GetUsers error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
}

/**
 * PATCH /api/admin/users/:id/role
 */
async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['Admin', 'Doctor', 'LabTechnician', 'Patient'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Valid: ${validRoles.join(', ')}` });
    }

    const [existing] = await pool.execute('SELECT role FROM Users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await pool.execute('UPDATE Users SET role = ? WHERE id = ?', [role, id]);

    // Audit log
    await pool.execute(
      'INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'USER_ROLE_UPDATE', 'Users', id, req.ip,
       JSON.stringify({ previous_role: existing[0].role, new_role: role })]
    );

    res.json({ success: true, message: 'User role updated.' });
  } catch (err) {
    console.error('UpdateUserRole error:', err);
    res.status(500).json({ success: false, message: 'Failed to update user role.' });
  }
}

/**
 * PATCH /api/admin/users/:id/status
 */
async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute('SELECT is_active FROM Users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const newStatus = existing[0].is_active ? 0 : 1;
    await pool.execute('UPDATE Users SET is_active = ? WHERE id = ?', [newStatus, id]);

    // Audit log
    await pool.execute(
      'INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, newStatus ? 'USER_ACTIVATE' : 'USER_DEACTIVATE', 'Users', id, req.ip, '{}']
    );

    res.json({ success: true, message: `User ${newStatus ? 'activated' : 'deactivated'}.` });
  } catch (err) {
    console.error('ToggleUserStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
}

module.exports = { getMetrics, getAuditLogs, getUsers, updateUserRole, toggleUserStatus };
