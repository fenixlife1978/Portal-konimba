import jsPDF from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';

// Store the pdf instance for multi-page/multi-table reports
let pdfInstance: jsPDF | null = null;
let finalOptions: ExportOptions | null = null;

// Extend the jsPDF type to include the autoTable method
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}

interface ExportOptions {
    head?: any[][];
    body?: any[][];
    foot?: any[][];
    tables?: { title: string, subHeader?: string, head: any[][], body: any[][], foot: any[][] }[];
    fileName?: string;
    reportTitle?: string;
    companyName?: string;
    showFooter?: boolean;
    isSubtable?: boolean;
    addPage?: boolean;
    isFinalSave?: boolean;
}

export const exportToPDF = async (
    options: ExportOptions,
    returnInstance: boolean = false
): Promise<jsPDF | void> => {
  const {
    head,
    body,
    foot,
    tables,
    fileName = 'report.pdf',
    reportTitle = 'Reporte',
    companyName = "Portal Konimba",
    showFooter = true,
    isSubtable = false,
    addPage = false,
    isFinalSave = false,
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

  let startY = 25;

  if (!isSubtable) {
      // --- Add Header ---
      const logoUrl = '/logo.png';
      try {
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        await new Promise<void>((resolve, reject) => {
          reader.onload = () => resolve();
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const logoDataUrl = reader.result as string;
        pdf.addImage(logoDataUrl, 'PNG', margin, 10, 30, 10);
      } catch (error) {
        console.error("Could not load logo for PDF, using text fallback.", error);
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        pdf.text(companyName, margin, margin + 8);
      }
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportTitle, pdfWidth - margin, 15, { align: 'right' });
    
      pdf.setFontSize(10);
      pdf.setTextColor(150);
      const dateStr = new Date().toLocaleDateString('es-VE');
      pdf.text(dateStr, pdfWidth - margin, 23, { align: 'right' });
  }


  const drawTable = (tableOptions: UserOptions) => {
    autoTable(pdf, tableOptions);
  }

  if (tables) {
      let lastY = startY;
      tables.forEach((table, index) => {
          if (index > 0) {
            // Add space between tables
            lastY += 10;
          }

          if (table.subHeader) {
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(40);
            pdf.text(table.subHeader, margin, lastY);
            lastY += 8;
          }

          drawTable({
            head: table.head,
            body: table.body,
            foot: table.foot,
            startY: lastY,
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
                 if (data.row.raw[0] && typeof data.row.raw[0] === 'object' && data.row.raw[0].colSpan) {
                    pdf.setFontSize(10);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFillColor(240,240,240);
                 }
            },
            didDrawPage: (data) => {
                lastY = data.cursor?.y || lastY;
            }
          });
          lastY = (pdf as any).lastAutoTable.finalY || lastY;
      });

  } else {
    // --- Add Content for single table ---
    drawTable({
        head,
        body,
        foot,
        startY: margin + 25,
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
