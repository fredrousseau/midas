/**
 * Trading API Routes
 * REST API endpoints for trading services - Simplified version
 */

import { asyncHandler, parseTradingParams, errorHandler } from './Utils/helpers.js';
import { getTimezone } from './Utils/timezone.js';

/**
 * Register all trading routes
 * @param {Express} app - Express application
 * @param {TradingService} tradingService - Trading service instance
 * @param {Object} logger - Logger instance
 */
export function registerTradingRoutes(options) {
	const app = options.app || null;
	if (!app) throw new Error('registerTradingRoutes requires an app instance in options');

	const dataProvider = options.dataProvider || null;
	if (!dataProvider) throw new Error('registerTradingRoutes requires a dataProvider class in options');

	const indicatorService = options.indicatorService || null;
	if (!indicatorService) throw new Error('registerTradingRoutes requires an indicatorService instance in options');

	const marketDataService = options.marketDataService || null;
	if (!marketDataService) throw new Error('registerTradingRoutes requires a marketDataService instance in options');

	const markerAnalysisService = options.markerAnalysisService || null;
	if (!markerAnalysisService) throw new Error('registerTradingRoutes requires a markerAnalysisService instance in options');

	const logger = options.logger || null;
	if (!logger) throw new Error('registerTradingRoutes requires a logger instance in options');

	// ========== MARKET DATA ==========

	app.get(
		'/api/price/:symbol',
		asyncHandler(async (req) => {
			const { symbol } = req.params;
			logger.info(`GET /api/price/${symbol} - Fetching current price`);

			const price = await marketDataService.getPrice(symbol);
			return {
				symbol,
				timestamp: Date.now(),
				value: price,
			};
		})
	);

	app.get(
		'/api/ohlcv',
		asyncHandler(async (req) => {
			logger.info('GET /api/ohlcv - Fetching OHLCV');
			const { symbol, timeframe, count, from, to } = parseTradingParams(req.query);

			if (!symbol) {
				const error = new Error('symbol is required');
				error.statusCode = 400;
				throw error;
			}

			return await marketDataService.loadOHLCV({ symbol, timeframe, count, from, to });
		})
	);

	app.get(
		'/api/pairs',
		asyncHandler(async (req) => {
			const { quoteAsset, baseAsset, status } = req.query;
			logger.info('GET /api/pairs - Fetching available trading pairs');

			const pairs = await marketDataService.getPairs({ quoteAsset, baseAsset, status });
			return { count: pairs.length, pairs };
		})
	);

	// ========== INDICATORS ==========

	app.get(
		'/api/catalog',
		asyncHandler(async (req) => {
			logger.info('GET /api/catalog - Fetching trading indicator catalog');
			const { category } = req.query;
			return indicatorService.getCatalog(category);
		})
	);

	app.get(
		'/api/indicator/:name',
		asyncHandler(async (req) => {
			const { name } = req.params;
			logger.info(`GET /api/indicator/${name} - Fetching indicator metadata`);

			const metadata = indicatorService.getIndicatorMetadata(name);
			if (!metadata) {
				const error = new Error(`Indicator '${name}' does not exist`);
				error.statusCode = 404;
				throw error;
			}
			return metadata;
		})
	);

	app.get(
		'/api/indicators/:indicator',
		asyncHandler(async (req) => {
			const { indicator } = req.params;
			const { symbol, config } = req.query;
			const { timeframe, bars } = parseTradingParams(req.query);

			logger.info(`GET /api/indicators/${indicator} - Getting time series for ${symbol}`);

			if (!symbol) {
				const error = new Error('symbol is required');
				error.statusCode = 400;
				throw error;
			}

			return await indicatorService.getIndicatorTimeSeries({
				symbol,
				indicator,
				timeframe,
				bars,
				config: config ? JSON.parse(config) : {},
			});
		})
	);

	// ========== REGIME DETECTION ==========

	app.get(
		'/api/regime',
		asyncHandler(async (req) => {
			logger.info('GET /api/regime - Detecting market regime');
			const { symbol, timeframe, count } = parseTradingParams(req.query);

			if (!symbol) {
				const error = new Error('symbol is required');
				error.statusCode = 400;
				throw error;
			}

			return await markerAnalysisService.detectRegime({ symbol, timeframe, count });
		})
	);



	// ========== STATISTICAL CONTEXT (UNIFIED) ==========

	app.get(
		'/api/context/enriched',
		asyncHandler(async (req) => {
			logger.info('GET /api/context/enriched - Unified enriched context');
			const { symbol, timeframes, count } = req.query;

			if (!symbol) {
				const error = new Error('symbol is required');
				error.statusCode = 400;
				throw error;
			}

			const tfArray = timeframes ? timeframes.split(',').map((tf) => tf.trim()) : ['1h'];
			const barCount = count ? parseInt(count, 10) : 200;

			if (isNaN(barCount) || barCount < 50 || barCount > 500) {
				const error = new Error('count must be between 50 and 500');
				error.statusCode = 400;
				throw error;
			}

			return await markerAnalysisService.generateEnrichedContext({
				symbol,
				timeframes: tfArray,
				count: barCount,
			});
		})
	);

	app.get(
		'/api/context/mtf-quick',
		asyncHandler(async (req) => {
			logger.info('GET /api/context/mtf-quick - Quick multi-timeframe check');
			const { symbol, timeframes } = req.query;

			if (!symbol) {
				const error = new Error('symbol is required');
				error.statusCode = 400;
				throw error;
			}

			const tfArray = timeframes ? timeframes.split(',').map((tf) => tf.trim()) : ['1d', '4h', '1h'];

			if (tfArray.length < 2 || tfArray.length > 5) {
				const error = new Error('Provide between 2 and 5 timeframes');
				error.statusCode = 400;
				throw error;
			}

			return await markerAnalysisService.quickMultiTimeframeCheck({
				symbol,
				timeframes: tfArray,
			});
		})
	);
	// ========== UTILITY ==========

	app.get(
		'/api/config',
		asyncHandler(() => {
			logger.info('GET /api/config - Getting client configuration');
			return {
				timezone: getTimezone(),
			};
		})
	);
	// ========== CACHE MANAGEMENT ==========

	app.get(
		'/api/cache/stats',
		asyncHandler(() => {
			logger.info('GET /api/cache/stats - Getting cache statistics');
			return dataProvider.getCacheStats();
		})
	);

	app.delete(
		'/api/cache',
		asyncHandler((req) => {
			const { symbol, timeframe } = req.query;
			logger.info(`DELETE /api/cache - Clearing cache for ${symbol || 'all'}:${timeframe || 'all'}`);
			const cleared = dataProvider.clearCache({ symbol, timeframe });
			return {
				success: true,
				cleared,
				message: `Cleared ${cleared} cache item(s)`,
			};
		})
	);

	// Error handler middleware (must be last)
	app.use('/api', errorHandler(logger));

	logger.info('Trading API routes registered successfully');
}

export default registerTradingRoutes;
