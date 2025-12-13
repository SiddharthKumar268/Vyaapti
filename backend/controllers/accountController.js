const client = require('../config/database');

// Get account by ID
const getAccountById = async (req, res) => {
    try {
        const accountId = req.params.accountId;
        console.log(`🔍 Looking for account: ${accountId}`);
        
        const query = 'SELECT * FROM accounts WHERE account_id = ?';
        const result = await client.execute(query, [accountId]);

        if (result.rows.length === 0) {
            console.log(`❌ Account ${accountId} not found`);
            
            // Get all available accounts to show user
            const allAccountsQuery = 'SELECT account_id FROM accounts LIMIT 20';
            const allAccounts = await client.execute(allAccountsQuery);
            const availableAccounts = allAccounts.rows.map(r => r.account_id);
            
            console.log(`📋 Available accounts: ${availableAccounts.join(', ')}`);
            
            return res.status(404).json({ 
                error: 'Account not found',
                requested: accountId,
                available_accounts: availableAccounts,
                message: `Account "${accountId}" does not exist in database`,
                suggestion: availableAccounts.length > 0 
                    ? `Try one of these: ${availableAccounts.slice(0, 5).join(', ')}` 
                    : 'No accounts found in database. Please insert sample data.'
            });
        }

        const account = result.rows[0];
        console.log(`✓ Found account: ${account.account_id}`);
        
        res.json({
            account_id: account.account_id,
            cluster_label: account.cluster_label,
            mean_amount: account.mean_amount,
            frequency: account.frequency,
            suspicion_index: account.suspicion_index
        });
    } catch (error) {
        console.error('❌ Error fetching account:', error);
        res.status(500).json({ 
            error: 'Failed to fetch account details',
            message: error.message 
        });
    }
};

// Get chains for an account
const getAccountChains = async (req, res) => {
    try {
        const accountId = req.params.accountId;
        
        const chainIdsQuery = 'SELECT chain_id FROM account_chains WHERE account_id = ?';
        const chainIdsResult = await client.execute(chainIdsQuery, [accountId]);
        
        if (chainIdsResult.rows.length === 0) {
            return res.json([]);
        }

        const chainIds = chainIdsResult.rows.map(row => row.chain_id);
        const chains = [];

        for (const chainId of chainIds) {
            const chainQuery = 'SELECT * FROM chains WHERE chain_id = ?';
            const chainResult = await client.execute(chainQuery, [chainId]);
            
            if (chainResult.rows.length > 0) {
                const chain = chainResult.rows[0];
                chains.push({
                    chain_id: chain.chain_id.toString(),
                    total_value: chain.total_value,
                    num_hops: chain.num_hops,
                    risk_score: chain.risk_score,
                    role: 'Participant'
                });
            }
        }

        res.json(chains);
    } catch (error) {
        console.error('Error fetching account chains:', error);
        res.status(500).json({ error: 'Failed to fetch account chains' });
    }
};

// Get top suspicious accounts
const getTopAccounts = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const query = 'SELECT * FROM accounts';
        const result = await client.execute(query);

        const accounts = result.rows
            .map(row => ({
                account_id: row.account_id,
                cluster_label: row.cluster_label,
                mean_amount: row.mean_amount,
                frequency: row.frequency,
                suspicion_index: row.suspicion_index,
                risk_score: row.suspicion_index
            }))
            .sort((a, b) => b.suspicion_index - a.suspicion_index)
            .slice(0, limit);

        for (const account of accounts) {
            const chainCountQuery = 'SELECT COUNT(*) as count FROM account_chains WHERE account_id = ?';
            const countResult = await client.execute(chainCountQuery, [account.account_id]);
            account.chain_count = countResult.rows[0].count.toNumber();
        }

        res.json(accounts);
    } catch (error) {
        console.error('Error fetching top accounts:', error);
        res.status(500).json({ error: 'Failed to fetch top accounts' });
    }
};

module.exports = {
    getAccountById,
    getAccountChains,
    getTopAccounts
};