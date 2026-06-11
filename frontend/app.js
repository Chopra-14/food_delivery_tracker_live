// Chart instances
let statusChart = null;
let restaurantChart = null;
let volumeChart = null;

// Local cache
let ordersCache = {};
let searchQuery = "";
let selectedStatus = "ALL";

// Initialize Chart.js visualizations
function initCharts() {
    // 1. Status Distribution (Pie / Doughnut)
    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    statusChart = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Placed', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: [
                    'rgba(107, 114, 128, 0.45)', // PLACED
                    'rgba(59, 130, 246, 0.45)',  // CONFIRMED
                    'rgba(245, 158, 11, 0.45)',  // PREPARING
                    'rgba(236, 72, 153, 0.45)',  // OUT_FOR_DELIVERY
                    'rgba(16, 185, 129, 0.45)'   // DELIVERED
                ],
                borderColor: [
                    '#6b7280', '#3b82f6', '#f59e0b', '#ec4899', '#10b981'
                ],
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#9ca3af',
                        font: {
                            family: 'Outfit',
                            size: 11
                        }
                    }
                }
            }
        }
    });

    // 2. Top Restaurants (Bar Chart)
    const ctxRest = document.getElementById('restaurantChart').getContext('2d');
    restaurantChart = new Chart(ctxRest, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: 'rgba(59, 130, 246, 0.4)',
                borderColor: '#3b82f6',
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(75, 85, 99, 0.1)'
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'Outfit'
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(75, 85, 99, 0.1)'
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'Outfit'
                        },
                        stepSize: 1
                    }
                }
            }
        }
    });

    // 3. Order Volume Trend (Line Chart)
    const ctxVol = document.getElementById('volumeChart').getContext('2d');
    volumeChart = new Chart(ctxVol, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.3,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(75, 85, 99, 0.1)'
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'Outfit'
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(75, 85, 99, 0.1)'
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'Outfit'
                        },
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Update charts with API analytics data
function updateCharts(analytics) {
    if (!analytics) return;

    // 1. Status Chart
    const statusCounts = analytics.status_distribution || {};
    const statusData = [
        statusCounts['PLACED'] || 0,
        statusCounts['CONFIRMED'] || 0,
        statusCounts['PREPARING'] || 0,
        statusCounts['OUT_FOR_DELIVERY'] || 0,
        statusCounts['DELIVERED'] || 0
    ];
    statusChart.data.datasets[0].data = statusData;
    statusChart.update();

    // 2. Top Restaurants Chart
    const topRestaurants = analytics.top_restaurants || [];
    restaurantChart.data.labels = topRestaurants.map(r => r.name);
    restaurantChart.data.datasets[0].data = topRestaurants.map(r => r.orders);
    restaurantChart.update();

    // 3. Volume Trend Chart
    const volumeTrend = analytics.volume_trend || [];
    volumeChart.data.labels = volumeTrend.map(v => v.time);
    volumeChart.data.datasets[0].data = volumeTrend.map(v => v.orders);
    volumeChart.update();
}

// Update KPI cards on dashboard
function updateKPIs(kpis) {
    if (!kpis) return;
    document.getElementById('val-total-orders').innerText = kpis.total_orders || 0;
    document.getElementById('val-active-orders').innerText = kpis.active_orders || 0;
    document.getElementById('val-delivered-orders').innerText = kpis.delivered_orders || 0;
    
    const speed = kpis.avg_delivery_time || 0;
    document.getElementById('val-avg-speed').innerText = `${speed}s`;
}

// Render the orders table with filtering and highlights
function renderOrdersTable() {
    const tableBody = document.getElementById("tableBody");
    const noDataMessage = document.getElementById("noDataMessage");
    
    // Sort keys descending (latest orders at the top)
    const sortedIds = Object.keys(ordersCache).sort((a, b) => b.localeCompare(a));
    
    let visibleCount = 0;
    let tableRowsHTML = "";
    
    sortedIds.forEach(orderId => {
        const order = ordersCache[orderId];
        
        // Filter logic
        const matchSearch = order.customer.toLowerCase().includes(searchQuery) ||
                            order.restaurant.toLowerCase().includes(searchQuery) ||
                            order.item.toLowerCase().includes(searchQuery) ||
                            orderId.toLowerCase().includes(searchQuery);
                            
        const matchStatus = selectedStatus === 'ALL' || order.status === selectedStatus;
        
        if (matchSearch && matchStatus) {
            visibleCount++;
            
            const badgeClass = `badge ${order.status.toLowerCase()}`;
            const displayStatus = order.status.replace(/_/g, " ");
            
            // Attempt to format timestamp nicely
            let displayTime = order.timestamp;
            try {
                const date = new Date(order.timestamp);
                displayTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            } catch (e) {
                // Fallback to original
            }
            
            const isNewOrUpdated = order.isNew || order.isUpdated;
            const animationClass = isNewOrUpdated ? 'class="new-row"' : '';
            
            tableRowsHTML += `
                <tr ${animationClass}>
                    <td>${orderId}</td>
                    <td>${order.customer}</td>
                    <td>${order.restaurant}</td>
                    <td>${order.item}</td>
                    <td><span class="${badgeClass}">${displayStatus}</span></td>
                    <td>${displayTime}</td>
                </tr>
            `;
            
            // Reset state flags after rendering
            order.isNew = false;
            order.isUpdated = false;
        }
    });
    
    tableBody.innerHTML = tableRowsHTML;
    noDataMessage.style.display = visibleCount === 0 ? "block" : "none";
}

// Update cache with new orders
function updateOrdersCache(newOrders) {
    let changed = false;
    
    for (const orderId in newOrders) {
        const newOrder = newOrders[orderId];
        const cached = ordersCache[orderId];
        
        if (!cached) {
            // Brand new order
            ordersCache[orderId] = {
                ...newOrder,
                isNew: true,
                isUpdated: false
            };
            changed = true;
        } else if (cached.status !== newOrder.status) {
            // Status changed
            ordersCache[orderId] = {
                ...newOrder,
                isNew: false,
                isUpdated: true
            };
            changed = true;
        }
    }
    
    if (changed || Object.keys(ordersCache).length === 0) {
        renderOrdersTable();
    }
}

// Poll state endpoint
async function fetchState() {
    try {
        const response = await fetch("http://localhost:5005/state");
        if (!response.ok) throw new Error("HTTP error " + response.status);
        const data = await response.json();
        updateOrdersCache(data);
    } catch (error) {
        console.error("Failed to fetch state:", error);
    }
}

// Poll analytics endpoint
async function fetchAnalytics() {
    try {
        const response = await fetch("http://localhost:5005/api/analytics");
        if (!response.ok) throw new Error("HTTP error " + response.status);
        const data = await response.json();
        updateKPIs(data.kpis);
        updateCharts(data);
    } catch (error) {
        console.error("Failed to fetch analytics:", error);
    }
}

// Set up UI listeners
function initListeners() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderOrdersTable();
    });

    document.getElementById('statusFilter').addEventListener('change', (e) => {
        selectedStatus = e.target.value;
        renderOrdersTable();
    });
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    initCharts();
    initListeners();
    
    // Initial fetch
    fetchState();
    fetchAnalytics();
    
    // Poll every 3 seconds
    setInterval(fetchState, 3000);
    setInterval(fetchAnalytics, 3000);
});
