# PRD: Portfolio Tracking and P&L Analysis

## Introduction
A comprehensive portfolio management system that aggregates positions across multiple exchanges, calculates real-time P&L, tracks allocation, and provides performance analytics. Traders can monitor their complete holdings, analyze returns, and optimize portfolio composition.

## Goals
- Aggregate positions across multiple exchanges and wallets
- Calculate real-time and historical P&L with multiple accounting methods
- Visualize portfolio allocation and performance over time
- Track cost basis and realized/unrealized gains
- Provide tax reporting exports

## User Stories

### US-001: Connect Exchange Accounts
**Description:** As a trader, I want to connect my exchange accounts via API so that my portfolio syncs automatically.

**Acceptance Criteria:**
- [ ] Support API connections for: Binance, Coinbase, Kraken, Bybit
- [ ] Secure API key storage with encryption
- [ ] Read-only API key requirement enforcement
- [ ] Auto-sync balances and positions every 5 minutes
- [ ] Manual sync trigger button
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-002: Manual Position Entry
**Description:** As a trader, I want to manually add positions so that I can track assets not on connected exchanges.

**Acceptance Criteria:**
- [ ] Form to add manual position: asset, quantity, cost basis, date
- [ ] Support for multiple cost basis entries (DCA tracking)
- [ ] Edit and delete manual positions
- [ ] Distinguish manual vs. API-synced positions in UI
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Portfolio Dashboard Overview
**Description:** As a trader, I want a dashboard showing my complete portfolio so that I can see my holdings at a glance.

**Acceptance Criteria:**
- [ ] Total portfolio value in base currency (USD)
- [ ] 24h change amount and percentage
- [ ] Asset breakdown with quantities and values
- [ ] Visual allocation chart (pie/donut)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: P&L Calculation
**Description:** As a trader, I want accurate P&L calculations so that I know my trading performance.

**Acceptance Criteria:**
- [ ] Realized P&L from closed trades
- [ ] Unrealized P&L from open positions
- [ ] Total return percentage since inception
- [ ] Daily/weekly/monthly P&L breakdown
- [ ] Typecheck passes

### US-005: Cost Basis Tracking
**Description:** As a trader, I want to track my cost basis so that I understand my true returns.

**Acceptance Criteria:**
- [ ] Support FIFO, LIFO, and average cost methods
- [ ] Per-asset cost basis display
- [ ] Cost basis adjustment for deposits/withdrawals
- [ ] Export cost basis report
- [ ] Typecheck passes

### US-006: Performance Charts
**Description:** As a trader, I want to visualize my portfolio performance over time so that I can analyze trends.

**Acceptance Criteria:**
- [ ] Portfolio value chart (line graph over time)
- [ ] P&L chart showing cumulative returns
- [ ] Drawdown visualization
- [ ] Comparison to benchmark (e.g., BTC, S&P 500)
- [ ] Custom date range selection
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Asset Allocation Analysis
**Description:** As a trader, I want to analyze my asset allocation so that I can maintain diversification.

**Acceptance Criteria:**
- [ ] Allocation by asset, sector, and exchange
- [ ] Drift detection when allocation moves from target
- [ ] Rebalancing suggestions
- [ ] Target allocation setting with alerts
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Transaction History
**Description:** As a trader, I want to view my complete transaction history so that I can audit my trades.

**Acceptance Criteria:**
- [ ] List all trades, deposits, withdrawals
- [ ] Filter by date range, asset, type, exchange
- [ ] Export to CSV/Excel
- [ ] Pagination for large histories
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Tax Reporting Export
**Description:** As a trader, I want tax reports so that I can file my taxes accurately.

**Acceptance Criteria:**
- [ ] Generate 8949-style report (US) with cost basis and proceeds
- [ ] Support for tax year selection
- [ ] Export formats: CSV, PDF, TurboTax TXF
- [ ] Include all realized gains/losses
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Exchange Integrations: Binance (Spot + Futures), Coinbase, Kraken, Bybit, OKX
- FR-2: Wallet Support: Manual entry for hardware/software wallet addresses
- FR-3: Sync Frequency: Auto-sync every 5 minutes, manual sync on demand
- FR-4: P&L Methods: FIFO, LIFO, Average Cost, HIFO (highest in first out)
- FR-5: Base Currencies: USD, EUR, GBP, BTC, ETH
- FR-6: Performance Metrics: Total Return, CAGR, Sharpe Ratio, Max Drawdown, Win Rate
- FR-7: Allocation Views: By asset, by exchange, by sector/category
- FR-8: Transaction Types: Buy, Sell, Deposit, Withdrawal, Transfer, Fee, Dividend/Airdrop
- FR-9: Data Retention: Full transaction history, no automatic deletion
- FR-10: Export Formats: CSV, Excel, PDF, TXF (TurboTax)

## Non-Goals

- No wallet address auto-discovery (privacy/security concerns)
- No NFT portfolio tracking (separate feature)
- No DeFi position tracking (LP tokens, yield farming) - Phase 2
- No automated trading based on portfolio rules
- No social/portfolio sharing features
- No margin/funding interest calculations (basic version)

## Technical Considerations

- **API Security:** 
  - Encrypt API keys with AES-256
  - Never store keys in plain text or logs
  - IP whitelisting recommended for user API keys
- **Data Aggregation:** 
  - Normalize data from different exchange APIs
  - Handle rate limiting with exponential backoff
  - Queue sync jobs to prevent overwhelming exchanges
- **Database:** 
  - PostgreSQL for transaction and position storage
  - Time-series optimization for historical data
- **Price Feeds:** 
  - CoinGecko/CoinMarketCap for prices of assets not on connected exchanges
  - WebSocket for real-time price updates
- **Performance:** 
  - Calculate P&L incrementally, not full recalculation
  - Cache portfolio snapshots hourly
- **Compliance:** 
  - Support multiple cost basis methods per jurisdiction
  - Clear disclaimers about tax advice

## Success Metrics

- Portfolio sync completes in < 30 seconds for accounts with < 1000 transactions
- P&L calculations match exchange statements within 0.01%
- Dashboard loads in < 2 seconds
- 95%+ of users successfully connect at least one exchange
- Tax report export used by 40%+ of users annually

## Open Questions

- Should we support DeFi protocol integrations (Uniswap, Aave, etc.)?
- Do we need multi-user/team portfolio tracking for trading firms?
- Should we integrate with tax software APIs (CoinTracker, Koinly)?
- Do we need margin trading P&L with funding cost calculations?
