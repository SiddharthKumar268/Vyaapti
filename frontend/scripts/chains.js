// ============================================
// RISK CHAINS PAGE LOGIC
// ============================================

const API_BASE = 'http://localhost:3000/api';
let allChains = [];
let filteredChains = [];
let currentPage = 1;
const itemsPerPage = 10;

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    loadChains();
});

// ============================================
// LOAD CHAINS
// ============================================

async function loadChains() {
    try {
        const response = await fetch(`${API_BASE}/chains`);
        if (!response.ok) throw new Error('Failed to fetch chains');
        
        allChains = await response.json();
        filteredChains = [...allChains];
        
        updateStats();
        renderChains();
        renderPagination();
    } catch (error) {
        console.error('Error loading chains:', error);
        showError('Failed to load risk chains');
        renderEmptyState();
    }
}

// ============================================
// UPDATE STATISTICS
// ============================================

function updateStats() {
    const total = allChains.length;
    const critical = allChains.filter(c => c.risk_score >= 80).length;
    const avgRisk = allChains.reduce((sum, c) => sum + c.risk_score, 0) / total || 0;
    const totalValue = allChains.reduce((sum, c) => sum + c.total_value, 0) / 10000000;

    document.getElementById('totalChainsCount').textContent = total;
    document.getElementById('criticalCount').textContent = critical;
    document.getElementById('avgRisk').textContent = avgRisk.toFixed(1) + '%';
    document.getElementById('totalChainValue').textContent = `₹${totalValue.toFixed(2)}Cr`;
}

// ============================================
// RENDER CHAINS TABLE
// ============================================

function renderChains() {
    const tbody = document.getElementById('chainsTableBody');
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const chainsToDisplay = filteredChains.slice(start, end);

    if (chainsToDisplay.length === 0) {
        renderEmptyState();
        return;
    }

    tbody.innerHTML = chainsToDisplay.map(chain => `
        <tr class="chain-row">
            <td>
                <div class="chain-id">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="color: #6366f1;">
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                        <path d="M12 1v6m0 6v6" stroke="currentColor" stroke-width="2"/>
                        <path d="M21 12h-6m-6 0H3" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <code>${chain.chain_id.substring(0, 8)}</code>
                </div>
            </td>
            <td>${renderRiskLevel(chain.risk_score)}</td>
            <td>${renderRiskBar(chain.risk_score)}</td>
            <td>
                <strong style="color: #10b981;">
                    ${formatCurrency(chain.total_value)}
                </strong>
            </td>
            <td>
                <span class="badge-info">${chain.num_hops} hops</span>
            </td>
            <td>
                <span style="color: #94a3b8;">
                    ${formatTimeSpan(chain.time_span)}
                </span>
            </td>
            <td>${renderFlags(chain.flags)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon" onclick="viewChain('${chain.chain_id}')" title="View Graph">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                    <button class="btn-icon" onclick="analyzeChain('${chain.chain_id}')" title="Analyze">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                            <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Add hover effects
    document.querySelectorAll('.chain-row').forEach(row => {
        row.style.transition = 'all 0.3s ease';
        row.addEventListener('mouseenter', () => {
            row.style.background = 'rgba(99, 102, 241, 0.05)';
            row.style.transform = 'scale(1.01)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = 'transparent';
            row.style.transform = 'scale(1)';
        });
    });
}

// ============================================
// RENDERING HELPERS
// ============================================

function renderRiskLevel(score) {
    const levels = {
        'Critical': { color: '#ef4444', icon: '🔴' },
        'High': { color: '#f59e0b', icon: '🟠' },
        'Medium': { color: '#3b82f6', icon: '🟡' },
        'Low': { color: '#10b981', icon: '🟢' }
    };
    
    const level = getRiskLevel(score);
    const { color, icon } = levels[level];
    
    return `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span>${icon}</span>
            <span style="color: ${color}; font-weight: 600;">${level}</span>
        </div>
    `;
}

function renderRiskBar(score) {
    const color = score >= 80 ? '#ef4444' : score >= 60 ? '#f59e0b' : score >= 40 ? '#3b82f6' : '#10b981';
    return `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="flex: 1; height: 10px; background: rgba(255,255,255,0.05); border-radius: 5px; overflow: hidden; min-width: 100px;">
                <div style="width: ${score}%; height: 100%; background: ${color}; transition: width 1s ease;"></div>
            </div>
            <span style="color: ${color}; font-weight: 700; min-width: 45px;">${score.toFixed(1)}%</span>
        </div>
    `;
}

function renderFlags(flags) {
    if (!flags || Object.keys(flags).length === 0) {
        return '<span style="color: #94a3b8;">None</span>';
    }
    
    const flagsList = Object.entries(flags)
        .filter(([_, value]) => value)
        .map(([key, _]) => {
            const flagIcons = {
                'circular': '🔄',
                'rapid': '⚡',
                'layering': '📚',
                'structuring': '🏗️',
                'round_trip': '↩️'
            };
            return `<span class="flag-badge" title="${key}">${flagIcons[key] || '⚠️'}</span>`;
        })
        .join('');
    
    return flagsList || '<span style="color: #94a3b8;">None</span>';
}

function formatCurrency(value) {
    if (value >= 10000000) {
        return `₹${(value / 10000000).toFixed(2)}Cr`;
    } else if (value >= 100000) {
        return `₹${(value / 100000).toFixed(2)}L`;
    }
    return `₹${(value / 1000).toFixed(2)}K`;
}

function formatTimeSpan(hours) {
    if (hours < 1) return `${(hours * 60).toFixed(0)} min`;
    if (hours < 24) return `${hours.toFixed(1)} hrs`;
    return `${(hours / 24).toFixed(1)} days`;
}

function getRiskLevel(score) {
    if (score >= 80) return 'Critical';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
}

// ============================================
// PAGINATION
// ============================================

function renderPagination() {
    const totalPages = Math.ceil(filteredChains.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '<div class="pagination-controls">';
    
    // Previous button
    html += `
        <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} 
                onclick="changePage(${currentPage - 1})">
            ← Prev
        </button>
    `;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `
                <button class="page-btn ${i === currentPage ? 'active' : ''}" 
                        onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += '<span class="page-dots">...</span>';
        }
    }
    
    // Next button
    html += `
        <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} 
                onclick="changePage(${currentPage + 1})">
            Next →
        </button>
    `;
    
    html += '</div>';
    pagination.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    renderChains();
    renderPagination();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// FILTERS
