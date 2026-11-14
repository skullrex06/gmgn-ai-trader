// Phase 4: live dashboard-to-Worker integration. Paper trading only.
const API_BASE = "https://gmgn-ai-trader.umayaris06.workers.dev";
const TOKEN_KEY = "gmgn_api_token_session";
const $ = (id) => document.getElementById(id);
const toast = $("toast");
let toastTimer;
let apiToken = sessionStorage.getItem(TOKEN_KEY) || "";

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
async function api(path, options = {}) {
  if (!apiToken) throw new Error("API token belum dimasukkan. Tekan Connect API.");
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiToken,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || "API request failed (" + response.status + ")");
  return data;
}

const connectBtn = $("apiConnectBtn");
if (connectBtn) connectBtn.textContent = apiToken ? "API Connected?" : "Connect API";

const smartPanel = $("smart-money");
const walletEmpty = smartPanel?.querySelector(".empty-state");
if (walletEmpty) walletEmpty.id = "walletList";
const walletButton = $("watchWalletBtn");
if (walletButton) walletButton.textContent = "＋ Add wallet";

const positionsPanel = $("positions");
const positionsEmpty = positionsPanel?.querySelector(".empty-state");
if (positionsEmpty) positionsEmpty.id = "positionsList";
const historyPanel = $("history");
const historyEmpty = historyPanel?.querySelector(".empty-state");
if (historyEmpty) historyEmpty.id = "historyList";

// Turn the risk preview into editable, API-backed controls.
const riskInputs = [...document.querySelectorAll("#risk .risk-grid input")];
riskInputs.forEach(input => input.disabled = false);
const riskSave = document.createElement("button");
riskSave.className = "primary-btn risk-save";
riskSave.textContent = "Save risk settings";
$("risk")?.append(riskSave);

function setApiStatus(connected, label) {
  connectBtn.textContent = connected ? "API Connected" : "Connect API";
  connectBtn.classList.toggle("connected", connected);
  const pill = document.querySelector(".mode-pill");
  if (pill) pill.textContent = connected ? "● PAPER MODE · API ONLINE" : "● PAPER TRADING";
  if (label) showToast(label);
}

// Use an in-page dialog instead of prompt(), which some mobile browsers suppress.
window.openApiDialog = function openApiDialog() {
  let modal = $("apiConnectModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "apiConnectModal";
    modal.className = "api-modal";
    modal.innerHTML = `
      <div class="api-modal-card" role="dialog" aria-modal="true" aria-labelledby="apiModalTitle">
        <button type="button" class="api-modal-close" id="apiModalClose" aria-label="Close">×</button>
        <div class="eyebrow">SECURE CONNECTION</div>
        <h3 id="apiModalTitle">Connect Cloudflare API</h3>
        <p>Masukkan nilai rahsia <b>API_ACCESS_TOKEN</b> yang ditetapkan dalam Cloudflare Worker → Settings → Variables and Secrets.</p>
        <input id="apiTokenInput" type="password" autocomplete="off" placeholder="Paste API_ACCESS_TOKEN">
        <label class="api-remember"><input id="apiRemember" type="checkbox"> Remember in this tab session</label>
        <div id="apiConnectError" class="api-connect-error" role="status"></div>
        <button type="button" id="apiConnectSubmit" class="primary-btn">Verify & Connect</button>
      </div>`;
    document.body.append(modal);
    $("apiModalClose").addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });
    $("apiConnectSubmit").addEventListener("click", async () => {
      const entered = $("apiTokenInput").value.trim();
      const errorBox = $("apiConnectError");
      if (!entered) { errorBox.textContent = "Token belum dimasukkan."; return; }
      const submit = $("apiConnectSubmit");
      submit.disabled = true; submit.textContent = "Checking...";
      errorBox.textContent = "";
      const previous = apiToken;
      apiToken = entered;
      try {
        // A successful protected settings read verifies token + D1 binding.
        await api("/api/settings");
        if ($("apiRemember").checked) sessionStorage.setItem(TOKEN_KEY, entered);
        else sessionStorage.removeItem(TOKEN_KEY);
        modal.classList.remove("open");
        setApiStatus(true, "Connected to Worker and D1.");
        await loadDashboard();
      } catch (e) {
        apiToken = previous;
        errorBox.textContent = e.message + " — Semak API_ACCESS_TOKEN dan D1 binding DB.";
      } finally {
        submit.disabled = false; submit.textContent = "Verify & Connect";
      }
    });
  }
  $("apiTokenInput").value = "";
  $("apiConnectError").textContent = "";
  modal.classList.add("open");
  setTimeout(() => $("apiTokenInput").focus(), 80);
}
connectBtn?.addEventListener("click", openApiDialog);

