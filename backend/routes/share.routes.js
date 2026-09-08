// ── Share Routes ──

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createShareLink,
  verifyShareToken,
  getShareQR,
  getMyShareLinks,
} = require('../controllers/share.controller');

router.post('/create',       authenticate, createShareLink);
router.get('/my-links',      authenticate, getMyShareLinks);
router.get('/verify/:token', verifyShareToken);           // Public — no auth required
router.get('/qr/:token',     authenticate, getShareQR);

module.exports = router;
