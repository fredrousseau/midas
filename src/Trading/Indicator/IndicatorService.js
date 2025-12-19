import { Indicator } from './indicators.js';
import { getFormattedCatalog, getIndicatorMetadata } from './registry.js';

export class IndicatorService {
	constructor(parameters = {}) {
		this.logger = parameters.logger || null;

		if (!this.logger) throw new Error('IndicatorService requires a logger instance in options');

		this.dataProvider = parameters.dataProvider || null;

		if (!this.dataProvider) throw new Error('IndicatorService requires a dataProvider instance in options');

		this.tradingIndicator = new Indicator({
			logger: this.logger,
			dataProvider: this.dataProvider,
		});

		this.logger.info('IndicatorService initialized.');
	}

	/**
	 * Get indicator catalog
	 * @param {string} category - Optional category filter
	 * @returns {Object} Indicator catalog
	 */
	getCatalog(category) {
		const fullCatalog = getFormattedCatalog();

		if (category) {
			if (!fullCatalog[category]) throw new Error(`Unknown category: ${category}. Valid categories: ${Object.keys(fullCatalog).join(', ')}`);

			return { [category]: fullCatalog[category] };
		}

		return fullCatalog;
	}

	/**
	 * Get metadata for a specific indicator
	 * @param {string} indicator - Indicator name
	 * @returns {Object|null} Indicator metadata
	 */
	getIndicatorMetadata(indicator) {
		return getIndicatorMetadata(indicator);
	}

	/**
	 * Calculate indicators for a symbol
	 * @param {Object} options - Calculation options
	 * @returns {Promise<Object>} Calculated indicators
	 */
	async calculateIndicators(options) {
		return await this.tradingIndicator.calculateIndicators(options);
	}

	/**
	 * Get indicator time series
	 * @param {Object} options - Time series options
	 * @returns {Promise<Object>} Indicator time series
	 */
	async getIndicatorTimeSeries(options) {
		return await this.tradingIndicator.getIndicatorTimeSeries(options);
	}
}

export default IndicatorService;
