# Backtesting & Validation Methodology for Midas

## 1. Pattern Outcome Tracking System

### Objective
Measure whether detected patterns actually achieve their targets, hit invalidation levels, or fail to resolve.

### Architecture

**Database Schema** (PostgreSQL/MongoDB):
```javascript
{
  pattern_id: UUID,
  symbol: "BTC/USD",
  timeframe: "4h",
  pattern_type: "double_bottom",
  detected_at: timestamp,
  detection_price: 45230.50,

  // Pattern specifics
  target_level: 47800.00,
  invalidation_level: 44100.00,
  risk_reward_ratio: 2.5,
  momentum_quality: "strong",
  coherence_status: "coherent",

  // Outcome tracking
  outcome: null, // 'target_hit' | 'invalidated' | 'timeout' | 'partial'
  outcome_timestamp: null,
  outcome_price: null,
  bars_to_resolution: null,
  max_favorable_excursion: null, // highest price before outcome
  max_adverse_excursion: null,   // lowest price before outcome

  // Context snapshot
  regime_detected: "trending_bullish",
  adx_at_detection: 37.64,
  full_context: {...} // complete StatisticalContext snapshot
}
```

**Tracking Process**:
1. **On Pattern Detection**: Insert record with `outcome: null`
2. **Continuous Monitoring**: Every bar update, check:
   - If price > target_level → `outcome: 'target_hit'`
   - If price < invalidation_level → `outcome: 'invalidated'`
   - If 50 bars elapsed → `outcome: 'timeout'`
3. **Calculate MFE/MAE**: Track price extremes during monitoring period

**Metrics to Calculate**:
```javascript
// Per pattern type
{
  pattern_type: "double_bottom",
  total_detected: 247,
  outcomes: {
    target_hit: 156,      // 63.2% success rate
    invalidated: 71,      // 28.7% failure rate
    timeout: 20           // 8.1% unresolved
  },
  avg_bars_to_target: 18.4,
  avg_bars_to_invalidation: 12.1,
  avg_risk_reward_realized: 2.1,

  // Conditional metrics
  success_by_momentum_quality: {
    strong: 0.78,         // 78% when momentum aligned
    weakening: 0.61,      // 61% when partially aligned
    contradicting: 0.42   // 42% when momentum conflicts
  },
  success_by_coherence: {
    coherent: 0.71,
    diverging: 0.48
  }
}
```

## 2. Regime Detection Validation

### Objective
Verify that detected regimes accurately describe subsequent price behavior.

### Walk-Forward Testing Methodology

**Process**:
1. **Historical Data Window**: Use 200 bars to detect regime at bar N
2. **Forward Validation Window**: Measure next 20-50 bars
3. **Regime Validation Metrics**:

```javascript
// For "trending_bullish" regime
{
  total_detections: 1834,

  // Price behavior in next 20 bars
  continued_uptrend: 1402,    // 76.4% - correct
  reversed_to_down: 198,      // 10.8% - false positive
  moved_to_range: 234,        // 12.8% - regime change

  // Quantitative validation
  avg_directional_move: +2.3%, // positive = correct for bullish
  avg_adx_next_20_bars: 34.2,  // remains high = stable trend
  avg_bars_until_regime_change: 47.3,

  // Confidence correlation
  by_confidence_score: {
    high: {detections: 823, accuracy: 0.87},      // 0.8-1.0
    medium: {detections: 721, accuracy: 0.74},    // 0.6-0.8
    low: {detections: 290, accuracy: 0.58}        // 0.0-0.6
  }
}
```

**Regime Stability Index**:
```javascript
stabilityIndex = (bars_regime_held / expected_duration) * confidence_score
// > 1.0 = regime lasted longer than expected (stable)
// < 1.0 = regime changed quickly (unstable)
```

### Confusion Matrix for Regime Classification

```javascript
// Actual regime (based on next 20 bars price action)
//                  Predicted
//         Trending  Range   Breakout
// Actual
// Trending   1402    234      12      = 1648 (precision: 85.1%)
// Range       198   2104      89      = 2391 (precision: 88.0%)
// Breakout     34     87     543      = 664  (precision: 81.8%)
```

## 3. Multi-Timeframe Alignment Validation

