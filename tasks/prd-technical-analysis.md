# PRD: Technical Analysis Indicators and Patterns

## Introduction
A technical analysis engine that calculates popular trading indicators (RSI, MACD, Moving Averages) and detects chart patterns. Provides actionable trading signals with configurable parameters and backtesting capabilities to validate indicator effectiveness.

## Goals
- Calculate 20+ technical indicators with configurable parameters
- Detect common chart patterns (support/resistance, triangles, head & shoulders)
- Generate actionable buy/sell signals based on indicator combinations
- Allow backtesting of indicator-based strategies
- Provide indicator screener to find assets meeting specific criteria

## User Stories

### US-001: Calculate RSI Indicator
**Description:** As a trader, I want to calculate RSI for any asset so that I can identify overbought and oversold conditions.

**Acceptance Criteria:**
- [ ] RSI calculation with configurable period (default 14)
- [ ] Return RSI value and overbought/oversold classification
- [ ] Support multiple timeframes
- [ ] API endpoint returns JSON with RSI data points
- [ ] Typecheck passes

### US-002: Calculate MACD Indicator
**Description:** As a trader, I want to calculate MACD so that I can identify momentum shifts and trend changes.

**Acceptance Criteria:**
- [ ] MACD line, signal line, and histogram calculation
- [ ] Configurable fast, slow, and signal periods
- [ ] Detect and return MACD crossover events
- [ ] API endpoint returns full MACD dataset
- [ ] Typecheck passes

### US-003: Moving Averages Suite
**Description:** As a trader, I want to calculate various moving averages so that I can analyze trends with my preferred method.

**Acceptance Criteria:**
- [ ] Support SMA, EMA, WMA, VWAP calculations
- [ ] Configurable periods for each MA type
- [ ] Calculate multiple MAs simultaneously
- [ ] Detect MA crossovers (golden cross, death cross)
- [ ] Typecheck passes

### US-004: Bollinger Bands
**Description:** As a trader, I want to calculate Bollinger Bands so that I can identify volatility and price extremes.

**Acceptance Criteria:**
- [ ] Calculate upper band, lower band, and middle band (SMA)
- [ ] Configurable period and standard deviation multiplier
- [ ] Return %B (position within bands) and bandwidth
- [ ] Identify squeeze and expansion conditions
- [ ] Typecheck passes

### US-005: Support and Resistance Detection
**Description:** As a trader, I want automatic detection of support and resistance levels so that I can identify key price zones.

**Acceptance Criteria:**
- [ ] Detect horizontal support/resistance from price pivots
- [ ] Configurable lookback period and touch count threshold
- [ ] Return levels with strength score based on touches
- [ ] Identify broken levels that may flip (support becomes resistance)
- [ ] Typecheck passes

### US-006: Chart Pattern Recognition
**Description:** As a trader, I want automatic detection of chart patterns so that I can spot trading opportunities.

**Acceptance Criteria:**
- [ ] Detect patterns: Double Top/Bottom, Head & Shoulders, Triangles, Flags
- [ ] Return pattern type, confidence score, and price target
- [ ] Pattern detection on multiple timeframes
- [ ] Alert when new pattern completes
- [ ] Typecheck passes

### US-007: Composite Signal Generation
**Description:** As a trader, I want combined signals from multiple indicators so that I can make more confident trading decisions.

**Acceptance Criteria:**
- [ ] Define signal rules combining multiple indicators
- [ ] Example: "RSI < 30 AND MACD bullish crossover = BUY"
- [ ] Signal strength scoring (weak, moderate, strong)
- [ ] API to query current signals for any asset
- [ ] Typecheck passes

### US-008: Indicator Screener
**Description:** As a trader, I want to screen assets by indicator values so that I can find trading opportunities quickly.

**Acceptance Criteria:**
- [ ] Screen by: RSI range, MACD status, MA alignment, price vs BB
- [ ] Multi-criteria filtering with AND/OR logic
- [ ] Sort results by indicator value or signal strength
- [ ] Save and reuse screen configurations
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Indicator Backtesting
**Description:** As a trader, I want to backtest indicator signals so that I can validate their effectiveness.

**Acceptance Criteria:**
- [ ] Define entry/exit rules based on indicator conditions
- [ ] Run backtest on historical data
- [ ] Calculate performance metrics: win rate, profit factor, max drawdown
- [ ] Visualize equity curve and trade history
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Trend Indicators: SMA, EMA, WMA, VWAP, Ichimoku Cloud, Parabolic SAR
- FR-2: Momentum Indicators: RSI, MACD, Stochastic, CCI, Williams %R, Momentum
- FR-3: Volatility Indicators: Bollinger Bands, ATR, Keltner Channels, Donchian Channels
- FR-4: Volume Indicators: OBV, Volume Profile, VWAP, Chaikin Money Flow
- FR-5: Pattern Detection: Double Top/Bottom, Head & Shoulders, Triangles (ascending, descending, symmetrical), Flags, Pennants, Wedges
- FR-6: Support/Resistance: Pivot-based detection with touch counting
- FR-7: Signal Generation: Configurable rule engine for composite signals
- FR-8: Screener: Multi-asset scanning with indicator filters
- FR-9: Backtesting: Historical performance simulation with metrics
- FR-10: API Rate Limits: Cache indicator calculations for 1 minute minimum

## Non-Goals

- No AI/ML-based prediction models
- No fundamental analysis data (P/E, earnings, etc.)
- No sentiment analysis from social media
- No automated trading execution (handled by trading-automation skill)
- No real-time news impact analysis

## Technical Considerations

- **Calculation Engine:** 
  - Python with pandas-ta or TA-Lib for indicator calculations
  - Node.js wrapper for API endpoints
- **Data Requirements:** 
  - OHLCV data from Binance API
  - Minimum 500 bars for reliable indicator calculation
- **Performance:** 
  - Cache indicator results for 60 seconds
  - Pre-calculate common indicators in background
  - Use vectorized operations for batch calculations
- **Storage:** 
  - Store indicator configurations in PostgreSQL
  - Cache recent calculations in Redis
- **API Design:** 
  - REST endpoints for single-asset queries
  - WebSocket stream for real-time updates

## Success Metrics

- Indicator calculation latency < 100ms for 1000 bars
- Pattern detection accuracy > 70% (measured against manual identification)
- Screener can scan 1000 assets in < 5 seconds
- Backtest results match expected theoretical calculations
- User retention: 60%+ of users run indicators weekly

## Open Questions

- Should we support custom indicator formulas via DSL or JavaScript?
- Do we need integration with external TA libraries like TradingView Pine?
- Should pattern detection use machine learning for improved accuracy?
- Do we need real-time divergence detection between price and indicators?
