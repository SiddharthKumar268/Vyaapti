"""
RTGS Transaction Generator - FIXED VERSION
Works with Windows + Spark + Astra DB
Generates 10,000 transactions with suspicious patterns
"""

from pyspark.sql import SparkSession
from pyspark.sql.types import *
from datetime import datetime, timedelta
import random
import uuid
import os

# ============================================
# CONFIGURATION
# ============================================

ASTRA_CLIENT_ID = "grpXrlZBvKEgKIHnqqIFzhmK"
ASTRA_CLIENT_SECRET = "MCgvzCnQYFl+X+fR8WIDeZNzIoKox+8HBkNwRB8H26P8PcQAL3Xi0HJ-mXsEHE18-.133_UJxdvWTlF9l5d1UTZoXDvw4k-bYxbLxJ2Z7BDu3hO0tysaGJZP98UzM+m."
ASTRA_SECURE_BUNDLE = "../../backend/secure-connect-vyaapti.zip"
KEYSPACE = "vyaapti"

NUM_TRANSACTIONS = 10000
NUM_ACCOUNTS = 200

# ============================================
# SPARK SESSION WITH PROPER CONFIG
# ============================================

print("="*70)
print("RTGS TRANSACTION GENERATOR - BIG DATA VERSION")
print(f"Technology Stack: Spark + Hadoop + Cassandra")
print(f"Target: {NUM_TRANSACTIONS:,} transactions")
print("="*70)

spark = SparkSession.builder \
    .appName("RTGS-Generator") \
    .config("spark.jars.packages", "com.datastax.spark:spark-cassandra-connector_2.12:3.2.0") \
    .config("spark.cassandra.connection.config.cloud.path", ASTRA_SECURE_BUNDLE) \
    .config("spark.cassandra.auth.username", ASTRA_CLIENT_ID) \
    .config("spark.cassandra.auth.password", ASTRA_CLIENT_SECRET) \
    .config("spark.dse.continuousPagingEnabled", "false") \
    .config("spark.sql.extensions", "com.datastax.spark.connector.CassandraSparkExtensions") \
    .getOrCreate()

spark.sparkContext.setLogLevel("ERROR")

print("\n[STEP 1/5] Spark Session Initialized")
print(f"  Spark Version: {spark.version}")
print(f"  Hadoop Version: Using Spark's Hadoop libraries")
print(f"  Executor Memory: {spark.sparkContext._conf.get('spark.executor.memory', 'default')}")

# ============================================
# GENERATE ACCOUNT DATA
# ============================================

print("\n[STEP 2/5] Generating Account Data...")
accounts = [f"ACC{str(i).zfill(6)}" for i in range(1, NUM_ACCOUNTS + 1)]
print(f"  [OK] Created {len(accounts)} unique accounts")

# ============================================
# GENERATE TRANSACTIONS
# ============================================

print("\n[STEP 3/5] Generating Transaction Patterns...")
transactions = []
start_date = datetime.now() - timedelta(days=90)

def create_normal_transaction():
    """Generate a normal transaction"""
    from_acc = random.choice(accounts)
    to_acc = random.choice([a for a in accounts if a != from_acc])
    amount = random.uniform(1000000, 50000000)
    timestamp = start_date + timedelta(seconds=random.randint(0, 90*24*3600))
    
    return {
        'txn_id': str(uuid.uuid4()),
        'from_account': from_acc,
        'to_account': to_acc,
        'amount': float(amount),
        'timestamp': timestamp,
        'processed': True
    }

def create_suspicious_chain():
    """Generate a suspicious transaction chain"""
    chain_length = random.randint(3, 6)
    chain_accounts = random.sample(accounts, chain_length)
    
    # 30% chance of circular chain
    if random.random() < 0.3:
        chain_accounts.append(chain_accounts[0])
    
    chain_txns = []
    base_time = start_date + timedelta(seconds=random.randint(0, 90*24*3600))
    
    for i in range(len(chain_accounts) - 1):
        # 40% chance of structuring (amount near 5M limit)
        if random.random() < 0.4:
            amount = random.uniform(4800000, 5100000)
        else:
            amount = random.uniform(5000000, 30000000)
        
        # Time compression for suspicious activity
        time_offset = random.randint(0, 3600)
        timestamp = base_time + timedelta(seconds=time_offset)
        
        chain_txns.append({
            'txn_id': str(uuid.uuid4()),
            'from_account': chain_accounts[i],
            'to_account': chain_accounts[i+1],
            'amount': float(amount),
            'timestamp': timestamp,
            'processed': True
        })
    
    return chain_txns

# Generate normal transactions (85%)
num_suspicious = int(NUM_TRANSACTIONS * 0.15)
num_normal = NUM_TRANSACTIONS - num_suspicious

