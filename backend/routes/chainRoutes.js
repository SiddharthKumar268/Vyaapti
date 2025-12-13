const express = require('express');
const router = express.Router();
const chainController = require('../controllers/chainController');

// GET /api/chains - Get all chains
router.get('/chains', chainController.getAllChains);

// GET /api/chain/:id - Get chain by ID
router.get('/chain/:id', chainController.getChainById);

module.exports = router;