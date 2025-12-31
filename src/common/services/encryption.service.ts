import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Service for encrypting and decrypting sensitive data (API keys, secrets)
 * Uses AES-256-GCM for authenticated encryption
 * 
 * SECURITY:
 * - Algorithm: AES-256-GCM (authenticated encryption)
 * - Key size: 256 bits (32 bytes)
 * - IV: 16 bytes (randomized per encryption)
 * - Output format: base64(iv + authTag + ciphertext)
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly IV_LENGTH = 16; // 128 bits
  private readonly AUTH_TAG_LENGTH = 16; // 128 bits

  constructor(private configService: ConfigService) {
    const keyHex = this.configService.get<string>('ENCRYPTION_KEY');
    
    if (!keyHex) {
      throw new Error(
        'ENCRYPTION_KEY not found in environment. Generate one with: openssl rand -hex 32'
      );
    }
    
    if (keyHex.length !== 64) {
      throw new Error(
        'ENCRYPTION_KEY must be 64 hex characters (32 bytes). Your key has ' + 
        keyHex.length + ' characters.'
      );
    }
    
    this.key = Buffer.from(keyHex, 'hex');
    this.logger.log('✅ EncryptionService initialized with AES-256-GCM');
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   * @param plaintext - The data to encrypt
   * @returns base64 encoded string containing iv + authTag + ciphertext
   * 
   * @example
   * const encrypted = encryptionService.encrypt('sk-proj-abc123...');
   * // Returns: "base64_encoded_string"
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random IV for this encryption
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      // Encrypt
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine: iv + authTag + ciphertext
      const encrypted = Buffer.concat([
        iv,
        authTag,
        Buffer.from(ciphertext, 'hex')
      ]);
      
      // Return as base64
      return encrypted.toString('base64');
    } catch (error) {
      this.logger.error('Encryption failed:', error.message);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt ciphertext using AES-256-GCM
   * @param encrypted - base64 encoded string from encrypt()
   * @returns Original plaintext
   * 
   * @example
   * const decrypted = encryptionService.decrypt(encrypted);
   * // Returns: "sk-proj-abc123..."
   */
  decrypt(encrypted: string): string {
    try {
      // Decode from base64
      const buffer = Buffer.from(encrypted, 'base64');
      
      // Extract components
      const iv = buffer.subarray(0, this.IV_LENGTH);
      const authTag = buffer.subarray(this.IV_LENGTH, this.IV_LENGTH + this.AUTH_TAG_LENGTH);
      const ciphertext = buffer.subarray(this.IV_LENGTH + this.AUTH_TAG_LENGTH);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt
      let plaintext = decipher.update(ciphertext);
      plaintext = Buffer.concat([plaintext, decipher.final()]);
      
      return plaintext.toString('utf8');
    } catch (error) {
      this.logger.error('Decryption failed - data may be corrupted or key is wrong');
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Test if encryption/decryption is working correctly
   * Used for health checks
   */
  testEncryption(): boolean {
    try {
      const testString = 'test-encryption-' + Date.now();
      const encrypted = this.encrypt(testString);
      const decrypted = this.decrypt(encrypted);
      return testString === decrypted;
    } catch {
      return false;
    }
  }
}
