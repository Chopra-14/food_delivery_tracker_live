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
});
