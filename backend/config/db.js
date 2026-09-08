// ── MySQL Connection Pool ──

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306', 10),
  user:               process.env.DB_USER || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME || 'clarus_health',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
  timezone:           '+00:00',
});

// Verify connection on startup
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('  ✦ MySQL connected to', process.env.DB_NAME || 'clarus_health');
    connection.release();
  } catch (err) {
    console.error('  ✖ MySQL connection failed:', err.message);
  }
})();

module.exports = pool;
