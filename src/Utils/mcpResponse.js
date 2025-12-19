/**
 * MCP Response Utilities - Simplified
 *
 * Helpers to format responses according to JSON-RPC 2.0 for MCP protocol.
 * Standard error codes:
 * -32602: Invalid params / -32601: Not found / -32603: Internal error
 */

export function mcpSuccess(data) {
	return {
		content: [
			{
				type: 'text',
				mimeType: 'application/json',
				text: JSON.stringify(data),
			},
		],
	};
}

export function mcpError(message, details = {}, code = -32603) {
	return {
		content: [
			{
				type: 'text',
				mimeType: 'application/json',
				text: JSON.stringify({
					error: {
						code,
						message,
						data: Object.keys(details).length > 0 ? details : undefined,
					},
				}),
			},
		],
		isError: true,
	};
}

export default {
	mcpSuccess,
	mcpError,
};
