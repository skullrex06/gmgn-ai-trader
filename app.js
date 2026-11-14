// Phase 1: demo UI only. No wallet signing or live trading.
document.getElementById("refreshBtn").addEventListener("click", () => {
  const button = document.getElementById("refreshBtn");
  button.textContent = "✓";
  window.setTimeout(() => { button.textContent = "↻"; }, 900);
});