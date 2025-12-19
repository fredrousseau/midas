/**
 * Statistical Helpers
 * Pure functions for statistical calculations
 */

/**
 * Calculate descriptive statistics for a dataset
 * @param {Array<number>} values - Array of numerical values
 * @returns {Object|null} Statistics object or null if insufficient data
 */
export function calculateStats(values) {
	const clean = values.filter(v => v !== null && v !== undefined && !isNaN(v));
	if (clean.length === 0) return null;

	const sum = clean.reduce((a, b) => a + b, 0);
	const mean = sum / clean.length;
	
	const variance = clean.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / clean.length;
	const std = Math.sqrt(variance);

	return {
		mean,
		std,
		variance,
		min: Math.min(...clean),
		max: Math.max(...clean),
		count: clean.length,
		sum
	};
}

/**
 * Get percentile rank of a value within a distribution
 * Returns a value between 0 and 1
 * @param {number} value - Value to evaluate
 * @param {Array<number>} distribution - Distribution to compare against
 * @returns {number|null} Percentile rank (0-1) or null if insufficient data
 */
export function getPercentileRank(value, distribution) {
	const sorted = distribution
		.filter(v => v !== null && v !== undefined && !isNaN(v))
		.sort((a, b) => a - b);
	
	if (sorted.length === 0) return null;
	
	const count = sorted.filter(v => v <= value).length;
	return count / sorted.length;
}

/**
 * Get typical range (Q1-Q3) of a distribution
 * @param {Array<number>} values - Array of values
 * @returns {Array<number>} [Q1, Q3] or [min, max] if insufficient data
 */
export function getTypicalRange(values) {
	const sorted = values
		.filter(v => v !== null && v !== undefined && !isNaN(v))
		.sort((a, b) => a - b);
	
	if (sorted.length < 4) 
		return sorted.length > 0 ? [sorted[0], sorted[sorted.length - 1]] : [null, null];
	
	const q1Index = Math.floor(sorted.length * 0.25);
	const q3Index = Math.floor(sorted.length * 0.75);
	
	return [sorted[q1Index], sorted[q3Index]];
}

/**
 * Detect trend in a time series using simple linear regression
 * @param {Array<number>} values - Time series values
 * @param {number} threshold - Minimum normalized slope to detect trend (default: 0.001)
 * @returns {Object} Trend information
 */
export function detectTrend(values, threshold = 0.001) {
	const clean = values.filter(v => v !== null && v !== undefined && !isNaN(v));
	if (clean.length < 2) 
		return { direction: 'unknown', strength: 0, slope: 0 };

	// Simple linear regression
	const n = clean.length;
	const x = Array.from({ length: n }, (_, i) => i);
	const y = clean;

	const sumX = x.reduce((a, b) => a + b, 0);
	const sumY = y.reduce((a, b) => a + b, 0);
	const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
	const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

	// Calculate slope
	const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
	const avgValue = sumY / n;
	
	// Normalize slope by average value to make it comparable across different scales
	const normalizedSlope = avgValue !== 0 ? slope / avgValue : 0;

	let direction = 'flat';
	if (normalizedSlope > threshold) direction = 'rising';
	else if (normalizedSlope < -threshold) direction = 'declining';

	return {
		direction,
		strength: Math.abs(normalizedSlope),
		slope,
		normalizedSlope
	};
}

/**
 * Detect statistical anomalies using z-score
 * @param {number} value - Value to check
 * @param {Array<number>} distribution - Historical distribution
 * @param {number} stdThreshold - Number of standard deviations to consider anomaly (default: 2)
 * @returns {Object} Anomaly detection result
 */
export function detectAnomaly(value, distribution, stdThreshold = 2) {
	const stats = calculateStats(distribution);
	if (!stats || stats.std === 0) 
		return { isAnomaly: false, zScore: 0, stdDeviations: 0 };

	const zScore = (value - stats.mean) / stats.std;
	const isAnomaly = Math.abs(zScore) > stdThreshold;

	return {
		isAnomaly,
		zScore,
		stdDeviations: Math.abs(zScore),
		direction: zScore > 0 ? 'above' : 'below'
	};
}

/**
 * Calculate rate of change over N periods
 * @param {Array<number>} values - Time series values
 * @param {number} period - Number of periods to look back
 * @returns {number|null} Rate of change as percentage
 */
export function rateOfChange(values, period = 1) {
	if (!values || values.length < period + 1) return null;
	
	const current = values[values.length - 1];
	const past = values[values.length - 1 - period];
	
	if (past === 0) return null;
	return ((current - past) / past) * 100;
}

/**
 * Round number to specified decimal places
 * @param {number} value - Value to round
 * @param {number} decimals - Number of decimal places
 * @returns {number|null} Rounded value or null if invalid
 */
export function round(value, decimals) {
	if (value === null || value === undefined || isNaN(value)) return null;
	const factor = Math.pow(10, decimals);
	return Math.round(value * factor) / factor;
}

/**
 * Calculate EMA (Exponential Moving Average)
 * @param {Array<number>} values - Array of values
 * @param {number} period - EMA period
 * @returns {Array<number>} EMA values
 */
export function ema(values, period) {
	const k = 2 / (period + 1);
	const result = [];
	
	result[0] = values[0];
	for (let i = 1; i < values.length; i++) 
		result[i] = values[i] * k + result[i - 1] * (1 - k);
	
	return result;
}

/**
 * Simple Moving Average
 * @param {Array<number>} values - Array of values
 * @param {number} period - SMA period
 * @returns {number|null} SMA value
 */
export function sma(values, period) {
	if (!values || values.length < period) return null;
	const slice = values.slice(-period);
	const sum = slice.reduce((a, b) => a + b, 0);
	return sum / slice.length;
}
