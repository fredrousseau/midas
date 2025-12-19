/**
 * Get Price Data Tool - Token-optimized
 */

import { z } from 'zod';
import { createToolHandler } from  '#utils/mcpToolHandler.js';

export default function ({ provider, logger }) {
	return {
		name: 'MyFirstTool.getPrice',
		config: {
			description: 'Get detailed price data with 24h stats, bid/ask, and volume from Binance.',
			inputSchema: {
				symbol: z.string().describe('Trading symbol (e.g. BTCUSDT, ETHUSDT)'),
			},
		},
		handler: createToolHandler(
			async ({ symbol }) => {
				if (!symbol)
					throw new Error('Missing required parameter: symbol');

				return await provider.getPrice(symbol);
			},
			logger,
			'TradingIndicator'
		),
	};
}
