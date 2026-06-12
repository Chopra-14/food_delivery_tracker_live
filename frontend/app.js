<<<<<<< HEAD
// ── Chart instances ──────────────────────────────
let statusChart    = null;
let restaurantChart = null;
let volumeChart    = null;

// ── Local cache ──────────────────────────────────
let ordersCache   = {};
let searchQuery   = "";
let selectedStatus = "ALL";
let lastFetchOk   = false;

// ── Status config ────────────────────────────────
const STATUS_CFG = {
  PLACED:            { label: "Placed",          cls: "placed",          color: "#64748b" },
  CONFIRMED:         { label: "Confirmed",        cls: "confirmed",       color: "#3b82f6" },
  PREPARING:         { label: "Preparing",        cls: "preparing",       color: "#f59e0b" },
  OUT_FOR_DELIVERY:  { label: "Out for delivery", cls: "out_for_delivery",color: "#ec4899" },
  DELIVERED:         { label: "Delivered",        cls: "delivered",       color: "#10b981" },
};

const STATUS_ORDER = ["PLACED","CONFIRMED","PREPARING","OUT_FOR_DELIVERY","DELIVERED"];

// ── Chart initialisation ─────────────────────────
function initCharts() {
  const GRID  = "rgba(255,255,255,0.05)";
  const TICKS = { color: "#4a5068", font: { family: "'Inter', sans-serif", size: 11 } };

  // Status doughnut
  statusChart = new Chart(
    document.getElementById("statusChart").getContext("2d"), {
      type: "doughnut",
      data: {
        labels: STATUS_ORDER.map(s => STATUS_CFG[s].label),
        datasets: [{
          data: [0,0,0,0,0],
          backgroundColor: STATUS_ORDER.map(s => STATUS_CFG[s].color + "33"),
          borderColor:     STATUS_ORDER.map(s => STATUS_CFG[s].color),
          borderWidth: 1.5,
          hoverOffset: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => `  ${ctx.label}: ${ctx.parsed}` }
        }}
      }
    }
  );

  // Build legend
  const legend = document.getElementById("status-legend");
  legend.innerHTML = STATUS_ORDER.map(s =>
    `<span class="leg"><span class="leg-sq" style="background:${STATUS_CFG[s].color}"></span>${STATUS_CFG[s].label}</span>`
  ).join("");

  // Top restaurants bar
  restaurantChart = new Chart(
    document.getElementById("restaurantChart").getContext("2d"), {
      type: "bar",
      data: { labels: [], datasets: [{ data: [], backgroundColor: "#6366f133", borderColor: "#6366f1", borderWidth: 1.5, borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: GRID }, ticks: TICKS },
          y: { grid: { color: GRID }, ticks: { ...TICKS, stepSize: 1 }, beginAtZero: true }
        }
      }
    }
  );

  // Volume line
  volumeChart = new Chart(
    document.getElementById("volumeChart").getContext("2d"), {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          data: [],
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.08)",
          fill: true, tension: 0.4, borderWidth: 1.5,
          pointRadius: 3, pointBackgroundColor: "#6366f1",
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: TICKS },
          y: { grid: { color: GRID }, ticks: { ...TICKS, stepSize: 1 }, beginAtZero: true }
        }
      }
    }
  );
}

// ── Chart updates ────────────────────────────────
function updateCharts(analytics) {
  if (!analytics) return;

  // Status doughnut
  const sd = analytics.status_distribution || {};
  statusChart.data.datasets[0].data = STATUS_ORDER.map(s => sd[s] || 0);
  statusChart.update("none");

  // Restaurants bar
  const top = analytics.top_restaurants || [];
  restaurantChart.data.labels = top.map(r => r.name);
  restaurantChart.data.datasets[0].data = top.map(r => r.orders);
  restaurantChart.update("none");

  // Volume line
  const vt = analytics.volume_trend || [];
  volumeChart.data.labels = vt.map(v => v.time);
  volumeChart.data.datasets[0].data = vt.map(v => v.orders);
  volumeChart.update("none");
}

// ── KPI updates ──────────────────────────────────
function updateKPIs(kpis) {
  if (!kpis) return;
  document.getElementById("val-total-orders").textContent    = kpis.total_orders     ?? "—";
  document.getElementById("val-active-orders").textContent   = kpis.active_orders    ?? "—";
  document.getElementById("val-delivered-orders").textContent= kpis.delivered_orders ?? "—";
  document.getElementById("val-avg-speed").textContent       = kpis.avg_delivery_time != null ? `${Math.round(kpis.avg_delivery_time)}s` : "—";
  document.getElementById("val-restaurants").textContent     = kpis.unique_restaurants ?? "—";
}

