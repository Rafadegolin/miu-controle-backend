import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let emailService: EmailService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    passwordHash: 'hashed_password',
    emailVerified: true,
    subscriptionTier: 'FREE',
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordResetToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    emailVerificationToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((promises) => Promise.all(promises)),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock-token'),
    verify: jest.fn(),
  };

  const mockEmailService = {
    sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '15m',
        REFRESH_TOKEN_SECRET: 'test-refresh-secret',
        REFRESH_TOKEN_EXPIRES_IN: '7d',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    emailService = module.get<EmailService>(EmailService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashed_password') as any);

      const result = await service.register({
        email: 'test@example.com',
        password: 'Test@123456',
        fullName: 'Test User',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
      expect(mockPrismaService.user.create).toHaveBeenCalled();
      expect(mockEmailService.sendEmailVerification).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Test@123456',
          fullName: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('should hash password before storing', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      const bcryptSpy = jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashed') as any);

      await service.register({
        email: 'test@example.com',
        password: 'PlainPassword123',
        fullName: 'Test User',
      });

      expect(bcryptSpy).toHaveBeenCalledWith('PlainPassword123', 10);
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true) as any);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Test@123456',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'Test@123456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false) as any);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong_password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update lastLoginAt on successful login', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true) as any);

      await service.login({
        email: 'test@example.com',
        password: 'Test@123456',
      });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { lastLoginAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('refreshTokens', () => {
    const mockRefreshToken = {
      id: 'token-123',
      userId: 'user-123',
      token: 'refresh-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      lastUsedAt: new Date(),
    };

    it('should successfully refresh tokens', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(mockRefreshToken);
      mockPrismaService.refreshToken.update.mockResolvedValue(mockRefreshToken);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.refreshTokens('user-123', 'refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshTokens('user-123', 'invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token is revoked', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        ...mockRefreshToken,
        revokedAt: new Date(),
      });

      await expect(
        service.refreshTokens('user-123', 'refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token is expired', async () => {
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.refreshTokens('user-123', 'refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should create reset token and send email for existing user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.passwordResetToken.create.mockResolvedValue({ token: 'reset-token' });

      const result = await service.forgotPassword({ email: 'test@example.com' });

      expect(result.message).toContain('Se o email existir');
      expect(mockPrismaService.passwordResetToken.create).toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should not reveal if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nonexistent@example.com' });

      expect(result.message).toContain('Se o email existir');
      expect(mockPrismaService.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should invalidate old reset tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.passwordResetToken.create.mockResolvedValue({ token: 'new-token' });

      await service.forgotPassword({ email: 'test@example.com' });

      expect(mockPrismaService.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  describe('verifyResetToken', () => {
    const mockResetToken = {
      id: 'reset-123',
      userId: 'user-123',
      token: 'valid-token',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      user: mockUser,
    };

    it('should verify valid reset token', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue(mockResetToken);

      const result = await service.verifyResetToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.email).toBe(mockUser.email);
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.verifyResetToken('invalid-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for used token', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue({
        ...mockResetToken,
        usedAt: new Date(),
      });

      await expect(service.verifyResetToken('used-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired token', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue({
        ...mockResetToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.verifyResetToken('expired-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    const mockResetToken = {
      id: 'reset-123',
      userId: 'user-123',
      token: 'valid-token',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      user: mockUser,
    };

    it('should successfully reset password', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue(mockResetToken);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false) as any);
      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('new_hashed_password') as any);

      const result = await service.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPassword@123',
      });

      expect(result.message).toContain('Senha alterada com sucesso');
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw ConflictException if new password is same as old', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue(mockResetToken);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true) as any);

      await expect(
        service.resetPassword({
          token: 'valid-token',
          newPassword: 'SamePassword@123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should revoke all refresh tokens after password reset', async () => {
      mockPrismaService.passwordResetToken.findUnique.mockResolvedValue(mockResetToken);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false) as any);
      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('new_hash') as any);

      await service.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPassword@123',
      });

      const transactionCalls = mockPrismaService.$transaction.mock.calls[0][0];
      expect(transactionCalls).toHaveLength(3);
    });
  });

  describe('verifyEmail', () => {
    const mockVerificationToken = {
      id: 'verify-123',
      userId: 'user-123',
      token: 'verify-token',
      expiresAt: new Date(Date.now() + 86400000),
      usedAt: null,
      user: { ...mockUser, emailVerified: false },
    };

    it('should successfully verify email', async () => {
      mockPrismaService.emailVerificationToken.findUnique.mockResolvedValue(mockVerificationToken);

      const result = await service.verifyEmail({ token: 'verify-token' });

      expect(result.message).toContain('Email verificado com sucesso');
      expect(result.emailVerified).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already verified', async () => {
      mockPrismaService.emailVerificationToken.findUnique.mockResolvedValue({
        ...mockVerificationToken,
        user: { ...mockUser, emailVerified: true },
      });

      await expect(service.verifyEmail({ token: 'verify-token' })).rejects.toThrow(ConflictException);
    });
  });

  describe('resendVerification', () => {
    it('should send verification email for unverified user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });

      const result = await service.resendVerification({ email: 'test@example.com' });

      expect(result.message).toContain('Se o email existir');
      expect(mockEmailService.sendEmailVerification).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already verified', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.resendVerification({ email: 'test@example.com' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should not reveal if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.resendVerification({ email: 'nonexistent@example.com' });

      expect(result.message).toContain('Se o email existir');
      expect(mockEmailService.sendEmailVerification).not.toHaveBeenCalled();
    });
  });
});
