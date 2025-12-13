"""
K-Means Clustering for RTGS Risk Analysis
Clusters accounts based on transaction patterns
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
import joblib
from dotenv import load_dotenv
from datetime import datetime

# Force UTF-8 encoding for Windows
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

def log(message, level="INFO"):
    """Enhanced logging with timestamps"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    icons = {
        "INFO": "[INFO]",
        "SUCCESS": "[OK]",
        "ERROR": "[ERROR]",
        "WARNING": "[WARN]",
        "PROCESS": "[PROC]"
    }
    icon = icons.get(level, "[LOG]")
    print(f"[{timestamp}] {icon} {message}", flush=True)
    sys.stdout.flush()

# Load environment variables from root directory
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(env_path)

# Database connection
def connect_to_astra():
    """Connect to DataStax Astra DB"""
    log("Connecting to DataStax Astra DB...", "PROCESS")
    
    bundle_path = os.getenv('ASTRA_DB_SECURE_BUNDLE_PATH')
    client_id = os.getenv('ASTRA_DB_CLIENT_ID')
    client_secret = os.getenv('ASTRA_DB_CLIENT_SECRET')
    
    # Validate environment variables
    if not bundle_path:
        raise ValueError("ASTRA_DB_SECURE_BUNDLE_PATH not found in environment variables")
    if not client_id:
        raise ValueError("ASTRA_DB_CLIENT_ID not found in environment variables")
    if not client_secret:
        raise ValueError("ASTRA_DB_CLIENT_SECRET not found in environment variables")
    
    # If relative path, look in backend directory
    if not os.path.isabs(bundle_path):
        bundle_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend', bundle_path)
    
    if not os.path.exists(bundle_path):
        raise FileNotFoundError(f"Secure bundle not found at: {bundle_path}")
    
    log(f"Using bundle: {bundle_path}", "INFO")
    
    cloud_config = {
        'secure_connect_bundle': bundle_path
    }
    
    auth_provider = PlainTextAuthProvider(client_id, client_secret)
    
    cluster = Cluster(cloud=cloud_config, auth_provider=auth_provider)
    session = cluster.connect()
    
    # Set keyspace
    keyspace = os.getenv('ASTRA_DB_KEYSPACE', 'vyaapti')
    session.set_keyspace(keyspace)
    
    log(f"Connected to keyspace: {keyspace}", "SUCCESS")
    return session

def fetch_account_data(session):
    """Fetch account features from database"""
    log("Fetching account data from database...", "PROCESS")
    
    query = """
        SELECT account_id, mean_amount, frequency, velocity, 
               diversity_score, suspicion_index
        FROM accounts
    """
    
    rows = session.execute(query)
    
    data = []
    for row in rows:
        data.append({
            'account_id': row.account_id,
            'mean_amount': float(row.mean_amount),
            'frequency': int(row.frequency),
            'velocity': float(row.velocity),
            'diversity_score': float(row.diversity_score),
            'suspicion_index': float(row.suspicion_index)
        })
    
    df = pd.DataFrame(data)
    log(f"Loaded {len(df)} accounts from database", "SUCCESS")
    return df

def perform_clustering(df, n_clusters=4):
    """Perform K-Means clustering"""
    log(f"Starting K-Means clustering with k={n_clusters}...", "PROCESS")
    
    # Select features for clustering
    features = ['mean_amount', 'frequency', 'velocity', 'diversity_score', 'suspicion_index']
    X = df[features].values
    
    log(f"Using {len(features)} features: {', '.join(features)}", "INFO")
    
    # Standardize features
    log("Standardizing features...", "PROCESS")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Perform K-Means clustering
    log("Running K-Means algorithm...", "PROCESS")
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10, max_iter=300)
    cluster_labels = kmeans.fit_predict(X_scaled)
    
    # Add cluster labels to dataframe
    df['cluster_label'] = cluster_labels
    
    log(f"K-Means clustering completed with inertia: {kmeans.inertia_:.2f}", "SUCCESS")
    
    # Log cluster distribution
    cluster_counts = df['cluster_label'].value_counts().sort_index()
    log("Cluster distribution:", "INFO")
    for cluster_id, count in cluster_counts.items():
        log(f"  Cluster {cluster_id}: {count} accounts", "INFO")
    
    return df, kmeans, scaler

