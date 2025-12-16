// A simplified version of jspdf-autotable
// This is not the full library, but a custom implementation for this project's needs.
import jsPDF from 'jspdf';

export interface UserOptions {
  head?: any[][];
  body?: any[][];
  foot?: any[][];
  startY?: number;
  margin?: number | { top?: number; right?: number; bottom?: number; left?: number };
  theme?: 'striped' | 'grid' | 'plain';
  styles?: any;
  headStyles?: any;
  bodyStyles?: any;
  footStyles?: any;
  alternateRowStyles?: any;
  columnStyles?: any;
}

export function autoTable(doc: jsPDF, options: UserOptions) {
  const table = new Table(doc, options);
  table.draw();
  return doc;
}

class Table {
  doc: jsPDF;
  options: UserOptions;
  settings: any;
  columns: any[];
  pageNumber: number = 1;

  constructor(doc: jsPDF, options: UserOptions) {
    this.doc = doc;
    this.options = options;
    this.settings = this.initSettings();
    this.columns = this.createColumns();
  }

  initSettings() {
    const margin = this.options.margin ?? 15;
    const margins = typeof margin === 'number' ? { top: margin, right: margin, bottom: margin, left: margin } : margin;
    return {
      startY: this.options.startY ?? margins.top,
      margin: margins,
      theme: this.options.theme ?? 'striped',
      styles: this.options.styles ?? {},
      headStyles: this.options.headStyles ?? {},
      bodyStyles: this.options.bodyStyles ?? {},
      footStyles: this.options.footStyles ?? {},
      alternateRowStyles: this.options.alternateRowStyles ?? {},
      columnStyles: this.options.columnStyles ?? {},
    };
  }

  createColumns() {
    const head = this.options.head?.[0] ?? [];
    const pageWidth = this.doc.internal.pageSize.getWidth() - this.settings.margin.left - this.settings.margin.right;
    const colWidth = pageWidth / head.length;
    return head.map(() => ({ width: colWidth }));
  }

  draw() {
    let y = this.settings.startY;
    const startX = this.settings.margin.left;
    const endX = this.doc.internal.pageSize.getWidth() - this.settings.margin.right;

    this.doc.setFont(this.settings.styles.font ?? 'helvetica', this.settings.styles.fontStyle ?? 'normal');
    this.doc.setFontSize(this.settings.styles.fontSize ?? 10);
    
    // Draw Header
    if (this.options.head) {
        y = this.drawRows(this.options.head, y, this.settings.headStyles, true);
    }
    
    // Draw Body
    if (this.options.body) {
        y = this.drawRows(this.options.body, y, this.settings.bodyStyles);
    }

    // Draw Footer
     if (this.options.foot) {
        y = this.drawRows(this.options.foot, y, this.settings.footStyles);
    }
  }
  
  drawRows(rows: any[][], y: number, styles: any, isHeader = false) {
    let newY = y;
    rows.forEach((row, rowIndex) => {
        let x = this.settings.margin.left;
        let maxHeight = 0;

        // Calculate max height for the row
        row.forEach((cell, colIndex) => {
            const cellText = this.getCellText(cell);
            const textLines = this.doc.splitTextToSize(cellText, this.columns[colIndex]?.width ?? 100);
            const textHeight = textLines.length * (this.settings.styles.fontSize ?? 10) * 0.352777 * 1.15;
            if (textHeight > maxHeight) {
                maxHeight = textHeight;
            }
        });
        maxHeight += (this.settings.styles.cellPadding ?? 5) * 2;
        
        if (newY + maxHeight > this.doc.internal.pageSize.getHeight() - this.settings.margin.bottom) {
            this.doc.addPage();
            this.pageNumber++;
            newY = this.settings.margin.top;
             if (isHeader && this.options.head) {
                 newY = this.drawRows(this.options.head, newY, this.settings.headStyles, true);
             }
        }
        
        row.forEach((cell, colIndex) => {
            const colWidth = this.columns[colIndex]?.width ?? 100;
            const cellStyles = this.getCellStyles(rowIndex, colIndex, styles);
            
            this.doc.setFillColor(cellStyles.fillColor[0], cellStyles.fillColor[1], cellStyles.fillColor[2]);
            this.doc.setTextColor(cellStyles.textColor[0], cellStyles.textColor[1], cellStyles.textColor[2]);
            this.doc.setFont(cellStyles.font, cellStyles.fontStyle);

            this.doc.rect(x, newY, colWidth, maxHeight, 'F');
            
            if (this.settings.theme === 'grid') {
                this.doc.setDrawColor(200);
                this.doc.rect(x, newY, colWidth, maxHeight, 'S');
            }

            const cellText = this.getCellText(cell);
            const halign = this.getCellProp(cell, 'styles.halign', cellStyles.halign);
            this.doc.text(cellText, x + (this.settings.styles.cellPadding ?? 5), newY + maxHeight / 2, {
                 align: halign,
                 baseline: 'middle',
                 maxWidth: colWidth - (this.settings.styles.cellPadding ?? 5) * 2,
            });

            x += colWidth;
        });

        newY += maxHeight;
    });
    return newY;
  }
  
  getCellText(cell: any) {
    if (cell && typeof cell === 'object' && cell.content !== undefined) {
        return String(cell.content);
    }
    return String(cell ?? '');
  }

  getCellProp(cell: any, prop: string, defaultValue: any) {
    if (cell && typeof cell === 'object') {
        const props = prop.split('.');
        let value = cell;
        for (const p of props) {
            if (value && typeof value === 'object' && p in value) {
                value = (value as any)[p];
            } else {
                return defaultValue;
            }
        }
        return value;
    }
    return defaultValue;
  }
  
  getCellStyles(rowIndex: number, colIndex: number, rowStyles: any) {
      const isAlternate = this.settings.theme === 'striped' && rowIndex % 2 !== 0;
      const base = { ...this.settings.styles, ...rowStyles };
      const alternate = isAlternate ? this.settings.alternateRowStyles : {};
      const column = this.settings.columnStyles[colIndex] ?? {};
      
      const styles = { ...base, ...alternate, ...column };

      return {
          fillColor: styles.fillColor ? this.parseColor(styles.fillColor) : [255, 255, 255],
          textColor: styles.textColor ? this.parseColor(styles.textColor) : [0, 0, 0],
          font: styles.font ?? 'helvetica',
          fontStyle: styles.fontStyle ?? 'normal',
          halign: styles.halign ?? 'left',
      };
  }

  parseColor(color: string | [number, number, number]): [number, number, number] {
      if (Array.isArray(color)) return color;
      return [255, 255, 255]; // Default white
  }
}
