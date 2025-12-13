"""
RTGS Risk-Chain Analyzer - Chain Builder Job
Detects suspicious transaction chains using graph algorithms
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *
from pyspark.sql.window import Window
import networkx as nx
from datetime import datetime
import uuid

# ============================================
# SPARK SESSION INITIALIZATION
# ============================================

spark = SparkSession.builder \
    .appName("RTGS-ChainBuilder") \
    .config("spark.cassandra.connection.host", "localhost") \
    .config("spark.jars.packages", "com.datastax.spark:spark-cassandra-connector_2.12:3.2.0") \
    .getOrCreate()

sc = spark.sparkContext
sc.setLogLevel("WARN")

print("="*60)
print("RTGS RISK-CHAIN ANALYZER - Chain Detection")
print("="*60)

# ============================================
# LOAD PROCESSED TRANSACTIONS
# ============================================

print("\n[1] Loading processed transactions...")

transactions_df = spark.read \
    .format("org.apache.spark.sql.cassandra") \
    .options(table="transactions_processed", keyspace="rtgs_risk") \
    .load()

print(f"Loaded {transactions_df.count()} transactions")

# ============================================
# BUILD TRANSACTION GRAPH
# ============================================

print("\n[2] Building transaction graph...")

# Convert to edges
edges = transactions_df.select(
    col("from_account").alias("source"),
    col("to_account").alias("target"),
    col("amount"),
    col("timestamp"),
    col("txn_id")
).collect()

# Create NetworkX directed graph
G = nx.DiGraph()

for edge in edges:
    G.add_edge(
        edge.source,
        edge.target,
        amount=edge.amount,
        timestamp=edge.timestamp,
        txn_id=str(edge.txn_id)
    )

print(f"Graph created with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges")

# ============================================
# DETECT CHAINS
# ============================================

print("\n[3] Detecting transaction chains...")

def detect_chains(graph, min_hops=2, max_hops=10):
    """
    Detect transaction chains using path analysis
    """
    chains = []
    
    # Find all simple paths between nodes
    for source in graph.nodes():
        # Get all paths starting from this source
        for target in graph.nodes():
            if source != target:
                try:
                    paths = list(nx.all_simple_paths(
                        graph, 
                        source, 
                        target, 
                        cutoff=max_hops
                    ))
                    
                    for path in paths:
                        if len(path) >= min_hops + 1:  # min_hops + 1 nodes
                            chains.append(path)
                except nx.NetworkXNoPath:
                    continue
    
    return chains

detected_chains = detect_chains(G, min_hops=2, max_hops=8)
print(f"Detected {len(detected_chains)} potential chains")

# ============================================
# CALCULATE CHAIN FEATURES
# ============================================

print("\n[4] Calculating chain features...")

def calculate_chain_features(chain, graph):
    """
    Calculate features for a transaction chain
    """
    # Total value
    total_value = sum(
        graph[chain[i]][chain[i+1]]['amount'] 
        for i in range(len(chain)-1)
    )
    
    # Number of hops
    num_hops = len(chain) - 1
    
    # Time span
    timestamps = [
        graph[chain[i]][chain[i+1]]['timestamp'] 
        for i in range(len(chain)-1)
    ]
    time_span = (max(timestamps) - min(timestamps)).total_seconds() / 3600  # hours
    
    # Velocity (value per hour)
    velocity = total_value / max(time_span, 0.1)
    
    return {
        'accounts': chain,
        'total_value': total_value,
        'num_hops': num_hops,
        'time_span': time_span,
        'velocity': velocity
    }

chain_features = [calculate_chain_features(chain, G) for chain in detected_chains]

# ============================================
# RISK SCORING
# ============================================

print("\n[5] Calculating risk scores...")

def calculate_risk_score(features):
    """
    Calculate risk score for a chain
    Patent-worthy novel scoring algorithm combining multiple factors
    """
    risk_score = 0.0
    flags = {}
    
    # Factor 1: Circular pattern detection
    if features['accounts'][0] == features['accounts'][-1]:
        risk_score += 30
        flags['circular'] = True
    
    # Factor 2: Rapid succession (high velocity)
    if features['velocity'] > 10000000:  # 1 Cr/hour
        risk_score += 25
        flags['rapid'] = True
    
    # Factor 3: Layering (many hops)
    if features['num_hops'] >= 5:
        risk_score += 20
        flags['layering'] = True
    
    # Factor 4: Structuring (just below reporting threshold)
    avg_value = features['total_value'] / features['num_hops']
    if 4900000 <= avg_value <= 5100000:  # Around 50L threshold
        risk_score += 15
        flags['structuring'] = True
    
    # Factor 5: Time compression
    if features['time_span'] < 1.0:  # Less than 1 hour
        risk_score += 10
        flags['time_compression'] = True
    
    # Normalize to 0-100
    risk_score = min(risk_score, 100)
    
    return risk_score, flags

# Calculate risk scores
for features in chain_features:
    risk_score, flags = calculate_risk_score(features)
    features['risk_score'] = risk_score
    features['flags'] = flags

# Filter high-risk chains
high_risk_chains = [f for f in chain_features if f['risk_score'] >= 60]
print(f"Identified {len(high_risk_chains)} high-risk chains")

# ============================================
# PREPARE FOR CASSANDRA
# ============================================

print("\n[6] Preparing data for Cassandra...")

# Create DataFrame for chains
chains_data = []
account_chains_data = []

for features in high_risk_chains:
    chain_id = str(uuid.uuid4())
    
    # Chain record
    chains_data.append({
        'chain_id': chain_id,
        'accounts': features['accounts'],
        'total_value': float(features['total_value']),
        'num_hops': int(features['num_hops']),
        'time_span': float(features['time_span']),
        'risk_score': float(features['risk_score']),
        'flags': features['flags'],
        'detected_at': datetime.now(),
        'status': 'active'
    })
    
    # Account-Chain junction records
    for idx, account in enumerate(features['accounts']):
        account_chains_data.append({
            'account_id': account,
            'chain_id': chain_id,
            'role': 'originator' if idx == 0 else 'intermediary' if idx < len(features['accounts'])-1 else 'destination',
            'position': idx
        })

# Create DataFrames
chains_schema = StructType([
    StructField("chain_id", StringType(), False),
    StructField("accounts", ArrayType(StringType()), False),
    StructField("total_value", DoubleType(), False),
    StructField("num_hops", IntegerType(), False),
    StructField("time_span", DoubleType(), False),
    StructField("risk_score", DoubleType(), False),
    StructField("flags", MapType(StringType(), BooleanType()), False),
    StructField("detected_at", TimestampType(), False),
    StructField("status", StringType(), False)
])

account_chains_schema = StructType([
    StructField("account_id", StringType(), False),
    StructField("chain_id", StringType(), False),
    StructField("role", StringType(), False),
    StructField("position", IntegerType(), False)
])

chains_df = spark.createDataFrame(chains_data, schema=chains_schema)
account_chains_df = spark.createDataFrame(account_chains_data, schema=account_chains_schema)

# ============================================
# WRITE TO CASSANDRA
# ============================================

print("\n[7] Writing results to Cassandra...")

chains_df.write \
    .format("org.apache.spark.sql.cassandra") \
    .mode("append") \
    .options(table="chains", keyspace="rtgs_risk") \
    .save()

account_chains_df.write \
    .format("org.apache.spark.sql.cassandra") \
    .mode("append") \
    .options(table="account_chains", keyspace="rtgs_risk") \
    .save()

print(f"✓ Wrote {len(chains_data)} chains to Cassandra")
print(f"✓ Wrote {len(account_chains_data)} account-chain relationships")

# ============================================
# SUMMARY STATISTICS
# ============================================

print("\n" + "="*60)
print("CHAIN DETECTION SUMMARY")
print("="*60)
print(f"Total Chains Detected:     {len(detected_chains)}")
print(f"High-Risk Chains:          {len(high_risk_chains)}")
print(f"Average Risk Score:        {sum(f['risk_score'] for f in high_risk_chains)/len(high_risk_chains):.2f}")
print(f"Max Chain Length:          {max(f['num_hops'] for f in high_risk_chains)}")
print(f"Total Flagged Value:       ₹{sum(f['total_value'] for f in high_risk_chains)/10000000:.2f} Cr")
print("="*60)

# Flag distribution
flag_counts = {}
for features in high_risk_chains:
    for flag in features['flags']:
        flag_counts[flag] = flag_counts.get(flag, 0) + 1

print("\nFlag Distribution:")
for flag, count in sorted(flag_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {flag:20s}: {count:3d} chains")

print("\n✓ Chain detection completed successfully!")
spark.stop()