// frontend/scripts/account.js - COMPLETE FIXED VERSION

const API_BASE = 'http://localhost:3000/api';

// ============================================
// GLOBAL CHART INSTANCES (FIX FOR CHART ERROR)
// ============================================
let patternChartInstance = null;
let clusterChartInstance = null;

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const accountId = urlParams.get('id');
    
    if (accountId) {
        document.getElementById('accountSearch').value = accountId;
        loadAccountDetails(accountId);
    } else {
        loadTopAccounts();
    }
});

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

function searchAccount(event) {
    if (event.key === 'Enter') {
        performSearch();
    }
}

function performSearch() {
    const accountId = document.getElementById('accountSearch').value.trim();
    if (accountId) {
        loadAccountDetails(accountId);
    }
}

// ============================================
// LOAD ACCOUNT DETAILS
// ============================================

async function loadAccountDetails(accountId) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE}/account/${accountId}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                const errorData = await response.json();
                console.log('Error data:', errorData);
                showNoResults(errorData);
                return;
            }
            throw new Error('Failed to fetch account details');
        }
        
        const account = await response.json();
        displayAccountDetails(account);
        await loadAccountChains(accountId);
        
    } catch (error) {
        console.error('Error loading account:', error);
        showNoResults({ error: error.message });
    }
}

// ============================================
// DISPLAY ACCOUNT DETAILS
// ============================================

function displayAccountDetails(account) {
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('topAccountsSection').style.display = 'none';
    document.getElementById('accountDetails').style.display = 'block';
    
    // Basic info
    document.getElementById('accountId').textContent = account.account_id;
    document.getElementById('clusterLabel').textContent = account.cluster_label || 'Unclassified';
    document.getElementById('clusterLabel').style.background = getClusterColor(account.cluster_label);
    
    // Metrics
    document.getElementById('meanAmount').textContent = formatCurrency(account.mean_amount || 0);
    document.getElementById('frequency').textContent = `${account.frequency || 0} txns`;
    document.getElementById('totalVolume').textContent = formatCurrency((account.mean_amount || 0) * (account.frequency || 0));
    
    // Risk assessment
    const suspicionIndex = account.suspicion_index || 0;
    document.getElementById('suspicionIndex').textContent = `${suspicionIndex.toFixed(2)}%`;
    updateRiskMeter(suspicionIndex);
    
    // Status
    const status = suspicionIndex > 70 ? 'High Risk' : suspicionIndex > 40 ? 'Medium Risk' : 'Active';
    const statusBadge = document.getElementById('accountStatus');
    statusBadge.textContent = status;
    statusBadge.style.background = suspicionIndex > 70 ? 'rgba(239, 68, 68, 0.2)' : 
                                   suspicionIndex > 40 ? 'rgba(245, 158, 11, 0.2)' : 
                                   'rgba(16, 185, 129, 0.2)';
    statusBadge.style.color = suspicionIndex > 70 ? '#ef4444' : 
                              suspicionIndex > 40 ? '#f59e0b' : 
                              '#10b981';
    
    // Initialize charts (FIXED - will destroy old charts first)
    createPatternChart(account);
    createClusterChart(account);
}

// ============================================
// RISK METER
// ============================================

function updateRiskMeter(score) {
    document.getElementById('riskScore').textContent = `${score.toFixed(1)}%`;
    
    const riskFill = document.getElementById('riskFill');
    riskFill.style.width = `${score}%`;
    
    let color, label;
    if (score >= 80) {
        color = '#ef4444';
        label = 'Critical Risk';
    } else if (score >= 60) {
        color = '#f59e0b';
        label = 'High Risk';
    } else if (score >= 40) {
        color = '#3b82f6';
        label = 'Medium Risk';
    } else {
        color = '#10b981';
        label = 'Low Risk';
    }
    
    riskFill.style.background = `linear-gradient(90deg, ${color}, ${color}dd)`;
    document.getElementById('riskLabel').textContent = label;
    document.getElementById('riskLabel').style.color = color;
}

// ============================================
// LOAD ASSOCIATED CHAINS
// ============================================

