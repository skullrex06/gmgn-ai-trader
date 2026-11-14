# GMGN AI Trader — Cloudflare API (Phase 3)

This backend is **paper-trading only**. It does not connect to GMGN, sign transactions, hold keys, or submit live swaps.

## 1. Create the D1 database

In Cloudflare Dashboard:
1. Open **Workers & Pages → D1 SQL Database**.
2. Create a database named `gmgn-ai-trader-db`.
3. Copy its database ID into `worker/wrangler.jsonc`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

## 2. Create the Worker

1. Open **Workers & Pages → Create → Worker**.
2. Name it `gmgn-ai-trader-api`.
3. Deploy a starter Worker, then open its editor.
4. For this repository-based setup, connect the GitHub repository if your Cloudflare account offers Workers Builds, and set the root directory to `worker`. Otherwise deploy the contents of this folder with Wrangler from a local development environment.
5. Set the D1 binding:
   - Variable name: `DB`
   - Select database: `gmgn-ai-trader-db`

## 3. Initialize the database

Run the SQL in `schema.sql` using the D1 Console. It creates settings, wallet watchlist, paper positions, and paper trade history.

## 4. Protect the API

Create a long random API token (at least 32 random bytes). Add it as a **Worker secret** named `API_ACCESS_TOKEN` in Settings → Variables and Secrets. Never put this token in GitHub or in public JavaScript.

The health endpoint is public. All other API routes require:
`Authorization: Bearer YOUR_API_ACCESS_TOKEN`

Because the dashboard is a public static site, the next frontend phase will add a user-entered session-only API token field. Do not hard-code the token in `app.js`.

## 5. Deploy and test

After deployment, open:

`https://YOUR-WORKER-SUBDOMAIN.workers.dev/api/health`

Expected response includes:
`{"ok":true,"service":"gmgn-ai-trader-api","mode":"paper-only"}`

Authenticated API routes:
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/wallets`
- `POST /api/wallets` — JSON: `{"address":"...","label":"..."}`
- `DELETE /api/wallets/:id`
- `GET /api/paper/positions`
- `GET /api/paper/trades?limit=50`
- `POST /api/paper/buy` — JSON: `{"token_symbol":"DEMO","token_address":"demo-address","amount_sol":0.01,"price_sol":0.0001}`
- `POST /api/paper/sell/:id` — JSON: `{"price_sol":0.00012}`

## Security notes

- CORS currently allows only `https://skullrex06.github.io`. Update the origin in `index.js` only if the dashboard domain changes.
- CORS is not authentication. Keep `API_ACCESS_TOKEN` secret.
- Paper prices and fills are supplied by the caller and are simulations, not market quotes.
- No live trading, wallet signing, seed phrase, private key, or GMGN private endpoint is implemented.
