/**
 * Storage service using the Singleton pattern for managing client data
 */
export class StorageService {
	static #instance = null;

	/**
	 * Create a StorageService instance (Singleton)
	 * @returns {StorageService} The singleton instance
	 */
	constructor() {
		if (StorageService.#instance)
			return StorageService.#instance;

		this.clients = new Map();
		StorageService.#instance = this;
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
		this.clients.set(clientId, metadata);
	}

	/**
	 * Retrieve client metadata
	 * @param {string} clientId - Unique client identifier
	 * @returns {Object|undefined} Client metadata or undefined if not found
	 */
	getClient(clientId) {
		return this.clients.get(clientId);
	}

	/**
	 * Delete client data
	 * @param {string} clientId - Unique client identifier
	 * @returns {boolean} True if client was deleted, false if not found
	 */
	delClient(clientId) {
		return this.clients.delete(clientId);
	}
}