### Objective
Verify that MTF alignment actually predicts stronger moves.

**Hypothesis**: When 4 timeframes align bullish, the next move should be stronger than when only 1 timeframe is bullish.

**Testing**:
```javascript
{
  alignment_score: 4, // all timeframes bullish
  sample_size: 342,

  // Next 24 hours performance
  avg_price_move: +3.7%, // strong positive
  win_rate: 0.82,        // 82% moved up
  avg_bars_to_reversal: 67,

  vs_no_alignment: {
    avg_price_move: -0.2%, // random/choppy
    win_rate: 0.51,        // coin flip
    avg_bars_to_reversal: 15
  }
}
```

## 4. Signal Component Accuracy

### Objective
Measure which indicators/components are most predictive.

**Indicator Reliability Scoring**:
```javascript
// MACD cross signal validation
{
  indicator: "macd_cross",
  bullish_crosses: 1247,

  // Did price actually move up in next N bars?
  next_5_bars: {
    moved_up: 823,      // 66.0% accuracy
    moved_down: 424     // 34.0% false signals
  },
  next_20_bars: {
    moved_up: 934,      // 74.9% accuracy (better on longer horizon)
    moved_down: 313
  },

  // Conditional accuracy
  when_regime_aligned: 0.81,  // 81% when regime confirms
  when_regime_conflicts: 0.47 // 47% when regime disagrees
}
```

**Build Reliability Rankings**:
```javascript
[
  {component: "regime_detection", accuracy: 0.76, weight: 1.0},
  {component: "macd_cross_20bar", accuracy: 0.75, weight: 0.9},
  {component: "ema_alignment", accuracy: 0.71, weight: 0.8},
  {component: "psar_position", accuracy: 0.68, weight: 0.7},
  {component: "rsi_trend", accuracy: 0.63, weight: 0.6}
]
```

## 5. Event-Driven Backtesting Engine

### Architecture Overview

**Core Components**:
1. **Historical Data Replay**: Stream OHLCV bars chronologically
2. **Analysis Snapshot**: Call `StatisticalContextService.generateFullContext()` at each bar
3. **Pattern/Signal Recording**: Store all detected patterns/signals with timestamps
4. **Outcome Evaluation**: Forward-check if signals were correct
5. **Performance Metrics**: Calculate system-wide statistics

**Implementation Flow**:
```javascript
// Pseudo-code
async function runBacktest(symbol, startDate, endDate) {
  const results = {
    patterns: [],
    regimes: [],
    signals: [],
    performance: {}
  };

  // Stream historical bars
  for (let currentBar of getHistoricalBars(symbol, startDate, endDate)) {

    // Get full analysis at this point in time
    const context = await StatisticalContextService.generateFullContext({
      symbol,
      timestamp: currentBar.timestamp,
      useHistoricalDataUntil: currentBar.timestamp // critical!
    });

    // Record detected patterns
    for (let pattern of context.patterns) {
      results.patterns.push({
        ...pattern,
        detected_at: currentBar.timestamp,
        detection_price: currentBar.close,
        // Start monitoring for outcome
        monitoring: true
      });
    }

    // Record regime
    results.regimes.push({
      timestamp: currentBar.timestamp,
      regime: context.timeframes['4h'].regime,
      confidence: context.timeframes['4h'].regime_confidence
    });

    // Monitor existing patterns for outcomes
    for (let monitoredPattern of results.patterns.filter(p => p.monitoring)) {
      if (currentBar.high >= monitoredPattern.target_level) {
        monitoredPattern.outcome = 'target_hit';
        monitoredPattern.outcome_price = monitoredPattern.target_level;
        monitoredPattern.outcome_timestamp = currentBar.timestamp;
        monitoredPattern.monitoring = false;
      } else if (currentBar.low <= monitoredPattern.invalidation_level) {
        monitoredPattern.outcome = 'invalidated';
        monitoredPattern.outcome_price = monitoredPattern.invalidation_level;
        monitoredPattern.outcome_timestamp = currentBar.timestamp;
        monitoredPattern.monitoring = false;
      }

      // Update MFE/MAE
      monitoredPattern.max_favorable_excursion = Math.max(
        monitoredPattern.max_favorable_excursion || 0,
        currentBar.high - monitoredPattern.detection_price
      );
    }
  }

  // Calculate aggregate metrics
  results.performance = calculatePerformanceMetrics(results);
  return results;
}
```

