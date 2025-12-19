export class MarketDataService {
	/**
	 * Create a MarketDataService instance
	 * @param {Object} parameters - Configuration parameters
	 * @param {Object} parameters.logger - Logger instance for logging operations
	 * @param {Object} parameters.dataProvider - Data provider instance for fetching market data
	 * @throws {Error} If logger or dataProvider is not provided
	 */
	constructor(parameters = {}) {
		this.logger = parameters.logger || null;

		if (!this.logger)
			throw new Error('MarketDataService requires a logger instance in options');

		this.dataProvider = parameters.dataProvider || null;

		if (!this.dataProvider)
			throw new Error('MarketDataService requires a dataProvider instance in options');

		this.logger.info('MarketDataService initialized successfully');
	}

	/**
	 * Get current price for a symbol
	 * @param {string} symbol - Trading symbol (e.g., 'BTCUSDT')
	 * @returns {Promise<number>} Current price
	 */
	async getPrice(symbol) {
		return await this.dataProvider.getPrice(symbol);
	}

	/**
	 * Get available trading pairs
	 * @param {Object} options - Filter options
	 * @returns {Promise<Array>} Array of trading pairs
	 */
	async getPairs(options = {}) {
		return await this.dataProvider.getPairs(options);
	}

	/**
	 * Load OHLCV data for a symbol
	 * @param {Object} options - Load options
	 * @returns {Promise<Object>} OHLCV data
	 */
	async loadOHLCV(options) {
		const result = await this.dataProvider.loadOHLCV(options);

		// Transform bars to structured format with timestamp and values
		const data =
			result.bars?.map((bar) => ({
				timestamp: bar.timestamp,
				values: {
					open: bar.open,
					high: bar.high,
					low: bar.low,
					close: bar.close,
					volume: bar.volume,
				},
			})) || [];

		return {
			...result,
			data,
			bars: undefined, // Remove raw bars from API response
		};
	}

	/**
	 * Load OHLCV data for multiple timeframes
	 * @param {Object} options - Load options with timeframes array
	 * @returns {Promise<Object>} Multi-timeframe OHLCV data
	 */
	async loadOHLCVMultiTimeframe(options) {
		const { symbol, timeframes, count } = options;

		if (!symbol || !timeframes || !Array.isArray(timeframes)) throw new Error('symbol and timeframes array are required');

		const startTime = Date.now();
		const timeframeData = {};

		// Load data for each timeframe in parallel
		const promises = timeframes.map(async (timeframe) => {
			try {
				const result = await this.loadOHLCV({
					symbol,
					timeframe,
					count: count || 200,
				});
				return { timeframe, result, error: null };
			} catch (error) {
				this.logger.error(`Failed to load ${timeframe} for ${symbol}: ${error.message}`);
				return { timeframe, result: null, error: error.message };
			}
		});

		const results = await Promise.all(promises);

		// Build the response object
		for (const { timeframe, result, error } of results)
			if (error) timeframeData[timeframe] = { error };
			else
				timeframeData[timeframe] = {
					count: result.count,
					firstTimestamp: result.firstTimestamp,
					lastTimestamp: result.lastTimestamp,
					gapCount: result.gapCount,
					fromCache: result.fromCache,
					loadDuration: result.loadDuration,
					data: result.data,
				};

		return {
			symbol,
			timeframes,
			timeframeData,
			duration: Date.now() - startTime,
			loadedAt: new Date().toISOString(),
		};
	}
}

export default MarketDataService;
