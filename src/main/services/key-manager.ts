/**
 * Key Manager Service
 *
 * Manages API keys with rotation support and encrypted storage.
 */

import { safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { logger } from './logger'
import type { ApiKeyEntry, KeyRotationStrategy } from '../../shared/types'
import {
  listApiKeys,
  getApiKeyValue,
  createApiKey,
  updateApiKeyValue,
  deleteApiKey,
  markKeyValidated,
  markKeyError,
  markKeyInvalid,
  recordKeyUsage,
  getNextAvailableKey,
  hasValidKeys
} from '../database/repositories/apikey.repository'
import { providerRegistry } from '../providers'

// Legacy key storage path (for migration)
const LEGACY_KEYS_PATH = join(app.getPath('userData'), 'api-keys.enc')

/**
 * Key Manager class for handling API key operations
 */
export class KeyManager {
  private rotationStrategy: KeyRotationStrategy = 'priority'

  /**
   * Set the key rotation strategy
   */
  setRotationStrategy(strategy: KeyRotationStrategy): void {
    this.rotationStrategy = strategy
  }

  /**
   * Get the current rotation strategy
   */
  getRotationStrategy(): KeyRotationStrategy {
    return this.rotationStrategy
  }

  /**
   * Get an API key for a provider using the configured rotation strategy
   */
  async getKey(providerId: string): Promise<string | null> {
    const keyEntry = getNextAvailableKey(providerId, this.rotationStrategy)

    if (!keyEntry) {
      return null
    }

    const encryptedKey = getApiKeyValue(keyEntry.id)
    if (!encryptedKey) {
      return null
    }

    // Decrypt the key
    const key = this.decryptKey(encryptedKey)
    if (!key) {
      return null
    }

    // Record usage
    recordKeyUsage(keyEntry.id)

    return key
  }

  /**
   * Add a new API key
   */
  async addKey(
    providerId: string,
    keyValue: string,
    label?: string,
    priority = 0
  ): Promise<ApiKeyEntry> {
    // Encrypt the key
    const encryptedKey = this.encryptKey(keyValue)

    // Create the entry
    return createApiKey(providerId, encryptedKey, label, priority)
  }

  /**
   * Update an existing key value
   */
  async updateKey(keyId: string, newKeyValue: string): Promise<void> {
    const encryptedKey = this.encryptKey(newKeyValue)
    updateApiKeyValue(keyId, encryptedKey)
  }

  /**
   * Remove an API key
   */
  async removeKey(keyId: string): Promise<void> {
    deleteApiKey(keyId)
  }

  /**
   * Validate an API key
   */
  async validateKey(providerId: string, keyValue: string): Promise<boolean> {
    const provider = providerRegistry.get(providerId)
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`)
    }

    try {
      return await provider.validateKey(keyValue)
    } catch {
      return false
    }
  }

  /**
   * Validate a stored key and update its status
   */
  async validateStoredKey(keyId: string): Promise<boolean> {
    const encryptedKey = getApiKeyValue(keyId)
    if (!encryptedKey) {
      return false
    }

    const keyValue = this.decryptKey(encryptedKey)
    if (!keyValue) {
      return false
    }

    // Get the key entry to find the provider
    const keys = listApiKeys('')
    const keyEntry = keys.find((k) => k.id === keyId)
    if (!keyEntry) {
      return false
    }

    try {
      const isValid = await this.validateKey(keyEntry.providerId, keyValue)
      if (isValid) {
        markKeyValidated(keyId)
      } else {
        markKeyInvalid(keyId, 'API key validation failed')
      }
      return isValid
    } catch (error) {
      markKeyError(keyId, String(error))
      return false
    }
  }

  /**
   * Mark a key as having failed
   */
  markKeyFailed(keyId: string, error: string, isAuthError = false): void {
    if (isAuthError) {
      markKeyInvalid(keyId, error)
    } else {
      markKeyError(keyId, error)
    }
  }

  /**
   * Check if a provider has any valid keys
   */
  hasValidKeys(providerId: string): boolean {
    return hasValidKeys(providerId)
  }

  /**
   * List all keys for a provider
   */
  listKeys(providerId: string): ApiKeyEntry[] {
    return listApiKeys(providerId)
  }

  /**
   * Migrate legacy API keys from file storage to database
   */
  async migrateLegacyKeys(): Promise<number> {
    if (!existsSync(LEGACY_KEYS_PATH)) {
      return 0
    }

    try {
      const legacyKeys = this.loadLegacyKeys()
      let migrated = 0

      for (const [providerId, keyValue] of legacyKeys) {
        // Check if provider already has keys
        const existingKeys = listApiKeys(providerId)
        if (existingKeys.length > 0) {
          continue
        }

        // Add the legacy key
        await this.addKey(providerId, keyValue, 'Migrated from legacy storage', 0)
        migrated++
      }

      // Delete the legacy file after successful migration
      if (migrated > 0) {
        try {
          require('fs').unlinkSync(LEGACY_KEYS_PATH)
        } catch {
          // Ignore deletion errors
        }
      }

      return migrated
    } catch (error) {
      logger.error('[KeyManager] Failed to migrate legacy keys:', error instanceof Error ? error : new Error(String(error)))
      return 0
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private encryptKey(keyValue: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(keyValue)
      return encrypted.toString('base64')
    }
    // Fallback: simple obfuscation (not secure, but better than plaintext)
    return Buffer.from(keyValue).toString('base64')
  }

  private decryptKey(encryptedKey: string): string | null {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const buffer = Buffer.from(encryptedKey, 'base64')
        return safeStorage.decryptString(buffer)
      }
      // Fallback: simple de-obfuscation
      return Buffer.from(encryptedKey, 'base64').toString('utf-8')
    } catch (error) {
      logger.error('[KeyManager] Failed to decrypt key:', error instanceof Error ? error : new Error(String(error)))
      return null
    }
  }

  private loadLegacyKeys(): Map<string, string> {
    if (!existsSync(LEGACY_KEYS_PATH)) {
      return new Map()
    }

    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return new Map()
      }

      const encrypted = readFileSync(LEGACY_KEYS_PATH)
      const decrypted = safeStorage.decryptString(encrypted)
      return new Map(Object.entries(JSON.parse(decrypted)))
    } catch {
      return new Map()
    }
  }
}

// Singleton instance
export const keyManager = new KeyManager()

// ============================================================================
// Legacy Support Functions
// ============================================================================

/**
 * Load API keys from legacy file storage
 * @deprecated Use keyManager.getKey() instead
 */
export function loadApiKeysFromFile(): Map<string, string> {
  if (!existsSync(LEGACY_KEYS_PATH)) return new Map()

  try {
    if (!safeStorage.isEncryptionAvailable()) {
      logger.warn('[KeyManager] Encryption not available')
      return new Map()
    }

    const encrypted = readFileSync(LEGACY_KEYS_PATH)
    const decrypted = safeStorage.decryptString(encrypted)
    return new Map(Object.entries(JSON.parse(decrypted)))
  } catch (error) {
    logger.error('[KeyManager] Failed to load legacy keys:', error instanceof Error ? error : new Error(String(error)))
    return new Map()
  }
}

/**
 * Save API keys to legacy file storage
 * @deprecated Use keyManager.addKey() instead
 */
export function saveApiKeysToFile(keys: Map<string, string>): void {
  if (!safeStorage.isEncryptionAvailable()) {
    logger.warn('[KeyManager] Encryption not available, keys not saved')
    return
  }

  try {
    const json = JSON.stringify(Object.fromEntries(keys))
    const encrypted = safeStorage.encryptString(json)
    writeFileSync(LEGACY_KEYS_PATH, encrypted)
  } catch (error) {
    logger.error('[KeyManager] Failed to save keys:', error instanceof Error ? error : new Error(String(error)))
  }
}
