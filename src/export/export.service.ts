import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExportFiltersDto } from './dto/export-filters.dto';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Prisma, TransactionType } from '@prisma/client';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Busca transações com filtros
   */
  private async getTransactions(userId: string, filters: ExportFiltersDto) {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(filters.startDate && {
        date: { gte: new Date(filters.startDate) },
      }),
      ...(filters.endDate && {
        date: { lte: new Date(filters.endDate) },
      }),
      ...(filters.type && { type: filters.type }),
      ...(filters.categoryId && { categoryId: filters.categoryId }),
      ...(filters.accountId && { accountId: filters.accountId }),
    };

    return this.prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  /**
   * Exporta como CSV
   */
  async exportCSV(userId: string, filters: ExportFiltersDto): Promise<string> {
    const transactions = await this.getTransactions(userId, filters);

    // Header CSV
    let csv = 'Data,Descrição,Tipo,Categoria,Conta,Valor\n';

    // Linhas
    transactions.forEach((t) => {
      const date = new Date(t.date).toLocaleDateString('pt-BR');
      const type = t.type === 'INCOME' ? 'Receita' : 'Despesa';
      const category = t.category?.name || 'Sem categoria';
      const account = t.account?.name || 'Sem conta';
      const amount = `R$ ${t.amount.toFixed(2).replace('.', ',')}`;

      csv += `"${date}","${t.description}","${type}","${category}","${account}","${amount}"\n`;
    });

    return csv;
  }

  /**
   * Exporta como Excel
   */
  async exportExcel(
    userId: string,
    filters: ExportFiltersDto,
  ): Promise<Buffer> {
    const transactions = await this.getTransactions(userId, filters);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Transações');

    // Metadados
    workbook.creator = 'Miu Controle';
    workbook.created = new Date();

    // Configurar colunas
    worksheet.columns = [
      { header: 'Data', key: 'date', width: 12 },
      { header: 'Descrição', key: 'description', width: 30 },
      { header: 'Tipo', key: 'type', width: 12 },
      { header: 'Categoria', key: 'category', width: 20 },
      { header: 'Conta', key: 'account', width: 20 },
      { header: 'Valor', key: 'amount', width: 15 },
    ];

    // Estilizar header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6366F1' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Adicionar dados
    transactions.forEach((t) => {
      const row = worksheet.addRow({
        date: new Date(t.date).toLocaleDateString('pt-BR'),
        description: t.description,
        type: t.type === 'INCOME' ? 'Receita' : 'Despesa',
        category: t.category?.name || 'Sem categoria',
        account: t.account?.name || 'Sem conta',
        amount: t.amount,
      });

      // Colorir valor baseado no tipo
      const amountCell = row.getCell('amount');
      amountCell.numFmt = 'R$ #,##0.00';
      amountCell.font = {
        color: {
          argb: t.type === 'INCOME' ? 'FF10B981' : 'FFEF4444',
        },
        bold: true,
      };
    });

    // Adicionar totais
    const totalRow = worksheet.addRow({
      date: '',
      description: '',
      type: '',
      category: '',
      account: 'TOTAL:',
      amount: transactions.reduce((sum, t) => {
        return t.type === 'INCOME'
          ? sum + Number(t.amount)
          : sum - Number(t.amount);
      }, 0),
    });

    totalRow.font = { bold: true, size: 12 };
    totalRow.getCell('amount').numFmt = 'R$ #,##0.00';
    totalRow.getCell('amount').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };

    // Gerar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Exporta como PDF
   */
  async exportPDF(userId: string, filters: ExportFiltersDto): Promise<Buffer> {
    const transactions = await this.getTransactions(userId, filters);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(20)
        .fillColor('#6366F1')
        .text('Miu Controle', { align: 'center' })
        .moveDown(0.5);

      doc
        .fontSize(14)
        .fillColor('#1F2937')
        .text('Relatório de Transações', { align: 'center' })
        .moveDown(0.3);

      doc
        .fontSize(10)
        .fillColor('#6B7280')
        .text(`Usuário: ${user.fullName}`, { align: 'center' })
        .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, {
          align: 'center',
        })
        .moveDown(1);

      // Filtros aplicados
      if (filters.startDate || filters.endDate) {
        doc
          .fontSize(10)
          .fillColor('#6B7280')
          .text('Período: ', { continued: true })
          .fillColor('#1F2937')
          .text(
            `${filters.startDate ? new Date(filters.startDate).toLocaleDateString('pt-BR') : '...'} até ${
              filters.endDate
                ? new Date(filters.endDate).toLocaleDateString('pt-BR')
                : '...'
            }`,
          )
          .moveDown(1);
      }

      // Linha separadora
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#E5E7EB').moveDown(0.5);

      // Tabela de transações
      transactions.forEach((t, index) => {
        // Verificar se precisa de nova página
        if (doc.y > 700) {
          doc.addPage();
        }

        const bgColor = index % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
        const yPos = doc.y;

        // Background da linha
        doc.rect(50, yPos, 495, 60).fill(bgColor);

        // Data
        doc
          .fontSize(9)
          .fillColor('#6B7280')
          .text(new Date(t.date).toLocaleDateString('pt-BR'), 60, yPos + 10, {
            width: 80,
          });

        // Descrição
        doc
          .fontSize(11)
          .fillColor('#1F2937')
          .text(t.description, 60, yPos + 25, { width: 200 });

        // Categoria
        doc
          .fontSize(9)
          .fillColor('#6B7280')
          .text(t.category?.name || 'Sem categoria', 270, yPos + 10, {
            width: 120,
          });

        // Conta
        doc
          .fontSize(9)
          .fillColor('#6B7280')
          .text(t.account?.name || 'Sem conta', 270, yPos + 25, {
            width: 120,
          });

        // Valor
        const valueColor = t.type === 'INCOME' ? '#10B981' : '#EF4444';
        const valuePrefix = t.type === 'INCOME' ? '+ ' : '- ';
        doc
          .fontSize(12)
          .fillColor(valueColor)
          .text(
            `${valuePrefix}R$ ${Number(t.amount).toFixed(2).replace('.', ',')}`,
            400,
            yPos + 20,
            { width: 135, align: 'right' },
          );

        doc.moveDown(3.5);
      });

      // Resumo no final
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#E5E7EB').moveDown(0.5);

      const totalIncome = transactions
        .filter((t) => t.type === 'INCOME')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalExpense = transactions
        .filter((t) => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const balance = totalIncome - totalExpense;

      doc
        .fontSize(11)
        .fillColor('#1F2937')
        .text('Resumo:', 60, doc.y)
        .moveDown(0.5);

      doc
        .fontSize(10)
        .fillColor('#6B7280')
        .text(`Total de Receitas: `, 60, doc.y, { continued: true })
        .fillColor('#10B981')
        .text(`R$ ${totalIncome.toFixed(2).replace('.', ',')}`)
        .moveDown(0.3);

      doc
        .fillColor('#6B7280')
        .text(`Total de Despesas: `, 60, doc.y, { continued: true })
        .fillColor('#EF4444')
        .text(`R$ ${totalExpense.toFixed(2).replace('.', ',')}`)
        .moveDown(0.3);

      doc
        .fontSize(12)
        .fillColor('#1F2937')
        .text(`Saldo: `, 60, doc.y, { continued: true })
        .fillColor(balance >= 0 ? '#10B981' : '#EF4444')
        .text(`R$ ${balance.toFixed(2).replace('.', ',')}`);

      // Footer
      doc
        .fontSize(8)
        .fillColor('#9CA3AF')
        .text('Relatório gerado automaticamente por Miu Controle', 50, 750, {
          align: 'center',
        });

      doc.end();
    });
  }
}
