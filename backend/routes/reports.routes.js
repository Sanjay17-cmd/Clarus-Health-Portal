// ── Reports Routes ──

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getReports,
  getReportById,
  uploadReport,
  downloadReport,
  updateReportStatus,
} = require('../controllers/reports.controller');

router.get('/',              authenticate, getReports);
router.get('/:id',           authenticate, getReportById);
router.post('/upload',       authenticate, authorize('LabTechnician', 'Admin'), upload.single('file'), uploadReport);
router.get('/:id/download',  authenticate, downloadReport);
router.patch('/:id/status',  authenticate, authorize('Admin', 'Doctor'), updateReportStatus);

module.exports = router;
