import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetTokenDto } from './dto/verify-reset-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { CurrentRefreshToken } from './decorators/current-refresh-token.decorator';
import { RefreshTokenDto } from './dto/refresh-token.dto';

// DTOs simples para o exchange dos provedores sociais
class GoogleExchangeDto {
  sessionToken: string;
}

class AppleExchangeDto {
  sessionToken: string;
}

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Post('register')
  @Throttle({ long: { limit: 3, ttl: 3600000 } }) // 3 req/hora
  @ApiOperation({
    summary: 'Criar nova conta',
    description: 'Limite: 3 tentativas por hora',
  })
  @ApiResponse({ status: 201, description: 'Conta criada com sucesso' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado' })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.authService.register(registerDto, userAgent, ipAddress);
  }

  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Fazer login',
    description: 'Limite: 5 tentativas por minuto',
  })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.authService.login(loginDto, userAgent, ipAddress);
  }

  /**
   * Troca uma sessão do Better Auth (Google OAuth) pelos tokens JWT do sistema.
   *
   * Fluxo do frontend:
   *  1. Redirecionar usuário para: GET /api/auth/signin/google
   *  2. Após callback do Google, o Better Auth redireciona para o frontend
   *     com o parâmetro ?sessionToken=xxx na URL informada no config
   *  3. Frontend chama este endpoint com o sessionToken recebido
   *  4. Endpoint retorna { accessToken, refreshToken, user } — IGUAL ao login normal
   */
  @Post('google/exchange')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trocar sessão Google por tokens JWT',
    description:
      'Após o fluxo OAuth via Better Auth, troca o sessionToken pelos ' +
      'accessToken e refreshToken do sistema. Retorno idêntico ao /auth/login normal.',
  })
  @ApiResponse({ status: 200, description: 'Tokens gerados com sucesso' })
  @ApiResponse({
    status: 401,
    description: 'Sessão Google inválida ou expirada',
  })
  async googleExchange(@Body() body: GoogleExchangeDto, @Req() req: Request) {
    if (!body?.sessionToken) {
      throw new UnauthorizedException('sessionToken é obrigatório');
    }
    const userAgent = (req as any).headers?.['user-agent'];
    const ipAddress = (req as any).ip || (req as any).socket?.remoteAddress;
    return this.authService.exchangeGoogleSession(
      body.sessionToken,
      userAgent,
      ipAddress,
    );
  }

  /**
   * Troca uma sessão do Better Auth (Apple Sign-In) pelos tokens JWT do sistema.
   *
   * Fluxo do frontend mobile:
   *  1. App usa expo-apple-authentication para iniciar o fluxo
   *  2. Redirecionar para: GET /api/auth/signin/apple
   *  3. Após callback da Apple, o Better Auth redireciona com ?sessionToken=xxx
   *  4. App chama este endpoint com o sessionToken recebido
   *  5. Endpoint retorna { accessToken, refreshToken, user } — IGUAL ao login normal
   */
  @Post('apple/exchange')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trocar sessão Apple Sign-In por tokens JWT',
    description:
      'Após o fluxo OAuth via Better Auth, troca o sessionToken pelos ' +
      'accessToken e refreshToken do sistema. Retorno idêntico ao /auth/login normal. ' +
      'Obrigatório para publicação na App Store (Apple exige login social Apple).',
  })
  @ApiResponse({ status: 200, description: 'Tokens gerados com sucesso' })
  @ApiResponse({
    status: 401,
    description: 'Sessão Apple inválida ou expirada',
  })
  async appleExchange(@Body() body: AppleExchangeDto, @Req() req: Request) {
    if (!body?.sessionToken) {
      throw new UnauthorizedException('sessionToken é obrigatório');
    }
    const userAgent = (req as any).headers?.['user-agent'];
    const ipAddress = (req as any).ip || (req as any).socket?.remoteAddress;
    return this.authService.exchangeAppleSession(
      body.sessionToken,
      userAgent,
      ipAddress,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token' })
  @ApiResponse({ status: 200, description: 'Novos tokens gerados' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido/expirado' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.authService.refreshTokens(
      refreshTokenDto.refreshToken,
      userAgent,
      ipAddress,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dados do usuário logado' })
  async getProfile(@CurrentUser() user) {
    return user;
  }

  @Post('forgot-password')
  @Throttle({ long: { limit: 3, ttl: 3600000 } }) // 3 req/hora
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar recuperação de senha',
    description: 'Limite: 3 tentativas por hora',
  })
  @ApiResponse({ status: 200, description: 'Email enviado (se existir)' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('verify-reset-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar validade do token' })
  @ApiResponse({ status: 200, description: 'Token válido' })
  @ApiResponse({ status: 400, description: 'Token inválido/expirado' })
  async verifyResetToken(@Body() verifyResetTokenDto: VerifyResetTokenDto) {
    return this.authService.verifyResetToken(verifyResetTokenDto.token);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir senha com token' })
  @ApiResponse({ status: 200, description: 'Senha alterada' })
  @ApiResponse({ status: 400, description: 'Token inválido/expirado' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('verify-email')
  @SkipThrottle() // Sem limite (validado por token único)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar email com token' })
  @ApiResponse({ status: 200, description: 'Email verificado com sucesso' })
  @ApiResponse({ status: 400, description: 'Token inválido/expirado' })
  @ApiResponse({ status: 409, description: 'Email já verificado' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification')
  @Throttle({ long: { limit: 3, ttl: 3600000 } }) // 3 req/hora
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reenviar email de verificação',
    description: 'Limite: 3 tentativas por hora',
  })
  @ApiResponse({ status: 200, description: 'Email reenviado (se existir)' })
  @ApiResponse({ status: 409, description: 'Email já verificado' })
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ) {
    return this.authService.resendVerification(resendVerificationDto);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar sessões ativas' })
  @ApiResponse({ status: 200, description: 'Lista de sessões retornada' })
  async getSessions(
    @CurrentUser() user: any,
    @CurrentRefreshToken() currentToken: string,
  ) {
    return this.sessionsService.getUserSessions(user.id, currentToken);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revogar sessão específica' })
  @ApiResponse({ status: 200, description: 'Sessão revogada' })
  @ApiResponse({ status: 403, description: 'Não pode revogar sessão atual' })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  async revokeSession(
    @CurrentUser() user: any,
    @Param('id') sessionId: string,
    @CurrentRefreshToken() currentToken: string,
  ) {
    return this.sessionsService.revokeSession(user.id, sessionId, currentToken);
  }

  @Delete('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revogar todas as sessões exceto a atual' })
  @ApiResponse({ status: 200, description: 'Sessões revogadas' })
  async revokeAllSessions(
    @CurrentUser() user: any,
    @CurrentRefreshToken() currentToken: string,
  ) {
    return this.sessionsService.revokeAllSessions(user.id, currentToken);
  }
}
