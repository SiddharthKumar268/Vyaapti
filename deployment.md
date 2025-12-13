# README-ASTRA-DEPLOYMENT.md

# 🚀 RTGS Risk-Chain Analyzer - DataStax Astra Deployment Guide

Complete guide to deploy your RTGS Risk-Chain Analyzer with **DataStax Astra DB** (Cloud Cassandra).

---

## 🎯 Why Use Astra DB?

### ✅ Advantages
- **Zero Setup**: No local Cassandra installation needed
- **Cloud-Based**: Access from anywhere
- **Free Tier**: 80GB storage, 40M reads/month
- **Auto-Scaling**: Handles traffic automatically
- **Managed**: DataStax handles backups, updates, maintenance
- **Mumbai Region**: Low latency for India (asia-south1)

### ❌ No Longer Need
- ❌ Install Cassandra locally
- ❌ Manage Cassandra cluster
- ❌ Configure replication
- ❌ Setup backups
- ❌ Monitor infrastructure

---

## 📋 Complete Setup Checklist

### Phase 1: Astra DB Setup (15 minutes)

#### Step 1.1: Access Your Database
```
✓ Database Name: vyaapti
✓ Status: Active
✓ Region: Mumbai, India (asia-south1)
✓ Database ID: 21aa9392-40f8-4ce5-a20e-f7be558d33e3
```

1. Go to https://astra.datastax.com
2. Login to your account
3. You should see **vyaapti** database

#### Step 1.2: Download Secure Connect Bundle
1. Click on **vyaapti** database
2. Go to **Connect** tab
3. Click **Download Secure Connect Bundle**
4. Save as: `secure-connect-vyaapti.zip`
5. **Important**: Place this file in `backend/` folder

```
RTGS-RiskChain/
├── backend/
│   ├── server.js
│   ├── secure-connect-vyaapti.zip  ← Place here!
│   └── .env
```

#### Step 1.3: Generate Application Token
1. In Astra Dashboard → **Settings** (gear icon)
2. Click **Application Tokens**
3. Click **Generate Token**
4. Role: Select **Database Administrator**
5. Copy and save:
   - ✅ Client ID (starts with `AstraCS...`)
   - ✅ Client Secret (long random string)
   - ✅ Token (for other uses)

**⚠️ IMPORTANT**: Save these credentials! You can't see them again.

---

### Phase 2: Project Setup (10 minutes)

#### Step 2.1: Project Structure
```
Vyaapti/
│
├── frontend/
│   ├── index.html
│   ├── chains.html
│   ├── account.html
│   ├── graph.html
│   ├── style.css
│   └── scripts/
│       ├── main.js
│       ├── chains.js
│       ├── account.js
│       └── graph.js
│
├── backend/
│   ├── server.js  (Astra version)
│   ├── .env
│   ├── package.json
│   ├── secure-connect-vyaapti.zip  ← Download from Astra
│   └── test-astra-connection.js
│
├── cassandra/
│   └── schema-astra.cql  (Astra version)
│
└── spark-jobs/
    └── chain-builder/
        └── detect_chains_astra.py  (Astra version)
```

#### Step 2.2: Configure Environment
Create `backend/.env`:

```env
PORT=3000
NODE_ENV=development

# Replace with YOUR actual credentials from Astra
ASTRA_CLIENT_ID=AstraCS:xxxxxxxxxxxxxxxxxxxxxx
ASTRA_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ASTRA_KEYSPACE=Vyaapti

# Your DB details (already correct)
ASTRA_DB_ID=21aa9392-40f8-4ce5-a20e-f7be558d33e3
ASTRA_REGION=asia-south1
ASTRA_DATACENTER=21aa9392...e3-1
```

#### Step 2.3: Install Dependencies
```bash
cd RTGS-RiskChain/backend
npm install
```

Dependencies installed:
- express
- cors
- cassandra-driver
- dotenv

---

### Phase 3: Database Setup (10 minutes)

#### Step 3.1: Create Keyspace
1. Go to Astra Dashboard → **vyaapti** → **CQL Console**
2. Run this command:

```cql
CREATE KEYSPACE IF NOT EXISTS Vyaapti
WITH replication = {
    'class': 'NetworkTopologyStrategy', 
    'asia-south1': 3
};
```

3. Verify:
```cql
DESCRIBE KEYSPACES;
```
You should see `rtgs_risk` in the list.

#### Step 3.2: Create Tables
1. Still in CQL Console, run:
```cql
USE rtgs_risk;
```

2. Copy ALL table creation commands from `cassandra/schema-astra.cql`
3. Paste and execute in CQL Console
4. This creates:
   - chains table
   - accounts table
   - account_chains table
   - transactions_processed table
   - risk_features table
   - clustering_results table
   - audit_log table

