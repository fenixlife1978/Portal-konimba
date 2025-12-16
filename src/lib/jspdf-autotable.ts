// This file is a placeholder to satisfy TypeScript imports.
// The actual implementation is now provided by the jspdf-autotable npm package.

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
  // This is a mock function. The real functionality comes from the package.
  console.log("Using jspdf-autotable package. This function is a placeholder.");
  return doc;
}
