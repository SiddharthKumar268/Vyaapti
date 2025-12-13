// ============================================
// RTGS RISK-CHAIN ANALYZER - MAIN DASHBOARD
// ============================================

const API_BASE = 'http://localhost:3000/api';

// ============================================
// INITIALIZE DASHBOARD
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    initCharts();
    setupRefreshInterval();
});

// ============================================
// FETCH DASHBOARD DATA
// ============================================

async function initDashboard() {
    try {
        const summary = await fetchAPI('/summary');
        updateStats(summary);
        await loadTopAccounts();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showError('Failed to load dashboard data');
    }
}

async function fetchAPI(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

// ============================================
// UPDATE STATISTICS
// ============================================

function updateStats(data) {
    animateCounter('totalChains', data.totalChains || 0);
    animateCounter('highRiskChains', data.highRiskChains || 0);
    animateCounter('totalValue', (data.totalValue / 10000000).toFixed(2));
    animateCounter('suspiciousAccounts', data.suspiciousAccounts || 0);
}

function animateCounter(id, target) {
    const element = document.getElementById(id);
    const duration = 2000;
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = typeof target === 'number' && target % 1 !== 0 
                ? target.toFixed(2) 
                : Math.floor(target);
            clearInterval(timer);
        } else {
            element.textContent = typeof target === 'number' && target % 1 !== 0 
                ? current.toFixed(2) 
                : Math.floor(current);
        }
    }, 16);
}

// ============================================
// LOAD TOP ACCOUNTS
// ============================================

async function loadTopAccounts() {
    try {
        const accounts = await fetchAPI('/accounts/top?limit=5');
        const tbody = document.getElementById('topAccountsBody');
        
        if (!accounts || accounts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No data available</td></tr>';
            return;
        }

        tbody.innerHTML = accounts.map(account => `
            <tr>
                <td><strong>${account.account_id}</strong></td>
                <td><span class="badge">${account.cluster_label || 'N/A'}</span></td>
                <td>${renderRiskBadge(account.risk_score)}</td>
                <td>${account.chain_count || 0}</td>
                <td>${renderStatus(account.risk_score)}</td>
                <td>
                    <a href="account.html?id=${account.account_id}" class="btn-small">View</a>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading top accounts:', error);
        document.getElementById('topAccountsBody').innerHTML = 
            '<tr><td colspan="6">Error loading accounts</td></tr>';
    }
}

function renderRiskBadge(score) {
    const riskLevel = getRiskLevel(score);
    const color = {
        'Critical': '#ef4444',
        'High': '#f59e0b',
        'Medium': '#3b82f6',
        'Low': '#10b981'
    }[riskLevel];

    return `<div style="display: flex; align-items: center; gap: 0.5rem;">
        <div style="width: 60px; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
            <div style="width: ${score}%; height: 100%; background: ${color}; transition: width 1s ease;"></div>
        </div>
        <span style="color: ${color}; font-weight: 600;">${score.toFixed(1)}%</span>
    </div>`;
}

function getRiskLevel(score) {
    if (score >= 80) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
}

function renderStatus(score) {
    const level = getRiskLevel(score);
    const colors = {
        'Critical': 'background: rgba(239, 68, 68, 0.2); color: #ef4444;',
        'High': 'background: rgba(245, 158, 11, 0.2); color: #f59e0b;',
        'Medium': 'background: rgba(59, 130, 246, 0.2); color: #3b82f6;',
        'Low': 'background: rgba(16, 185, 129, 0.2); color: #10b981;'
    };
    return `<span style="${colors[level]} padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem;">${level}</span>`;
}

// ============================================
// INITIALIZE CHARTS
// ============================================

let riskChart, volumeChart;

async function initCharts() {
    try {
        const chartData = await fetchAPI('/charts/data');
        createRiskChart(chartData.riskDistribution);
        createVolumeChart(chartData.volumeTrends);
    } catch (error) {
        console.error('Error initializing charts:', error);
        createRiskChart([]);
        createVolumeChart([]);
    }
}

function createRiskChart(data) {
    const ctx = document.getElementById('riskChart');
    if (!ctx) return;

    const labels = ['Low', 'Medium', 'High', 'Critical'];
    const values = data.length > 0 ? data : [120, 85, 45, 28];

    riskChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(59, 130, 246, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(239, 68, 68, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#f1f5f9',
                        padding: 15,
                        font: { size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 2000
            }
        }
    });
}

function createVolumeChart(data) {
    const ctx = document.getElementById('volumeChart');
    if (!ctx) return;

    const labels = data.length > 0 ? data.map(d => d.date) : 
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const values = data.length > 0 ? data.map(d => d.volume) : 
        [450, 520, 380, 610, 490, 720, 680];

    volumeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Transaction Volume',
                data: values,
                borderColor: 'rgba(99, 102, 241, 1)',
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
                    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
                    return gradient;
                },
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 11 }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 11 }
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// ============================================
// AUTO REFRESH
// ============================================

function setupRefreshInterval() {
    // Refresh dashboard every 30 seconds
    setInterval(() => {
        initDashboard();
    }, 30000);
}

// ============================================
// ERROR HANDLING
// ============================================

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
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
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(value);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}