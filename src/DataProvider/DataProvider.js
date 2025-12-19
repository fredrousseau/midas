/**
 * Data provider service for fetching and caching OHLCV market data
 */
export class DataProvider {
	/**
	 * Create a DataProvider instance
	 * @param {Object} parameters - Configuration parameters
	 * @param {Object} parameters.dataAdapter - Data adapter for fetching market data
	 * @param {Object} parameters.logger - Logger instance
	 * @param {number} [parameters.cacheTTL=60000] - Cache time-to-live in milliseconds
	 * @param {boolean} [parameters.enableCache=true] - Enable caching
	 * @param {number} [parameters.maxDataPoints=5000] - Maximum number of data points
	 */
	constructor(parameters = {}) {
		this.dataAdapter = parameters.dataAdapter;
		this.logger = parameters.logger;
		this.cache = new Map();
		this.cacheTTL = parameters.cacheTTL || 60000;
		this.enableCache = parameters.enableCache !== false;
		this.maxDataPoints = parameters.maxDataPoints || 5000;
		this.logger.info('DataProvider initialized');
	}

	/**
	 * Generate cache key from symbol and timeframe
	 * @private
	 * @param {string} symbol - Trading symbol
	 * @param {string} timeframe - Timeframe
	 * @returns {string} Cache key
	 */
	_getCacheKey(symbol, timeframe) {
		return `${symbol}:${timeframe}`;
	}

	/**
	 * Check if cache entry is still valid
	 * @private
	 * @param {number} timestamp - Cache entry timestamp
	 * @returns {boolean} True if cache is valid
	 */
	_isCacheValid(timestamp) {
		return Date.now() - timestamp < this.cacheTTL;
	}

	/**
	 * Convert timeframe string to milliseconds
	 * @private
	 * @param {string} timeframe - Timeframe string (e.g., '1h', '5m', '1d')
	 * @returns {number} Timeframe in milliseconds
	 * @throws {Error} If timeframe format is invalid
	 */
	_timeframeToMs(timeframe) {
		const units = { m: 60e3, h: 36e5, d: 864e5, w: 6048e5, M: 2592e6 };
		const match = timeframe.match(/^(\d+)([mhdwM])$/);
		if (!match) throw new Error(`Invalid timeframe format: ${timeframe}`);
		const unitMs = units[match[2]];
		if (!unitMs) throw new Error(`Unknown timeframe unit: ${match[2]}`);
		return parseInt(match[1]) * unitMs;
	}

	/**
	 * Validate OHLCV data structure and values
	 * @private
	 * @param {Array<Object>} ohlcv - OHLCV data array
	 * @throws {Error} If data is invalid
	 */
	_validateOHLCVData(ohlcv) {
		if (!Array.isArray(ohlcv) || !ohlcv.length) throw new Error('OHLCV data must be a non-empty array');
		if (ohlcv.length > this.maxDataPoints) throw new Error(`Data exceeds maximum size (${ohlcv.length} > ${this.maxDataPoints})`);

		const required = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
		for (let i = 0; i < ohlcv.length; i++) {
			const bar = ohlcv[i];
			if (!bar || typeof bar !== 'object') throw new Error(`Bar ${i} is not a valid object`);

			for (const field of required) if (typeof bar[field] !== 'number' || bar[field] < 0) throw new Error(`Bar ${i}: Invalid ${field}`);

			if (bar.high < bar.low || bar.high < bar.open || bar.high < bar.close || bar.low > bar.open || bar.low > bar.close) throw new Error(`Bar ${i}: Invalid OHLC relationship`);
		}
	}

	/**
	 * Clean OHLCV data by removing duplicates and sorting
	 * @private
	 * @param {Array<Object>} ohlcv - OHLCV data array
	 * @returns {Array<Object>} Cleaned and sorted OHLCV data
	 */
	_cleanOHLCVData(ohlcv) {
		const seen = new Map();
		for (const bar of ohlcv) seen.set(bar.timestamp, bar);
		return Array.from(seen.values()).sort((a, b) => a.timestamp - b.timestamp);
	}

	/**
	 * Detect gaps in OHLCV data timeline
	 * @private
	 * @param {Array<Object>} ohlcv - OHLCV data array
	 * @param {string} timeframe - Timeframe string
	 * @returns {Array<Object>} Array of detected gaps
	 */
	_detectGaps(ohlcv, timeframe) {
		const gaps = [];
		const timeframeMs = this._timeframeToMs(timeframe);
		for (let i = 1; i < ohlcv.length; i++) {
			const expected = ohlcv[i - 1].timestamp + timeframeMs;
			const actual = ohlcv[i].timestamp;
			if (actual !== expected)
				gaps.push({
					before: ohlcv[i - 1].timestamp,
					after: actual,
					expectedBars: Math.round((actual - expected) / timeframeMs),
				});
		}
		return gaps;
	}