// Read-only API/D1 diagnostics: confirms all core tables and read routes respond.
const apiTestBtn = $("apiTestBtn");
apiTestBtn?.addEventListener("click", async () => {
  if (!apiToken) { showToast("Connect API dahulu."); return; }
  apiTestBtn.disabled = true;
  const original = apiTestBtn.textContent;
  apiTestBtn.textContent = "Testing...";
  const checks = [
    ["Settings / bot_settings", "/api/settings", "settings"],
    ["Wallets / wallet_watchlist", "/api/wallets", "wallets"],
    ["Positions / paper_positions", "/api/paper/positions", "positions"],
    ["Trades / paper_trades", "/api/paper/trades?limit=5", "trades"]
  ];
  const results = [];
  try {
    for (const [label, path, key] of checks) {
      try {
        const data = await api(path);
        if (!(key in data)) throw new Error("Response field missing: " + key);
        results.push("✓ " + label);
      } catch (e) { results.push("✗ " + label + ": " + e.message); }
    }
    const passed = results.filter(x => x.startsWith("✓")).length;
    showToast("D1 diagnostics: " + passed + "/4 passed. See API Test results.");
    let box = $("apiTestResults");
    if (!box) {
      box = document.createElement("pre");
      box.id = "apiTestResults";
      box.style.cssText = "white-space:pre-wrap;font:11px/1.7 monospace;color:#b9c7dc;background:#0b1424;border:1px solid #263650;border-radius:10px;padding:12px;margin:12px 0";
      document.querySelector(".topbar")?.after(box);
    }
    box.textContent = "API / D1 DIAGNOSTICS — " + passed + "/4 passed\\n" + results.join("\\n");
  } finally {
    apiTestBtn.disabled = false;
    apiTestBtn.textContent = original;
  }
});

async function loadWallets() {
  const data = await api("/api/wallets");
  const box = $("walletList");
  if (!box) return;
  if (!data.wallets?.length) {
    box.className = "empty-state";
    box.innerHTML = '<div class="empty-icon">⌁</div><b>No wallets added</b><p>Add a public wallet address to your private watchlist.</p>';
    return;
  }
  box.className = "api-list";
  box.innerHTML = data.wallets.map(w => `
    <div class="api-row"><div><b>${escapeHtml(w.label)}</b><small>${escapeHtml(w.address)}</small></div>
    <button class="danger-btn" data-delete-wallet="${Number(w.id)}" aria-label="Remove wallet">×</button></div>`).join("");
}
async function loadPositions() {
  const data = await api("/api/paper/positions");
  const box = $("positionsList");
  if (!box) return;
  $("positionsCount").textContent = data.positions.length;
  if (!data.positions.length) {
    box.className = "empty-state compact";
    box.innerHTML = '<div class="empty-icon">▤</div><b>No simulated positions</b><p>Use Paper Buy to create a practice position.</p>';
    return;
  }
  box.className = "api-list";
  box.innerHTML = data.positions.map(p => `
    <div class="api-row position-row"><div><b>${escapeHtml(p.token_symbol)}</b><small>Entry ${Number(p.entry_price_sol).toPrecision(5)} SOL · Size ${Number(p.invested_sol).toFixed(3)} SOL</small></div>
    <button class="danger-btn" data-sell-position="${Number(p.id)}">Paper Sell</button></div>`).join("");
}
async function loadTrades() {
  const data = await api("/api/paper/trades?limit=30");
  const box = $("historyList");
  if (!box) return;
  if (!data.trades.length) {
    box.className = "empty-state compact";
    box.innerHTML = '<div class="empty-icon">↗</div><b>No trade history</b><p>Paper BUY and SELL records will appear here.</p>';
    return;
  }
  box.className = "api-list";
  box.innerHTML = data.trades.map(t => `
    <div class="api-row"><div><b class="${t.side === "BUY" ? "positive" : "negative"}">${escapeHtml(t.side)} · ${escapeHtml(t.token_symbol)}</b><small>${Number(t.amount_sol).toFixed(4)} SOL · ${escapeHtml(t.created_at)}</small></div><span class="tag">${escapeHtml(t.note || "Paper")}</span></div>`).join("");
}
async function loadSettings() {
  const data = await api("/api/settings");
  const s = data.settings || {};
  const values = [s.max_position_sol ?? 0.10, s.daily_loss_limit_sol ?? 0.25, s.stop_loss_percent ?? 15, s.take_profit_percent ?? 30];
  riskInputs.forEach((input, i) => input.value = values[i]);
}
async function loadDashboard() {
  await Promise.all([loadWallets(), loadPositions(), loadTrades(), loadSettings()]);
}

walletButton?.addEventListener("click", async () => {
  const address = prompt("Public wallet address to watch:");
  if (!address) return;
  const label = prompt("Wallet label (optional):") || "Tracked wallet";
  try {
    await api("/api/wallets", { method: "POST", body: JSON.stringify({ address: address.trim(), label: label.trim() }) });
    await loadWallets();
    showToast("Wallet saved to D1 watchlist.");
  } catch (e) { showToast(e.message); }
});

