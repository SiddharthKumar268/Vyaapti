const express = require('express');
const router = express.Router();
const chartController = require('../controllers/chartController');

// GET /api/charts/data - Get chart data
router.get('/charts/data', chartController.getChartData);

module.exports = router;