const client = require('../config/database');

// Get dashboard summary
const getSummary = async (req, res) => {
    try {
        const chainsQuery = 'SELECT COUNT(*) as count FROM chains';
        const chainsResult = await client.execute(chainsQuery);
        const totalChains = chainsResult.rows[0].count.toNumber();

        const highRiskQuery = 'SELECT COUNT(*) as count FROM chains WHERE risk_score >= 80 ALLOW FILTERING';
        const highRiskResult = await client.execute(highRiskQuery);
        const highRiskChains = highRiskResult.rows[0].count.toNumber();

        const valueQuery = 'SELECT SUM(total_value) as total FROM chains';
        const valueResult = await client.execute(valueQuery);
        const totalValue = valueResult.rows[0].total || 0;

        const accountsQuery = 'SELECT COUNT(*) as count FROM accounts WHERE suspicion_index >= 70 ALLOW FILTERING';
        const accountsResult = await client.execute(accountsQuery);
        const suspiciousAccounts = accountsResult.rows[0].count.toNumber();

        res.json({
            totalChains,
            highRiskChains,
            totalValue,
            suspiciousAccounts
        });
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
};

module.exports = {
    getSummary
};