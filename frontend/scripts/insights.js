// frontend/scripts/insights.js

const API_BASE = 'http://localhost:3000/api/ml';

let clusterChartInstance = null;
let riskDistChartInstance = null;

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    checkModelStatus();
    loadClusterAnalysis();
    loadMLStatistics();
});

// ============================================
// CHECK MODEL STATUS
// ============================================

async function checkModelStatus() {
    try {
        const response = await fetch(`${API_BASE}/model-status`);
        const data = await response.json();

        // Update K-Means status
        const kmeansReady = data.models.kmeans_model && data.models.kmeans_scaler;
        document.getElementById('kmeansStatusText').textContent = kmeansReady ? '✓ Ready' : '⚠ Not Trained';
        document.getElementById('kmeansStatusText').style.color = kmeansReady ? '#10b981' : '#f59e0b';
        document.getElementById('kmeansBtn').textContent = kmeansReady ? 'Re-run' : 'Run Clustering';

        // Update Random Forest status
        const rfReady = data.models.rf_classifier && data.models.rf_scaler;
        document.getElementById('rfStatusText').textContent = rfReady ? '✓ Ready' : '⚠ Not Trained';
        document.getElementById('rfStatusText').style.color = rfReady ? '#10b981' : '#f59e0b';
        document.getElementById('rfBtn').textContent = rfReady ? 'Re-train' : 'Train Model';

    } catch (error) {
        console.error('Error checking model status:', error);
    }
}

// ============================================
// RUN K-MEANS CLUSTERING
// ============================================

