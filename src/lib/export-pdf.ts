import type { jsPDF } from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';

// Store the pdf instance for multi-page/multi-table reports
let pdfInstance: jsPDF | null = null;
let finalOptions: ExportOptions | null = null;

// Extend the jsPDF type to include the autoTable method
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}

interface PaymentSummary {
    totalUSD: number;
    usdToVesRate?: number;
    usdToCopRate?: number;
    totalToPayInVES_USD: number;
    totalToPayInCOP_USD: number;
    totalToPayInUSDT: number;
}

interface ExportOptions {
    head?: any[][];
    body?: any[][];
    foot?: any[][];
    tables?: { title?: string, subHeader?: string, head: any[][], body: any[][], foot: any[][] }[];
    fileName?: string;
    reportTitle?: string;
    companyName?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    companySocialMedia?: string;
    publisherName?: string;
    showFooter?: boolean;
    isSubtable?: boolean;
    addPage?: boolean;
    isFinalSave?: boolean;
    paymentSummary?: PaymentSummary;
}

// Función auxiliar para convertir una URL en DataURL válido
async function getImageDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const exportToPDF = async (
    options: ExportOptions,
    returnInstance: boolean = false
): Promise<jsPDF | void> => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

  const {
    head,
    body,
    foot,
    tables,
    fileName = 'report.pdf',
    reportTitle = 'Reporte',
    companyName = "Portal Konimba",
    companyAddress,
    companyPhone,
    companyEmail,
    companySocialMedia,
    publisherName,
    showFooter = true,
    isSubtable = false,
    addPage = false,
    isFinalSave = false,
    paymentSummary,
  } = options;

  if (isFinalSave && pdfInstance) {
    if (showFooter) {
        const pageCount = pdfInstance.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdfInstance.setPage(i);
            pdfInstance.setFontSize(8);
            pdfInstance.setTextColor(150);
            pdfInstance.text(
                `Página ${i} de ${pageCount}`,
                pdfInstance.internal.pageSize.getWidth() / 2,
                pdfInstance.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }
    }
    pdfInstance.save(finalOptions?.fileName || 'report.pdf');
    pdfInstance = null;
    finalOptions = null;
    return;
  }
  
  if (!pdfInstance) {
      pdfInstance = new jsPDF('l', 'mm', 'a4') as jsPDFWithAutoTable;
      finalOptions = options;
  }

  const pdf = pdfInstance;
  if(addPage) pdf.addPage();
  
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;

  let startY = 15;

  if (!isSubtable) {
      // --- Add Header ---
      const logoUrl = "https://i.supaimg.com/f1d0ffb2-fc91-4d68-b225-ad61b19b274e.jpg"; // 👉 tu logo externo
      try {
        const response = await fetch(logoUrl);
        if (!response.ok) throw new Error("Logo fetch failed");
        const blob = await response.blob();
        const reader = new FileReader();
        await new Promise<void>((resolve, reject) => {
            reader.onloadend = () => {
                const logoDataUrl = reader.result as string;
                const format = logoDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
                pdf.addImage(logoDataUrl, format, margin, 10, 20, 20); // x, y, width, height
                resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error("Could not load logo for PDF, using text fallback.", error);
      }
      
      // Company Info Block
      const companyInfoX = margin + 25;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(companyName, companyInfoX, 15);
      
      let companyInfoY = 20;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      
      if(companyAddress) {
        pdf.text(companyAddress, companyInfoX, companyInfoY);
        companyInfoY += 4;
      }
       if(companyPhone) {
        pdf.text(`Tel: ${companyPhone}`, companyInfoX, companyInfoY);
        companyInfoY += 4;
      }
      if(companyEmail) {
        pdf.text(`Email: ${companyEmail}`, companyInfoX, companyInfoY);
        companyInfoY += 4;
      }
       if(companySocialMedia) {
        pdf.text(`Social: ${companySocialMedia}`, companyInfoX, companyInfoY);
      }
      

      // Report Title and Date (Right aligned)
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportTitle, pdfWidth - margin, 15, { align: 'right' });
    
      pdf.setFontSize(10);
      pdf.setTextColor(150);
      const dateStr = new Date().toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric' });
      pdf.text(dateStr, pdfWidth - margin, 23, { align: 'right' });
      
      startY = Math.max(companyInfoY, 25) + 10;

      // Add Publisher Info (centered)
      if (publisherName) {
        startY += 5; // Add some space
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(publisherName, pdfWidth / 2, startY, { align: 'center' });
        startY += 8;
      }
  }


  const drawTable = (tableOptions: UserOptions) => {
    autoTable(pdf, tableOptions);
  }
  
  let finalY = startY;

  if (tables) {
      tables.forEach((table, index) => {
          if (index > 0) {
            finalY += 10;
          }

          if (table.subHeader) {
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(40);
            pdf.text(table.subHeader, margin, finalY);
            finalY += 8;
          }

          drawTable({
            head: table.head,
            body: table.body,
            foot: table.foot,
            startY: finalY,
            theme: 'grid',
            styles: {
              font: 'helvetica',
              fontSize: 7,
              cellPadding: 1,
              overflow: 'linebreak',
            },
            headStyles: { 
                fillColor: [22, 64, 114], // Primary color
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 6,
                halign: 'center'
            },
            footStyles: {
                fillColor: [230, 230, 230],
                textColor: 0,
                fontStyle: 'bold',
            },
            willDrawCell: (data) => {
              const rawRow = data.row.raw as any[];
              if (rawRow && rawRow[0] && typeof rawRow[0] === 'object' && rawRow[0].colSpan) {
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.setFillColor(240, 240, 240);
              }
            },
            didDrawPage: (data) => {
                finalY = data.cursor?.y || finalY;
            }
          });
          finalY = (pdf as any).lastAutoTable.finalY || finalY;
      });

  } else {
    // --- Add Content for single table ---
    drawTable({
        head,
        body,
        foot,
        startY,
        theme: 'grid',
        styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 1.5,
            overflow: 'linebreak',
        },
        headStyles: { 
            fillColor: [22, 64, 114],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        footStyles: {
            fillColor: [230, 230, 230],
            textColor: 0,
            fontStyle: 'bold',
        },
        didDrawPage: (data) => {
          // --- Add Footer ---
          if (showFooter && !returnInstance) {
            pdf.setFontSize(8);
            pdf.setTextColor(150);
            pdf.text(
              `Página ${data.pageNumber}`,
              pdfWidth / 2,
              pdf.internal.pageSize.getHeight() - 10,
              { align: 'center' }
            );
          }
        }
    });
    finalY = (pdf as any).lastAutoTable.finalY || finalY;
  }
  
    // --- Add Payment Summary ---
    if (paymentSummary) {
        finalY += 15;
        if (finalY > pdf.internal.pageSize.getHeight() - 40) {
            pdf.addPage();
            finalY = 20;
        }

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Resumen General de la Nómina', margin, finalY);
        finalY += 8;

        const summaryBody: any[] = [];
        const { totalUSD, usdToVesRate, usdToCopRate, totalToPayInVES_USD, totalToPayInCOP_USD, totalToPayInUSDT } = paymentSummary;

        summaryBody.push([{ content: `Monto Total Nómina (USD): $${totalUSD.toFixed(2)}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }]);

        if (totalToPayInVES_USD > 0 && usdToVesRate) {
            const totalVES = totalToPayInVES_USD * usdToVesRate;
            summaryBody.push([
                { content: `Tasa Aplicable (VES): ${usdToVesRate.toFixed(2)}`, styles: { fontStyle: 'normal' } },
                { content: `Pago Total en Bolívares (VES): $${totalToPayInVES_USD.toFixed(2)} x ${usdToVesRate.toFixed(2)} = ${totalVES.toLocaleString('es-VE', {minimumFractionDigits: 2})} VES`, styles: { halign: 'right', fontStyle: 'bold' } }
            ]);
        }
        if (totalToPayInCOP_USD > 0 && usdToCopRate) {
            const totalCOP = totalToPayInCOP_USD * usdToCopRate;
             summaryBody.push([
                { content: `Tasa Aplicable (COP): ${usdToCopRate.toFixed(2)}`, styles: { fontStyle: 'normal' } },
                { content: `Pago Total en Pesos (COP): $${totalToPayInCOP_USD.toFixed(2)} x ${usdToCopRate.toFixed(2)} = ${totalCOP.toLocaleString('es-CO', {style: 'currency', currency: 'COP'})}`, styles: { halign: 'right', fontStyle: 'bold' } }
            ]);
        }
        if (totalToPayInUSDT > 0) {
            summaryBody.push([
                { content: `Pagos en USDT (Binance):`, styles: { fontStyle: 'normal' } },
                { content: `$${totalToPayInUSDT.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }
            ]);
        }

        autoTable(pdf, {
            body: summaryBody,
            startY: finalY,
            theme: 'grid',
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 100 },
                1: { cellWidth: 'auto' }
            }
        });
    }


  if (returnInstance) {
      return pdf;
  }
  
  if (!isSubtable) {
      if (showFooter) {
        const pageCount = pdf.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(150);
            pdf.text(
                `Página ${i} de ${pageCount}`,
                pdfWidth / 2,
                pdf.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }
      }
      pdf.save(fileName);
      pdfInstance = null; // Reset for next non-subtable call
      finalOptions = null;
  }
};