	/**
	 * Load OHLCV data for a symbol and timeframe
	 * @param {Object} options - Load options
	 * @param {string} options.symbol - Trading symbol (e.g., 'BTCUSDT')
	 * @param {string} [options.timeframe='1h'] - Timeframe (e.g., '1h', '5m', '1d')
	 * @param {number} [options.count=200] - Number of bars to fetch
	 * @param {number} [options.from] - Start timestamp
	 * @param {number} [options.to] - End timestamp
	 * @param {boolean} [options.useCache=true] - Use cached data if available
	 * @param {boolean} [options.detectGaps=true] - Detect gaps in data
	 * @returns {Promise<Object>} OHLCV data with metadata
	 * @throws {Error} If symbol is missing or count is out of range
	 */
	async loadOHLCV(options = {}) {
		const { symbol, timeframe = '1h', count = 200, from, to, useCache = true, detectGaps = true } = options;

		if (!symbol) throw new Error('Symbol is required');
		if (count < 1 || count > this.maxDataPoints) throw new Error(`Count must be between 1 and ${this.maxDataPoints}`);

		const startTime = Date.now();
		const cacheKey = this._getCacheKey(symbol, timeframe);

		// Check cache with intelligent bar count validation
		if (useCache && this.enableCache && this.cache.has(cacheKey)) {
			const cached = this.cache.get(cacheKey);
			const cachedBarCount = cached.data?.bars?.length || 0;

			// Cache is valid if:
			// 1. Not expired (TTL check)
			// 2. Has enough bars to satisfy the request
			if (this._isCacheValid(cached.timestamp) && cachedBarCount >= count) {
				this.logger.info(`Cache hit for ${symbol} (${timeframe}, ${count}/${cachedBarCount} bars)`);

				// Return only the requested number of bars (most recent)
				const trimmedBars = cached.data.bars.slice(-count);
				return {
					...cached.data,
					bars: trimmedBars,
					count: trimmedBars.length,
					firstTimestamp: trimmedBars.at(0)?.timestamp ?? null,
					lastTimestamp: trimmedBars.at(-1)?.timestamp ?? null,
					fromCache: true,
					cachedBarCount,
				};
			}

			// Cache exists but insufficient data or expired
			if (this._isCacheValid(cached.timestamp) && cachedBarCount < count) 
				this.logger.info(`Cache insufficient for ${symbol} (${timeframe}): has ${cachedBarCount} bars, need ${count}`);
			
			this.cache.delete(cacheKey);
		}

		try {
			const rawData = await this.dataAdapter.fetchOHLC({ symbol, timeframe, count, from, to });
			this._validateOHLCVData(rawData);
			const cleanedData = this._cleanOHLCVData(rawData);
			const gaps = detectGaps ? this._detectGaps(cleanedData, timeframe) : [];
			const duration = Date.now() - startTime;
			const gapInfo = gaps.length > 0 ? ` (${gaps.length} gaps detected)` : '';

			const response = {
				symbol,
				timeframe,
				count: cleanedData.length,
				bars: cleanedData, // Keep raw bars for internal use
				firstTimestamp: cleanedData.at(0)?.timestamp ?? null,
				lastTimestamp: cleanedData.at(-1)?.timestamp ?? null,
				gaps,
				gapCount: gaps.length,
				fromCache: false,
				loadDuration: duration,
				loadedAt: new Date().toISOString(),
			};

			// Smart caching: Always keep the maximum bars fetched for this symbol/timeframe
			if (this.enableCache) {
				const existing = this.cache.get(cacheKey);
				const existingBarCount = existing?.data?.bars?.length || 0;

				// Only update cache if we fetched more bars than what's already cached
				if (cleanedData.length >= existingBarCount) {
					this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
					this.logger.verbose(`Cache updated: ${symbol} (${timeframe}) with ${cleanedData.length} bars`);
				} else {
					this.logger.verbose(`Cache NOT updated: existing cache has more bars (${existingBarCount} > ${cleanedData.length})`);
				}
			}

			this.logger.info(`Data Loaded : ${symbol} (${timeframe} / ${cleanedData.length}) bars in ${duration}ms${gapInfo}`);

			return response;
		} catch (error) {
			this.logger.error(`Error loading data for ${symbol}: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Clear cache entries
	 * @param {Object} [options={}] - Clear options
	 * @param {string} [options.symbol] - Symbol to clear (clears all if not specified)
	 * @param {string} [options.timeframe] - Timeframe to clear
	 * @returns {number} Number of cache entries removed
	 */
	clearCache(options = {}) {
		const { symbol, timeframe } = options;

		if (!symbol && !timeframe) {
			const size = this.cache.size;
			this.cache.clear();
			this.logger.info(`Cache cleared (${size} items removed)`);
			return size;
		}

		let cleared = 0;
		if (timeframe) {
			const cacheKey = this._getCacheKey(symbol, timeframe);
			if (this.cache.has(cacheKey)) {
				this.cache.delete(cacheKey);
				cleared = 1;
			}
		} else {
			this.cache.forEach((_, key) => {
				if (key.startsWith(symbol + ':')) {
					this.cache.delete(key);
					cleared++;
				}
			});
		}

		this.logger.info(`Cache cleared (${cleared} items removed)`);
		return cleared;
	}

	/**
	 * Get current price for a symbol
	 * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
	 * @returns {Promise<number>} Current price
	 */
	getPrice(symbol) {
		return this.dataAdapter.getPrice(symbol);
	}

	/**
	 * Get available trading pairs
	 * @param {Object} options - Options for filtering pairs
	 * @returns {Promise<Array>} List of available trading pairs
	 */
	getPairs(options){
		return this.dataAdapter.getPairs(options);
	}
	/**
	 * Get cache statistics
	 * @returns {Object} Cache statistics including size, TTL, and item details
	 */
	getCacheStats() {
		const items = [];
		for (const [key, value] of this.cache.entries()) {
			const age = Date.now() - value.timestamp;
			const isValid = this._isCacheValid(value.timestamp);
			items.push({
				key,
				barCount: value.data?.bars?.length || 0,
				age: Math.round(age / 1000), // seconds
				isValid,
				loadedAt: value.data?.loadedAt,
			});
		}

		return {
			enabled: this.enableCache,
			ttl: this.cacheTTL / 1000, // convert to seconds
			size: this.cache.size,
			items,
		};
	}
}
