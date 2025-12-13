"""
RTGS Chain Detector
Uses Spark + NetworkX for graph-based chain detection
Optimized for dense graphs and laptop execution
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import col
from pyspark.sql.types import *
from datetime import datetime
import networkx as nx
import uuid
import os
import builtins

# ==========================================================
# CONFIGURATION
# ==========================================================

ASTRA_CLIENT_ID = "YOUR_ASTRA_CLIENT_ID"
ASTRA_CLIENT_SECRET = "YOUR_ASTRA_CLIENT_SECRET"
ASTRA_SECURE_BUNDLE = "../../backend/secure-connect-vyaapti.zip"
KEYSPACE = "vyaapti"

MIN_HOPS = 2
MAX_HOPS = 4
MAX_PATHS_PER_SOURCE = 20
HIGH_DEGREE_NODE_LIMIT = 50
RISK_THRESHOLD = 60

# ==========================================================
# SPARK SESSION
# ==========================================================

print("=" * 70)
print("RTGS CHAIN DETECTOR - BIG DATA ANALYTICS")
print("Technology: Spark + NetworkX + Cassandra (Astra DB)")
print("=" * 70)

spark = SparkSession.builder \
    .appName("RTGS-ChainDetector") \
    .config("spark.jars.packages",
            "com.datastax.spark:spark-cassandra-connector_2.12:3.2.0") \
    .config("spark.cassandra.connection.config.cloud.path",
            ASTRA_SECURE_BUNDLE) \
    .config("spark.cassandra.auth.username", ASTRA_CLIENT_ID) \
    .config("spark.cassandra.auth.password", ASTRA_CLIENT_SECRET) \
    .getOrCreate()

spark.sparkContext.setLogLevel("ERROR")

print("\n[STEP 1/8] Spark Session Initialized")
print(f"  Spark Version: {spark.version}")
print(f"  NetworkX Version: {nx.__version__}")

# ==========================================================
# LOAD TRANSACTIONS
# ==========================================================

print("\n[STEP 2/8] Loading Transactions...")

try:
    transactions_df = spark.read \
        .format("org.apache.spark.sql.cassandra") \
        .options(table="transactions_processed",
                 keyspace=KEYSPACE) \
        .load()

    txn_count = transactions_df.count()
    print(f"  [OK] Loaded {txn_count:,} transactions from Astra")

except Exception:
    print("  [WARNING] Astra read failed — using CSV fallback")
    transactions_df = spark.read.csv(
        "transactions_generated.csv",
        header=True,
        inferSchema=True
    )
    txn_count = transactions_df.count()
    print(f"  [OK] Loaded {txn_count:,} transactions from CSV")

# ==========================================================
# BUILD TRANSACTION GRAPH
# ==========================================================

print("\n[STEP 3/8] Building Transaction Graph...")

edges = transactions_df.select(
    col("from_account").alias("source"),
    col("to_account").alias("target"),
    col("amount"),
    col("timestamp"),
    col("txn_id")
).collect()

G = nx.DiGraph()

for e in edges:
    G.add_edge(
        e.source,
        e.target,
        amount=float(e.amount),
        timestamp=e.timestamp,
        txn_id=str(e.txn_id)
    )

print(f"  Graph Nodes: {G.number_of_nodes()}")
print(f"  Graph Edges: {G.number_of_edges()}")

# ==========================================================
# DETECT CHAINS (BOUNDED)
# ==========================================================

print("\n[STEP 4/8] Detecting Transaction Chains...")
print(f"  Hops: {MIN_HOPS}–{MAX_HOPS}")
print(f"  Max paths/source: {MAX_PATHS_PER_SOURCE}")

def detect_chains(graph):
    chains = []
    nodes = list(graph.nodes())

    high_degree_nodes = sorted(
        nodes,
        key=lambda n: graph.degree(n),
        reverse=True
    )[:HIGH_DEGREE_NODE_LIMIT]

    for source in high_degree_nodes:
        path_count = 0

        for target in nodes:
            if source == target:
                continue

            try:
                for path in nx.all_simple_paths(
                        graph,
                        source,
                        target,
                        cutoff=MAX_HOPS
                ):
                    if len(path) >= MIN_HOPS + 1:
                        chains.append(path)
                        path_count += 1

                    if path_count >= MAX_PATHS_PER_SOURCE:
                        break

                if path_count >= MAX_PATHS_PER_SOURCE:
                    break

            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue

    return chains

detected_chains = detect_chains(G)
print(f"  [OK] Detected {len(detected_chains)} potential chains")

# ==========================================================
# CHAIN FEATURE EXTRACTION
# ==========================================================

print("\n[STEP 5/8] Calculating Chain Features...")

def calculate_chain_features(chain, graph):
    total_value = builtins.sum(
        graph[chain[i]][chain[i + 1]]['amount']
        for i in range(len(chain) - 1)
    )

    num_hops = len(chain) - 1

    timestamps = [
        graph[chain[i]][chain[i + 1]]['timestamp']
        for i in range(len(chain) - 1)
    ]

    time_span = (max(timestamps) - min(timestamps)
                 ).total_seconds() / 3600

    velocity = total_value / max(time_span, 0.1)

    return {
        "accounts": chain,
        "total_value": total_value,
        "num_hops": num_hops,
        "time_span": time_span,
        "velocity": velocity
    }

chain_features = [
    calculate_chain_features(c, G)
    for c in detected_chains
]

print(f"  [OK] Features computed for {len(chain_features)} chains")

# ==========================================================
# RISK SCORING
# ==========================================================

print("\n[STEP 6/8] Risk Scoring...")

def calculate_risk_score(f):
    score = 0
    flags = {}

    if f["accounts"][0] == f["accounts"][-1]:
        score += 30
        flags["circular"] = True

    if f["velocity"] > 10_000_000:
        score += 25
        flags["rapid"] = True

    if f["num_hops"] >= 4:
        score += 20
        flags["layering"] = True

    avg_val = f["total_value"] / f["num_hops"]
    if 4_900_000 <= avg_val <= 5_100_000:
        score += 15
        flags["structuring"] = True

    if f["time_span"] < 1:
        score += 10
        flags["time_compression"] = True

    return min(score, 100), flags

for f in chain_features:
    score, flags = calculate_risk_score(f)
    f["risk_score"] = score
    f["flags"] = flags

high_risk = [f for f in chain_features
             if f["risk_score"] >= RISK_THRESHOLD]

print(f"  [OK] High-risk chains: {len(high_risk)}")

# ==========================================================
# PREPARE FOR STORAGE
# ==========================================================

print("\n[STEP 7/8] Preparing Data for Storage...")

chains_rows = []
account_chain_rows = []

for f in high_risk:
    cid = str(uuid.uuid4())

    chains_rows.append({
        "chain_id": cid,
        "accounts": f["accounts"],
        "total_value": f["total_value"],
        "num_hops": f["num_hops"],
        "time_span": f["time_span"],
        "risk_score": f["risk_score"],
        "flags": f["flags"],
        "detected_at": datetime.now(),
        "status": "active"
    })

    for idx, acc in enumerate(f["accounts"]):
        role = "originator" if idx == 0 else \
               "destination" if idx == len(f["accounts"]) - 1 \
               else "intermediary"

        account_chain_rows.append({
            "account_id": acc,
            "chain_id": cid,
            "role": role,
            "position": idx
        })

# ==========================================================
# WRITE RESULTS
# ==========================================================

print("\n[STEP 8/8] Writing Results...")

chains_df = spark.createDataFrame(chains_rows)
account_chains_df = spark.createDataFrame(account_chain_rows)

try:
    chains_df.write.format(
        "org.apache.spark.sql.cassandra"
    ).mode("append").options(
        table="chains",
        keyspace=KEYSPACE
    ).save()

    account_chains_df.write.format(
        "org.apache.spark.sql.cassandra"
    ).mode("append").options(
        table="account_chains",
        keyspace=KEYSPACE
    ).save()

    print(f"  [OK] Stored {len(chains_rows)} chains in Astra")

except Exception:
    print("  [WARNING] Astra write failed — CSV fallback")
    chains_df.coalesce(1).write.csv(
        "chains_detected.csv",
        header=True,
        mode="overwrite"
    )

# ==========================================================
# SUMMARY
# ==========================================================

print("=" * 70)
print("CHAIN DETECTION COMPLETE")
print(f"Total Chains Analyzed : {len(detected_chains)}")
print(f"High-Risk Chains      : {len(high_risk)}")
print("=" * 70)

spark.stop()
print("[COMPLETE] Spark session closed")
