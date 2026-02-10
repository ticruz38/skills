# PRD: Forecasting

## Introduction

Enable Barry the Analyst to create simple projections and forecasts based on historical data. Provide time series forecasting with confidence intervals and scenario planning capabilities for informed decision-making.

## Goals

- Generate time-series forecasts using proven statistical methods
- Display confidence intervals to communicate uncertainty
- Support scenario planning (best case, worst case, expected)
- Visualize forecasts alongside historical data
- Export forecasts for use in external planning tools

## User Stories

### US-001: Generate Time Series Forecasts
**Description:** As Barry, I want to generate forecasts from my historical data so that I can project future values.

**Acceptance Criteria:**
- [ ] Select time-series data column
- [ ] Choose forecast horizon (days, weeks, months ahead)
- [ ] Multiple forecasting methods (moving average, exponential smoothing)
- [ ] Forecast accuracy metrics (MAE, RMSE, MAPE)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: View Confidence Intervals
**Description:** As Barry, I want to see confidence intervals on forecasts so that I understand the uncertainty range.

**Acceptance Criteria:**
- [ ] Display 80% and 95% confidence bands
- [ ] Configurable confidence levels
- [ ] Shaded area visualization on forecast charts
- [ ] Export interval bounds as data
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Scenario Planning
**Description:** As Barry, I want to create multiple forecast scenarios so that I can plan for different outcomes.

**Acceptance Criteria:**
- [ ] Create optimistic, pessimistic, and expected scenarios
- [ ] Manual adjustment of growth rates
- [ ] Scenario comparison visualization
- [ ] Save and label scenarios
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Seasonal Forecasting
**Description:** As Barry, I want forecasts that account for seasonality so that cyclical patterns are preserved.

**Acceptance Criteria:**
- [ ] Auto-detect and incorporate seasonality
- [ ] Override seasonality parameters manually
- [ ] Seasonal adjustment visualization
- [ ] Export seasonal components
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Export Forecasts
**Description:** As Barry, I want to export forecast data so that I can use it in planning documents and spreadsheets.

**Acceptance Criteria:**
- [ ] Export as CSV with point forecasts and intervals
- [ ] Export as Excel with formatting
- [ ] Include forecast metadata (method, accuracy, date generated)
- [ ] Schedule automated forecast exports
- [ ] Typecheck/lint passes

### US-006: Forecast Visualization
**Description:** As Barry, I want to visualize forecasts with historical data so that I can see trends and projections together.

**Acceptance Criteria:**
- [ ] Line chart showing historical and forecast data
- [ ] Visual distinction between actual and projected values
- [ ] Zoom and pan time range
- [ ] Annotation support for forecast start point
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Support simple moving average forecasting
- FR-2: Support exponential smoothing (single, double, triple/Holt-Winters)
- FR-3: Support linear regression trend extrapolation
- FR-4: Forecast horizons: up to 30 days, 12 weeks, 12 months, 2 years
- FR-5: Calculate and display 80% and 95% confidence intervals
- FR-6: Support manual scenario creation with adjustable growth rates
- FR-7: Auto-detect seasonality and include in forecasts
- FR-8: Display forecast accuracy metrics (MAE, RMSE, MAPE)
- FR-9: Export forecasts as CSV and Excel
- FR-10: Visual distinction between historical data and forecast projections
- FR-11: Support multi-series forecasting
- FR-12: Store forecast history for comparison

## Non-Goals

- No machine learning or deep learning models (LSTM, Prophet, etc.)
- No external factor integration (weather, economic indicators)
- No automated model selection (user chooses method)
- No real-time forecast updates (batch processing only)
- No collaborative forecasting or consensus features

## Technical Considerations

- Use lightweight statistical libraries for client-side calculations
- Server-side processing for large datasets
- Cache forecast results to avoid recalculation
- Handle missing data and irregular time intervals gracefully
- Validate data sufficiency before forecasting (minimum data points)

## Success Metrics

- Generate a forecast in under 10 seconds for datasets under 10,000 points
- Forecast accuracy within 20% MAPE for stable time series
- Confidence intervals contain actual values 80%+ of the time
- Export completes in under 2 seconds

## Open Questions

- Should we support external regressors (e.g., marketing spend affecting sales)?
- Do we need ARIMA models in addition to exponential smoothing?
- Should we provide forecast explanation/rationale?
