import { randomUUID, createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { StorageService } from './StorageService.js';

/**
 * OAuth 2.0 service with PKCE support for secure authentication
 */
export class OAuthService {
	/**
	 * Create an OAuthService instance
	 * @param {Object} parameters - Configuration parameters
	 * @param {Object} parameters.logger - Logger instance
	 * @throws {Error} If logger is not provided
	 */
	constructor(parameters) {
		this.logger = parameters.logger || null;
		if (!this.logger) throw new Error('OAuthService requires a logger instance in options');

		this.JWT_SECRET = process.env.JWT_SECRET || null;
		if (!this.JWT_SECRET) throw new Error('OAuthService requires JWT_SECRET to be set in environment variables');

		this.storage = StorageService.getInstance();

		// Validation schemas
		this.registerSchema = z.object({
			client_name: z.string().min(1).max(255).optional(),
			redirect_uris: z.array(z.string().url()).min(1),
		});

		this.authorizeSchema = z.object({
			client_id: z.string().uuid(),
			redirect_uri: z.string().url(),
			code_challenge: z.string().min(43).max(128),
			code_challenge_method: z.enum(['S256']),
			state: z.string().optional(),
			scope: z.string().optional(),
		});

		this.tokenSchema = z.object({
			grant_type: z.enum(['authorization_code', 'refresh_token']),
			client_id: z.string().uuid(),
			code: z.string().uuid().optional(),
			code_verifier: z.string().min(43).max(128).optional(),
			refresh_token: z.string().optional(),
			scope: z.string().optional(),
		});
	}

	/**
	 * Get OAuth route definitions
	 * @returns {Array<Object>} Array of route configurations
	 */
	getRoutes() {
		const routes = [
			{
				method: 'get',
				path: '/.well-known/oauth-authorization-server',
				handler: this.wellKnownGetHandler,
			},
			{
				method: 'post',
				path: '/oauth/register',
				handler: this.registerPostHandler,
			},
			{
				method: 'get',
				path: '/oauth/authorize',
				handler: this.authorizeGetHandler,
			},
			{
				method: 'post',
				path: '/oauth/token',
				handler: this.tokenPostHandler,
			},
		];
		return routes;
	}

	// oAuth Step #1 - Authorization Server Metadata
	wellKnownGetHandler(req, res) {
		const protocol = req.protocol;
		const host = req.get('host');
		const issuer = `${protocol}://${host}`;

		res.status(200).json({
			issuer: `${issuer}`,
			authorization_endpoint: `${issuer}/oauth/authorize`,
			token_endpoint: `${issuer}/oauth/token`,
			registration_endpoint: `${issuer}/oauth/register`,
			grant_types_supported: ['authorization_code', 'client_credentials'],
			code_challenge_methods_supported: ['S256'],
			response_types_supported: ['code'],
		});
	}

	// oAuth Step #2 - Dynamic Client Registration : retuns server capabilities and client_id/secret
	registerPostHandler(req, res) {
		// Validate input
		const validation = this.registerSchema.safeParse(req.body);
		if (!validation.success) {
			const errorMsg = 'Invalid registration request';
			this.logger.verbose(`${errorMsg}: ${validation.error.message}`);
			return res.status(400).json({
				error: 'invalid_request',
				error_description: errorMsg,
				details: validation.error.issues,
			});
		}

		const params = validation.data;
		const client_id = randomUUID();
		const client_secret = randomUUID();
		const client_name = params.client_name || 'Unnamed App';
		const client_redirect_uris = params.redirect_uris;

		this.storage.setClient(client_id, {
			client_secret: client_secret,
			client_name: client_name,
			client_redirect_uris: client_redirect_uris,
		});

		res.status(201).json({
			client_id: client_id,
			client_secret: client_secret,
			client_name: client_name,
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'none',
			scope: 'all',
			redirect_uris: client_redirect_uris,
		});
	}

	// oAuth Step #3 - Client sends a auth request
	authorizeGetHandler(req, res) {
		// Validate input
		const validation = this.authorizeSchema.safeParse(req.query);
		if (!validation.success) {
			const errorMsg = 'Invalid authorization request';
			this.logger.verbose(`${errorMsg}: ${validation.error.message}`);
			return res.status(400).json({
				error: 'invalid_request',
				error_description: errorMsg,
				details: validation.error.issues,
			});
		}

		const params = validation.data;
		const { client_id, redirect_uri, code_challenge, code_challenge_method, state, scope } = params;

		// Check if client exists
		const client = this.storage.getClient(client_id);
		if (!client) {
			const errorMsg = 'Client not found';
			this.logger.verbose(errorMsg);
			return res.status(400).json({
				error: 'invalid_client',
				error_description: errorMsg,
			});
		}

		// CRITICAL: Validate redirect_uri against registered URIs
		if (!client.client_redirect_uris || !client.client_redirect_uris.includes(redirect_uri)) {
			const errorMsg = 'Invalid redirect_uri: not registered for this client';
			this.logger.info(`${errorMsg} - Client: ${client_id}, URI: ${redirect_uri}`);
			return res.status(400).json({
				error: 'invalid_request',
				error_description: errorMsg,
			});
		}

		// Validate code_challenge_method
		if (code_challenge_method !== 'S256') {
			const errorMsg = 'Only S256 code_challenge_method is supported';
			this.logger.verbose(errorMsg);
			return res.status(400).json({
				error: 'invalid_request',
				error_description: errorMsg,
			});
		}

		// Store authorization code with PKCE challenge
		client.code_challenge = code_challenge;
		client.code = randomUUID();
		client.code_creation_date = Date.now();
		client.scope = scope || 'all';

		this.storage.setClient(client_id, client);

		const redirectUrl = new URL(redirect_uri);
		redirectUrl.searchParams.set('code', client.code);
		if (state) redirectUrl.searchParams.set('state', state);

		res.redirect(302, redirectUrl.toString());
	}

	// oAuth Step #4 - Client asks for token (or refresh) server assess and sends
	async tokenPostHandler(req, res) {
		// Validate input
		const validation = this.tokenSchema.safeParse(req.body);
		if (!validation.success) {
			const errorMsg = 'Invalid token request';
			this.logger.verbose(`${errorMsg}: ${validation.error.message}`);
			return res.status(400).json({
				error: 'invalid_request',
				error_description: errorMsg,
				details: validation.error.issues,
			});
		}

		const params = validation.data;
		let client_id = params.client_id;
		let scope = params.scope || 'all';

		if (params.grant_type === 'authorization_code') {
			if (!params.code || !params.code_verifier) {
				const errorMsg = 'Missing code or code_verifier for authorization_code grant';
				this.logger.verbose(errorMsg);
				return res.status(400).json({ error: 'invalid_request', error_description: errorMsg });
			}

			// Get client data
			const client = this.storage.getClient(client_id);
			if (!client) {
				const errorMsg = 'Client not found';
				this.logger.info(errorMsg);
				return res.status(400).json({ error: 'invalid_client', error_description: errorMsg });
			}

			// Verify the authorization code matches
			if (client.code !== params.code) {
				const errorMsg = 'Invalid authorization code';
				this.logger.info(errorMsg);
				return res.status(400).json({ error: 'invalid_grant', error_description: errorMsg });
			}

			const elapsedSinceRequest = Date.now() - client.code_creation_date;
			const codeExpirationMs = parseInt(process.env.OAUTH_AUTHORIZATION_CODE_DURATION, 10) * 60 * 1000;

			if (elapsedSinceRequest > codeExpirationMs) {
				const errorMsg = 'Expired authorization code';
				this.logger.verbose(errorMsg);

				client.code = null;
				client.code_challenge = null;
				client.code_creation_date = null;
				this.storage.setClient(client_id, client);

				return res.status(400).json({ error: 'invalid_grant', error_description: errorMsg });
			}

			// Verify PKCE challenge
			const computedChallenge = this.computeChallenge(params.code_verifier);
			if (computedChallenge !== client.code_challenge) {
				const errorMsg = 'PKCE verification failed';
				this.logger.info(errorMsg);
				return res.status(400).json({ error: 'invalid_grant', error_description: errorMsg });
			}

			// Use scope from authorization request if available
			scope = client.scope || scope;

			// Delete the authorization code (one-time use)
			client.code = null;
			client.code_challenge = null;
			client.code_creation_date = null;
			this.storage.setClient(client_id, client);
		} else if (params.grant_type === 'refresh_token') {
			if (!params.refresh_token) {
				const errorMsg = 'Missing refresh_token';
				this.logger.verbose(errorMsg);
				return res.status(400).json({ error: 'invalid_request', error_description: errorMsg });
			}

			const validation = this.validateToken(params.refresh_token);
			if (!validation.valid) {
				const errorMsg = 'Invalid or expired refresh_token';
				this.logger.info(`${errorMsg}: ${validation.error}`);
				return res.status(400).json({ error: 'invalid_grant', error_description: errorMsg });
			}
			client_id = validation.payload.sub;
		}

		const accessTokenDuration = parseInt(process.env.OAUTH_ACCESS_TOKEN_DURATION, 10) * 60;
		const refreshTokenDuration = parseInt(process.env.OAUTH_REFRESH_TOKEN_DURATION, 10) * 60;

		const accessToken = this.createToken(client_id, accessTokenDuration, { scope });
		const refreshToken = this.createToken(client_id, refreshTokenDuration, { scope });

		res.status(200).json({
			access_token: accessToken,
			token_type: 'Bearer',
			expires_in: accessTokenDuration,
			refresh_token: refreshToken,
			scope: scope,
		});
	}

	computeChallenge(verifier) {
		return createHash('sha256').update(verifier).digest('base64url');
	}

	createToken(userId, duration, additionalClaims = {}) {
		const token = jwt.sign(
			{
				sub: userId,
				iat: Math.floor(Date.now() / 1000),
				...additionalClaims,
			},
			this.JWT_SECRET,
			{
				expiresIn: duration,
			}
		);
		return token;
	}

	validateToken(token) {
		try {
			const payload = jwt.verify(token, this.JWT_SECRET);
			return { valid: true, payload };
		} catch (error) {
			let errorType = 'unknown';
			if (error.name === 'TokenExpiredError') errorType = 'expired';
			else if (error.name === 'JsonWebTokenError') errorType = 'invalid';
			else if (error.name === 'NotBeforeError') errorType = 'not_active';

			return { valid: false, error: errorType, details: error.message };
		}
	}
}

export default OAuthService;
