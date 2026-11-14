const corsHeaders = {
  "Access-Control-Allow-Origin": "https://skullrex06.github.io",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json; charset=utf-8"
};

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function error(message, status = 400) {
  return response({ ok: false, error: message }, status);
}

function authorized(request, env) {
  const expected = env.API_ACCESS_TOKEN;
  if (!expected) return false;
  return request.headers.get("Authorization") === `Bearer ${expected}`;
}

function validText(value, max = 120) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

async function parseBody(request) {
  try { return await request.json(); } catch { return null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    if (url.pathname === "/api/health" && request.method === "GET") {
      return response({ ok: true, service: "gmgn-ai-trader-api", mode: "paper-only", timestamp: new Date().toISOString() });
    }

    if (!authorized(request, env)) return error("Unauthorized. Configure and provide API_ACCESS_TOKEN.", 401);
    if (!env.DB) return error("D1 database binding DB is missing.", 503);

    try {
      if (url.pathname === "/api/settings" && request.method === "GET") {
        const row = await env.DB.prepare("SELECT * FROM bot_settings WHERE id = 1").first();
        return response({ ok: true, settings: row || {} });
      }

      if (url.pathname === "/api/settings" && request.method === "PUT") {
        const body = await parseBody(request);
        if (!body || typeof body !== "object") return error("Invalid JSON body.");
        const maxPosition = Number(body.max_position_sol);
        const dailyLoss = Number(body.daily_loss_limit_sol);
        const stopLoss = Number(body.stop_loss_percent);
        const takeProfit = Number(body.take_profit_percent);
        if (![maxPosition, dailyLoss, stopLoss, takeProfit].every(Number.isFinite) ||
            maxPosition <= 0 || dailyLoss <= 0 || stopLoss <= 0 || takeProfit <= 0 ||
            maxPosition > 100 || dailyLoss > 100 || stopLoss > 100 || takeProfit > 1000) {
          return error("Settings values are outside the allowed range.");
        }
        await env.DB.prepare(`UPDATE bot_settings SET max_position_sol = ?, daily_loss_limit_sol = ?,
          stop_loss_percent = ?, take_profit_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`)
          .bind(maxPosition, dailyLoss, stopLoss, takeProfit).run();
        return response({ ok: true });
      }

      if (url.pathname === "/api/wallets" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM wallet_watchlist ORDER BY created_at DESC").all();
        return response({ ok: true, wallets: results });
      }

      if (url.pathname === "/api/wallets" && request.method === "POST") {
        const body = await parseBody(request);
        if (!body || !validText(body.address, 64)) return error("A valid wallet address is required.");
        const label = validText(body.label, 60) ? body.label.trim() : "Tracked wallet";
        try {
          const result = await env.DB.prepare("INSERT INTO wallet_watchlist (address, label) VALUES (?, ?)")
            .bind(body.address.trim(), label).run();
          return response({ ok: true, id: result.meta.last_row_id }, 201);
        } catch (e) {
          if (String(e).includes("UNIQUE")) return error("Wallet already exists.", 409);
          throw e;
        }
      }

      const walletDelete = url.pathname.match(/^\/api\/wallets\/(\d+)$/);
      if (walletDelete && request.method === "DELETE") {
        await env.DB.prepare("DELETE FROM wallet_watchlist WHERE id = ?").bind(Number(walletDelete[1])).run();
        return response({ ok: true });
      }

      if (url.pathname === "/api/paper/positions" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM paper_positions WHERE status = 'OPEN' ORDER BY opened_at DESC").all();
        return response({ ok: true, positions: results });
      }

      if (url.pathname === "/api/paper/trades" && request.method === "GET") {
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
        const { results } = await env.DB.prepare("SELECT * FROM paper_trades ORDER BY created_at DESC LIMIT ?").bind(limit).all();
        return response({ ok: true, trades: results });
      }

      if (url.pathname === "/api/paper/buy" && request.method === "POST") {
        const body = await parseBody(request);
        const symbol = body && validText(body.token_symbol, 20) ? body.token_symbol.trim().toUpperCase() : null;
        const address = body && validText(body.token_address, 64) ? body.token_address.trim() : null;
        const amount = Number(body && body.amount_sol);
        const price = Number(body && body.price_sol);
        if (!symbol || !address || !Number.isFinite(amount) || !Number.isFinite(price) || amount <= 0 || price <= 0) {
          return error("Provide token_symbol, token_address, positive amount_sol and price_sol.");
        }
        const settings = await env.DB.prepare("SELECT max_position_sol FROM bot_settings WHERE id = 1").first();
        if (amount > Number(settings?.max_position_sol || 0.1)) return error("Amount exceeds max position limit.", 422);
        const tokenAmount = amount / price;
        const result = await env.DB.prepare(`INSERT INTO paper_positions
          (token_symbol, token_address, entry_price_sol, token_amount, invested_sol, status)
          VALUES (?, ?, ?, ?, ?, 'OPEN')`)
          .bind(symbol, address, price, tokenAmount, amount).run();
        await env.DB.prepare(`INSERT INTO paper_trades
          (position_id, side, token_symbol, token_address, price_sol, token_amount, amount_sol, note)
          VALUES (?, 'BUY', ?, ?, ?, ?, ?, 'Paper buy')`)
          .bind(result.meta.last_row_id, symbol, address, price, tokenAmount, amount).run();
        return response({ ok: true, position_id: result.meta.last_row_id, token_amount: tokenAmount }, 201);
      }

      const sellMatch = url.pathname.match(/^\/api\/paper\/sell\/(\d+)$/);
      if (sellMatch && request.method === "POST") {
        const body = await parseBody(request);
        const price = Number(body && body.price_sol);
        if (!Number.isFinite(price) || price <= 0) return error("A positive price_sol is required.");
        const id = Number(sellMatch[1]);
        const position = await env.DB.prepare("SELECT * FROM paper_positions WHERE id = ? AND status = 'OPEN'").bind(id).first();
        if (!position) return error("Open paper position not found.", 404);
        const proceeds = Number(position.token_amount) * price;
        const pnl = proceeds - Number(position.invested_sol);
        await env.DB.batch([
          env.DB.prepare("UPDATE paper_positions SET status = 'CLOSED', exit_price_sol = ?, proceeds_sol = ?, pnl_sol = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(price, proceeds, pnl, id),
          env.DB.prepare(`INSERT INTO paper_trades
            (position_id, side, token_symbol, token_address, price_sol, token_amount, amount_sol, note)
            VALUES (?, 'SELL', ?, ?, ?, ?, ?, 'Paper sell')`)
            .bind(id, position.token_symbol, position.token_address, price, position.token_amount, proceeds)
        ]);
        return response({ ok: true, proceeds_sol: proceeds, pnl_sol: pnl });
      }

      return error("Route not found.", 404);
    } catch (e) {
      return error("Server error: " + (env.ENVIRONMENT === "development" ? String(e) : "request could not be completed"), 500);
    }
  }
};
