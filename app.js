// Phase 2 dashboard interactions. All values remain demo-only.
const toast = document.getElementById("toast");
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
document.getElementById("refreshBtn").addEventListener("click", () => {
  const button = document.getElementById("refreshBtn");
  button.textContent = "✓";
  showToast("Preview refreshed. No live market feed is connected.");
  setTimeout(() => { button.textContent = "↻"; }, 900);
});
document.getElementById("watchWalletBtn").addEventListener("click", () => {
  showToast("Wallet watchlist will be enabled after secure data integration.");
});
document.querySelectorAll(".sidebar nav a").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".sidebar nav a").forEach(item => item.classList.remove("active"));
    link.classList.add("active");
  });
});
document.getElementById("tokenSearch").addEventListener("input", () => {
  showToast("Scanner is awaiting an authorized market-data connection.");
});
document.getElementById("riskFilter").addEventListener("change", () => {
  showToast("Risk filters will work when token data is connected.");
});