async function loadAccountChains(accountId) {
    try {
        const response = await fetch(`${API_BASE}/account/${accountId}/chains`);
        if (!response.ok) throw new Error('Failed to fetch chains');
        
        const chains = await response.json();
        document.getElementById('chainCount').textContent = `${chains.length} chain${chains.length !== 1 ? 's' : ''}`;
        
        if (chains.length === 0) {
            document.getElementById('chainsTableBody').innerHTML = 
                '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No associated chains found</td></tr>';
            return;
        }
        
        const tbody = document.getElementById('chainsTableBody');
        tbody.innerHTML = chains.map(chain => `
            <tr>
                <td><code>${chain.chain_id.substring(0, 8)}...</code></td>
                <td>${renderRiskBadge(chain.risk_score)}</td>
                <td><strong style="color: #10b981;">${formatCurrency(chain.total_value)}</strong></td>
                <td><span class="badge-info">${chain.num_hops} hops</span></td>
                <td>${chain.role || 'Participant'}</td>
                <td>
                    <button class="btn-icon" onclick="viewChain('${chain.chain_id}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading chains:', error);
    }
}

// ============================================
// CHARTS (FIXED - DESTROY OLD CHARTS FIRST)
// ============================================

function createPatternChart(account) {
    const ctx = document.getElementById('patternChart');
    if (!ctx) return;
    
    // CRITICAL FIX: Destroy existing chart before creating new one
    if (patternChartInstance) {
        console.log('Destroying old pattern chart');
        patternChartInstance.destroy();
        patternChartInstance = null;
    }
    
    console.log('Creating new pattern chart');
    patternChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Transaction Amount',
                data: generatePatternData(account.mean_amount),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

function createClusterChart(account) {
    const ctx = document.getElementById('clusterChart');
    if (!ctx) return;
    
    // CRITICAL FIX: Destroy existing chart before creating new one
    if (clusterChartInstance) {
        console.log('Destroying old cluster chart');
        clusterChartInstance.destroy();
        clusterChartInstance = null;
    }
    
    console.log('Creating new cluster chart');
    clusterChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Frequency', 'Amount', 'Velocity', 'Diversity', 'Pattern'],
            datasets: [{
                label: 'Account Profile',
                data: [65, 78, 55, 82, 70],
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                pointBackgroundColor: '#8b5cf6'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8'
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: '#94a3b8', backdropColor: 'transparent' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#f1f5f9' }
                }
            }
        }
    });
}

// ============================================
// TOP ACCOUNTS
// ============================================

async function loadTopAccounts() {
    try {
        const response = await fetch(`${API_BASE}/accounts/top?limit=12`);
        if (!response.ok) throw new Error('Failed to fetch accounts');
        
        const accounts = await response.json();
        displayTopAccounts(accounts);
        
    } catch (error) {
        console.error('Error loading top accounts:', error);
        document.getElementById('accountsGrid').innerHTML = 
            '<p style="color: #94a3b8;">Failed to load accounts</p>';
    }
}

function displayTopAccounts(accounts) {
    const grid = document.getElementById('accountsGrid');
    
    grid.innerHTML = accounts.map(account => `
        <div class="account-card" onclick="loadAccountDetails('${account.account_id}')">
            <div class="account-card-header">
                <span class="account-icon">👤</span>
                <span class="cluster-tag" style="background: ${getClusterColor(account.cluster_label)}">
                    C${account.cluster_label || 0}
                </span>
            </div>
            <h3>${account.account_id.substring(0, 12)}...</h3>
            <div class="account-metrics">
                <div class="metric">
                    <span class="metric-label">Risk</span>
                    <span class="metric-value" style="color: ${getRiskColor(account.risk_score)}">
                        ${account.risk_score?.toFixed(1) || 0}%
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">Chains</span>
                    <span class="metric-value">${account.chain_count || 0}</span>
                </div>
            </div>
            <div class="account-risk-bar">
                <div style="width: ${account.risk_score || 0}%; background: ${getRiskColor(account.risk_score)}; height: 100%;"></div>
            </div>
        </div>
    `).join('');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getClusterColor(cluster) {
    const colors = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    ];
    return colors[(cluster || 0) % colors.length];
}

function getRiskColor(score) {
    if (score >= 80) return '#ef4444';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#3b82f6';
    return '#10b981';
}

function renderRiskBadge(score) {
    const color = getRiskColor(score);
    return `<span style="color: ${color}; font-weight: 700;">${score.toFixed(1)}%</span>`;
}

function formatCurrency(value) {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${(value / 1000).toFixed(2)}K`;
}

function generatePatternData(base) {
    return Array.from({ length: 4 }, () => 
        base * (0.8 + Math.random() * 0.4)
    );
}

function viewChain(chainId) {
    window.location.href = `graph.html?chain=${chainId}`;
}

function showLoading() {
    document.getElementById('accountDetails').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('topAccountsSection').style.display = 'none';
}

function showNoResults(errorData) {
    document.getElementById('accountDetails').style.display = 'none';
    document.getElementById('topAccountsSection').style.display = 'none';
    const noResults = document.getElementById('noResults');
    noResults.style.display = 'flex';
    
    // Update the no results message with helpful info
    if (errorData && errorData.available_accounts) {
        const noResultsContent = `
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" style="margin-bottom: 2rem; opacity: 0.3;">
                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2"/>
                <line x1="6" y1="11" x2="16" y2="11" stroke="currentColor" stroke-width="2"/>
            </svg>
            <h2>Account Not Found</h2>
            <p style="color: #ef4444; margin: 1rem 0;">Account "${errorData.requested}" does not exist in database.</p>
            ${errorData.available_accounts.length > 0 ? `
                <div style="background: rgba(99, 102, 241, 0.1); padding: 1.5rem; border-radius: 12px; margin-top: 1rem;">
                    <p style="color: #94a3b8; margin-bottom: 1rem;">Try one of these accounts:</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center;">
                        ${errorData.available_accounts.slice(0, 10).map(acc => `
                            <button onclick="loadAccountDetails('${acc}')" style="
                                background: rgba(99, 102, 241, 0.2);
                                color: #6366f1;
                                border: 1px solid rgba(99, 102, 241, 0.3);
                                padding: 0.5rem 1rem;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                                transition: all 0.3s ease;
                            " onmouseover="this.style.background='rgba(99, 102, 241, 0.3)'" onmouseout="this.style.background='rgba(99, 102, 241, 0.2)'">
                                ${acc}
                            </button>
                        `).join('')}
                    </div>
                </div>
            ` : '<p style="color: #94a3b8;">No accounts found in database. Please insert sample data.</p>'}
        `;
        noResults.innerHTML = noResultsContent;
    }
}