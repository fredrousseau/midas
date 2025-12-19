/**
 * Timezone utility for formatting dates with configured timezone
 */

const TIMEZONE = process.env.TIMEZONE || 'Europe/Paris';

/**
 * Format a timestamp to a localized date string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @param {string} locale - Locale string (default: 'fr-FR')
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
function formatTimestamp(timestamp, locale = 'fr-FR', options = {}) {
	const defaultOptions = {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	};

	const mergedOptions = { ...defaultOptions, ...options };

	try {
		return new Intl.DateTimeFormat(locale, mergedOptions).format(new Date(timestamp));
	} catch (error) {
		// Fallback to ISO string if timezone is invalid
		console.error(`Invalid timezone: ${TIMEZONE}, falling back to ISO format`);
		return new Date(timestamp).toISOString();
	}
}

/**
 * Format a timestamp to ISO string in the configured timezone
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} ISO formatted date string
 */
function formatTimestampISO(timestamp) {
	return formatTimestamp(timestamp, 'en-CA', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});
}

/**
 * Get the configured timezone
 * @returns {string} Timezone identifier
 */
function getTimezone() {
	return TIMEZONE;
}

/**
 * Format timestamp for chart display (short format)
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted date string
 */
function formatChartTimestamp(timestamp) {
	return formatTimestamp(timestamp, 'fr-FR', {
		timeZone: TIMEZONE,
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
}

export {
	formatTimestamp,
	formatTimestampISO,
	formatChartTimestamp,
	getTimezone,
};
