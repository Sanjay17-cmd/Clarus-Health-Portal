// ── Auth Routes ──

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { login, register, getMe } = require('../controllers/auth.controller');

router.post('/login',    login);
router.post('/register', register);
router.get('/me',        authenticate, getMe);

module.exports = router;
