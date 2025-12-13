-- cassandra/schema-astra.cql

-- ============================================
-- RTGS RISK-CHAIN ANALYZER - ASTRA DB SCHEMA
-- DataStax Astra DB (Mumbai, India)
-- Database: vyaapti
-- Region: asia-south1
-- ============================================

-- IMPORTANT: Create keyspace through Astra Dashboard first
-- Dashboard → Database → CQL Console → Run below command:
-- CREATE KEYSPACE IF NOT EXISTS rtgs_risk WITH replication = {'class': 'NetworkTopologyStrategy', 'asia-south1': 3};

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

INSERT INTO chains (chain_id, accounts, total_value, num_hops, time_span, risk_score, flags, detected_at, status)
VALUES (uuid(), ['ACC013', 'ACC014', 'ACC015'], 35000000, 2, 3.0, 68.5, {'rapid': true}, toTimestamp(now()), 'active');

INSERT INTO chains (chain_id, accounts, total_value, num_hops, time_span, risk_score, flags, detected_at, status)
VALUES (uuid(), ['ACC016', 'ACC017', 'ACC018', 'ACC019'], 45000000, 3, 4.5, 78.9, {'layering': true, 'rapid': true}, toTimestamp(now()), 'active');

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

INSERT INTO accounts (account_id, cluster_label, mean_amount, frequency, suspicion_index, velocity, diversity_score, created_at, updated_at)
VALUES ('ACC006', 1, 4500000, 48, 79.6, 0.71, 0.68, toTimestamp(now()), toTimestamp(now()));

INSERT INTO accounts (account_id, cluster_label, mean_amount, frequency, suspicion_index, velocity, diversity_score, created_at, updated_at)
VALUES ('ACC007', 3, 3200000, 35, 71.4, 0.63, 0.55, toTimestamp(now()), toTimestamp(now()));

INSERT INTO accounts (account_id, cluster_label, mean_amount, frequency, suspicion_index, velocity, diversity_score, created_at, updated_at)
VALUES ('ACC008', 2, 5500000, 55, 86.7, 0.79, 0.74, toTimestamp(now()), toTimestamp(now()));

INSERT INTO accounts (account_id, cluster_label, mean_amount, frequency, suspicion_index, velocity, diversity_score, created_at, updated_at)
VALUES ('ACC009', 1, 3800000, 42, 73.2, 0.66, 0.61, toTimestamp(now()), toTimestamp(now()));

INSERT INTO accounts (account_id, cluster_label, mean_amount, frequency, suspicion_index, velocity, diversity_score, created_at, updated_at)
VALUES ('ACC010', 2, 4700000, 50, 81.9, 0.76, 0.70, toTimestamp(now()), toTimestamp(now()));

-- Link accounts to chains (sample data)
INSERT INTO account_chains (account_id, chain_id, role, position) 
SELECT 'ACC001', chain_id, 'originator', 0 FROM chains WHERE accounts CONTAINS 'ACC001' LIMIT 1;

INSERT INTO account_chains (account_id, chain_id, role, position) 
SELECT 'ACC002', chain_id, 'intermediary', 1 FROM chains WHERE accounts CONTAINS 'ACC002' LIMIT 1;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check chains count
-- SELECT COUNT(*) as total_chains FROM chains;

-- Check high-risk chains
-- SELECT chain_id, risk_score, num_hops, total_value FROM chains WHERE risk_score >= 80 ALLOW FILTERING;

-- Check accounts count
-- SELECT COUNT(*) as total_accounts FROM accounts;

-- Check suspicious accounts
-- SELECT account_id, suspicion_index, cluster_label FROM accounts WHERE suspicion_index >= 70 ALLOW FILTERING;

-- ============================================
-- NOTES FOR ASTRA DB
-- ============================================

-- 1. Secondary indexes are limited in Astra free tier
-- 2. Materialized views are not available in free tier
-- 3. Use ALLOW FILTERING for ad-hoc queries (not recommended in production)
-- 4. For production, design queries around partition keys
-- 5. Astra handles replication automatically based on region