// ============================================
// NETWORK GRAPH VISUALIZATION
// ============================================

const API_BASE = 'http://localhost:3000/api';
let network = null;
let physicsEnabled = true;

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const chainId = urlParams.get('chain');

    if (chainId) {
        loadChainGraph(chainId);
    } else {
        showError('No chain ID provided');
    }
});

// ============================================
// LOAD CHAIN GRAPH
// ============================================

async function loadChainGraph(chainId) {
    try {
        const response = await fetch(`${API_BASE}/chain/${chainId}`);
        if (!response.ok) throw new Error('Failed to fetch chain data');

        const chainData = await response.json();
        displayChainInfo(chainData);
        createNetworkGraph(chainData);

    } catch (error) {
        console.error('Error loading chain graph:', error);
        showError('Failed to load chain graph');
    }
}

// ============================================
// DISPLAY CHAIN INFO
// ============================================

function displayChainInfo(chain) {
    document.getElementById('chainId').textContent = chain.chain_id.substring(0, 12) + '...';

    const riskScore = chain.risk_score || 0;
    const riskElement = document.getElementById('chainRisk');
    riskElement.textContent = `${riskScore.toFixed(1)}%`;
    riskElement.style.color = getRiskColor(riskScore);

    document.getElementById('chainValue').textContent = formatCurrency(chain.total_value || 0);
    document.getElementById('chainHops').textContent = chain.num_hops || 0;
    document.getElementById('chainTimeSpan').textContent = formatTimeSpan(chain.time_span || 0);
    document.getElementById('chainAccounts').textContent = chain.accounts?.length || 0;

    // Display flags
    displayFlags(chain.flags);
}

function displayFlags(flags) {
    const container = document.getElementById('flagsContainer');

    if (!flags || Object.keys(flags).length === 0) {
        container.innerHTML = '<p style="color: #94a3b8;">No flags detected</p>';
        return;
    }

    const flagDetails = {
        'circular': { icon: '🔄', label: 'Circular Pattern', color: '#ef4444' },
        'rapid': { icon: '⚡', label: 'Rapid Succession', color: '#f59e0b' },
        'layering': { icon: '📚', label: 'Layering Detected', color: '#f59e0b' },
        'structuring': { icon: '🏗️', label: 'Structuring', color: '#ef4444' },
        'round_trip': { icon: '↩️', label: 'Round Trip', color: '#ef4444' }
    };

    const activeFlags = Object.entries(flags)
        .filter(([_, value]) => value)
        .map(([key, _]) => {
            const detail = flagDetails[key] || { icon: '⚠️', label: key, color: '#f59e0b' };
            return `
                <div class="flag-badge-large" style="border-left: 3px solid ${detail.color};">
                    <span class="flag-icon">${detail.icon}</span>
                    <span class="flag-label">${detail.label}</span>
                </div>
            `;
        })
        .join('');

    container.innerHTML = activeFlags || '<p style="color: #94a3b8;">No flags detected</p>';
}

// ============================================
// CREATE NETWORK GRAPH
// ============================================

function createNetworkGraph(chainData) {
    const container = document.getElementById('network');

    // Prepare nodes
    const nodes = new vis.DataSet(
        chainData.nodes.map((node, index) => ({
            id: node.id,
            label: node.label || `Acc-${index}`,
            title: `Account: ${node.id}\nAmount: ${formatCurrency(node.amount || 0)}`,
            color: {
                background: getNodeColor(node, index, chainData.nodes.length),
                border: getNodeBorderColor(node),
                highlight: {
                    background: '#6366f1',
                    border: '#4f46e5'
                }
            },
            font: {
                color: '#f1f5f9',
                size: 14,
                face: 'Inter'
            },
            size: getNodeSize(node),
            borderWidth: 3,
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.3)',
                size: 10
            }
        }))
    );

    // Prepare edges
    const edges = new vis.DataSet(
        chainData.edges.map(edge => ({
            from: edge.from,
            to: edge.to,
            label: formatCurrency(edge.amount || 0),
            arrows: {
                to: {
                    enabled: true,
                    scaleFactor: 1.2
                }
            },
            color: {
                color: '#64748b',
                highlight: '#6366f1',
                hover: '#8b5cf6'
            },
            font: {
                color: '#94a3b8',
                size: 12,
                align: 'middle',
                background: 'rgba(15, 23, 42, 0.8)',
                strokeWidth: 0
            },
            width: 2,
            smooth: {
                type: 'cubicBezier',
                roundness: 0.4
            },
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.2)',
                size: 5
            }
        }))
    );

    const data = { nodes, edges };

    const options = {
        width: '100%',
        height: '100%',
        autoResize: true,
        nodes: {
            shape: 'dot',
            scaling: {
                min: 20,
                max: 50
            }
        },
        edges: {
            smooth: {
                enabled: true,
                type: 'continuous'
            }
        },
        physics: {
            enabled: true,
            barnesHut: {
                gravitationalConstant: -8000,
                centralGravity: 0.3,
                springLength: 200,
                springConstant: 0.04,
                damping: 0.3,
                avoidOverlap: 0.5
            },
            stabilization: {
                enabled: true,
                iterations: 1000,
                updateInterval: 25
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 100,
            zoomView: true,
            dragView: true,
            navigationButtons: false
        },
        layout: {
            improvedLayout: true,
            hierarchical: false
        }
    };
    network = new vis.Network(container, data, options);

    // Force resize after initialization
    setTimeout(() => {
        if (network) {
            network.redraw();
            network.fit();
        }
    }, 100);

    // Hide loading overlay
    setTimeout(() => {
        document.getElementById('loadingOverlay').style.display = 'none';
    }, 1500);

    // Add event listeners
    network.on('click', onNodeClick);
    network.on('stabilizationProgress', onStabilizationProgress);
    network.on('stabilizationIterationsDone', onStabilizationDone);
}

