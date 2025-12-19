/**
 * Moving Averages Enricher
 * Generates detailed EMA/SMA analysis with crosses, slopes, divergences
 */

import { round } from '#utils/statisticalHelpers.js';

export class MovingAveragesEnricher {
	constructor(options = {}) {
		this.logger = options.logger || console;
		this.emaPeriods = [12, 26, 50, 200];
		this.smaPeriods = [20, 50];
	}

	/**
	 * Enrich moving averages with detailed analysis
	 */
	async enrich({ ohlcvData, currentPrice }) {
		const closes = ohlcvData.bars.map(b => b.close);
		
		// Calculate EMAs
		const emas = {};
		for (const period of this.emaPeriods) {
			const emaValues = this._calculateEMA(closes, period);
			emas[period] = {
				current: emaValues[emaValues.length - 1],
				history: emaValues
			};
		}

		// Calculate SMAs
		const smas = {};
		for (const period of this.smaPeriods) {
			const smaValues = this._calculateSMA(closes, period);
			smas[period] = {
				current: smaValues[smaValues.length - 1],
				history: smaValues
			};
		}

		// Build enriched context
		return {
			ema: {
				// Current values
				ema12: round(emas[12]?.current, 0),
				ema26: round(emas[26]?.current, 0),
				ema50: round(emas[50]?.current, 0),
				ema200: round(emas[200]?.current, 0),

				// Price vs EMAs
				price_vs_ema12: this._formatPercentage(currentPrice, emas[12]?.current),
				price_vs_ema26: this._formatPercentage(currentPrice, emas[26]?.current),
				price_vs_ema50: this._formatPercentage(currentPrice, emas[50]?.current),
				price_vs_ema200: this._formatPercentage(currentPrice, emas[200]?.current),

				// Crosses
				cross_12_26: this._detectCross(emas[12]?.history, emas[26]?.history, 'EMA12/EMA26'),
				cross_50_200: this._detectCross(emas[50]?.history, emas[200]?.history, 'EMA50/EMA200'),

				// Slopes
				slope_ema12: this._calculateSlope(emas[12]?.history, 10),
				slope_ema26: this._calculateSlope(emas[26]?.history, 10),
				slope_ema50: this._calculateSlope(emas[50]?.history, 20),

				// Divergence
				divergence: this._analyzeDivergence(
					emas[12]?.history,
					emas[26]?.history,
					emas[50]?.history
				),

				// Alignment
				alignment: this._analyzeAlignment(emas, currentPrice),

				// Support/Resistance
				support_cluster: this._identifySupportCluster(emas, currentPrice),
				nearest_support: this._identifyNearestSupport(emas, currentPrice)
			},

			sma: {
				sma20: round(smas[20]?.current, 0),
				sma50: round(smas[50]?.current, 0),
				vs_ema: this._compareSMAvsEMA(smas, emas)
			}
		};
	}

	/**
	 * Calculate EMA
	 */
	_calculateEMA(values, period) {
		if (values.length < period) return null;
		
		const k = 2 / (period + 1);
		const result = [];
		
		// Start with SMA for first value
		let sum = 0;
		for (let i = 0; i < period; i++) 
			sum += values[i];
		
		result[period - 1] = sum / period;
		
		// Calculate EMA for remaining values
		for (let i = period; i < values.length; i++) 
			result[i] = values[i] * k + result[i - 1] * (1 - k);
		
		return result;
	}

	/**
	 * Calculate SMA
	 */
	_calculateSMA(values, period) {
		if (values.length < period) return null;
		
		const result = [];
		for (let i = period - 1; i < values.length; i++) {
			let sum = 0;
			for (let j = 0; j < period; j++) 
				sum += values[i - j];
			
			result[i] = sum / period;
		}
		
		return result;
	}

	/**
	 * Format percentage difference
	 */
	_formatPercentage(value1, value2) {
		if (!value1 || !value2) return 'N/A';
		const pct = ((value1 - value2) / value2) * 100;
		const sign = pct >= 0 ? '+' : '';
		return `${sign}${round(pct, 2)}%`;
	}

