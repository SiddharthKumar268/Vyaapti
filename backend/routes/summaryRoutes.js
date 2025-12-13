const express = require('express');
const router = express.Router();
const summaryController = require('../controllers/summaryController');

// GET /api/summary
router.get('/summary', summaryController.getSummary);

module.exports = router;