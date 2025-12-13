const mongoose = require('mongoose');
const client = require('./config/database');

// MongoDB connection
const MONGO_URL = 'mongodb://localhost:27017/vyaapti';

// Define Schemas based on Cassandra tables
const chainSchema = new mongoose.Schema({
    chain_id: String,
    accounts: [String],
    detected_at: Date,
    flags: Map,
    num_hops: Number,
    risk_score: Number,
    status: String,
    time_span: Number,
    total_value: Number
}, { collection: 'chains' });

const accountSchema = new mongoose.Schema({
    account_id: String,
    cluster_label: Number,
    created_at: Date,
    diversity_score: Number,
    frequency: Number,
    mean_amount: Number,
    suspicion_index: Number,
    updated_at: Date,
    velocity: Number
}, { collection: 'accounts' });

const accountChainSchema = new mongoose.Schema({
    account_id: String,
    chain_id: String,
    position: Number,
    role: String
}, { collection: 'account_chains' });

const auditLogSchema = new mongoose.Schema({
    log_id: String,
    details: String,
    entity_id: String,
    entity_type: String,
    event_type: String,
    timestamp: Date,
    user_id: String
}, { collection: 'audit_log' });

const clusteringResultsSchema = new mongoose.Schema({
    cluster_label: Number,
    avg_suspicion: Number,
    centroid: Map,
    description: String,
    size: Number
}, { collection: 'clustering_results' });

const transactionsProcessedSchema = new mongoose.Schema({
    txn_id: String,
    amount: Number,
    chain_id: String,
    features: Map,
    from_account: String,
    processed: Boolean,
    timestamp: Date,
    to_account: String
}, { collection: 'transactions_processed' });

const riskFeaturesSchema = new mongoose.Schema({}, { collection: 'risk_features', strict: false });

// Create Models
const Chain = mongoose.model('Chain', chainSchema);
const Account = mongoose.model('Account', accountSchema);
const AccountChain = mongoose.model('AccountChain', accountChainSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);
const ClusteringResults = mongoose.model('ClusteringResults', clusteringResultsSchema);
const TransactionsProcessed = mongoose.model('TransactionsProcessed', transactionsProcessedSchema);
const RiskFeatures = mongoose.model('RiskFeatures', riskFeaturesSchema);

async function syncTable(tableName, Model) {
    try {
        console.log(`📥 Fetching ${tableName} from Astra DB...`);
        const result = await client.execute(`SELECT * FROM ${tableName}`);
        
        const data = result.rows.map(row => {
            const obj = {};
            for (const [key, value] of Object.entries(row)) {
                // Convert UUIDs to strings
                if (value && typeof value === 'object' && value.constructor.name === 'Uuid') {
                    obj[key] = value.toString();
                } 
                // Convert Cassandra maps to plain objects
                else if (value && typeof value === 'object' && value.constructor.name === 'Map') {
                    obj[key] = Object.fromEntries(value);
                }
                else {
                    obj[key] = value;
                }
            }
            return obj;
        });
        
        await Model.deleteMany({});
        if (data.length > 0) {
            await Model.insertMany(data);
        }
        console.log(`✓ Stored ${data.length} records in ${tableName}`);
        return data.length;
    } catch (error) {
        console.error(`❌ Error syncing ${tableName}:`, error.message);
        return 0;
    }
}

async function syncData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URL);
        console.log('✓ Connected to MongoDB');
        
        // Connect to Astra DB
        await client.connect();
        console.log('✓ Connected to Astra DB');
        
        console.log('\n🔄 Starting sync...\n');
        
        // Sync all tables
        await syncTable('chains', Chain);
        await syncTable('accounts', Account);
        await syncTable('account_chains', AccountChain);
        await syncTable('audit_log', AuditLog);
        await syncTable('clustering_results', ClusteringResults);
        await syncTable('transactions_processed', TransactionsProcessed);
        await syncTable('risk_features', RiskFeatures);
        
        console.log('\n✅ All data synced successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        await client.shutdown();
        console.log('🔌 Disconnected from databases');
    }
}

syncData();