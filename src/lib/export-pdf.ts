import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportToPDF = async (elementId: string, fileName: string, reportTitle: string, companyName: string = "Portal Konimba") => {
  const input = document.getElementById(elementId);
  if (!input) {
    console.error(`Element with id ${elementId} not found.`);
    return;
  }

  // Create a new jsPDF instance
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;

  // --- Add Header ---
  // Since we cannot load external images easily, we'll use text or a placeholder
  const logoUrl = '/logo.png'; // Assuming the logo is in the public folder

  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    const reader = new FileReader();
    await new Promise((resolve, reject) => {
      reader.onload = resolve;
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const logoDataUrl = reader.result as string;
    pdf.addImage(logoDataUrl, 'PNG', margin, margin, 30, 10); // Adjust size as needed
  } catch (error) {
    console.error("Could not load logo for PDF, using text fallback.", error);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(companyName, margin, margin + 8);
  }
  
  // Title
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reportTitle, margin, margin + 18);

  // Date
  pdf.setFontSize(10);
  pdf.setTextColor(150);
  const dateStr = new Date().toLocaleDateString('es-VE');
  pdf.text(dateStr, pdfWidth - margin, margin + 8, { align: 'right' });

  // Line separator
  pdf.setDrawColor(221, 221, 221); // A light grey
  pdf.line(margin, margin + 25, pdfWidth - margin, margin + 25);

  // --- Add Content ---
  // Use html2canvas to render the element
  const canvas = await html2canvas(input, {
    scale: 2, // Higher scale for better quality
    useCORS: true, // If you have images from other domains
    backgroundColor: null, // Use transparent background
  });

  const imgData = canvas.toDataURL('image/png');
  const imgProps = pdf.getImageProperties(imgData);
  const imgWidth = pdfWidth - (margin * 2);
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

  let contentHeight = imgHeight;
  let heightLeft = contentHeight;
  let position = margin + 30; // Initial y position after header

  // Add the first page
  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  heightLeft -= (pdfHeight - position - margin); // Subtract used height

  // Add new pages if content overflows
  while (heightLeft > 0) {
    position = -contentHeight + heightLeft;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }
  
  // --- Add Footer ---
  const pageCount = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(
      `Página ${i} de ${pageCount}`,
      pdfWidth / 2,
      pdfHeight - margin,
      { align: 'center' }
    );
  }

  // --- Save PDF ---
  pdf.save(fileName);
};
