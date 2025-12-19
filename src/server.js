// Environment is loaded via import 'dotenv/config' at file top so other modules see process.env
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { logger } from './Logger/LoggerService.js';

import { OAuthService } from './MCP/OAuthService.js';
import { McpService } from './MCP/McpService.js';

import { registerTradingRoutes } from './routes.js';
import { hasKeys } from './Utils/helpers.js';

import { BinanceAdapter } from './DataProvider/BinanceAdapter.js';
import { DataProvider } from './DataProvider/DataProvider.js';

import { MarketDataService } from './Trading/MarketData/MarketDataService.js';
import { IndicatorService } from './Trading/Indicator/IndicatorService.js';
import { MarketAnalysisService } from './Trading/MarketAnalysis/MarketAnalysisService.js';

// Load server options from environment variables

// Evaluate security flag once at startup
const SECURED = String(process.env.SECURED_SERVER || 'true').toLowerCase() === 'true';

const app = express();

// Configure CORS with more restrictive settings
app.use(
	cors({
		origin: process.env.CORS_ORIGIN || '*',
		methods: ['GET', 'POST'],
		allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
		credentials: true,
		maxAge: 86400,
	})
);
app.use(express.json()); // Parse application/json
app.use(express.urlencoded({ extended: true })); // Parse application/x-www-form-urlencoded

// Helper to create rate limiters with consistent logging
function makeLimiter({ windowMs = 15 * 60 * 1000, max = 100 } = {}) {
	return rateLimit({
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		handler: (req, res) => {
			logger.info(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
			res.status(429).json({ error: 'too_many_requests' });
		},
	});
}

const oauthLimiter = makeLimiter({ max: 100 });
const tokenLimiter = makeLimiter({ max: 20 });

// HTTP Logger Middleware
app.use((req, res, next) => {
	const start = Date.now();

	res.once('finish', () => {
		const duration = Date.now() - start;
		logger.verbose(`${req.ip} ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
	});

	if (hasKeys(req.body)) logger.verbose({ tag: 'Incoming Body', body: req.body });
	if (hasKeys(req.query)) logger.verbose({ tag: 'Incoming Query', query: req.query });

	next();
});

// Initialize OAuth service and register its routes on the express app
const oauth = new OAuthService({ logger });
const routes = oauth.getRoutes();

routes.forEach((route) => {
	const middleware = [];
	if (route.path === '/oauth/token') middleware.push(tokenLimiter);
	else if (route.path.startsWith('/oauth/')) middleware.push(oauthLimiter);
	middleware.push(route.handler.bind(oauth));
	app[route.method](route.path, ...middleware);
});

// Initialize TradingService (core trading functionality)

const binanceAdapter = new BinanceAdapter({
	logger: logger,
	baseUrl: 'https://api.binance.com',
});

const dataProvider = new DataProvider({
	dataAdapter: binanceAdapter,
	logger: logger,
	enableCache: true,
	cacheTTL: 60000,
});

const marketDataService = new MarketDataService({
	logger: logger,
	dataProvider: dataProvider,
});

const indicatorService = new IndicatorService({
	logger: logger,
	dataProvider: dataProvider,
});

const marketAnalysisService = new MarketAnalysisService({
	logger: logger,
	dataProvider: dataProvider,
	indicatorService: indicatorService,
});

const mcpService = new McpService({
	logger: logger,
	name: 'fred',
	version: '1.0.0',
});

// Auto-register all MCP tool modules with tradingService dependency
await mcpService.registerAllModules({
	mcpService: mcpService,
	logger: logger,
	dataProvider: dataProvider,
	marketDataService: marketDataService,
	indicatorService: indicatorService,
	marketAnalysisService: marketAnalysisService,
});

registerTradingRoutes({
	app: app,
	logger: logger,
	dataProvider: dataProvider,
	marketDataService: marketDataService,
	indicatorService: indicatorService,
	markerAnalysisService: marketAnalysisService,
});

//	Handler - API health/status endpoint
app.get('/api/status', (req, res) => {
	res.status(200).json({ status: 'ok' });
});

// Serve static files from public directory (for web UI)
// This should be AFTER API routes so that API routes take precedence
app.use(express.static('src/WebUI'));

// Auth Middleware - Verify JWT Token / If SECURED_SERVER is disabled, middleware will bypass authentication.
function authMiddleware(req, res, next) {
	if (!SECURED) return next();

	const { authorization: authHeader } = req.headers;
	if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing or invalid authorization header' });

	const token = authHeader.slice(7).trim();
	if (!token) return res.status(401).json({ error: 'Token cannot be empty' });

	const validation = oauth.validateToken(token);
	if (!validation.valid) return res.status(401).json({ error: 'Invalid or expired token' });

	req.user = { id: validation.payload.sub, scope: validation.payload.scope };
	next();
}

// MCP Tools List Endpoint - Return tools with properly formatted schemas
app.get('/mcp/tools', (req, res) => {
	logger.info('GET /mcp/tools - Returning registered tools');
	res.json({ tools: mcpService.getTools() });
});

// MCP Server Handler - POST only (SSE support removed)
app.post('/mcp', authMiddleware, async (req, res) => {
	// Delegate handling to the McpService which manages transports and sessions
	await mcpService.handleRequest(req, res);
});

// HTTP 404 Middleware (must be last) Catch-all for unknown routes
app.use((req, res) => {
	res.status(404).json({ error: 'Route not found' });
});

// Start listening on the configured port
const PORT = process.env.PORT || 3000;
app
	.listen(PORT, () => {
		logger.info(`Server running on http://localhost:${PORT} - Log Level: ${logger.level} - Secured Mode : ${SECURED}`);
	})
	.on('error', (err) => {
		logger.error(`Server error: ${err.message}`);
		process.exit(1);
	});
