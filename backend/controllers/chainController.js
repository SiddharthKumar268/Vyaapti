const client = require('../config/database');
const cassandra = require('cassandra-driver');

// Get all chains
const getAllChains = async (req, res) => {
    try {
        const query = 'SELECT * FROM chains';
        const result = await client.execute(query);
        
        const chains = result.rows.map(row => ({
            chain_id: row.chain_id.toString(),
            accounts: row.accounts,
            total_value: row.total_value,
            num_hops: row.num_hops,
            time_span: row.time_span,
            risk_score: row.risk_score,
            flags: row.flags
        }));

        res.json(chains);
    } catch (error) {
        console.error('Error fetching chains:', error);
        res.status(500).json({ error: 'Failed to fetch chains' });
    }
};

// Get chain by ID
const getChainById = async (req, res) => {
    try {
        const chainId = req.params.id;
        const query = 'SELECT * FROM chains WHERE chain_id = ?';
        const result = await client.execute(query, [cassandra.types.Uuid.fromString(chainId)]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Chain not found' });
        }

        const chain = result.rows[0];
        
        const nodes = chain.accounts.map((account, index) => ({
            id: account,
            label: `A-${index + 1}`,
            amount: chain.total_value / chain.accounts.length,
            suspicious: chain.risk_score > 70 && index > 0 && index < chain.accounts.length - 1
        }));

        const edges = [];
        for (let i = 0; i < chain.accounts.length - 1; i++) {
            edges.push({
                from: chain.accounts[i],
                to: chain.accounts[i + 1],
                amount: chain.total_value / (chain.accounts.length - 1)
            });
        }

        res.json({
            chain_id: chain.chain_id.toString(),
            accounts: chain.accounts,
            total_value: chain.total_value,
            num_hops: chain.num_hops,
            time_span: chain.time_span,
            risk_score: chain.risk_score,
            flags: chain.flags,
            nodes,
            edges
        });
    } catch (error) {
        console.error('Error fetching chain:', error);
        res.status(500).json({ error: 'Failed to fetch chain details' });
    }
};

module.exports = {
    getAllChains,
    getChainById
};