// utils/pdfGenerator.js - Updated with optimization
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateReceiptPDF = async (receiptElement, supplierName) => {
  try {
    const canvas = await html2canvas(receiptElement, {
      scale: 1.5, // Reduced from 2 to 1.5 for smaller file size
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      removeContainer: true,
      // Optimize for smaller file size
      width: 800, // Fixed width instead of full element width
      height: receiptElement.scrollHeight * (800 / receiptElement.scrollWidth), // Maintain aspect ratio
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG with 80% quality instead of PNG
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 190; // Slightly smaller than A4 width
    const pageHeight = 277; // Slightly smaller than A4 height
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Add image to PDF
    pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);
    
    // Generate filename without special characters
    const cleanSupplierName = supplierName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const fileName = `PO_${cleanSupplierName}_${Date.now()}.pdf`;
    
    // Convert to base64
    const pdfBase64 = pdf.output('datauristring');
    
    
    return { pdfBase64, fileName };
  } catch (error) {
    throw error;
  }
};