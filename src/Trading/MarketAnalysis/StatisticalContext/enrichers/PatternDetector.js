/**
 * Pattern Detector
 * Detects chart patterns: flags, triangles, wedges, head & shoulders
 */

import { round } from '#utils/statisticalHelpers.js';

export class PatternDetector {
	constructor(options = {}) {
		this.logger = options.logger || console;
	}

	/**
	 * Detect patterns in price action
	 */
	detect({ ohlcvData, currentPrice }) {
		const bars = ohlcvData.bars;
		
		const patterns = [];

		// Detect bull/bear flags
		const flagPattern = this._detectFlag(bars, currentPrice);
		if (flagPattern) patterns.push(flagPattern);

		// Detect triangles
		const trianglePattern = this._detectTriangle(bars, currentPrice);
		if (trianglePattern) patterns.push(trianglePattern);

		// Detect wedges
		const wedgePattern = this._detectWedge(bars, currentPrice);
		if (wedgePattern) patterns.push(wedgePattern);

		// Detect head & shoulders
		const hsPattern = this._detectHeadAndShoulders(bars, currentPrice);
		if (hsPattern) patterns.push(hsPattern);

		// Detect double top/bottom
		const doublePattern = this._detectDouble(bars, currentPrice);
		if (doublePattern) patterns.push(doublePattern);

		return patterns.length > 0 ? patterns : null;
	}

	/**
	 * Detect bull or bear flag
	 */
	_detectFlag(bars, currentPrice) {
		if (bars.length < 20) return null;

		// Look for pole (strong move) followed by consolidation
		const recentBars = bars.slice(-30);
		
		// Find potential pole (8-15 bars of strong directional move)
		for (let poleEnd = recentBars.length - 5; poleEnd >= 15; poleEnd--) 
			for (let poleStart = poleEnd - 15; poleStart < poleEnd - 8; poleStart++) {
				const pole = recentBars.slice(poleStart, poleEnd);
				const poleMove = pole[pole.length - 1].close - pole[0].close;
				const poleRange = Math.abs(poleMove);
				const poleDirection = poleMove > 0 ? 'bull' : 'bear';
				
				// Check if pole is strong enough (at least 3% move)
				const polePct = (poleRange / pole[0].close) * 100;
				if (polePct < 3) continue;

				// Check for consolidation after pole (flag)
				const flag = recentBars.slice(poleEnd);
				if (flag.length < 5 || flag.length > 15) continue;

				// Flag should be smaller than pole
				const flagHigh = Math.max(...flag.map(b => b.high));
				const flagLow = Math.min(...flag.map(b => b.low));
				const flagRange = flagHigh - flagLow;
				
				if (flagRange > poleRange * 0.5) continue; // Flag too large

				// Flag should be consolidating (not continuing the trend strongly)
				const flagMove = flag[flag.length - 1].close - flag[0].close;
				if (Math.abs(flagMove) > poleRange * 0.3) continue;

				// Calculate target (pole projection)
				const target = poleDirection === 'bull' 
					? currentPrice + poleRange 
					: currentPrice - poleRange;

				// Invalidation level
				const invalidation = poleDirection === 'bull'
					? flagLow
					: flagHigh;

				// Confidence based on flag duration and tightness
				let confidence = 0.70;
				if (flag.length >= 8 && flag.length <= 12) confidence += 0.05; // Ideal duration
				if (flagRange < poleRange * 0.3) confidence += 0.05; // Tight flag

				return {
					pattern: poleDirection === 'bull' ? 'bull flag' : 'bear flag',
					confidence: round(confidence, 2),
					pole: `${round(pole[0].close, 0)} to ${round(pole[pole.length - 1].close, 0)} (+${round(poleRange, 0)} points)`,
					pole_duration: pole.length,
					flag_duration: `${flag.length} bars (${flag.length >= 8 && flag.length <= 12 ? 'healthy' : flag.length < 8 ? 'short' : 'extended'})`,
					target_if_breaks: round(target, 0),
					invalidation: round(invalidation, 0),
					status: 'forming',
					interpretation: `${poleDirection}ish continuation pattern`
				};
			}

		return null;
	}

