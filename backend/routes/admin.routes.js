// ── Admin Routes ──

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getMetrics,
  getAuditLogs,
  getUsers,
  updateUserRole,
  toggleUserStatus,
} = require('../controllers/admin.controller');

// All admin routes require Admin role
router.use(authenticate, authorize('Admin'));

router.get('/metrics',            getMetrics);
router.get('/audit-logs',         getAuditLogs);
router.get('/users',              getUsers);
router.patch('/users/:id/role',   updateUserRole);
router.patch('/users/:id/status', toggleUserStatus);

module.exports = router;