	/**
	 * Detect cross between two EMAs
	 */
	_detectCross(fast, slow, label) {
		if (!fast || !slow || fast.length < 2 || slow.length < 2) 
			return 'insufficient data';

		const recentLength = Math.min(50, fast.length);
		const recentFast = fast.slice(-recentLength);
		const recentSlow = slow.slice(-recentLength);

		const currentFast = recentFast[recentFast.length - 1];
		const currentSlow = recentSlow[recentSlow.length - 1];

		// Current position
		const isBullish = currentFast > currentSlow;

		// Find when the cross happened
		let barsSinceCross = 0;
		for (let i = recentFast.length - 2; i >= 0; i--) {
			const wasBullish = recentFast[i] > recentSlow[i];
			if (wasBullish !== isBullish) 
				break;
			
			barsSinceCross++;
		}

		// Format output
		const direction = isBullish ? 'bullish' : 'bearish';
		const relationship = isBullish ? '>' : '<';
		
		// Special labels for golden/death cross
		let specialLabel = '';
		if (label === 'EMA50/EMA200') 
			specialLabel = isBullish ? ' - golden cross' : ' - death cross';
		
		if (barsSinceCross >= recentLength - 1) 
			return `${direction} (${relationship} for ${recentLength}+ bars${specialLabel})`;
		 else 
			return `${direction} (${relationship} since ${barsSinceCross} bars${specialLabel})`;
		
	}

	/**
	 * Calculate slope (rate of change per bar)
	 */
	_calculateSlope(values, lookback = 10) {
		if (!values || values.length < lookback) 
			return 'insufficient data';

		const recent = values.slice(-lookback);
		
		// Simple linear regression
		const n = recent.length;
		const x = Array.from({ length: n }, (_, i) => i);
		const y = recent;

		const sumX = x.reduce((a, b) => a + b, 0);
		const sumY = y.reduce((a, b) => a + b, 0);
		const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
		const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

		const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
		const avgValue = sumY / n;
		
		// Normalize slope by average value
		const normalizedSlope = (slope / avgValue) * 100;
		
		const sign = normalizedSlope >= 0 ? '+' : '';
		
		// Add context
		let context = '';
		if (Math.abs(normalizedSlope) < 0.05) 
			context = ' (flattening)';
		 else if (Math.abs(normalizedSlope) > 0.3) 
			context = normalizedSlope > 0 ? ' (accelerating up)' : ' (accelerating down)';
		
		return `${sign}${round(normalizedSlope, 2)}% per bar${context}`;
	}

	/**
	 * Analyze divergence between EMAs
	 */
	_analyzeDivergence(ema12, ema26, ema50) {
		if (!ema12 || !ema26 || !ema50) return 'insufficient data';
		
		const lookback = 10;
		const recent12 = ema12.slice(-lookback);
		const recent26 = ema26.slice(-lookback);
		const recent50 = ema50.slice(-lookback);

		// Calculate slopes
		const slope12 = this._getSlope(recent12);
		const slope26 = this._getSlope(recent26);
		const slope50 = this._getSlope(recent50);

		// Check if slopes are similar (parallel) or diverging
		const slopeDiff12_26 = Math.abs(slope12 - slope26);
		const slopeDiff26_50 = Math.abs(slope26 - slope50);

		if (slopeDiff12_26 < 0.001 && slopeDiff26_50 < 0.001) 
			return 'parallel (healthy trend)';
		 else if (slopeDiff12_26 > 0.005) 
			if (slope12 > slope26) 
				return 'expanding (momentum increasing)';
			 else 
				return 'converging (momentum decreasing)';
			
		 else 
			return 'slightly converging (consolidation phase)';
		
	}

	/**
	 * Get simple slope for divergence analysis
	 */
	_getSlope(values) {
		const n = values.length;
		const x = Array.from({ length: n }, (_, i) => i);
		const sumX = x.reduce((a, b) => a + b, 0);
		const sumY = values.reduce((a, b) => a + b, 0);
		const sumXY = x.reduce((acc, xi, i) => acc + xi * values[i], 0);
		const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
		
		return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
	}

