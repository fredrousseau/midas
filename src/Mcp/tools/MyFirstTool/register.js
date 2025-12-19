import mcpGetPrice from './mcpGetPrice.js';

/**
 * Registers the MyFirstTool module with the MCP service.
 * This function initializes and registers all tools provided by the MyFirstTool module.
 *
 */

export async function register(parameters) {
	const logger = parameters.logger || null;
	if (!logger) throw new Error('Register requires a logger instance in parameters');

	const mcpService = parameters.mcpService || null;
	if (!mcpService) throw new Error('Register requires mcpService instance in parameters');

	const marketDataService = parameters.marketDataService || null;
	if (!marketDataService) throw new Error('Register requires marketDataService instance in parameters');

	try {
		// Build the tools
		const tools = [mcpGetPrice({ provider: marketDataService, logger: logger })];

		// Register each tool with MCP service
		for (const tool of tools) mcpService.registerTool(tool.name, tool.config, tool.handler);

		return {
			success: true,
			module: 'MyFirstTool',
			tools: tools,
		};
	} catch (error) {
		logger.error(`Failed to register MyFirstTool module: ${error.message}`);
		return {
			success: false,
			module: 'MyFirstTool',
			error: error.message,
			stack: error.stack,
		};
	}
}

export default { register };
