// ── Clarus Health Portal — Express Server Entry ──

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Ensure uploads directory exists ──
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Middleware ──
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static file serving for uploads ──
app.use('/uploads', express.static(uploadsDir));

// ── API Routes ──
const authRoutes    = require('./routes/auth.routes');
const reportsRoutes = require('./routes/reports.routes');
const shareRoutes   = require('./routes/share.routes');
const adminRoutes   = require('./routes/admin.routes');
const usersRoutes   = require('./routes/users.routes');

app.use('/api/auth',    authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/share',   shareRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/users',   usersRoutes);

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Clarus Health Portal API' });
});

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Start server ──
app.listen(PORT, () => {
  console.log(`\n  ✦ Clarus Health Portal API`);
  console.log(`  ✦ Running on http://localhost:${PORT}`);
  console.log(`  ✦ Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