	/**
	 * Analyze EMA alignment
	 */
	_analyzeAlignment(emas, currentPrice) {
		const ema12 = emas[12]?.current;
		const ema26 = emas[26]?.current;
		const ema50 = emas[50]?.current;
		const ema200 = emas[200]?.current;

		if (!ema12 || !ema26 || !ema50)
			return 'insufficient data';

		// Check perfect bullish alignment
		if (currentPrice > ema12 && ema12 > ema26 && ema26 > ema50) {
			// If EMA200 exists, it must also be in alignment for "perfect"
			if (ema200) {
				if (ema50 > ema200)
					return 'perfect bullish (price > ema12 > ema26 > ema50 > ema200)';
				else
					return 'partial bullish (price > ema12 > ema26 > ema50, but ema50 < ema200)';
			}

			return 'perfect bullish (price > ema12 > ema26 > ema50)';
		}

		// Check perfect bearish alignment
		if (currentPrice < ema12 && ema12 < ema26 && ema26 < ema50) {
			// If EMA200 exists, it must also be in alignment for "perfect"
			if (ema200) {
				if (ema50 < ema200)
					return 'perfect bearish (price < ema12 < ema26 < ema50 < ema200)';
				else
					return 'partial bearish (price < ema12 < ema26 < ema50, but ema50 > ema200)';
			}

			return 'perfect bearish (price < ema12 < ema26 < ema50)';
		}

		// Check bullish but compressing
		if (currentPrice > ema12 && ema12 > ema26) {
			const spread12_26 = ((ema12 - ema26) / ema26) * 100;
			if (spread12_26 < 0.5) 
				return 'bullish but compressing (consolidation)';
			
			return 'bullish (price > ema12 > ema26)';
		}

		// Check bearish
		if (currentPrice < ema12 && ema12 < ema26) 
			return 'bearish (price < ema12 < ema26)';

		// Mixed
		return 'mixed (no clear alignment)';
	}

	/**
	 * Identify support cluster
	 */
	_identifySupportCluster(emas, currentPrice) {
		const supports = [];
		
		for (const [period, data] of Object.entries(emas)) 
			if (data && data.current < currentPrice) {
				const distance = ((currentPrice - data.current) / currentPrice) * 100;
				if (distance < 5)  // Within 5%
					supports.push({ period: parseInt(period), value: data.current, distance });
				
			}

		if (supports.length === 0) return 'none nearby';
		if (supports.length === 1) {
			const s = supports[0];
			return `ema${s.period} at ${round(s.value, 0)} (-${round(s.distance, 2)}%)`;
		}

		// Multiple supports form a cluster
		supports.sort((a, b) => a.value - b.value);
		const lowest = supports[0];
		const highest = supports[supports.length - 1];
		
		return `${round(lowest.value, 0)}-${round(highest.value, 0)} (ema${lowest.period}-ema${highest.period} zone)`;
	}

	/**
	 * Identify nearest support
	 */
	_identifyNearestSupport(emas, currentPrice) {
		let nearestSupport = null;
		let minDistance = Infinity;

		for (const [period, data] of Object.entries(emas)) 
			if (data && data.current < currentPrice) {
				const distance = currentPrice - data.current;
				if (distance < minDistance) {
					minDistance = distance;
					nearestSupport = { period: parseInt(period), value: data.current };
				}
			}

		if (!nearestSupport) return 'none below price';
		
		const distancePct = (minDistance / currentPrice) * 100;
		return `ema${nearestSupport.period} at ${round(nearestSupport.value, 0)} (-${round(distancePct, 2)}%)`;
	}

	/**
	 * Compare SMA vs EMA
	 */
	_compareSMAvsEMA(smas, emas) {
		const sma20 = smas[20]?.current;
		const ema26 = emas[26]?.current;

		if (!sma20 || !ema26) return 'insufficient data';

		if (ema26 > sma20) 
			return 'emas leading (bullish signal)';
		 else if (ema26 < sma20) 
			return 'smas leading (bearish signal)';
		 else 
			return 'aligned (neutral)';
		
	}
}

export default MovingAveragesEnricher;
