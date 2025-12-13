const client = require('../config/database');

// Get chart data
const getChartData = async (req, res) => {
    try {
        const chainsQuery = 'SELECT risk_score FROM chains';
        const chainsResult = await client.execute(chainsQuery);
        
        const riskDistribution = [0, 0, 0, 0];
        chainsResult.rows.forEach(row => {
            const score = row.risk_score;
            if (score < 40) riskDistribution[0]++;
            else if (score < 60) riskDistribution[1]++;
            else if (score < 80) riskDistribution[2]++;
            else riskDistribution[3]++;
        });

        const volumeTrends = [];
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        for (let i = 0; i < 7; i++) {
            volumeTrends.push({
                date: days[i],
                volume: Math.floor(Math.random() * 500) + 300
            });
        }

        res.json({
            riskDistribution,
            volumeTrends
        });
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
};

module.exports = {
    getChartData
};