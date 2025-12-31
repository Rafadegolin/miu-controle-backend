import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../src/common/services/encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('0'.repeat(64)), // Mock 64-char hex key
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt correctly', () => {
      const plaintext = 'sk-proj-test-api-key-123456';
      
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should generate different ciphertext for same input (different IV)', () => {
      const plaintext = 'sk-proj-test-api-key-123456';
      
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      
      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to same plaintext
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(1000);
      
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'sk-proj-!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should throw error on tampered ciphertext', () => {
      const plaintext = 'sk-proj-test-api-key';
      const encrypted = service.encrypt(plaintext);
      
      // Tamper with the encrypted data (change last 5 chars)
      const tampered = encrypted.slice(0, -5) + 'AAAAA';
      
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw error on invalid base64', () => {
      expect(() => service.decrypt('not-valid-base64!!!')).toThrow();
    });

    it('should throw error on too short encrypted string', () => {
      expect(() => service.decrypt('YQ==')).toThrow(); // "a" in base64
    });
  });

  describe('security', () => {
    it('should produce base64 encoded output', () => {
      const plaintext = 'test';
      const encrypted = service.encrypt(plaintext);
      
      // Base64 should only contain these characters
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should not expose plaintext in encrypted output', () => {
      const plaintext = 'sk-proj-very-secret-key';
      const encrypted = service.encrypt(plaintext);
      
      expect(encrypted).not.toContain('secret');
      expect(encrypted).not.toContain('proj');
    });
  });
});
