import jsPDF from "jspdf";

export function exportQuoteToPDF(quote, businessName = "Your Business") {
  const doc = new jsPDF();
  
  // Colors
  const primaryColor = [26, 26, 26]; // #1a1a1a
  const accentColor = [5, 150, 105]; // #059669
  const grayColor = [120, 113, 108]; // #78716c
  
  let yPos = 20;
  
  // Header - Business Name
  doc.setFontSize(24);
  doc.setTextColor(...primaryColor);
  doc.text(businessName, 20, yPos);
  
  yPos += 15;
  doc.setFontSize(12);
  doc.setTextColor(...accentColor);
  doc.text("QUOTE", 20, yPos);
  
  // Quote Number and Date
  yPos += 10;
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text(`Quote #${quote.quote_number}`, 20, yPos);
  doc.text(`Date: ${new Date(quote.created_date).toLocaleDateString()}`, 150, yPos, { align: "right" });
  
  // Divider
  yPos += 5;
  doc.setDrawColor(...grayColor);
  doc.line(20, yPos, 190, yPos);
  
  // Project Details
  yPos += 10;
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text("Project Details", 20, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text(`Project Name: ${quote.project_name}`, 20, yPos);
  
  if (quote.due_date) {
    yPos += 6;
    doc.text(`Deadline: ${new Date(quote.due_date).toLocaleDateString()}`, 20, yPos);
  }
  
  yPos += 6;
  doc.text(`Status: ${quote.status}`, 20, yPos);
  
  // Customer Information
  yPos += 15;
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text("Customer Information", 20, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  if (quote.customer_name) {
    doc.text(`Name: ${quote.customer_name}`, 20, yPos);
    yPos += 6;
  }
  if (quote.customer_email) {
    doc.text(`Email: ${quote.customer_email}`, 20, yPos);
    yPos += 6;
  }
  if (quote.customer_phone) {
    doc.text(`Phone: ${quote.customer_phone}`, 20, yPos);
    yPos += 6;
  }
  
  // Materials
  if (quote.materials && quote.materials.length > 0) {
    yPos += 10;
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text("Materials", 20, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(...grayColor);
    
    quote.materials.forEach((material) => {
      doc.text(`${material.name || material.type}`, 20, yPos);
      doc.text(`$${(material.cost || 0).toFixed(2)}`, 190, yPos, { align: "right" });
      yPos += 6;
    });
  }
  
  // Labor & Machines
  yPos += 10;
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text("Labor & Machine Time", 20, yPos);
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  
  // Design Services
  const designHours = (parseFloat(quote.design_hours || 0)) + (parseFloat(quote.design_minutes || 0) / 60);
  if (designHours > 0) {
    const designTotal = designHours * (parseFloat(quote.design_rate || 0));
    doc.text(`Design Services (${designHours.toFixed(2)} hrs @ $${quote.design_rate}/hr)`, 20, yPos);
    doc.text(`$${designTotal.toFixed(2)}`, 190, yPos, { align: "right" });
    yPos += 6;
  }
  
  // Manual Labor
  const laborHours = (parseFloat(quote.manual_labor_hours || 0)) + (parseFloat(quote.manual_labor_minutes || 0) / 60);
  if (laborHours > 0) {
    const laborTotal = laborHours * (parseFloat(quote.manual_labor_rate || 0));
    doc.text(`Manual Labor (${laborHours.toFixed(2)} hrs @ $${quote.manual_labor_rate}/hr)`, 20, yPos);
    doc.text(`$${laborTotal.toFixed(2)}`, 190, yPos, { align: "right" });
    yPos += 6;
  }
  
  // Machines
  if (quote.machines && quote.machines.length > 0) {
    quote.machines.forEach((machine) => {
      const machineHours = (parseFloat(machine.hours || 0)) + (parseFloat(machine.minutes || 0) / 60);
      const machineTotal = machineHours * (parseFloat(machine.rate || 0));
      doc.text(`${machine.name} (${machineHours.toFixed(2)} hrs @ $${machine.rate}/hr)`, 20, yPos);
      doc.text(`$${machineTotal.toFixed(2)}`, 190, yPos, { align: "right" });
      yPos += 6;
    });
  }
  
  // Calculate totals
  const materialsTotal = (quote.materials || []).reduce((sum, m) => sum + (parseFloat(m.cost) || 0), 0);
  const designTotal = designHours * (parseFloat(quote.design_rate || 0));
  const laborTotal = laborHours * (parseFloat(quote.manual_labor_rate || 0));
  const machinesTotal = (quote.machines || []).reduce((sum, m) => {
    const hrs = (parseFloat(m.hours || 0)) + (parseFloat(m.minutes || 0) / 60);
    return sum + (hrs * (parseFloat(m.rate || 0)));
  }, 0);
  const grandTotal = materialsTotal + designTotal + laborTotal + machinesTotal;
  
  // Total Section
  yPos += 10;
  doc.setDrawColor(...grayColor);
  doc.line(20, yPos, 190, yPos);
  
  yPos += 8;
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text("Materials Total:", 130, yPos);
  doc.text(`$${materialsTotal.toFixed(2)}`, 190, yPos, { align: "right" });
  
  yPos += 7;
  doc.text("Labor & Machines:", 130, yPos);
  doc.text(`$${(designTotal + laborTotal + machinesTotal).toFixed(2)}`, 190, yPos, { align: "right" });
  
  yPos += 10;
  doc.setFontSize(16);
  doc.setTextColor(...accentColor);
  doc.text("TOTAL:", 130, yPos);
  doc.text(`$${grandTotal.toFixed(2)}`, 190, yPos, { align: "right" });
  
  // Notes
  if (quote.notes) {
    yPos += 15;
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text("Notes", 20, yPos);
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(...grayColor);
    const splitNotes = doc.splitTextToSize(quote.notes, 170);
    doc.text(splitNotes, 20, yPos);
  }
  
  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text("Thank you for your business!", 105, pageHeight - 15, { align: "center" });
  
  // Save PDF
  doc.save(`Quote_${quote.quote_number}_${quote.project_name.replace(/\s+/g, '_')}.pdf`);
}