#### Step 3.3: Insert Sample Data
1. In CQL Console, copy the INSERT statements from `cassandra/schema-astra.cql`
2. Execute them
3. Verify:

```cql
SELECT COUNT(*) FROM chains;
SELECT COUNT(*) FROM accounts;
```

You should see 5 chains and 10 accounts.

---

### Phase 4: Test Connection (5 minutes)

#### Step 4.1: Run Connection Test
```bash
cd backend
node test-astra-connection.js
```

**Expected Output**:
```
╔════════════════════════════════════════════╗
║  DataStax Astra DB Connection Test        ║
╚════════════════════════════════════════════╝

🔌 Attempting to connect to Astra DB...
   Database: vyaapti
   Region: Mumbai (asia-south1)
   Keyspace: rtgs_risk

✓ Successfully connected to Astra DB!

📊 Testing queries...

1. Checking chains table...
   ✓ Found 5 chains

2. Checking accounts table...
   ✓ Found 10 accounts

3. Fetching sample chain...
   ✓ Sample Chain:
     Chain ID: 21aa9392...
     Risk Score: 85.50%
     Hops: 3
     Value: ₹5.00 Cr

4. Fetching sample account...
   ✓ Sample Account:
     Account ID: ACC001
     Suspicion Index: 82.50%
     Cluster: 1

╔════════════════════════════════════════════╗
║  ✓ All Tests Passed!                      ║
║  Your Astra DB is ready to use!           ║
╚════════════════════════════════════════════╝
```

#### Step 4.2: Troubleshooting

**Error: Secure Connect Bundle not found**
```
Solution: 
1. Download secure-connect-vyaapti.zip from Astra
2. Place it in backend/ folder
3. Check file name exactly matches
```

**Error: Authentication Failed**
```
Solution:
1. Verify credentials in .env file
2. Check for extra spaces
3. Regenerate token if needed
```

**Error: Keyspace not found**
```
Solution:
1. Go to Astra CQL Console
2. Create keyspace (see Step 3.1)
```

**Error: Table does not exist**
```
Solution:
1. Go to Astra CQL Console
2. Run schema-astra.cql commands
```

---

### Phase 5: Start Application (2 minutes)

#### Step 5.1: Start Backend
```bash
cd backend
node server.js
```

**Expected Output**:
```
╔════════════════════════════════════════════╗
║  RTGS Risk-Chain Analyzer Server          ║
║  Running on http://localhost:3000         ║
║  DataStax Astra DB (Mumbai, India)        ║
╚════════════════════════════════════════════╝
✓ Connected to DataStax Astra DB
```

#### Step 5.2: Test API
Open new terminal:
```bash
# Test summary endpoint
curl http://localhost:3000/api/summary

# Test chains endpoint
curl http://localhost:3000/api/chains

# Test specific account
curl http://localhost:3000/api/account/ACC001
```

#### Step 5.3: Start Frontend
```bash
cd frontend
python3 -m http.server 8080
```

#### Step 5.4: Access Application
Open browser: **http://localhost:8080**

You should see:
- ✅ Dashboard with statistics
- ✅ Charts displaying data
- ✅ Sample chains listed
- ✅ Account information

---

## 🎨 Application Features

### Dashboard (index.html)
- Total chains count
- High-risk chains
- Total value tracked
- Suspicious accounts
- Risk distribution chart
- Volume trends chart
- Live activity feed
- Top risky accounts table

### Risk Chains (chains.html)
- All detected chains
- Risk level indicators
- Filter by risk level
- Sort by various criteria
- Pagination
- Export to CSV
- View chain graph

### Account Analysis (account.html)
- Search by account ID
- Account metrics
- Risk assessment meter
- Transaction patterns chart
- Cluster distribution
- Associated chains

### Network Graph (graph.html)
- Interactive chain visualization
- Node details on click
- Zoom controls
- Physics simulation
- Screenshot capability
- Risk indicators

---

## 🔧 Advanced Configuration

### Environment Variables (.env)
```env
# Server
PORT=3000
NODE_ENV=production

# Astra DB (Required)
ASTRA_CLIENT_ID=your-client-id
ASTRA_CLIENT_SECRET=your-client-secret
ASTRA_KEYSPACE=Vyaapti
SECURE_CONNECT_BUNDLE=./secure-connect-vyaapti.zip

# Optional
API_RATE_LIMIT=100
LOG_LEVEL=info
```

### Spark Job Configuration
To run Spark jobs with Astra:

```bash
export ASTRA_CLIENT_ID="your-client-id"
export ASTRA_CLIENT_SECRET="your-client-secret"
export ASTRA_SECURE_BUNDLE="./secure-connect-vyaapti.zip"

spark-submit \
  --packages com.datastax.spark:spark-cassandra-connector_2.12:3.2.0 \
  spark-jobs/chain-builder/detect_chains_astra.py
```

