/**
 * Key Manager Service
 *
 * Manages API keys with rotation support and encrypted storage.
 */

import { safeStorage } from 'electron'
import type { ApiKeyEntry, KeyRotationStrategy, KeyValidationResult } from '../../shared/types'
import {
  createApiKey,
  deleteApiKey,
  getApiKey,
  getApiKeyValue,
  getNextAvailableKey,
  hasValidKeys,
  listAllApiKeys,
  listApiKeys,
  markKeyError,
  markKeyInvalid,
  markKeyValidated,
  recordKeyUsage,
  updateApiKeyValue,
} from '../database/repositories/apikey.repository'
import { validateKeyForConfig } from '../providers'
import { logger } from './logger'

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
  async getKey(providerConfigId: string): Promise<string | null> {
    const keyEntry = getNextAvailableKey(providerConfigId, this.rotationStrategy)

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
    providerConfigId: string,
    keyValue: string,
    label?: string,
    priority = 0
  ): Promise<ApiKeyEntry> {
    // Encrypt the key
    const encryptedKey = this.encryptKey(keyValue)

    // Create the entry
    return createApiKey(providerConfigId, encryptedKey, label, priority)
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
  async validateKey(providerConfigId: string, keyValue: string): Promise<boolean> {
    try {
      return await validateKeyForConfig(providerConfigId, keyValue)
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

    // Get the key entry to find the provider config
    const keyEntry = getApiKey(keyId)
    if (!keyEntry) {
      return false
    }

    try {
      const isValid = await this.validateKey(keyEntry.providerConfigId, keyValue)
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
   * Validate all stored keys and return results
   */
  async validateAllKeys(): Promise<KeyValidationResult[]> {
    const allKeys = listAllApiKeys()
    const results: KeyValidationResult[] = []

    // Validate keys in parallel with concurrency limit
    const batchSize = 3
    for (let i = 0; i < allKeys.length; i += batchSize) {
      const batch = allKeys.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(async (key) => {
          try {
            const isValid = await this.validateStoredKey(key.id)
            return {
              keyId: key.id,
              providerConfigId: key.providerConfigId,
              label: key.label,
              isValid,
              error: isValid ? undefined : 'Validation failed',
            }
          } catch (error) {
            return {
              keyId: key.id,
              providerConfigId: key.providerConfigId,
              label: key.label,
              isValid: false,
              error: error instanceof Error ? error.message : String(error),
            }
          }
        })
      )
      results.push(...batchResults)
    }

    return results
  }

  /**
   * Whether OS-level secure storage is available. When false, keys are only
   * obfuscated (reversible base64) rather than encrypted — common on headless
   * or keyring-less Linux/WSL setups. Surfaced to the UI so the user can be warned.
   */
  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  /**
   * Check if a provider has any valid keys
   */
  hasValidKeys(providerConfigId: string): boolean {
    return hasValidKeys(providerConfigId)
  }

  /**
   * List all keys for a provider
   */
  listKeys(providerConfigId: string): ApiKeyEntry[] {
    return listApiKeys(providerConfigId)
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private encryptKey(keyValue: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(keyValue)
      return encrypted.toString('base64')
    }
    // Fallback: simple obfuscation (not secure, but better than plaintext).
    // The UI warns the user when this path is active (see apikey:encryptionAvailable).
    logger.warn(
      '[KeyManager] OS secure storage unavailable — storing API key with reversible obfuscation only'
    )
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
      logger.error(
        '[KeyManager] Failed to decrypt key:',
        error instanceof Error ? error : new Error(String(error))
      )
      return null
    }
  }
}

// Singleton instance
export const keyManager = new KeyManager()
