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
    companyAddress?: string;
    showFooter?: boolean;
    isSubtable?: boolean;
    addPage?: boolean;
    isFinalSave?: boolean;
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
  const {
    head,
    body,
    foot,
    tables,
    fileName = 'report.pdf',
    reportTitle = 'Reporte',
    companyName = "Portal Konimba",
    companyAddress,
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

  let startY = 15;

  if (!isSubtable) {
      // --- Add Header ---
      const logoUrl = "https://i.supaimg.com/f1d0ffb2-fc91-4d68-b225-ad61b19b274e.jpg"; // 👉 tu logo externo
      try {
        const logoDataUrl = await getImageDataUrl(logoUrl);
        const format = logoDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        pdf.addImage(logoDataUrl, format, margin, 10, 20, 20); // x, y, width, height
      } catch (error) {
        console.error("Could not load logo for PDF, using text fallback.", error);
      }
      
      const companyInfoX = margin + 25;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(companyName, companyInfoX, 15);
      
      if(companyAddress) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(companyAddress, companyInfoX, 21);
      }

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportTitle, pdfWidth - margin, 15, { align: 'right' });
    
      pdf.setFontSize(10);
      pdf.setTextColor(150);
      const dateStr = new Date().toLocaleDateString('es-VE');
      pdf.text(dateStr, pdfWidth - margin, 23, { align: 'right' });
      
      startY = 35;
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
              const rawRow = data.row.raw as any[];
              if (rawRow && rawRow[0] && typeof rawRow[0] === 'object' && rawRow[0].colSpan) {
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.setFillColor(240, 240, 240);
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
