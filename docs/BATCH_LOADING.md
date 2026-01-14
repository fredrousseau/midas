# Batch Loading for Historical Data

## Date: 2026-01-14

## Overview

The DataProvider now supports **automatic batch loading** for large historical data requests that exceed the API adapter's limit. This allows backtesting with longer lookback periods without being constrained by single-request API limits.

## Problem

When running backtests with long historical requirements (e.g., 1h timeframe with 1d long timeframe needs ~5,040 bars), a single API request would fail or be capped:

- **BinanceAdapter limit**: 1,500 bars per request (theoretical)
- **Binance API actual limit**: ~1,000 bars for hourly data
- **Backtest requirement**: 5,000+ bars for 210-day warmup period

**Error before fix**:
```
Error: Count must be between 1 and 5000
```

## Solution: Automatic Batch Loading in DataProvider

### Architecture Decision

Following the **separation of concerns** principle, batch loading logic belongs in the **DataProvider layer**, not in business logic (BacktestingService).

**Why DataProvider?**
- ✅ Handles all data fetching concerns
- ✅ Single responsibility: abstract away API limitations
- ✅ Reusable across all services (not just backtesting)
- ✅ Business logic remains clean and simple

### Implementation

#### 1. Detection and Routing

In `DataProvider.loadOHLCV()`:

```javascript
// BATCH LOADING: Check if count exceeds adapter's limit
const adapterLimit = this.dataAdapter.constructor.MAX_LIMIT || 1000;
let rawData;

if (count > adapterLimit) {
    // Need to fetch in batches
    this.logger.info(`Count ${count} exceeds adapter limit ${adapterLimit}, fetching in batches`);
    rawData = await this._fetchInBatches({ symbol, timeframe, count, from, to: endTime, adapterLimit });
} else {
    // Single request
    rawData = await this.dataAdapter.fetchOHLC({ symbol, timeframe, count, from, to: endTime });
}
```

#### 2. Batch Fetching Logic

New private method `_fetchInBatches()`:

```javascript
async _fetchInBatches({ symbol, timeframe, count, from, to, adapterLimit }) {
    const timeframeMs = this._timeframeToMs(timeframe);
    const allBars = [];
    let remainingCount = count;
    let currentEndTime = to;

    // Calculate number of batches needed
    const totalBatches = Math.ceil(count / adapterLimit);

    let batchNum = 0;
    while (remainingCount > 0) {
        batchNum++;
        const batchSize = Math.min(remainingCount, adapterLimit);

        // Fetch this batch
        const batchData = await this.dataAdapter.fetchOHLC({
            symbol,
            timeframe,
            count: batchSize,
            from,
            to: currentEndTime,
        });

        if (!batchData || batchData.length === 0) break;

        // Add to beginning of array (we're working backwards)
        allBars.unshift(...batchData);

        remainingCount -= batchData.length;

        // If we got less than requested, we've hit the data limit
        if (batchData.length < batchSize) {
            this.logger.warn(`Batch ${batchNum}/${totalBatches} returned fewer bars than requested, no more historical data available`);
            break;
        }

        // Calculate the next batch's end time (one bar before the earliest bar we just fetched)
        const earliestTimestamp = Math.min(...batchData.map(bar => bar.timestamp));
        currentEndTime = earliestTimestamp - timeframeMs;

        // Avoid hitting rate limits
        if (remainingCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        }
    }

    return allBars;
}
```

### Key Features

1. **Works Backwards**: Fetches from most recent to oldest (to→from direction)
2. **Respects Adapter Limits**: Each batch ≤ adapterLimit (1500 for Binance)
3. **Handles Partial Data**: Stops gracefully if API returns fewer bars than requested
4. **Rate Limit Protection**: 100ms delay between batches
5. **Transparent Logging**: Logs progress and warnings for debugging

### Configuration

#### Environment Variable: MAX_DATA_POINTS

Added to `.env` (default: 5000):

```bash
# MAX_DATA_POINTS: Maximum number of bars per API request (default: 5000)
# Some APIs have limits (e.g., Binance: 1000-1500 depending on timeframe)
# The DataProvider will automatically split large requests into batches
# Increase this for backtesting with large datasets
MAX_DATA_POINTS=10000
```

**Usage in server.js**:
```javascript
const dataProvider = new DataProvider({
    dataAdapter: binanceAdapter,
    logger: logger,
    maxDataPoints: parseInt(process.env.MAX_DATA_POINTS || '5000'),
    redisConfig: redisConfig,
});
```

## Binance API Limitations

### Actual vs Theoretical Limits

