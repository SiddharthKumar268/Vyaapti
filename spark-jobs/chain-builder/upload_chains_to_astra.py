import os
import uuid
import pandas as pd
from datetime import datetime
from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
from dotenv import load_dotenv

# ================================
# BASE DIRECTORY (Vyaapti root)
# ================================
BASE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)

# ================================
# LOAD ENV
# ================================
ENV_PATH = os.path.join(BASE_DIR, "backend", ".env")
load_dotenv(ENV_PATH)

ASTRA_CLIENT_ID = os.getenv("ASTRA_CLIENT_ID")
ASTRA_CLIENT_SECRET = os.getenv("ASTRA_CLIENT_SECRET")
ASTRA_KEYSPACE = os.getenv("ASTRA_KEYSPACE")

if not ASTRA_CLIENT_ID or not ASTRA_CLIENT_SECRET:
    raise RuntimeError("Astra credentials not loaded from .env")

# ================================
# PATHS
# ================================
SECURE_BUNDLE = os.path.join(
    BASE_DIR,
    "backend",
    "secure-connect-vyaapti.zip"
)

CSV_PATH = os.path.join(
    BASE_DIR,
    "data",
    "chains_detected.csv"
)

print("[DEBUG] BASE_DIR =", BASE_DIR)
print("[DEBUG] SECURE_BUNDLE =", SECURE_BUNDLE)
print("[DEBUG] CSV_PATH =", CSV_PATH)

if not os.path.exists(SECURE_BUNDLE):
    raise FileNotFoundError(f"Secure bundle not found at: {SECURE_BUNDLE}")

if not os.path.exists(CSV_PATH):
    raise FileNotFoundError(f"chains_detected.csv not found at: {CSV_PATH}")

# ================================
# CONNECT TO ASTRA
# ================================
print("[STEP 1] Connecting to Astra DB...")

auth_provider = PlainTextAuthProvider(
    ASTRA_CLIENT_ID,
    ASTRA_CLIENT_SECRET
)

cluster = Cluster(
    cloud={"secure_connect_bundle": SECURE_BUNDLE},
    auth_provider=auth_provider
)

session = cluster.connect(ASTRA_KEYSPACE)
print("[OK] Connected to Astra")

# ================================
# LOAD CSV
# ================================
print("[STEP 2] Loading chains_detected.csv...")
df = pd.read_csv(CSV_PATH)
print(f"[OK] Loaded {len(df)} chains")

print("[DEBUG] CSV columns:", list(df.columns))
print("[DEBUG] First row accounts value:", df.iloc[0]["accounts"])

# ================================
# HELPER FUNCTION TO PARSE ACCOUNTS
# ================================
def parse_accounts(accounts_str):
    """
    Parse accounts from various formats:
    - "ACC000105 -> ACC000051 -> ACC000145"
    - "['ACC000105', 'ACC000051', 'ACC000145']"
    - Already a list
    """
    if isinstance(accounts_str, list):
        return accounts_str
    
    if not isinstance(accounts_str, str):
        return []
    
    # Try literal_eval first (for Python list strings)
    try:
        from ast import literal_eval
        result = literal_eval(accounts_str)
        if isinstance(result, list):
            return result
    except (ValueError, SyntaxError):
        pass
    
    # Parse arrow-separated format: "ACC1 -> ACC2 -> ACC3"
    if "->" in accounts_str:
        accounts = [acc.strip() for acc in accounts_str.split("->")]
        return accounts
    
    # Parse comma-separated format: "ACC1, ACC2, ACC3"
    if "," in accounts_str:
        accounts = [acc.strip() for acc in accounts_str.split(",")]
        return accounts
    
    # Single account
    return [accounts_str.strip()]

# ================================
# PREPARE INSERT
# ================================
insert_stmt = session.prepare("""
INSERT INTO chains (
    chain_id,
    accounts,
    detected_at,
    flags,
    num_hops,
    risk_score,
    status,
    time_span,
    total_value
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
""")

# ================================
# INSERT DATA
# ================================
print("[STEP 3] Uploading to Astra...")

count = 0
errors = 0

for idx, row in df.iterrows():
    try:
        # ---- Parse accounts
        accounts = parse_accounts(row["accounts"])
        
        if not accounts:
            print(f"[WARNING] Row {idx}: No accounts found, skipping")
            errors += 1
            continue
        
        # ---- num_hops (robust)
        if "num_hops" in row and pd.notna(row["num_hops"]):
            num_hops = int(row["num_hops"])
        elif "hops" in row and pd.notna(row["hops"]):
            num_hops = int(row["hops"])
        elif "chain_length" in row and pd.notna(row["chain_length"]):
            num_hops = int(row["chain_length"])
        else:
            num_hops = len(accounts) - 1
        
        # ---- risk_score (with default)
        if "risk_score" in row and pd.notna(row["risk_score"]):
            risk_score = float(row["risk_score"])
        else:
            risk_score = 0.0
        
        # ---- time_span (handle different column names)
        if "time_span" in row and pd.notna(row["time_span"]):
            time_span = float(row["time_span"])
        elif "time_span_hours" in row and pd.notna(row["time_span_hours"]):
            time_span = float(row["time_span_hours"])
        else:
            time_span = 0.0
        
        # ---- total_value
        if "total_value" in row and pd.notna(row["total_value"]):
            total_value = float(row["total_value"])
        else:
            total_value = 0.0
        
        # ---- Insert into Astra
        session.execute(
            insert_stmt,
            (
                uuid.uuid4(),
                accounts,
                datetime.utcnow(),
                {},                      # flags (empty dict)
                num_hops,
                risk_score,
                "active",
                time_span,
                total_value,
            )
        )
        
        count += 1
        if count % 500 == 0:
            print(f"  Inserted {count} chains")
    
    except Exception as e:
        errors += 1
        print(f"[ERROR] Row {idx}: {e}")
        if errors > 10:
            print("[ERROR] Too many errors, stopping")
            break

print(f"[DONE] Uploaded {count} chains successfully")
if errors > 0:
    print(f"[WARNING] {errors} rows failed")

# ================================
# CLEANUP
# ================================
cluster.shutdown()
print("[COMPLETE] Astra connection closed")