// ── Table rendering ──────────────────────────────
function renderOrdersTable() {
  const tbody   = document.getElementById("tableBody");
  const empty   = document.getElementById("noDataMessage");
  const ids     = Object.keys(ordersCache).sort((a, b) => b.localeCompare(a));

  let html = "";
  let shown = 0;

  ids.forEach(id => {
    const o = ordersCache[id];
    const matchSearch =
      o.customer.toLowerCase().includes(searchQuery)    ||
      o.restaurant.toLowerCase().includes(searchQuery)  ||
      o.item.toLowerCase().includes(searchQuery)        ||
      id.toLowerCase().includes(searchQuery);
    const matchStatus = selectedStatus === "ALL" || o.status === selectedStatus;

    if (!matchSearch || !matchStatus) return;

    shown++;
    const cfg  = STATUS_CFG[o.status] || STATUS_CFG.PLACED;
    const disp = cfg.label;

    let time = o.timestamp;
    try {
      const d = new Date(o.timestamp);
      time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch (_) {}

    const rowCls = (o.isNew || o.isUpdated) ? " class=\"new-row\"" : "";
    o.isNew = false;
    o.isUpdated = false;

    html += `<tr${rowCls}>
      <td class="order-id">${id}</td>
      <td>${o.customer}</td>
      <td>${o.restaurant}</td>
      <td>${o.item}</td>
      <td><span class="badge ${cfg.cls}"><span class="badge-dot"></span>${disp}</span></td>
      <td style="color:var(--txt-2);font-size:11px">${time}</td>
    </tr>`;
  });

  tbody.innerHTML = html;
  empty.style.display = shown === 0 ? "flex" : "none";
}

// ── Orders cache update ──────────────────────────
function updateOrdersCache(newOrders) {
  let changed = false;
  for (const id in newOrders) {
    const n = newOrders[id];
    const c = ordersCache[id];
    if (!c) {
      ordersCache[id] = { ...n, isNew: true, isUpdated: false };
      changed = true;
    } else if (c.status !== n.status) {
      ordersCache[id] = { ...n, isNew: false, isUpdated: true };
      changed = true;
    }
  }
  if (changed) renderOrdersTable();
}

// ── Connection status ────────────────────────────
function setConnectionStatus(ok) {
  if (ok === lastFetchOk) return;
  lastFetchOk = ok;
  const dot   = document.getElementById("k-dot");
  const label = document.getElementById("k-label");
  if (ok) {
    dot.className   = "k-dot connected";
    label.textContent = "Kafka connected";
  } else {
    dot.className   = "k-dot error";
    label.textContent = "Connection error";
  }
}

// ── API polling ──────────────────────────────────
async function fetchState() {
  try {
    const res = await fetch("http://localhost:5005/state");
    if (!res.ok) throw new Error();
    const data = await res.json();
    updateOrdersCache(data);
    setConnectionStatus(true);
  } catch {
    setConnectionStatus(false);
    console.warn("Failed to fetch /state");
  }
}

async function fetchAnalytics() {
  try {
    const res = await fetch("http://localhost:5005/api/analytics");
    if (!res.ok) throw new Error();
    const data = await res.json();
    updateKPIs(data.kpis);
    updateCharts(data);
  } catch {
    console.warn("Failed to fetch /api/analytics");
  }
}

// ── Refresh button ───────────────────────────────
function initRefreshBtn() {
  const btn = document.getElementById("refresh-btn");
  btn.addEventListener("click", () => {
    btn.classList.add("spinning");
    Promise.all([fetchState(), fetchAnalytics()]).finally(() => {
      setTimeout(() => btn.classList.remove("spinning"), 520);
    });
  });
}

// ── Listeners ────────────────────────────────────
function initListeners() {
  document.getElementById("searchInput").addEventListener("input", e => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderOrdersTable();
  });
  document.getElementById("statusFilter").addEventListener("change", e => {
    selectedStatus = e.target.value;
    renderOrdersTable();
  });
}

// ── Boot ─────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  initCharts();
  initListeners();
  initRefreshBtn();

  fetchState();
  fetchAnalytics();

  setInterval(fetchState,     3000);
  setInterval(fetchAnalytics, 3000);
=======
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
>>>>>>> 2bb697068f62c2d18158412a162786c315dc916b
});