	/**
	 * Detect triangle (ascending, descending, symmetrical)
	 */
	_detectTriangle(bars, currentPrice) {
		if (bars.length < 15) return null;

		const recentBars = bars.slice(-20);
		const highs = recentBars.map(b => b.high);
		const lows = recentBars.map(b => b.low);

		// Find trend lines
		const highTrend = this._calculateTrendLine(highs);
		const lowTrend = this._calculateTrendLine(lows);

		// Check for converging lines (triangle)
		if (Math.abs(highTrend.slope) < 0.1 && Math.abs(lowTrend.slope) < 0.1) 
			return null; // Rectangle, not triangle

		// Determine triangle type
		let triangleType;
		let interpretation;
		let bias;

		if (highTrend.slope < -0.001 && Math.abs(lowTrend.slope) < 0.001) {
			// Descending triangle (bearish)
			triangleType = 'descending triangle';
			interpretation = 'bearish continuation pattern';
			bias = 'downside breakout expected';
		} else if (Math.abs(highTrend.slope) < 0.001 && lowTrend.slope > 0.001) {
			// Ascending triangle (bullish)
			triangleType = 'ascending triangle';
			interpretation = 'bullish continuation pattern';
			bias = 'upside breakout expected';
		} else if (highTrend.slope < -0.001 && lowTrend.slope > 0.001) {
			// Symmetrical triangle (neutral)
			triangleType = 'symmetrical triangle';
			interpretation = 'consolidation pattern';
			bias = 'breakout direction uncertain';
		} else {
			return null;
		}

		// Calculate apex (where lines would meet)
		const currentRange = highs[highs.length - 1] - lows[lows.length - 1];
		const initialRange = highs[0] - lows[0];
		const compression = ((initialRange - currentRange) / initialRange) * 100;

		if (compression < 20) return null; // Not compressed enough

		return {
			pattern: triangleType,
			confidence: 0.65,
			interpretation,
			bias,
			compression: `${round(compression, 0)}%`,
			apex_approaching: compression > 60 ? 'yes (breakout imminent)' : 'no',
			upper_bound: round(highs[highs.length - 1], 0),
			lower_bound: round(lows[lows.length - 1], 0)
		};
	}

	/**
	 * Detect wedge (rising or falling)
	 */
	_detectWedge(bars, currentPrice) {
		if (bars.length < 15) return null;

		const recentBars = bars.slice(-20);
		const highs = recentBars.map(b => b.high);
		const lows = recentBars.map(b => b.low);

		const highTrend = this._calculateTrendLine(highs);
		const lowTrend = this._calculateTrendLine(lows);

		// Both lines must be sloping in same direction for wedge
		if (highTrend.slope * lowTrend.slope < 0) return null;

		// Check if converging
		const slopeDiff = Math.abs(highTrend.slope - lowTrend.slope);
		if (slopeDiff < 0.0005) return null; // Parallel lines (channel)

		let wedgeType, interpretation;

		if (highTrend.slope > 0 && lowTrend.slope > 0) {
			wedgeType = 'rising wedge';
			interpretation = 'bearish reversal pattern (typically breaks down)';
		} else if (highTrend.slope < 0 && lowTrend.slope < 0) {
			wedgeType = 'falling wedge';
			interpretation = 'bullish reversal pattern (typically breaks up)';
		} else {
			return null;
		}

		return {
			pattern: wedgeType,
			confidence: 0.60,
			interpretation,
			status: 'forming'
		};
	}

