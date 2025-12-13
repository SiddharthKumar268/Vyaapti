const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');

// GET /api/accounts/top - Get top suspicious accounts
router.get('/accounts/top', accountController.getTopAccounts);

// GET /api/account/:accountId - Get account by ID
router.get('/account/:accountId', accountController.getAccountById);

// GET /api/account/:accountId/chains - Get chains for an account
router.get('/account/:accountId/chains', accountController.getAccountChains);

module.exports = router;