---

## 📊 Monitoring & Maintenance

### Astra Dashboard Monitoring
1. Go to Astra Dashboard → **vyaapti**
2. **Overview** tab shows:
   - Storage used
   - Read/Write requests
   - Data transfer
   - Billing period usage

### Check Database Health
```bash
node backend/test-astra-connection.js
```

### View Logs
Backend logs show all operations:
```
✓ Connected to DataStax Astra DB
GET /api/summary 200 45ms
GET /api/chains 200 123ms
```

---

## 🚨 Common Issues & Solutions

### Issue 1: Connection Timeout
**Symptoms**: Cannot connect to Astra
**Solutions**:
1. Check internet connection
2. Verify Astra DB is active (not hibernated)
3. Check firewall settings
4. Verify credentials

### Issue 2: Keyspace Not Found
**Symptoms**: Error about missing keyspace
**Solution**: Create keyspace in CQL Console (see Phase 3)

### Issue 3: No Data Showing
**Symptoms**: Frontend shows zero stats
**Solutions**:
1. Check backend is running
2. Verify tables have data: `SELECT COUNT(*) FROM chains;`
3. Insert sample data from schema-astra.cql
4. Check browser console for errors (F12)

### Issue 4: Slow Queries
**Symptoms**: API takes long to respond
**Solutions**:
1. Avoid ALLOW FILTERING in production
2. Design queries around partition keys
3. Use prepared statements
4. Consider pagination

---

## 🎓 For College Project / VIVA

### Demo Flow
1. **Show Astra Dashboard**
   - Live database in cloud
   - Mumbai region
   - Usage statistics

2. **Run Connection Test**
   ```bash
   node test-astra-connection.js
   ```

3. **Start Application**
   - Backend connecting to cloud
   - Frontend showing live data

4. **Navigate Through Pages**
   - Dashboard → Statistics
   - Chains → Risk patterns
   - Accounts → Analysis
   - Graph → Visualization

5. **Show CQL Console**
   - Run live queries
   - Show data in Astra
   - Compare with frontend

### Key Points to Mention
- ✅ "Using cloud-native Cassandra (Astra)"
- ✅ "Production-ready deployment"
- ✅ "No local database setup required"
- ✅ "Auto-scaling and managed infrastructure"
- ✅ "Mumbai data center for low latency"
- ✅ "Free tier suitable for development"

---

## 📈 Scaling & Production

### Free Tier Limits
- ✅ 80 GB storage
- ✅ 40M reads/month
- ✅ Unlimited API calls
- ✅ 1 database
- ✅ 3 regions max

### Upgrade Path
When you need more:
1. **Serverless**: Pay-as-you-go ($0.10/million reads)
2. **Classic**: Fixed monthly pricing
3. **Multi-region**: Global distribution

### Production Checklist
- [ ] Use environment variables for credentials
- [ ] Enable SSL/TLS
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Implement rate limiting
- [ ] Add authentication
- [ ] Use prepared statements
- [ ] Optimize queries

---

## 🔐 Security Best Practices

1. **Never commit credentials**
   - Add .env to .gitignore
   - Use secrets manager in production

2. **Rotate tokens regularly**
   - Generate new tokens monthly
   - Revoke old tokens

3. **Use least privilege**
   - Application token with minimum permissions
   - Separate read/write tokens if possible

4. **Enable IP whitelist** (optional)
   - Restrict access to known IPs
   - Available in Astra settings

---

## 📞 Support & Resources

### Official Documentation
- Astra Docs: https://docs.datastax.com/en/astra/
- Cassandra Driver: https://docs.datastax.com/en/driver-matrix/doc/driver_matrix/nodejs/nodeJs.html

### Community
- DataStax Community: https://community.datastax.com/
- Stack Overflow: [datastax-astra] tag

### Getting Help
1. Check Astra Dashboard for status
2. Review application logs
3. Run connection test script
4. Check Astra support portal

---

## ✅ Final Verification

Run this checklist before demo:

```bash
# 1. Connection test
cd backend
node test-astra-connection.js

# 2. Start backend
node server.js

# 3. Test API
curl http://localhost:3000/api/summary

# 4. Start frontend
cd ../frontend
python3 -m http.server 8080

# 5. Open browser
open http://localhost:8080
```

All green? You're ready! 🚀

---

## 🎉 Success!

Your RTGS Risk-Chain Analyzer is now running on **DataStax Astra DB**!

- ✅ Cloud database configured
- ✅ Backend connected
- ✅ Frontend displaying data
- ✅ Ready for demo

**Next Steps**:
1. Customize the UI
2. Add more sample data
3. Run Spark jobs
4. Prepare presentation
5. Practice demo flow

Good luck with your project! 🎓✨