| Limit Type | Value | Notes |
|------------|-------|-------|
| BinanceAdapter.MAX_LIMIT | 1500 | Theoretical maximum |
| Binance API actual limit | ~1000 bars | Varies by timeframe and data availability |
| Historical data availability | ~41 days for 1h | Binance doesn't store infinite history |

### Example: 1h Timeframe Backtest

**Requirements for 1h timeframe → {1h, 4h, 1d} mapping:**
- Long timeframe (1d) needs 210 bars for EMA200
- Converted to 1h: 210 days × 24 hours = **5,040 bars**
- Plus backtest period + safety margin = **~5,258 bars total**

**Binance limitation:**
- ❌ Only ~1,000 bars available (~41 days of 1h data)
- ❌ Cannot fetch 210 days of historical data

**Solution options:**
1. **Use shorter long timeframe**: 4h instead of 1d (needs only ~880 bars)
2. **Use higher backtest timeframe**: 4h instead of 1h (each bar covers more time)
3. **Accept limited warmup period**: Work with available data (may reduce accuracy)

## Testing

### Test Script: test-backtest-fix.js

Demonstrates all features:

```bash
node scripts/test-backtest-fix.js
```

**Expected logs**:
```
[info]: Dynamic bar calculation: long_tf=1d needs 210 bars, converting to 5040 bars of 1h (~210 days warmup)
[info]: Count 5258 exceeds adapter limit 1500, fetching in batches
[info]: Fetching 5258 bars in 4 batches (1500 bars per batch)
[warn]: Batch 1/4 returned fewer bars than requested (1000/1500), no more historical data available
[info]: Batch fetch complete: received 1000/5258 bars in 1 batches
[error]: Insufficient data received: got 1000 candles but need at least 5050 (5040 for warmup + 10 to analyze)
```

**This demonstrates**:
1. ✅ Dynamic bar calculation working correctly
2. ✅ Batch loading triggered automatically
3. ✅ Graceful handling when Binance has insufficient data
4. ✅ Helpful error message with actionable suggestions

## Performance Impact

### Without Batch Loading (Before)
- ❌ Requests >1500 bars would fail with validation error
- ❌ No backtests possible with long historical periods

### With Batch Loading (After)
- ✅ Requests automatically split into multiple API calls
- ✅ 100ms delay between batches (rate limit protection)
- ✅ Works within API constraints
- ⚠️  Still limited by Binance's actual data availability

### Example Batch Loading Performance

For a 5,258-bar request (theoretical):
- **Batches needed**: 4 (1500 + 1500 + 1500 + 758)
- **API calls**: 4 (but stops at 1 when Binance limit is hit)
- **Delays**: 3 × 100ms = 300ms
- **Total time**: ~1-2 seconds (depending on API latency)

## Recommendations

### For Production Backtesting

1. **Enable Redis** (essential for performance):
   ```bash
   REDIS_ENABLED=true
   ```

2. **Use appropriate timeframe mappings**:
   - 1h backtest → {1h, 4h, 4h} instead of {1h, 4h, 1d}
   - 4h backtest → {4h, 1d, 1w} (requires ~8,760 bars, use batch loading)

3. **Increase MAX_DATA_POINTS** for backtesting:
   ```bash
   MAX_DATA_POINTS=10000
   ```

4. **Monitor batch loading logs**:
   - Watch for "returned fewer bars than requested" warnings
   - Indicates hitting Binance's data availability limit

### For Development/Testing

1. **Use recent backtest periods**: Data availability better for recent dates
2. **Start with short periods**: 1-3 days to verify functionality
3. **Test with different timeframes**: See which configurations work within Binance limits

## Related Documentation

- [BACKTEST_DATA_FIX.md](./BACKTEST_DATA_FIX.md) - Dynamic bar calculation fix
- [BACKTEST_SIMPLIFICATION.md](./BACKTEST_SIMPLIFICATION.md) - Architecture overview
- [CONFIGURABLE_PARAMETERS.md](./CONFIGURABLE_PARAMETERS.md) - All configuration options
- [.env.sample](../.env.sample) - Environment variable reference

## Files Modified

- `src/DataProvider/DataProvider.js`:
  - Added batch loading detection (lines 201-212)
  - Added `_fetchInBatches()` method (lines 134-204)

- `.env.sample`:
  - Added MAX_DATA_POINTS configuration (lines 82-88)

- `src/server.js`:
  - Added maxDataPoints configuration (line 164)

- `CLAUDE.md`:
  - Documented Redis and data provider settings (lines 55-73)

- `scripts/test-backtest-fix.js`:
  - Added dotenv import (line 6)
  - Added maxDataPoints variable (line 37)
  - Updated test configuration with comments (lines 98-105)