def update_database(session, df):
    """Update cluster labels in database"""
    log("Updating cluster labels in database...", "PROCESS")
    
    update_query = """
        UPDATE accounts 
        SET cluster_label = ?
        WHERE account_id = ?
    """
    
    prepared = session.prepare(update_query)
    
    updated_count = 0
    for _, row in df.iterrows():
        session.execute(prepared, (int(row['cluster_label']), row['account_id']))
        updated_count += 1
        
        if updated_count % 100 == 0:
            log(f"Updated {updated_count}/{len(df)} accounts...", "INFO")
    
    log(f"Successfully updated {len(df)} accounts with cluster labels", "SUCCESS")

def save_models(kmeans, scaler):
    """Save trained models"""
    log("Saving trained models...", "PROCESS")
    
    models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    os.makedirs(models_dir, exist_ok=True)
    
    kmeans_path = os.path.join(models_dir, 'kmeans_model.pkl')
    scaler_path = os.path.join(models_dir, 'scaler.pkl')
    
    joblib.dump(kmeans, kmeans_path)
    joblib.dump(scaler, scaler_path)
    
    log(f"Models saved to: {os.path.abspath(models_dir)}", "SUCCESS")
    log(f"  - kmeans_model.pkl", "INFO")
    log(f"  - scaler.pkl", "INFO")

def print_cluster_statistics(df):
    """Print detailed cluster statistics"""
    log("=" * 60, "INFO")
    log("CLUSTER ANALYSIS RESULTS", "INFO")
    log("=" * 60, "INFO")
    
    cluster_stats = df.groupby('cluster_label').agg({
        'account_id': 'count',
        'suspicion_index': ['mean', 'min', 'max'],
        'mean_amount': 'mean',
        'frequency': 'mean',
        'velocity': 'mean'
    }).round(2)
    
    for cluster_id in sorted(df['cluster_label'].unique()):
        cluster_data = df[df['cluster_label'] == cluster_id]
        avg_suspicion = cluster_data['suspicion_index'].mean()
        
        # Determine risk category
        if avg_suspicion >= 80:
            risk_category = "CRITICAL RISK"
        elif avg_suspicion >= 60:
            risk_category = "HIGH RISK"
        elif avg_suspicion >= 40:
            risk_category = "MEDIUM RISK"
        else:
            risk_category = "LOW RISK"
        
        log(f"\nCluster {cluster_id} - {risk_category}", "INFO")
        log(f"  Accounts: {len(cluster_data)}", "INFO")
        log(f"  Avg Suspicion: {avg_suspicion:.2f}%", "INFO")
        log(f"  Avg Amount: ₹{cluster_data['mean_amount'].mean()/100000:.2f}L", "INFO")
        log(f"  Avg Frequency: {cluster_data['frequency'].mean():.1f}", "INFO")
    
    log("=" * 60, "INFO")

def main():
    try:
        log("=" * 60, "INFO")
        log("RTGS RISK-CHAIN ANALYZER - K-MEANS CLUSTERING", "INFO")
        log("=" * 60, "INFO")
        
        # Connect to database
        session = connect_to_astra()
        
        # Fetch data
        df = fetch_account_data(session)
        
        if len(df) == 0:
            log("No accounts found in database. Please run data generation first.", "ERROR")
            sys.exit(1)
        
        # Perform clustering
        df, kmeans, scaler = perform_clustering(df, n_clusters=4)
        
        # Update database
        update_database(session, df)
        
        # Save models
        save_models(kmeans, scaler)
        
        # Print statistics
        print_cluster_statistics(df)
        
        log("=" * 60, "INFO")
        log("K-MEANS CLUSTERING COMPLETED SUCCESSFULLY!", "SUCCESS")
        log("=" * 60, "INFO")
        
        session.shutdown()
        
    except Exception as e:
        log(f"FATAL ERROR: {str(e)}", "ERROR")
        import traceback
        log(traceback.format_exc(), "ERROR")
        sys.exit(1)

if __name__ == "__main__":
    main()