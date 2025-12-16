import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserOptions } from 'jspdf-autotable';

// Extend the jsPDF type to include the autoTable method
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}

export const exportToPDF = async (
    columns: any[], 
    data: any[][], 
    fileName: string, 
    reportTitle: string, 
    companyName: string = "Portal Konimba"
) => {
  const pdf = new jsPDF('p', 'mm', 'a4') as jsPDFWithAutoTable;
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;

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
    pdf.addImage(logoDataUrl, 'PNG', margin, margin, 30, 10);
  } catch (error) {
    console.error("Could not load logo for PDF, using text fallback.", error);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(companyName, margin, margin + 8);
  }
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reportTitle, pdfWidth - margin, margin, { align: 'right' });

  pdf.setFontSize(10);
  pdf.setTextColor(150);
  const dateStr = new Date().toLocaleDateString('es-VE');
  pdf.text(dateStr, pdfWidth - margin, margin + 8, { align: 'right' });

  // --- Add Content ---
  autoTable(pdf, {
    head: [columns],
    body: data,
    startY: margin + 25,
    theme: 'grid',
    headStyles: { fillColor: [22, 64, 114] }, // Primary color
    styles: {
      font: 'helvetica',
      fontSize: 8,
    },
    didDrawPage: (data) => {
      // --- Add Footer ---
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(
        `Página ${data.pageNumber}`,
        pdfWidth / 2,
        pdf.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
  });

  // --- Save PDF ---
  pdf.save(fileName);
};