	/**
	 * Detect head and shoulders (or inverse)
	 */
	_detectHeadAndShoulders(bars, currentPrice) {
		if (bars.length < 30) return null;

		const recentBars = bars.slice(-40);
		const peaks = this._findPeaks(recentBars.map(b => b.high));
		const troughsRaw = this._findPeaks(recentBars.map(b => -b.low));
		const troughs = { values: troughsRaw.values.map(v => -v), indices: troughsRaw.indices };

		// Head and shoulders: need 3 peaks with middle one highest
		if (peaks.values.length >= 3) {
			const lastThree = peaks.values.slice(-3);
			const [left, head, right] = lastThree;
			
			// Check if middle is highest and sides similar
			if (head > left * 1.02 && head > right * 1.02) {
				const shoulderDiff = Math.abs(left - right) / left;
				
				if (shoulderDiff < 0.05)  // Shoulders roughly equal
					return {
						pattern: 'head and shoulders',
						confidence: 0.70,
						interpretation: 'bearish reversal pattern',
						left_shoulder: round(left, 0),
						head: round(head, 0),
						right_shoulder: round(right, 0),
						status: 'forming',
						neckline: troughs.values.length > 0 ? round(Math.max(...troughs.values.slice(-2)), 0) : null
					};
				
			}
		}

		// Inverse head and shoulders: need 3 troughs with middle one lowest
		if (troughs.values.length >= 3) {
			const lastThree = troughs.values.slice(-3);
			const [left, head, right] = lastThree;
			
			if (head < left * 0.98 && head < right * 0.98) {
				const shoulderDiff = Math.abs(left - right) / left;
				
				if (shoulderDiff < 0.05) 
					return {
						pattern: 'inverse head and shoulders',
						confidence: 0.70,
						interpretation: 'bullish reversal pattern',
						left_shoulder: round(left, 0),
						head: round(head, 0),
						right_shoulder: round(right, 0),
						status: 'forming',
						neckline: peaks.values.length > 0 ? round(Math.min(...peaks.values.slice(-2)), 0) : null
					};
				
			}
		}

		return null;
	}

	/**
	 * Detect double top or bottom
	 */
	_detectDouble(bars, currentPrice) {
		if (bars.length < 20) return null;

		const recentBars = bars.slice(-30);
		const peaks = this._findPeaks(recentBars.map(b => b.high));
		const troughsRaw = this._findPeaks(recentBars.map(b => -b.low));
		const troughs = { values: troughsRaw.values.map(v => -v), indices: troughsRaw.indices };

		// Double top
		if (peaks.values.length >= 2) {
			const lastTwo = peaks.values.slice(-2);
			const diff = Math.abs(lastTwo[1] - lastTwo[0]) / lastTwo[0];
			
			if (diff < 0.02) { // Peaks within 2% of each other
				const minBetween = Math.min(...recentBars.slice(peaks.indices[peaks.indices.length - 2], peaks.indices[peaks.indices.length - 1]).map(b => b.low));
				
				return {
					pattern: 'double top',
					confidence: 0.65,
					interpretation: 'bearish reversal pattern',
					first_top: round(lastTwo[0], 0),
					second_top: round(lastTwo[1], 0),
					support_level: round(minBetween, 0),
					status: currentPrice < minBetween ? 'confirmed' : 'forming'
				};
			}
		}

		// Double bottom
		if (troughs.values.length >= 2) {
			const lastTwo = troughs.values.slice(-2);
			const diff = Math.abs(lastTwo[1] - lastTwo[0]) / lastTwo[0];
			
			if (diff < 0.02) {
				const maxBetween = Math.max(...recentBars.slice(troughs.indices[troughs.indices.length - 2], troughs.indices[troughs.indices.length - 1]).map(b => b.high));
				
				return {
					pattern: 'double bottom',
					confidence: 0.65,
					interpretation: 'bullish reversal pattern',
					first_bottom: round(lastTwo[0], 0),
					second_bottom: round(lastTwo[1], 0),
					resistance_level: round(maxBetween, 0),
					status: currentPrice > maxBetween ? 'confirmed' : 'forming'
				};
			}
		}

		return null;
	}

	/**
	 * Find peaks in array
	 */
	_findPeaks(values) {
		const peaks = { values: [], indices: [] };
		
		for (let i = 2; i < values.length - 2; i++) 
			// Peak: higher than neighbors
			if (values[i] > values[i - 1] && 
			    values[i] > values[i + 1] &&
			    values[i] > values[i - 2] && 
			    values[i] > values[i + 2]) {
				peaks.values.push(values[i]);
				peaks.indices.push(i);
			}
		
		return peaks;
	}

	/**
	 * Calculate trend line (simple linear regression)
	 */
	_calculateTrendLine(values) {
		const n = values.length;
		const x = Array.from({ length: n }, (_, i) => i);
		
		const sumX = x.reduce((a, b) => a + b, 0);
		const sumY = values.reduce((a, b) => a + b, 0);
		const sumXY = x.reduce((acc, xi, i) => acc + xi * values[i], 0);
		const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
		
		const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
		const intercept = (sumY - slope * sumX) / n;
		
		return { slope, intercept };
	}
}

export default PatternDetector;