async function runKMeans() {
    const btn = document.getElementById('kmeansBtn');
    btn.disabled = true;
    btn.textContent = 'Running...';
    
    addLog('🤖 Starting K-Means clustering...');

    try {
        const response = await fetch(`${API_BASE}/run-kmeans`, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            addLog('✅ K-Means clustering completed successfully!');
            addLog(`📊 ${data.clusters.length} clusters created`);
            
            showSuccess('K-Means clustering completed!');
            
            // Reload data
            await loadClusterAnalysis();
            await checkModelStatus();
        } else {
            addLog('❌ K-Means clustering failed: ' + data.error);
            showError('K-Means failed: ' + data.error);
        }
    } catch (error) {
        addLog('❌ Error: ' + error.message);
        showError('Failed to run K-Means: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Re-run';
    }
}

// ============================================
// TRAIN RANDOM FOREST
// ============================================

async function trainRandomForest() {
    const btn = document.getElementById('rfBtn');
    btn.disabled = true;
    btn.textContent = 'Training...';
    
    addLog('🎯 Starting Random Forest training...');

    try {
        const response = await fetch(`${API_BASE}/train-random-forest`, { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            addLog('✅ Random Forest training completed!');
            addLog('📊 Model ready for predictions');
            
            showSuccess('Random Forest trained successfully!');
            
            await checkModelStatus();
        } else {
            addLog('❌ Random Forest training failed: ' + data.error);
            showError('Training failed: ' + data.error);
        }
    } catch (error) {
        addLog('❌ Error: ' + error.message);
        showError('Failed to train model: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Re-train';
    }
}

// ============================================
// LOAD ML STATISTICS
// ============================================

async function loadMLStatistics() {
    try {
        const response = await fetch(`${API_BASE}/statistics`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('mlAccuracy').textContent = `Accuracy: ${data.statistics.accuracy}`;
            document.getElementById('mlFeatures').textContent = `Features: ${data.statistics.features_used}`;
        }
    } catch (error) {
        console.error('Error loading ML statistics:', error);
    }
}

// ============================================
// LOAD CLUSTER ANALYSIS
// ============================================

async function loadClusterAnalysis() {
    try {
        const response = await fetch(`${API_BASE}/cluster-analysis`);
        const data = await response.json();

        if (data.success && data.clusters.length > 0) {
            displayClusters(data.clusters);
            createClusterCharts(data.clusters);
            populateClusterSelect(data.clusters);
            document.getElementById('clusterCount').textContent = `${data.clusters.length} clusters`;
        }
    } catch (error) {
        console.error('Error loading cluster analysis:', error);
        document.getElementById('clustersGrid').innerHTML = 
            '<p style="color: #94a3b8;">Run K-Means clustering first to see results</p>';
    }
}

// ============================================
// DISPLAY CLUSTERS
// ============================================

function displayClusters(clusters) {
    const grid = document.getElementById('clustersGrid');
    
    grid.innerHTML = clusters.map(cluster => `
        <div class="cluster-card" style="border-left: 4px solid ${cluster.color};">
            <div class="cluster-header">
                <h3>Cluster ${cluster.cluster_id}</h3>
                <span class="cluster-badge" style="background: ${cluster.color}20; color: ${cluster.color};">
                    ${cluster.risk_category}
                </span>
            </div>
            <div class="cluster-stats">
                <div class="cluster-stat">
                    <span class="stat-label">Accounts</span>
                    <span class="stat-value">${cluster.account_count}</span>
                </div>
                <div class="cluster-stat">
                    <span class="stat-label">Avg Suspicion</span>
                    <span class="stat-value">${cluster.avg_suspicion}%</span>
                </div>
                <div class="cluster-stat">
                    <span class="stat-label">Avg Amount</span>
                    <span class="stat-value">₹${cluster.avg_amount}L</span>
                </div>
                <div class="cluster-stat">
                    <span class="stat-label">Avg Frequency</span>
                    <span class="stat-value">${cluster.avg_frequency}</span>
                </div>
            </div>
            <button class="btn-small" onclick="viewClusterAccounts(${cluster.cluster_id})">
                View Accounts
            </button>
        </div>
    `).join('');
}

// ============================================
// CREATE CLUSTER CHARTS WITH VIBRANT COLORS
// ============================================

function createClusterCharts(clusters) {
    // Define vibrant, highly distinct colors for each cluster
    const getClusterColor = (riskCategory, index) => {
        const colorSchemes = {
            'Critical': ['#FF1744', '#D50000', '#C62828', '#B71C1C'], // Bright Reds
            'High': ['#FF6F00', '#FF9100', '#FF6D00', '#F57C00'],     // Bright Oranges
            'Medium': ['#00B0FF', '#2979FF', '#0091EA', '#01579B'],   // Bright Blues
            'Low': ['#00E676', '#00C853', '#00BFA5', '#00897B']       // Bright Greens
        };
        const colors = colorSchemes[riskCategory] || ['#9C27B0', '#7B1FA2', '#6A1B9A', '#4A148C'];
        return colors[index % colors.length];
    };
    
    // Assign distinct colors to each cluster
    const clusterColors = clusters.map((cluster, index) => 
        getClusterColor(cluster.risk_category, index)
    );
    
    // Cluster Distribution Chart (Doughnut)
    const clusterCtx = document.getElementById('clusterChart');
    if (clusterChartInstance) clusterChartInstance.destroy();
    
    clusterChartInstance = new Chart(clusterCtx, {
        type: 'doughnut',
        data: {
            labels: clusters.map(c => `Cluster ${c.cluster_id} (${c.risk_category})`),
            datasets: [{
                data: clusters.map(c => c.account_count),
                backgroundColor: clusterColors,
                borderColor: '#1e293b',
                borderWidth: 3,
                hoverOffset: 15,
                hoverBorderColor: '#ffffff',
                hoverBorderWidth: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    labels: { 
                        color: '#f1f5f9',
                        font: {
                            size: 13,
                            weight: '600'
                        },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    },
                    position: 'bottom'
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: '#475569',
                    borderWidth: 1,
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} accounts (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Risk Distribution Chart (Bar) with vibrant gradient colors
    const riskCtx = document.getElementById('riskDistChart');
    if (riskDistChartInstance) riskDistChartInstance.destroy();
    
    const riskCounts = {
        'Low': 0,
        'Medium': 0,
        'High': 0,
        'Critical': 0
    };
    
    clusters.forEach(c => {
        riskCounts[c.risk_category] += c.account_count;
    });
    
    // Super vibrant colors for risk levels - highly distinguishable
    const riskColors = {
        'Low': '#00E676',      // Neon Green
        'Medium': '#00B0FF',   // Electric Blue
        'High': '#FF6F00',     // Bright Orange
        'Critical': '#FF1744'  // Hot Red
    };
    
    riskDistChartInstance = new Chart(riskCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(riskCounts),
            datasets: [{
                label: 'Accounts',
                data: Object.values(riskCounts),
                backgroundColor: Object.keys(riskCounts).map(key => riskColors[key]),
                borderColor: Object.keys(riskCounts).map(key => riskColors[key]),
                borderWidth: 3,
                borderRadius: 10,
                hoverBackgroundColor: Object.keys(riskCounts).map(key => riskColors[key] + 'DD'),
                hoverBorderWidth: 4,
                barPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: '#475569',
                    borderWidth: 1,
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} accounts at ${context.label} risk level`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.08)',
                        lineWidth: 1
                    },
                    ticks: { 
                        color: '#cbd5e1',
                        font: {
                            size: 12,
                            weight: '600'
                        },
                        stepSize: 1
                    },
                    border: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { 
                        color: '#cbd5e1',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    },
                    border: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// ============================================
// POPULATE CLUSTER SELECT
// ============================================

function populateClusterSelect(clusters) {
    const select = document.getElementById('clusterSelect');
    select.innerHTML = '<option value="">Select Cluster</option>' +
        clusters.map(c => `<option value="${c.cluster_id}">Cluster ${c.cluster_id} (${c.risk_category})</option>`).join('');
}

// ============================================
// LOAD CLUSTER ACCOUNTS
// ============================================

async function loadClusterAccounts() {
    const clusterId = document.getElementById('clusterSelect').value;
    
    if (!clusterId) {
        document.getElementById('clusterAccountsBody').innerHTML = 
            '<tr><td colspan="6">Select a cluster to view accounts</td></tr>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/cluster/${clusterId}/accounts?limit=20`);
        const data = await response.json();

        if (data.success && data.accounts.length > 0) {
            const tbody = document.getElementById('clusterAccountsBody');
            tbody.innerHTML = data.accounts.map(acc => `
                <tr>
                    <td><strong>${acc.account_id}</strong></td>
                    <td><span class="badge-info">C${acc.cluster}</span></td>
                    <td><span style="color: ${getRiskColor(acc.suspicion_index)};">${acc.suspicion_index}%</span></td>
                    <td>₹${acc.mean_amount}L</td>
                    <td>${acc.frequency}</td>
                    <td>${acc.velocity}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading cluster accounts:', error);
    }
}

function viewClusterAccounts(clusterId) {
    document.getElementById('clusterSelect').value = clusterId;
    loadClusterAccounts();
    document.getElementById('clusterSelect').scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// PREDICT RISK
// ============================================

async function predictRisk() {
    const accountId = document.getElementById('accountInput').value.trim();
    
    if (!accountId) {
        showError('Please enter an account ID');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/predict-risk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_id: accountId })
        });

        const data = await response.json();

        if (data.success) {
            displayPredictionResult(data);
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Failed to predict risk: ' + error.message);
    }
}

function displayPredictionResult(data) {
    const resultDiv = document.getElementById('predictionResult');
    const pred = data.prediction;
    const feat = data.features;
    
    resultDiv.innerHTML = `
        <div class="prediction-header">
            <h3>Prediction for ${data.account_id}</h3>
            <span class="risk-badge-large" style="background: ${getRiskColor(pred.suspicion_index)}20; color: ${getRiskColor(pred.suspicion_index)};">
                ${pred.risk_category} Risk
            </span>
        </div>
        <div class="prediction-details">
            <div class="pred-stat">
                <span class="pred-label">Confidence</span>
                <span class="pred-value">${pred.confidence}%</span>
            </div>
            <div class="pred-stat">
                <span class="pred-label">Suspicion Index</span>
                <span class="pred-value" style="color: ${getRiskColor(pred.suspicion_index)};">${pred.suspicion_index}%</span>
            </div>
            <div class="pred-stat">
                <span class="pred-label">Cluster</span>
                <span class="pred-value">${feat.cluster}</span>
            </div>
        </div>
        <div class="prediction-recommendation">
            <strong>Recommendation:</strong>
            <p>${pred.recommendation}</p>
        </div>
    `;
    
    resultDiv.style.display = 'block';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRiskColor(score) {
    if (score >= 80) return '#FF1744';  // Hot Red
    if (score >= 60) return '#FF6F00';  // Bright Orange
    if (score >= 40) return '#00B0FF';  // Electric Blue
    return '#00E676';  // Neon Green
}

function addLog(message) {
    const log = document.getElementById('trainingLog');
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${timestamp}] ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function clearLog() {
    document.getElementById('trainingLog').innerHTML = 
        '<p style="color: #94a3b8;">Log cleared.</p>';
}

function refreshData() {
    checkModelStatus();
    loadClusterAnalysis();
    loadMLStatistics();
    showSuccess('Data refreshed!');
}

function showSuccess(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: rgba(16, 185, 129, 0.9);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showError(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: rgba(239, 68, 68, 0.9);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}