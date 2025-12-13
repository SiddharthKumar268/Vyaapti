-- ============================================
-- RTGS RISK-CHAIN ANALYZER - CASSANDRA SCHEMA
-- ============================================

-- Create Keyspace
CREATE KEYSPACE IF NOT EXISTS rtgs_risk
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 3
};

USE rtgs_risk;

-- ============================================
-- CHAINS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS chains (
    chain_id UUID PRIMARY KEY,
    accounts list<text>,
    total_value double,
    num_hops int,
    time_span double,
    risk_score double,
    flags map<text, boolean>,
    detected_at timestamp,
    status text
);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS chains_risk_score_idx ON chains (risk_score);
CREATE INDEX IF NOT EXISTS chains_status_idx ON chains (status);

-- ============================================
-- ACCOUNTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS accounts (
    account_id text PRIMARY KEY,
    cluster_label int,
    mean_amount double,
    frequency int,
    suspicion_index double,
    velocity double,
    diversity_score double,
    created_at timestamp,
    updated_at timestamp
);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS accounts_cluster_idx ON accounts (cluster_label);
CREATE INDEX IF NOT EXISTS accounts_suspicion_idx ON accounts (suspicion_index);

-- ============================================
-- ACCOUNT_CHAINS TABLE (Junction Table)
-- ============================================

CREATE TABLE IF NOT EXISTS account_chains (
    account_id text,
    chain_id UUID,
    role text,
    position int,
    PRIMARY KEY (account_id, chain_id)
);

-- Index for reverse lookup
CREATE INDEX IF NOT EXISTS account_chains_chain_idx ON account_chains (chain_id);

-- ============================================
-- TRANSACTIONS_PROCESSED TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS transactions_processed (
    txn_id UUID PRIMARY KEY,
    from_account text,
    to_account text,
    amount double,
    timestamp timestamp,
    processed boolean,
    chain_id UUID,
    features map<text, double>
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS txn_from_account_idx ON transactions_processed (from_account);
CREATE INDEX IF NOT EXISTS txn_to_account_idx ON transactions_processed (to_account);
CREATE INDEX IF NOT EXISTS txn_chain_idx ON transactions_processed (chain_id);

-- ============================================
-- RISK_FEATURES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS risk_features (
    account_id text PRIMARY KEY,
    total_sent double,
    total_received double,
    txn_count int,
    unique_counterparties int,
    avg_txn_amount double,
    max_txn_amount double,
    min_txn_amount double,
    std_dev_amount double,
    night_txn_ratio double,
    weekend_txn_ratio double,
    velocity_score double,
    round_amount_ratio double,
    updated_at timestamp
);

-- ============================================
-- CLUSTERING_RESULTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS clustering_results (
    cluster_label int PRIMARY KEY,
    size int,
    centroid map<text, double>,
    avg_suspicion double,
    description text
);

-- ============================================
-- AUDIT_LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
    log_id UUID PRIMARY KEY,
    event_type text,
    entity_id text,
    entity_type text,
    details text,
    user_id text,
    timestamp timestamp
);

CREATE INDEX IF NOT EXISTS audit_event_type_idx ON audit_log (event_type);
CREATE INDEX IF NOT EXISTS audit_timestamp_idx ON audit_log (timestamp);

-- ============================================
-- MATERIALIZED VIEWS
-- ============================================

-- High Risk Chains View
CREATE MATERIALIZED VIEW IF NOT EXISTS high_risk_chains AS
    SELECT chain_id, accounts, total_value, num_hops, risk_score, flags
    FROM chains
    WHERE risk_score >= 70 AND chain_id IS NOT NULL
    PRIMARY KEY (risk_score, chain_id)
    WITH CLUSTERING ORDER BY (chain_id ASC);

-- Suspicious Accounts View
CREATE MATERIALIZED VIEW IF NOT EXISTS suspicious_accounts AS
    SELECT account_id, cluster_label, suspicion_index, mean_amount, frequency
    FROM accounts
    WHERE suspicion_index >= 60 AND account_id IS NOT NULL
    PRIMARY KEY (suspicion_index, account_id)
    WITH CLUSTERING ORDER BY (account_id ASC);

-- ============================================
-- SAMPLE DATA INSERTION
-- ============================================

-- Insert sample chains
INSERT INTO chains (chain_id, accounts, total_value, num_hops, time_span, risk_score, flags, detected_at, status)
VALUES (uuid(), ['ACC001', 'ACC002', 'ACC003', 'ACC004'], 50000000, 3, 2.5, 85.5, {'circular': true, 'rapid': true}, toTimestamp(now()), 'active');

INSERT INTO chains (chain_id, accounts, total_value, num_hops, time_span, risk_score, flags, detected_at, status)
VALUES (uuid(), ['ACC005', 'ACC006', 'ACC007'], 25000000, 2, 1.2, 72.3, {'layering': true}, toTimestamp(now()), 'active');

INSERT INTO chains (chain_id, accounts, total_value, num_hops, time_span, risk_score, flags, detected_at, status)
VALUES (uuid(), ['ACC008', 'ACC009', 'ACC010', 'ACC011', 'ACC012'], 75000000, 4, 5.0, 91.2, {'circular': true, 'structuring': true}, toTimestamp(now()), 'active');

-- Insert sample accounts
INSERT INTO accounts (account_id, cluster_label, mean_amount, frequency, suspicion_index, velocity, diversity_score, created_at, updated_at)
VALUES ('ACC001', 1, 5000000, 45, 82.5, 0.75, 0.65, toTimestamp(now()), toTimestamp(now()));

INSERT INTO accounts (account_id, cluster_label, mean_amount, frequency, suspicion_index, velocity, diversity_score, created_at, updated_at)
VALUES ('ACC002', 2, 3500000, 38, 75.8, 0.68, 0.58, toTimestamp(now()), toTimestamp(now()));

INSERT INTO accounts (account_id, cluster_label, mean_amount, frequency, suspicion_index, velocity, diversity_score, created_at, updated_at)
VALUES ('ACC003', 1, 4200000, 52, 88.2, 0.82, 0.72, toTimestamp(now()), toTimestamp(now()));

INSERT INTO accounts (account_id, cluster_label, mean_amount, frequency, suspicion_index, velocity, diversity_score, created_at, updated_at)
VALUES ('ACC004', 3, 2800000, 31, 65.3, 0.55, 0.48, toTimestamp(now()), toTimestamp(now()));

INSERT INTO accounts (account_id, cluster_label, mean_amount, frequency, suspicion_index, velocity, diversity_score, created_at, updated_at)
VALUES ('ACC005', 2, 6000000, 62, 92.1, 0.88, 0.78, toTimestamp(now()), toTimestamp(now()));

-- Link accounts to chains
INSERT INTO account_chains (account_id, chain_id, role, position) 
VALUES ('ACC001', (SELECT chain_id FROM chains WHERE accounts CONTAINS 'ACC001' LIMIT 1), 'originator', 0);

-- ============================================
-- USEFUL QUERIES
-- ============================================

-- Get all high-risk chains
-- SELECT * FROM high_risk_chains;

-- Get all suspicious accounts
-- SELECT * FROM suspicious_accounts;

-- Find chains for a specific account
-- SELECT * FROM account_chains WHERE account_id = 'ACC001';

-- Get recent audit events
-- SELECT * FROM audit_log WHERE timestamp > '2025-01-01' ALLOW FILTERING;