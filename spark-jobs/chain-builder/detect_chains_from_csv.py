from pyspark.sql import SparkSession
from pyspark.sql.functions import col
from datetime import datetime
import networkx as nx
import uuid

# ===============================
# CONFIG
# ===============================

CSV_PATH = "D:/Python/Avi.py/Vyaapti/spark-jobs/chain-builder/transactions_generated.csv"


MIN_HOPS = 2
MAX_HOPS = 4
MAX_PATHS_PER_SOURCE = 20

# ===============================
# SPARK
# ===============================

spark = SparkSession.builder \
    .appName("RTGS-Chain-Detection-CSV") \
    .getOrCreate()

spark.sparkContext.setLogLevel("ERROR")

print("[STEP 1] Spark initialized")

# ===============================
# LOAD CSV
# ===============================

df = spark.read.csv(CSV_PATH, header=True, inferSchema=True)

print(f"[STEP 2] Loaded {df.count()} transactions")

# ===============================
# BUILD GRAPH
# ===============================

edges = df.select(
    col("from_account"),
    col("to_account"),
    col("amount"),
    col("timestamp")
).collect()

G = nx.DiGraph()

for e in edges:
    G.add_edge(
        e.from_account,
        e.to_account,
        amount=float(e.amount),
        timestamp=e.timestamp
    )

print(f"[STEP 3] Graph built | Nodes={G.number_of_nodes()} Edges={G.number_of_edges()}")

# ===============================
# DETECT CHAINS
# ===============================

def detect_chains(graph):
    chains = []
    nodes = list(graph.nodes())

    high_degree_nodes = sorted(
        nodes, key=lambda n: graph.degree(n), reverse=True
    )[:50]

    for source in high_degree_nodes:
        path_count = 0
        for target in nodes:
            if source == target:
                continue

            try:
                for path in nx.all_simple_paths(
                    graph, source, target, cutoff=MAX_HOPS
                ):
                    if len(path) >= MIN_HOPS + 1:
                        chains.append(path)
                        path_count += 1

                    if path_count >= MAX_PATHS_PER_SOURCE:
                        break
            except:
                continue

    return chains

chains = detect_chains(G)
print(f"[STEP 4] Chains detected: {len(chains)}")

# ===============================
# FEATURE EXTRACTION
# ===============================

def chain_features(chain):
    total_value = sum(
        G[chain[i]][chain[i+1]]["amount"]
        for i in range(len(chain)-1)
    )

    timestamps = [
        G[chain[i]][chain[i+1]]["timestamp"]
        for i in range(len(chain)-1)
    ]

    time_span = (max(timestamps) - min(timestamps)).total_seconds() / 3600
    hops = len(chain) - 1
    velocity = total_value / max(time_span, 0.1)

    return {
        "chain_id": str(uuid.uuid4()),
        "accounts": " -> ".join(chain),
        "hops": hops,
        "total_value": total_value,
        "time_span_hours": round(time_span, 2),
        "velocity": round(velocity, 2)
    }

rows = [chain_features(c) for c in chains]

# ===============================
# SAVE RESULT (NORMAL CSV)
# ===============================

import pandas as pd

out_df = pd.DataFrame(rows)
out_df.to_csv(
    r"D:\Python\Avi.py\Vyaapti\data\chains_detected.csv",
    index=False
)

print("[STEP 5] chains_detected.csv created")

spark.stop()
print("[DONE]")