// ============================================
// NODE STYLING
// ============================================

function getNodeColor(node, index, total) {
    if (node.suspicious || node.risk_score > 70) {
        return '#ef4444'; // Red for suspicious
    }
    if (index === 0) {
        return '#10b981'; // Green for origin
    }
    if (index === total - 1) {
        return '#8b5cf6'; // Purple for destination
    }
    return '#3b82f6'; // Blue for intermediate
}

function getNodeBorderColor(node) {
    if (node.suspicious) return '#dc2626';
    return '#1e293b';
}

function getNodeSize(node) {
    const baseSize = 25;
    const amountFactor = Math.min((node.amount || 0) / 10000000, 1);
    return baseSize + (amountFactor * 15);
}

// ============================================
// EVENT HANDLERS
// ============================================

function onNodeClick(params) {
    if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        displayNodeInfo(nodeId);
    }
}

function displayNodeInfo(nodeId) {
    const container = document.getElementById('nodeInfo');

    // In a real implementation, fetch node details from API
    container.innerHTML = `
        <div class="node-detail">
            <h4>Account: ${nodeId}</h4>
            <div class="detail-row">
                <span>Status:</span>
                <span class="badge-success">Active</span>
            </div>
            <div class="detail-row">
                <span>Cluster:</span>
                <span>C-3</span>
            </div>
            <div class="detail-row">
                <span>Risk Score:</span>
                <span style="color: #f59e0b; font-weight: 600;">65%</span>
            </div>
            <button class="btn-small" onclick="viewAccount('${nodeId}')">
                View Full Profile
            </button>
        </div>
    `;
}

function onStabilizationProgress(params) {
    const progress = Math.round((params.iterations / params.total) * 100);
    const overlay = document.getElementById('loadingOverlay');
    overlay.querySelector('p').textContent = `Loading network graph... ${progress}%`;
}

function onStabilizationDone() {
    console.log('Network stabilization complete');
}

// ============================================
// GRAPH CONTROLS
// ============================================

function zoomIn() {
    if (network) {
        const scale = network.getScale();
        network.moveTo({ scale: scale * 1.2 });
    }
}

function zoomOut() {
    if (network) {
        const scale = network.getScale();
        network.moveTo({ scale: scale * 0.8 });
    }
}

function fitView() {
    if (network) {
        network.fit({
            animation: {
                duration: 1000,
                easingFunction: 'easeInOutQuad'
            }
        });
    }
}

function resetView() {
    if (network) {
        network.fit();
        network.moveTo({
            position: { x: 0, y: 0 },
            scale: 1,
            animation: {
                duration: 1000,
                easingFunction: 'easeInOutQuad'
            }
        });
    }
}

function togglePhysics() {
    if (network) {
        physicsEnabled = !physicsEnabled;
        network.setOptions({ physics: { enabled: physicsEnabled } });
        showToast(physicsEnabled ? 'Physics enabled' : 'Physics disabled');
    }
}

function takeScreenshot() {
    if (network) {
        const canvas = network.canvas.frame.canvas;
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chain_graph_${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Screenshot saved!');
        });
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getRiskColor(score) {
    if (score >= 80) return '#ef4444';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#3b82f6';
    return '#10b981';
}

function formatCurrency(value) {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${(value / 1000).toFixed(2)}K`;
}

function formatTimeSpan(hours) {
    if (hours < 1) return `${(hours * 60).toFixed(0)} min`;
    if (hours < 24) return `${hours.toFixed(1)} hrs`;
    return `${(hours / 24).toFixed(1)} days`;
}

function viewAccount(accountId) {
    window.location.href = `account.html?id=${accountId}`;
}

function showError(message) {
    document.getElementById('loadingOverlay').innerHTML = `
        <div style="color: #ef4444; text-align: center;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="margin: 0 auto 1rem;">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2"/>
            </svg>
            <p>${message}</p>
        </div>
    `;
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(99, 102, 241, 0.9);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}