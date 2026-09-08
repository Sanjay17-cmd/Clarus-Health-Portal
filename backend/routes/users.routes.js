// ── Users Routes ──

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getPatients, getUserById } = require('../controllers/users.controller');

router.get('/patients', authenticate, authorize('Doctor', 'Admin'), getPatients);
router.get('/:id',      authenticate, getUserById);

module.exports = router;
