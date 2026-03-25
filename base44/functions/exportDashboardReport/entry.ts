import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { format: exportFormat = 'pdf', financialData, settings, periodLabel } = payload;

    if (!financialData || !settings) {
      return Response.json({ error: 'Missing required data' }, { status: 400 });
    }

    if (exportFormat === 'pdf') {
      const { jsPDF } = await import('npm:jspdf@4.0.0');
      const doc = new jsPDF();
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Helper to add section
      const addSection = (title) => {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = margin;
        }
        doc.setFontSize(14);
        doc.setTextColor(20, 20, 20);
        doc.text(title, margin, yPos);
        yPos += 8;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
        yPos += 4;
      };

      const addText = (label, value, bold = false) => {
        if (yPos > pageHeight - 10) {
          doc.addPage();
          yPos = margin;
        }
        if (bold) doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(`${label}:`, margin, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), pageWidth - margin - 50, yPos, { align: 'right' });
        yPos += 6;
      };

      // Header
      doc.setFontSize(16);
      doc.setTextColor(10, 10, 10);
      doc.text(`${settings.business_name || 'Business'} - Financial Report`, margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Period: ${periodLabel} | Generated: ${new Date().toLocaleDateString()}`, margin, yPos);
      yPos += 10;

      // KPI Section
      addSection('Key Performance Indicators');
      
      const totalRevenue = financialData.totalRevenue || 0;
      const totalExpenses = financialData.totalExpenses || 0;
      const netProfit = financialData.netProfit || 0;
      const profitMargin = financialData.profitMargin || 0;

      addText('Total Revenue', `$${totalRevenue.toFixed(2)}`, true);
      addText('Total Expenses', `$${totalExpenses.toFixed(2)}`);
      addText('Net Profit', `$${netProfit.toFixed(2)}`, true);
      addText('Profit Margin', `${profitMargin.toFixed(1)}%`);

      // Revenue Breakdown
      addSection('Revenue Breakdown');
      addText('Etsy Sales (Net)', `$${(financialData.revenue?.netEtsySales || 0).toFixed(2)}`);
      if (financialData.revenue?.etsyRefunds > 0) {
        addText('Etsy Refunds', `−$${financialData.revenue.etsyRefunds.toFixed(2)}`);
      }
      addText('Custom Sales A', `$${(financialData.revenue?.customSaleA || 0).toFixed(2)}`);
      addText('Custom Sales B', `$${(financialData.revenue?.customSaleB || 0).toFixed(2)}`);
      if (financialData.revenue?.customSalesTaxCollected > 0) {
        addText('Sales Tax Collected', `$${financialData.revenue.customSalesTaxCollected.toFixed(2)}`);
      }

      // Expense Breakdown
      addSection('Expense Breakdown');
      
      // Selling Expenses
      if (financialData.sellingExpenses?.total > 0) {
        doc.setFont(undefined, 'bold');
        addText('Selling Expenses', `$${financialData.sellingExpenses.total.toFixed(2)}`);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (financialData.sellingExpenses.etsyListingFees > 0) {
          addText('  • Listing Fees', `$${financialData.sellingExpenses.etsyListingFees.toFixed(2)}`);
        }
        if (financialData.sellingExpenses.etsyTransactionFees > 0) {
          addText('  • Transaction Fees', `$${financialData.sellingExpenses.etsyTransactionFees.toFixed(2)}`);
        }
        if (financialData.sellingExpenses.etsyProcessingFees > 0) {
          addText('  • Processing Fees', `$${financialData.sellingExpenses.etsyProcessingFees.toFixed(2)}`);
        }
        if (financialData.sellingExpenses.etsyAds > 0) {
          addText('  • Etsy Ads', `$${financialData.sellingExpenses.etsyAds.toFixed(2)}`);
        }
      }

      // Product Expenses
      if (financialData.productExpenses?.total > 0) {
        doc.setFont(undefined, 'bold');
        addText('Product Expenses', `$${financialData.productExpenses.total.toFixed(2)}`);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (financialData.productExpenses.materialsSupplies > 0) {
          addText('  • Materials & Supplies', `$${financialData.productExpenses.materialsSupplies.toFixed(2)}`);
        }
        if (financialData.productExpenses.toolsEquipment > 0) {
          addText('  • Tools & Equipment', `$${financialData.productExpenses.toolsEquipment.toFixed(2)}`);
        }
      }

      // Business Expenses
      if (financialData.businessExpenses?.total > 0) {
        doc.setFont(undefined, 'bold');
        addText('Business Expenses', `$${financialData.businessExpenses.total.toFixed(2)}`);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        if (financialData.businessExpenses.advertisingMarketing > 0) {
          addText('  • Advertising & Marketing', `$${financialData.businessExpenses.advertisingMarketing.toFixed(2)}`);
        }
        if (financialData.businessExpenses.officeExpenses > 0) {
          addText('  • Office Expenses', `$${financialData.businessExpenses.officeExpenses.toFixed(2)}`);
        }
        if (financialData.businessExpenses.gasMileage > 0) {
          addText('  • Gas / Mileage', `$${financialData.businessExpenses.gasMileage.toFixed(2)}`);
        }
        if (financialData.businessExpenses.utilitiesCellPhone > 0) {
          addText('  • Utilities / Cell Phone', `$${financialData.businessExpenses.utilitiesCellPhone.toFixed(2)}`);
        }
        if (financialData.businessExpenses.professionalServices > 0) {
          addText('  • Professional Services', `$${financialData.businessExpenses.professionalServices.toFixed(2)}`);
        }
      }

      // Summary
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = margin;
      }
      addSection('Summary');
      doc.setFont(undefined, 'bold');
      addText('Total Revenue', `$${totalRevenue.toFixed(2)}`, true);
      doc.setFont(undefined, 'normal');
      addText('Total Expenses', `$${totalExpenses.toFixed(2)}`);
      doc.setFont(undefined, 'bold');
      addText('Net Profit', `$${netProfit.toFixed(2)}`, true);
      addText('Profit Margin', `${profitMargin.toFixed(1)}%`);

      const pdfBytes = doc.output('arraybuffer');
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="report_${periodLabel.replace(/\s+/g, '_')}.pdf"`
        }
      });
    } else if (exportFormat === 'xlsx') {
      const { utils, write } = await import('npm:xlsx@0.18.5');

      const sheets = {};

      // Summary sheet
      const summaryData = [
        ['Financial Report', '', '', ''],
        ['Business', settings.business_name || 'N/A'],
        ['Period', periodLabel],
        ['Generated', new Date().toLocaleDateString()],
        ['', '', '', ''],
        ['KEY METRICS', '', '', ''],
        ['Total Revenue', financialData.totalRevenue || 0],
        ['Total Expenses', financialData.totalExpenses || 0],
        ['Net Profit', financialData.netProfit || 0],
        ['Profit Margin %', financialData.profitMargin || 0],
      ];
      sheets.Summary = utils.aoa_to_sheet(summaryData);

      // Revenue sheet
      const revenueData = [
        ['Revenue Breakdown'],
        ['Category', 'Amount'],
        ['Etsy Sales (Net)', financialData.revenue?.netEtsySales || 0],
        ['Etsy Refunds', −(financialData.revenue?.etsyRefunds || 0)],
        ['Custom Sales A', financialData.revenue?.customSaleA || 0],
        ['Custom Sales B', financialData.revenue?.customSaleB || 0],
        ['Sales Tax (Reference)', financialData.revenue?.customSalesTaxCollected || 0],
        ['TOTAL REVENUE', financialData.totalRevenue || 0],
      ];
      sheets.Revenue = utils.aoa_to_sheet(revenueData);

      // Expenses sheet
      const expenseData = [
        ['Expense Breakdown'],
        ['Category', 'Amount'],
      ];

      if (financialData.sellingExpenses?.total > 0) {
        expenseData.push(['SELLING EXPENSES', financialData.sellingExpenses.total]);
        if (financialData.sellingExpenses.etsyListingFees > 0) {
          expenseData.push(['  Listing Fees', financialData.sellingExpenses.etsyListingFees]);
        }
        if (financialData.sellingExpenses.etsyTransactionFees > 0) {
          expenseData.push(['  Transaction Fees', financialData.sellingExpenses.etsyTransactionFees]);
        }
        if (financialData.sellingExpenses.etsyProcessingFees > 0) {
          expenseData.push(['  Processing Fees', financialData.sellingExpenses.etsyProcessingFees]);
        }
        if (financialData.sellingExpenses.etsyAds > 0) {
          expenseData.push(['  Etsy Ads', financialData.sellingExpenses.etsyAds]);
        }
      }

      if (financialData.productExpenses?.total > 0) {
        expenseData.push(['PRODUCT EXPENSES', financialData.productExpenses.total]);
        if (financialData.productExpenses.materialsSupplies > 0) {
          expenseData.push(['  Materials & Supplies', financialData.productExpenses.materialsSupplies]);
        }
        if (financialData.productExpenses.toolsEquipment > 0) {
          expenseData.push(['  Tools & Equipment', financialData.productExpenses.toolsEquipment]);
        }
      }

      if (financialData.businessExpenses?.total > 0) {
        expenseData.push(['BUSINESS EXPENSES', financialData.businessExpenses.total]);
        if (financialData.businessExpenses.advertisingMarketing > 0) {
          expenseData.push(['  Advertising & Marketing', financialData.businessExpenses.advertisingMarketing]);
        }
        if (financialData.businessExpenses.officeExpenses > 0) {
          expenseData.push(['  Office Expenses', financialData.businessExpenses.officeExpenses]);
        }
        if (financialData.businessExpenses.gasMileage > 0) {
          expenseData.push(['  Gas / Mileage', financialData.businessExpenses.gasMileage]);
        }
        if (financialData.businessExpenses.utilitiesCellPhone > 0) {
          expenseData.push(['  Utilities / Cell Phone', financialData.businessExpenses.utilitiesCellPhone]);
        }
        if (financialData.businessExpenses.professionalServices > 0) {
          expenseData.push(['  Professional Services', financialData.businessExpenses.professionalServices]);
        }
      }

      expenseData.push(['TOTAL EXPENSES', financialData.totalExpenses || 0]);
      sheets.Expenses = utils.aoa_to_sheet(expenseData);

      const workbook = { Sheets: sheets, SheetNames: ['Summary', 'Revenue', 'Expenses'] };
      const buffer = write(workbook, { bookType: 'xlsx', type: 'array' });

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="report_${periodLabel.replace(/\s+/g, '_')}.xlsx"`
        }
      });
    }

    return Response.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('Export error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});