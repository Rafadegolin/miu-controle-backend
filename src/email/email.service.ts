import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('RESEND_API_KEY');
    this.fromEmail = this.configService.get('EMAIL_FROM');
    this.resend = new Resend(apiKey);
  }

  /**
   * Envia email de recuperação de senha
   */
  async sendPasswordResetEmail(to: string, token: string, userName: string) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: '🔐 Recuperação de Senha - Miu Controle',
        html: this.getPasswordResetTemplate(userName, resetUrl),
      });

      if (error) {
        this.logger.error('Erro ao enviar email:', error);
        throw error;
      }

      this.logger.log(`Email de reset enviado para: ${to}`);
      return data;
    } catch (error) {
      this.logger.error('Falha ao enviar email:', error);
      throw error;
    }
  }

  /**
   * Template HTML para email de reset
   */
  private getPasswordResetTemplate(userName: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recuperação de Senha</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🔐 Miu Controle</h1>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                        Olá, ${userName}!
                      </h2>
                      
                      <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                        Recebemos uma solicitação para redefinir a senha da sua conta.
                      </p>

                      <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                        Clique no botão abaixo para criar uma nova senha:
                      </p>

                      <!-- Button -->
                      <table role="presentation" style="margin: 0 auto;">
                        <tr>
                          <td style="border-radius: 6px; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);">
                            <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">
                              Redefinir Senha
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Alternative Link -->
                      <p style="margin: 30px 0 0 0; padding: 20px 0 0 0; border-top: 1px solid #e5e5e5; color: #999999; font-size: 14px; line-height: 1.6;">
                        Ou copie e cole este link no seu navegador:<br>
                        <a href="${resetUrl}" style="color: #6366F1; word-break: break-all;">${resetUrl}</a>
                      </p>

                      <!-- Warning -->
                      <div style="margin: 20px 0 0 0; padding: 16px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px;">
                        <p style="margin: 0; color: #92400E; font-size: 14px; line-height: 1.6;">
                          ⚠️ <strong>Importante:</strong> Este link expira em 1 hora e só pode ser usado uma vez.
                        </p>
                      </div>

                      <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.6;">
                        Se você não solicitou esta alteração, ignore este email. Sua senha permanecerá inalterada.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; text-align: center; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
                      <p style="margin: 0; color: #999999; font-size: 14px;">
                        © ${new Date().getFullYear()} Miu Controle. Todos os direitos reservados.
                      </p>
                      <p style="margin: 10px 0 0 0; color: #999999; font-size: 12px;">
                        Este é um email automático. Por favor, não responda.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  /**
   * Envia email de confirmação após reset bem-sucedido
   */
  async sendPasswordChangedEmail(to: string, userName: string) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject: '✅ Senha Alterada - Miu Controle',
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
              <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px;">
                <h2 style="color: #10B981;">✅ Senha Alterada com Sucesso!</h2>
                <p>Olá, ${userName}!</p>
                <p>Sua senha foi alterada com sucesso.</p>
                <p style="margin-top: 20px; padding: 16px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px;">
                  ⚠️ Se você não fez essa alteração, entre em contato conosco imediatamente.
                </p>
              </div>
            </body>
          </html>
        `,
      });

      if (error) {
        this.logger.error('Erro ao enviar confirmação:', error);
      }

      return data;
    } catch (error) {
      this.logger.error('Falha ao enviar confirmação:', error);
    }
  }
}