**Critical: Time Travel Prevention**:
- Database queries MUST use `WHERE timestamp <= currentBar.timestamp`
- Cache MUST be disabled or time-aware
- Cannot use future data (look-ahead bias)

## 6. Performance Metrics to Track

### Pattern Performance
```javascript
{
  overall_pattern_success_rate: 0.632,
  best_performing_pattern: {
    type: "double_bottom",
    success_rate: 0.714,
    avg_reward_risk: 2.3
  },
  worst_performing_pattern: {
    type: "bearish_flag",
    success_rate: 0.487,
    avg_reward_risk: 1.1
  }
}
```

### Regime Prediction Accuracy
```javascript
{
  overall_regime_accuracy: 0.764,
  avg_regime_duration: 47.3, // bars
  regime_transition_accuracy: {
    trending_to_range: 0.68,
    range_to_breakout: 0.71,
    breakout_to_trending: 0.82
  }
}
```

### Signal Precision/Recall
```javascript
{
  bullish_signals: {
    precision: 0.71,  // when signal fired, 71% were correct
    recall: 0.64,     // caught 64% of actual bull moves
    f1_score: 0.67
  },
  bearish_signals: {
    precision: 0.68,
    recall: 0.61,
    f1_score: 0.64
  }
}
```

### Coherence Impact
```javascript
{
  trades_when_coherent: {
    count: 1247,
    win_rate: 0.73,
    avg_profit: +2.4%
  },
  trades_when_diverging: {
    count: 543,
    win_rate: 0.52,
    avg_profit: -0.3%
  },
  // Conclusion: coherence_check is valuable filter
}
```

## 7. Implementation Phases

### Phase 1: Pattern Outcome Database (Week 1-2)
- Create PostgreSQL schema
- Build pattern insertion service
- Implement monitoring cron job
- Basic success rate calculation

### Phase 2: Regime Validation (Week 3-4)
- Historical regime detection replay
- Forward validation windows
- Confusion matrix generation
- Confidence score correlation

### Phase 3: Component Reliability (Week 5-6)
- Individual indicator backtests
- Signal accuracy measurement
- Build reliability rankings
- Identify weak components

### Phase 4: Full Backtesting Engine (Week 7-10)
- Event-driven replay system
- Time-travel prevention
- Performance metrics dashboard
- Statistical significance testing

### Phase 5: Live Validation (Ongoing)
- Run analysis in parallel with backtester
- Compare real-time outcomes vs predictions
- Continuous metrics updates
- Drift detection (model degradation)

## 8. Key Success Metrics

**Minimum Acceptable Performance**:
- Pattern success rate: > 60%
- Regime accuracy: > 70%
- Signal precision: > 65%
- Coherent signal win rate: > 70%

**World-Class Performance**:
- Pattern success rate: > 75%
- Regime accuracy: > 85%
- Signal precision: > 75%
- Coherent signal win rate: > 80%

## 9. Validation Dashboard

**Real-time Metrics Display**:
```
┌─ Pattern Performance (Last 30 Days) ─────────────┐
│ Double Bottom:    ████████░░ 78% (142/182)      │
│ Bull Flag:        ██████░░░░ 64% (89/139)       │
│ Ascending Tri:    ███████░░░ 71% (67/94)        │
└──────────────────────────────────────────────────┘

┌─ Regime Accuracy (Last 90 Days) ─────────────────┐
│ Trending:         ████████░░ 82% stable          │
│ Range:            ███████░░░ 76% stable          │
│ Breakout:         ██████░░░░ 68% stable          │
└──────────────────────────────────────────────────┘

┌─ Signal Quality ─────────────────────────────────┐
│ Coherent Signals: █████████░ 87% win rate        │
│ Diverging Signals: ████░░░░░░ 51% win rate       │
│ Recommendation: Filter out diverging signals     │
└──────────────────────────────────────────────────┘
```

---

This methodology provides **objective, data-driven validation** of whether the Midas analysis engine actually works. The critical insight is: **every component must prove its value with historical outcomes**, not just theoretical logic.
