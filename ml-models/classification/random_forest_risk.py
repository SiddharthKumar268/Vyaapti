"""
Random Forest Classifier for Risk Prediction
Predicts risk level based on account features
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
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

def fetch_training_data(session):
    """Fetch account features and labels from database"""
    log("Fetching training data from database...", "PROCESS")
    
    query = """
        SELECT account_id, mean_amount, frequency, velocity, 
               diversity_score, suspicion_index, cluster_label
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
            'suspicion_index': float(row.suspicion_index),
            'cluster_label': int(row.cluster_label)
        })
    
    df = pd.DataFrame(data)
    log(f"Loaded {len(df)} accounts from database", "SUCCESS")
    return df

def create_risk_labels(df):
    """Create risk level labels based on suspicion index"""
    log("Creating risk level labels...", "PROCESS")
    
    def get_risk_level(suspicion):
        if suspicion >= 80:
            return 3  # Critical
        elif suspicion >= 60:
            return 2  # High
        elif suspicion >= 40:
            return 1  # Medium
        else:
            return 0  # Low
    
    df['risk_level'] = df['suspicion_index'].apply(get_risk_level)
    
    # Log distribution
    risk_dist = df['risk_level'].value_counts().sort_index()
    risk_names = {0: "Low", 1: "Medium", 2: "High", 3: "Critical"}
    
    log("Risk level distribution:", "INFO")
    for level, count in risk_dist.items():
        log(f"  {risk_names[level]} Risk (Level {level}): {count} accounts", "INFO")
    
    return df

def train_random_forest(df):
    """Train Random Forest classifier"""
    log("=" * 60, "INFO")
    log("Starting Random Forest training...", "PROCESS")
    log("=" * 60, "INFO")
    
    # Select features
    feature_cols = ['mean_amount', 'frequency', 'velocity', 'diversity_score', 'cluster_label']
    X = df[feature_cols].values
    y = df['risk_level'].values
    
    log(f"Training with {len(feature_cols)} features:", "INFO")
    for i, feat in enumerate(feature_cols, 1):
        log(f"  {i}. {feat}", "INFO")
    
    # Split data
    log("Splitting data (80% train, 20% test)...", "PROCESS")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    log(f"Training set: {len(X_train)} samples", "INFO")
    log(f"Testing set: {len(X_test)} samples", "INFO")
    
    # Standardize features
    log("Standardizing features...", "PROCESS")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train Random Forest
    log("Training Random Forest classifier (100 trees)...", "PROCESS")
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        n_jobs=-1,
        verbose=0
    )
    
    rf.fit(X_train_scaled, y_train)
    
    # Evaluate
    train_score = rf.score(X_train_scaled, y_train)
    test_score = rf.score(X_test_scaled, y_test)
    
    log("=" * 60, "INFO")
    log("MODEL PERFORMANCE", "INFO")
    log("=" * 60, "INFO")
    log(f"Training Accuracy: {train_score:.2%}", "SUCCESS")
    log(f"Testing Accuracy: {test_score:.2%}", "SUCCESS")
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': rf.feature_importances_
    }).sort_values('importance', ascending=False)
    
    log("=" * 60, "INFO")
    log("FEATURE IMPORTANCE", "INFO")
    log("=" * 60, "INFO")
    for _, row in feature_importance.iterrows():
        log(f"  {row['feature']}: {row['importance']:.4f} ({row['importance']*100:.2f}%)", "INFO")
    
    # Predictions
    y_pred = rf.predict(X_test_scaled)
    
    # Classification report
     # Classification report
    risk_names = ['Low', 'Medium', 'High', 'Critical']
    # Get unique classes in test data
    unique_classes = sorted(np.unique(y_test))
    class_names = [risk_names[i] for i in unique_classes]
    report = classification_report(y_test, y_pred, labels=unique_classes, target_names=class_names, output_dict=True, zero_division=0)
    
    log("=" * 60, "INFO")
    log("CLASSIFICATION REPORT", "INFO")
    log("=" * 60, "INFO")
    
    for risk_name in risk_names:
        if risk_name in report:
            r = report[risk_name]
            log(f"{risk_name} Risk:", "INFO")
            log(f"  Precision: {r['precision']:.2%}", "INFO")
            log(f"  Recall: {r['recall']:.2%}", "INFO")
            log(f"  F1-Score: {r['f1-score']:.2%}", "INFO")
    
    log("=" * 60, "INFO")
    
    return rf, scaler, feature_cols

def save_models(rf, scaler, feature_cols):
    """Save trained models"""
    log("Saving trained models...", "PROCESS")
    
    models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    os.makedirs(models_dir, exist_ok=True)
    
    rf_path = os.path.join(models_dir, 'rf_classifier.pkl')
    scaler_path = os.path.join(models_dir, 'rf_scaler.pkl')
    features_path = os.path.join(models_dir, 'rf_features.pkl')
    
    joblib.dump(rf, rf_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(feature_cols, features_path)
    
    log(f"Models saved to: {os.path.abspath(models_dir)}", "SUCCESS")
    log(f"  - rf_classifier.pkl", "INFO")
    log(f"  - rf_scaler.pkl", "INFO")
    log(f"  - rf_features.pkl", "INFO")

def main():
    try:
        log("=" * 60, "INFO")
        log("RTGS RISK-CHAIN ANALYZER - RANDOM FOREST TRAINING", "INFO")
        log("=" * 60, "INFO")
        
        # Connect to database
        session = connect_to_astra()
        
        # Fetch data
        df = fetch_training_data(session)
        
        if len(df) == 0:
            log("No accounts found in database. Please run data generation first.", "ERROR")
            sys.exit(1)
        
        # Check if clustering has been done
        if df['cluster_label'].isnull().any():
            log("Some accounts don't have cluster labels. Run K-Means clustering first!", "WARNING")
        
        # Create risk labels
        df = create_risk_labels(df)
        
        # Train model
        rf, scaler, feature_cols = train_random_forest(df)
        
        # Save models
        save_models(rf, scaler, feature_cols)
        
        log("=" * 60, "INFO")
        log("RANDOM FOREST TRAINING COMPLETED SUCCESSFULLY!", "SUCCESS")
        log("=" * 60, "INFO")
        log("Model is ready for risk predictions!", "INFO")
        log("=" * 60, "INFO")
        
        session.shutdown()
        
    except Exception as e:
        log(f"FATAL ERROR: {str(e)}", "ERROR")
        import traceback
        log(traceback.format_exc(), "ERROR")
        sys.exit(1)

if __name__ == "__main__":
    main()