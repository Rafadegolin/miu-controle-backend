import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisService } from './analysis.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AnalysisJob {
  private readonly logger = new Logger(AnalysisJob.name);

  constructor(
    private prisma: PrismaService,
    private analysisService: AnalysisService,
    private emailService: EmailService,
  ) {}

  /**
   * Executa todo dia 1º do mês às 08:00
   * Gera relatório do mês anterior para todos os usuários ativos
   */
  @Cron('0 0 8 1 * *')
  async handleMonthlyAnalysis() {
    this.logger.log('Starting monthly analysis job...');

    // Mês anterior (Target)
    const today = new Date();
    const targetMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // Usar apenas usuários ativos recentemente, mas aqui vamos pegar todos por simplicidade do MVP
    const users = await this.prisma.user.findMany({
      select: { id: true, email: true, fullName: true },
    });

    for (const user of users) {
      try {
        const report = await this.analysisService.generateMonthlyReport(
          user.id,
          targetMonth,
        );

        // Enviar Email
        await this.sendEmail(user, report);
      } catch (e) {
        this.logger.error(
          `Failed to process monthly analysis for user ${user.id}: ${e.message}`,
        );
      }
    }

    this.logger.log('Monthly analysis job finished.');
  }

  private async sendEmail(user: any, report: any) {
    // Simple HTML template
    const insightsHtml = (report.insights as string[])
      .map((i) => `<li>${i}</li>`)
      .join('');

    const html = `
        <h1>Olá ${user.fullName}, seu relatório mensal chegou! 📊</h1>
        <p>Aqui está o resumo do seu mês de ${report.month.toLocaleString('default', { month: 'long' })}:</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px;">
            <h2>Saldo: R$ ${Number(report.balance).toFixed(2)}</h2>
            <p>Receitas: R$ ${Number(report.totalIncome).toFixed(2)}</p>
            <p>Despesas: R$ ${Number(report.totalExpense).toFixed(2)}</p>
        </div>

        <h3>💡 Insights:</h3>
        <ul>
            ${insightsHtml}
        </ul>

        <p><a href="https://miucontrole.com.br/dashboard/reports">Ver relatório completo</a></p>
      `;

    try {
      await this.emailService.sendEmail(
        user.email,
        `Miu Controle - Relatório Mensal de ${report.month.getMonth() + 1}/${report.month.getFullYear()}`,
        html,
      );
      this.logger.log(`Email sent to ${user.email}`);
    } catch (e) {
      this.logger.error(`Failed to send email to ${user.email}: ${e.message}`);
    }
  }
}
