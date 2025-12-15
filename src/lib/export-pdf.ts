import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportToPDF = async (elementId: string, fileName: string, reportTitle: string) => {
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
  // Create a canvas for the logo
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = 64;
  logoCanvas.height = 64;
  const ctx = logoCanvas.getContext('2d');
  
  if (ctx) {
    const logoSvg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="30" fill="hsl(215 70% 30%)" />
        <path
          d="M32 17.5L35.5 28.5L46.5 32L35.5 35.5L32 46.5L28.5 35.5L17.5 32L28.5 28.5L32 17.5Z"
          fill="hsl(210 40% 98%)"
        />
      </svg>`;
    const logoImg = new Image();
    logoImg.src = 'data:image/svg+xml;base64,' + btoa(logoSvg);
    
    await new Promise(resolve => {
        logoImg.onload = () => {
            ctx.drawImage(logoImg, 0, 0);
            const logoDataUrl = logoCanvas.toDataURL('image/png');
            pdf.addImage(logoDataUrl, 'PNG', margin, margin, 12, 12);
            resolve(null);
        };
    });
  }
  
  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text("Siren's Portal", margin + 15, margin + 8);

  // Report Title
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(reportTitle, margin + 15, margin + 14);

  // Date
  pdf.setFontSize(10);
  pdf.setTextColor(150);
  const dateStr = new Date().toLocaleDateString('es-VE');
  pdf.text(dateStr, pdfWidth - margin, margin + 8, { align: 'right' });

  // Line separator
  pdf.setDrawColor(221, 221, 221); // A light grey
  pdf.line(margin, margin + 20, pdfWidth - margin, margin + 20);

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
  let position = margin + 25; // Initial y position after header

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
