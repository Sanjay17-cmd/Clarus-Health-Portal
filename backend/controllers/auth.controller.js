// ── Auth Controller ──

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET    = process.env.JWT_SECRET || 'clarus_health_jwt_secret_change_in_production';
const JWT_EXPIRES   = process.env.JWT_EXPIRES_IN || '24h';

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, email, password_hash, full_name, role, department, phone, avatar_url, is_active FROM Users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const tokenPayload = {
      id:        user.id,
      email:     user.email,
      role:      user.role,
      full_name: user.full_name,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    // Audit log
    await pool.execute(
      'INSERT INTO AuditLogs (user_id, action, ip_address, metadata) VALUES (?, ?, ?, ?)',
      [user.id, 'USER_LOGIN', req.ip, JSON.stringify({ method: 'credentials' })]
    );

    res.json({
      success: true,
      token,
      user: {
        id:         user.id,
        email:      user.email,
        full_name:  user.full_name,
        role:       user.role,
        department: user.department,
        phone:      user.phone,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
}

/**
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { email, password, full_name, role, department, phone } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ success: false, message: 'Email, password, and full name are required.' });
    }

    // Check duplicate
    const [existing] = await pool.execute('SELECT id FROM Users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const validRoles = ['Admin', 'Doctor', 'LabTechnician', 'Patient'];
    const userRole = validRoles.includes(role) ? role : 'Patient';

    const [result] = await pool.execute(
      'INSERT INTO Users (email, password_hash, full_name, role, department, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [email, password_hash, full_name, userRole, department || null, phone || null]
    );

    // Audit log
    await pool.execute(
      'INSERT INTO AuditLogs (user_id, action, entity_type, entity_id, ip_address, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [result.insertId, 'USER_REGISTER', 'Users', result.insertId, req.ip, JSON.stringify({ role: userRole })]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      userId: result.insertId,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res) {
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, full_name, role, department, phone, avatar_url, is_active, created_at FROM Users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { login, register, getMe };
