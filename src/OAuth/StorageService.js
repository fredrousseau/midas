import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Storage service using SQLite for persistent client data management
 * Features:
 * - Automatic persistence with SQLite
 * - Auto-cleanup of expired tokens
 * - Transaction support for data integrity
 * - Optimized queries with indexes
 */
export class StorageService {
	static #instance = null;
	#db = null;
	#cleanupInterval = null;
	#cleanupIntervalMs = 60 * 60 * 1000; // 1 hour

	/**
	 * Create a StorageService instance (Singleton)
	 * @returns {StorageService} The singleton instance
	 */
	constructor() {
		if (StorageService.#instance)
			return StorageService.#instance;

		StorageService.#instance = this;
		this.#initialize();
	}

	/**
	 * Initialize the database and tables
	 * @private
	 */
	#initialize() {
		// Ensure data directory exists
		const dataDir = path.join(__dirname, '../../data');
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}

		// Open database
		const dbPath = path.join(dataDir, 'oauth-storage.db');
		this.#db = new Database(dbPath);

		// Enable WAL mode for better concurrency
		this.#db.pragma('journal_mode = WAL');

		// Create tables
		this.#createTables();

		// Start auto-cleanup
		this.#startAutoCleanup();

		console.log(`[StorageService] Initialized with database at ${dbPath}`);
	}

	/**
	 * Create database tables
	 * @private
	 */
	#createTables() {
		this.#db.exec(`
			CREATE TABLE IF NOT EXISTS clients (
				client_id TEXT PRIMARY KEY,
				metadata TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				expires_at INTEGER,
				updated_at INTEGER NOT NULL
			);

			CREATE INDEX IF NOT EXISTS idx_expires_at ON clients(expires_at);
			CREATE INDEX IF NOT EXISTS idx_created_at ON clients(created_at);
		`);
	}

	/**
	 * Start automatic cleanup of expired tokens
	 * @private
	 */
	#startAutoCleanup() {
		// Initial cleanup
		this.#cleanExpired();

		// Schedule periodic cleanup
		this.#cleanupInterval = setInterval(() => {
			this.#cleanExpired();
		}, this.#cleanupIntervalMs);
	}

	/**
	 * Clean expired tokens from database
	 * @private
	 */
	#cleanExpired() {
		try {
			const now = Date.now();
			const stmt = this.#db.prepare(`
				DELETE FROM clients
				WHERE expires_at IS NOT NULL AND expires_at < ?
			`);

			const result = stmt.run(now);

			if (result.changes > 0) {
				console.log(`[StorageService] Cleaned ${result.changes} expired clients`);
			}
		} catch (error) {
			console.error('[StorageService] Error during cleanup:', error);
		}
	}

	/**
	 * Calculate expiration timestamp from metadata
	 * @private
	 * @param {Object} metadata - Client metadata
	 * @returns {number|null} Expiration timestamp or null
	 */
	#calculateExpiresAt(metadata) {
		if (metadata.expiresAt) {
			return metadata.expiresAt;
		}

		if (metadata.token?.expires_in) {
			const createdAt = metadata.token.created_at || Date.now();
			return createdAt + (metadata.token.expires_in * 1000);
		}

		return null;
	}

	/**
	 * Get the singleton instance of StorageService
	 * @returns {StorageService} The singleton instance
	 */
	static getInstance() {
		if (!StorageService.#instance)
			StorageService.#instance = new StorageService();
		return StorageService.#instance;
	}

	/**
	 * Store or update client metadata
	 * @param {string} clientId - Unique client identifier
	 * @param {Object} metadata - Client metadata to store
	 */
	setClient(clientId, metadata = {}) {
		const now = Date.now();

		// Add timestamp if token data is present
		if (metadata.token && !metadata.token.created_at) {
			metadata.token.created_at = now;
		}

		const expiresAt = this.#calculateExpiresAt(metadata);
		const metadataJson = JSON.stringify(metadata);

		const stmt = this.#db.prepare(`
			INSERT INTO clients (client_id, metadata, created_at, expires_at, updated_at)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(client_id) DO UPDATE SET
				metadata = excluded.metadata,
				expires_at = excluded.expires_at,
				updated_at = excluded.updated_at
		`);

		stmt.run(clientId, metadataJson, now, expiresAt, now);
	}

	/**
	 * Retrieve client metadata
	 * @param {string} clientId - Unique client identifier
	 * @returns {Object|undefined} Client metadata or undefined if not found/expired
	 */
	getClient(clientId) {
		const now = Date.now();

		const stmt = this.#db.prepare(`
			SELECT metadata FROM clients
			WHERE client_id = ?
			AND (expires_at IS NULL OR expires_at > ?)
		`);

		const row = stmt.get(clientId, now);

		if (row) {
			return JSON.parse(row.metadata);
		}

		return undefined;
	}

	/**
	 * Delete client data
	 * @param {string} clientId - Unique client identifier
	 * @returns {boolean} True if client was deleted, false if not found
	 */
	delClient(clientId) {
		const stmt = this.#db.prepare('DELETE FROM clients WHERE client_id = ?');
		const result = stmt.run(clientId);
		return result.changes > 0;
	}

	/**
	 * Get all active clients (excluding expired ones)
	 * @returns {Map} Map of all non-expired clients
	 */
	getAllClients() {
		const now = Date.now();
		const stmt = this.#db.prepare(`
			SELECT client_id, metadata FROM clients
			WHERE expires_at IS NULL OR expires_at > ?
		`);

		const rows = stmt.all(now);
		const clients = new Map();

		for (const row of rows) {
			clients.set(row.client_id, JSON.parse(row.metadata));
		}

		return clients;
	}

	/**
	 * Get statistics about stored clients
	 * @returns {Object} Statistics object
	 */
	getStats() {
		const now = Date.now();

		const total = this.#db.prepare('SELECT COUNT(*) as count FROM clients').get();
		const active = this.#db.prepare(`
			SELECT COUNT(*) as count FROM clients
			WHERE expires_at IS NULL OR expires_at > ?
		`).get(now);
		const expired = this.#db.prepare(`
			SELECT COUNT(*) as count FROM clients
			WHERE expires_at IS NOT NULL AND expires_at <= ?
		`).get(now);

		return {
			total: total.count,
			active: active.count,
			expired: expired.count
		};
	}

	/**
	 * Clean all data from the database
	 */
	clearAll() {
		const stmt = this.#db.prepare('DELETE FROM clients');
		const result = stmt.run();
		console.log(`[StorageService] Cleared ${result.changes} clients`);
		return result.changes;
	}

	/**
	 * Stop auto-cleanup and close database connection
	 */
	shutdown() {
		if (this.#cleanupInterval) {
			clearInterval(this.#cleanupInterval);
			this.#cleanupInterval = null;
		}

		// Final cleanup before shutdown
		this.#cleanExpired();

		// Close database
		if (this.#db) {
			this.#db.close();
			this.#db = null;
		}

		console.log('[StorageService] Shutdown complete');
	}
}