// ============================================

function toggleFilters() {
    const panel = document.getElementById('filterPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function applyFilters() {
    const riskFilter = document.getElementById('riskFilter').value;
    const minValue = parseFloat(document.getElementById('minValue').value) || 0;
    const minHops = parseInt(document.getElementById('minHops').value) || 0;
    const sortBy = document.getElementById('sortBy').value;

    // Apply filters
    filteredChains = allChains.filter(chain => {
        const riskLevel = getRiskLevel(chain.risk_score).toLowerCase();
        const passRisk = riskFilter === 'all' || riskLevel === riskFilter;
        const passValue = chain.total_value / 10000000 >= minValue;
        const passHops = chain.num_hops >= minHops;
        
        return passRisk && passValue && passHops;
    });

    // Apply sorting
    filteredChains.sort((a, b) => {
        switch(sortBy) {
            case 'risk':
                return b.risk_score - a.risk_score;
            case 'value':
                return b.total_value - a.total_value;
            case 'hops':
                return b.num_hops - a.num_hops;
            default:
                return 0;
        }
    });

    currentPage = 1;
    renderChains();
    renderPagination();
}

// ============================================
// ACTIONS
// ============================================

function viewChain(chainId) {
    window.location.href = `graph.html?chain=${chainId}`;
}

function analyzeChain(chainId) {
    alert(`Detailed analysis for chain ${chainId} - Feature coming soon!`);
}

function exportChains() {
    const csv = convertToCSV(filteredChains);
    downloadCSV(csv, 'risk_chains.csv');
}

function convertToCSV(data) {
    const headers = ['Chain ID', 'Risk Score', 'Risk Level', 'Total Value', 'Hops', 'Time Span'];
    const rows = data.map(chain => [
        chain.chain_id,
        chain.risk_score,
        getRiskLevel(chain.risk_score),
        chain.total_value,
        chain.num_hops,
        chain.time_span
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ============================================
// EMPTY STATE
// ============================================

function renderEmptyState() {
    document.getElementById('chainsTableBody').innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 3rem;">
                <div style="color: #94a3b8;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 1rem; opacity: 0.3;">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
                        <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">No chains found</p>
                    <p style="font-size: 0.9rem;">Try adjusting your filters</p>
                </div>
            </td>
        </tr>
    `;
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
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}