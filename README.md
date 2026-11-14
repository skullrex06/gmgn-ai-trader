# GMGN AI Trader

A safety-first dashboard for Solana meme-token research and paper trading.

## Current status
- Phase 1: repository scaffold and dashboard shell
- Paper-trading / demo UI only
- No live swaps, wallet signing, or private-key handling is enabled

## Planned architecture
- Frontend: static HTML, CSS, JavaScript
- Backend: Cloudflare Workers
- Database: Cloudflare D1
- Market data and execution: documented, authorized GMGN/provider integrations only

## Safety
- Never commit seed phrases, private keys, API secrets, or wallet files.
- Keep secrets in Cloudflare Worker secrets, not frontend code or GitHub.
- Token filters cannot guarantee that a token is safe.
- Live trading stays disabled until API permissions, signing design, limits, and tests are reviewed.

## Preview
Enable GitHub Pages from the main branch, root folder, to preview the dashboard.