print(f"  Normal transactions: {num_normal:,}")
print(f"  Suspicious chains: ~{num_suspicious:,}")

for _ in range(num_normal):
    transactions.append(create_normal_transaction())

# Generate suspicious chains (15%)
suspicious_count = 0
while suspicious_count < num_suspicious:
    chain = create_suspicious_chain()
    transactions.extend(chain)
    suspicious_count += len(chain)

# Trim to exact count
transactions = transactions[:NUM_TRANSACTIONS]

print(f"  [OK] Generated {len(transactions):,} transactions")
print(f"  Total Value: Rs.{sum(t['amount'] for t in transactions)/10000000:.2f} Crore")

# ============================================
# CREATE SPARK DATAFRAME
# ============================================

print("\n[STEP 4/5] Creating Spark DataFrame...")

schema = StructType([
    StructField("txn_id", StringType(), False),
    StructField("from_account", StringType(), False),
    StructField("to_account", StringType(), False),
    StructField("amount", DoubleType(), False),
    StructField("timestamp", TimestampType(), False),
    StructField("processed", BooleanType(), False)
])

df = spark.createDataFrame(transactions, schema=schema)

print(f"  DataFrame Rows: {df.count():,}")
print(f"  DataFrame Partitions: {df.rdd.getNumPartitions()}")
print(f"  [OK] Data loaded into Spark")

# ============================================
# WRITE TO ASTRA DB
# ============================================

print("\n[STEP 5/5] Writing to Astra DB...")
print(f"  Database: {KEYSPACE}")
print(f"  Table: transactions_processed")

try:
    # Attempt to write to Astra
    df.write \
        .format("org.apache.spark.sql.cassandra") \
        .mode("append") \
        .options(table="transactions_processed", keyspace=KEYSPACE) \
        .save()
    
    print(f"\n{'='*70}")
    print(f"SUCCESS! Transaction Generation Complete")
    print(f"{'='*70}")
    print(f"  Transactions Written: {len(transactions):,}")
    print(f"  Total Value: Rs.{sum(t['amount'] for t in transactions)/10000000:.2f} Crore")
    print(f"  Storage: DataStax Astra DB (Mumbai)")
    print(f"  Status: READY FOR CHAIN DETECTION")
    print(f"{'='*70}")
    print(f"\n[NEXT] Run: spark-submit detect-chains-FIXED.py")
    
except Exception as e:
    print(f"\n[WARNING] Could not write directly to Astra")
    print(f"  Error: {str(e)[:100]}")
    print(f"\n[FALLBACK] Saving to CSV + Using cassandra-driver...")
    
    # Save to CSV as backup
    output_path = "transactions_generated.csv"
    df.coalesce(1).write.csv(output_path, header=True, mode="overwrite")
    print(f"  [OK] Saved to {output_path}")
    
    # Use cassandra-driver as fallback
    try:
        from cassandra.cluster import Cluster
        from cassandra.auth import PlainTextAuthProvider
        
        cloud_config = {'secure_connect_bundle': ASTRA_SECURE_BUNDLE}
        auth_provider = PlainTextAuthProvider(ASTRA_CLIENT_ID, ASTRA_CLIENT_SECRET)
        cluster = Cluster(cloud=cloud_config, auth_provider=auth_provider)
        session = cluster.connect(KEYSPACE)
        
        print(f"  [OK] Connected via cassandra-driver")
        
        insert_query = session.prepare(
            "INSERT INTO transactions_processed (txn_id, from_account, to_account, amount, timestamp, processed) "
            "VALUES (?, ?, ?, ?, ?, ?)"
        )
        
        batch_size = 100
        for i in range(0, len(transactions), batch_size):
            batch = transactions[i:i+batch_size]
            for txn in batch:
                session.execute(insert_query, (
                    uuid.UUID(txn['txn_id']),
                    txn['from_account'],
                    txn['to_account'],
                    txn['amount'],
                    txn['timestamp'],
                    txn['processed']
                ))
            if (i + batch_size) % 1000 == 0:
                print(f"    Inserted {i + batch_size:,}/{len(transactions):,}...")
        
        cluster.shutdown()
        
        print(f"\n{'='*70}")
        print(f"SUCCESS! Transaction Generation Complete (Fallback Method)")
        print(f"{'='*70}")
        print(f"  Transactions Written: {len(transactions):,}")
        print(f"  Method: cassandra-driver (direct connection)")
        print(f"  Status: READY FOR CHAIN DETECTION")
        print(f"{'='*70}")
        
    except Exception as e2:
        print(f"  [ERROR] Fallback also failed: {str(e2)}")
        print(f"  [ACTION] Manual import needed from CSV file")

spark.stop()
print("\n[COMPLETE] Spark session closed")