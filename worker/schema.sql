PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bot_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  max_position_sol REAL NOT NULL DEFAULT 0.10,
  daily_loss_limit_sol REAL NOT NULL DEFAULT 0.25,
  stop_loss_percent REAL NOT NULL DEFAULT 15,
  take_profit_percent REAL NOT NULL DEFAULT 30,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO bot_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS wallet_watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'Tracked wallet',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS paper_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_symbol TEXT NOT NULL,
  token_address TEXT NOT NULL,
  entry_price_sol REAL NOT NULL,
  token_amount REAL NOT NULL,
  invested_sol REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  exit_price_sol REAL,
  proceeds_sol REAL,
  pnl_sol REAL,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS paper_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_id INTEGER,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  token_symbol TEXT NOT NULL,
  token_address TEXT NOT NULL,
  price_sol REAL NOT NULL,
  token_amount REAL NOT NULL,
  amount_sol REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (position_id) REFERENCES paper_positions(id)
);

CREATE INDEX IF NOT EXISTS idx_positions_status ON paper_positions(status);
CREATE INDEX IF NOT EXISTS idx_trades_created ON paper_trades(created_at DESC);