riskSave.addEventListener("click", async () => {
  try {
    await api("/api/settings", { method: "PUT", body: JSON.stringify({
      max_position_sol: Number(riskInputs[0].value),
      daily_loss_limit_sol: Number(riskInputs[1].value),
      stop_loss_percent: Number(riskInputs[2].value),
      take_profit_percent: Number(riskInputs[3].value)
    })});
    showToast("Risk settings saved to D1.");
  } catch (e) { showToast(e.message); }
});

document.addEventListener("click", async event => {
  const remove = event.target.closest("[data-delete-wallet]");
  if (remove && confirm("Remove this wallet from watchlist?")) {
    try {
      await api("/api/wallets/" + remove.dataset.deleteWallet, { method: "DELETE" });
      await loadWallets(); showToast("Wallet removed.");
    } catch (e) { showToast(e.message); }
  }
  const sell = event.target.closest("[data-sell-position]");
  if (sell) {
    const price = prompt("Current simulated token price in SOL (not live price):");
    if (price === null) return;
    try {
      const result = await api("/api/paper/sell/" + sell.dataset.sellPosition, { method: "POST", body: JSON.stringify({ price_sol: Number(price) }) });
      await Promise.all([loadPositions(), loadTrades()]);
      showToast("Paper sell recorded. P&L: " + Number(result.pnl_sol).toFixed(5) + " SOL");
    } catch (e) { showToast(e.message); }
  }
});

const paperBuy = document.createElement("button");
paperBuy.className = "primary-btn paper-buy-btn";
paperBuy.textContent = "＋ Paper Buy";
$("scanner")?.querySelector(".panel-heading")?.append(paperBuy);
paperBuy.addEventListener("click", async () => {
  const symbol = prompt("Token symbol (example: DEMO):");
  if (!symbol) return;
  const address = prompt("Token mint/address (public address only):");
  if (!address) return;
  const amount = prompt("Amount in SOL (max position limit applies):", "0.05");
  if (amount === null) return;
  const price = prompt("Simulated token price in SOL:", "0.001");
  if (price === null) return;
  try {
    await api("/api/paper/buy", { method: "POST", body: JSON.stringify({
      token_symbol: symbol.trim(), token_address: address.trim(),
      amount_sol: Number(amount), price_sol: Number(price)
    })});
    await Promise.all([loadPositions(), loadTrades()]);
    showToast("Paper BUY recorded. No real transaction was sent.");
  } catch (e) { showToast(e.message); }
});

$("refreshBtn")?.addEventListener("click", async () => {
  if (!apiToken) return showToast("Connect API first to refresh backend data.");
  try { await loadDashboard(); showToast("Dashboard data refreshed from D1."); }
  catch (e) { showToast(e.message); }
});
document.querySelectorAll(".sidebar nav a").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".sidebar nav a").forEach(item => item.classList.remove("active"));
    link.classList.add("active");
  });
});

// Health is public; protected data loads only after the user enters their secret.
fetch(API_BASE + "/api/health").then(r => {
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}).then(d => {
  const badge = $("backendHealthLabel");
  if (d.ok) {
    if (badge) { badge.textContent = "● BACKEND ONLINE"; badge.classList.remove("health-checking","health-offline"); badge.classList.add("health-online"); }
    showToast("Backend online · Paper trading only.");
  } else throw new Error("Health response not OK");
}).catch(() => {
  const badge = $("backendHealthLabel");
  if (badge) { badge.textContent = "● BACKEND OFFLINE"; badge.classList.remove("health-checking","health-online"); badge.classList.add("health-offline"); }
  showToast("Backend health check unavailable.");
});
if (apiToken) loadDashboard().then(() => setApiStatus(true)).catch(() => {
  sessionStorage.removeItem(TOKEN_KEY); apiToken = ""; setApiStatus(false);
});

window.verifyApiToken = async function () {
 const input=document.getElementById("apiTokenInput");
 const error=document.getElementById("apiConnectError");
 const button=document.getElementById("apiConnectSubmit");
 const entered=input ? input.value.trim() : "";
 if(!entered){if(error)error.textContent="Masukkan API_ACCESS_TOKEN dahulu.";return;}
 const old=apiToken; apiToken=entered;
 if(button){button.disabled=true;button.textContent="Checking...";}
 if(error)error.textContent="";
 try{
   await api("/api/settings");
   if(document.getElementById("apiRemember")?.checked)sessionStorage.setItem(TOKEN_KEY,entered);
   else sessionStorage.removeItem(TOKEN_KEY);
   document.getElementById("apiConnectModal").style.display="none";
   setApiStatus(true,"Connected to Worker and D1.");
   await loadDashboard();
 }catch(e){
   apiToken=old;
   if(error)error.textContent=e.message+" — Semak token dan D1 binding DB.";
 }finally{if(button){button.disabled=false;button.textContent="Verify & Connect";}}
};
