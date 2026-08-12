import jsPDF from "jspdf";

export function exportQuoteToPDF(quote, businessName = "Your Business") {
  const doc = new jsPDF();

  const primaryColor = [26, 26, 26];
  const accentColor = [5, 150, 105];
  const grayColor = [120, 113, 108];

  let yPos = 20;

  // Header
  doc.setFontSize(24);
  doc.setTextColor(...primaryColor);
  doc.text(businessName, 20, yPos);

  yPos += 15;
  doc.setFontSize(12);
  doc.setTextColor(...accentColor);
  doc.text("QUOTE", 20, yPos);

  yPos += 10;
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text(`Quote #${quote.quote_number}`, 20, yPos);
  doc.text(`Date: ${quote.created_date ? new Date(quote.created_date).toLocaleDateString() : new Date().toLocaleDateString()}`, 150, yPos, { align: "right" });

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
  doc.text(`Project: ${quote.project_name || ""}`, 20, yPos);

  if (quote.quantity && quote.quantity > 1) {
    yPos += 6;
    doc.text(`Quantity: ${quote.quantity} units`, 20, yPos);
  }

  if (quote.due_date) {
    yPos += 6;
    doc.text(`Deadline: ${new Date(quote.due_date).toLocaleDateString()}`, 20, yPos);
  }

  yPos += 6;
  doc.text(`Status: ${quote.status || "Draft"}`, 20, yPos);

  // Customer Information
  yPos += 15;
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text("Billed To", 20, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  if (quote.customer_name) {
    doc.text(quote.customer_name, 20, yPos);
    yPos += 6;
  }
  if (quote.customer_email) {
    doc.text(quote.customer_email, 20, yPos);
    yPos += 6;
  }
  if (quote.customer_phone) {
    doc.text(quote.customer_phone, 20, yPos);
    yPos += 6;
  }

  // Line Items (if present)
  if (quote.line_items && quote.line_items.length > 0) {
    yPos += 10;
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text("Line Items", 20, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(...grayColor);
    doc.setFont(undefined, "bold");
    doc.text("Description", 20, yPos);
    doc.text("Qty", 120, yPos);
    doc.text("Unit Price", 140, yPos);
    doc.text("Total", 175, yPos, { align: "right" });
    doc.setFont(undefined, "normal");
    yPos += 5;
    doc.setDrawColor(...grayColor);
    doc.line(20, yPos, 190, yPos);
    yPos += 6;

    quote.line_items.forEach((item) => {
      doc.text(String(item.description || "").substring(0, 50), 20, yPos);
      doc.text(String(item.quantity || 1), 120, yPos);
      doc.text(`$${(item.unit_price || 0).toFixed(2)}`, 140, yPos);
      doc.text(`$${(item.total || 0).toFixed(2)}`, 190, yPos, { align: "right" });
      yPos += 6;
    });
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
      const lineTotal = (material.cost || 0) * (material.quantity || 1);
      const label = material.name || material.type || "Material";
      doc.text(`${label}${material.quantity > 1 ? ` (x${material.quantity})` : ""}`, 20, yPos);
      doc.text(`$${lineTotal.toFixed(2)}`, 190, yPos, { align: "right" });
      yPos += 6;
    });
  }

  // Labor & Machine Time
  const laborHours = (parseFloat(quote.labor_hours || 0)) + (parseFloat(quote.labor_minutes || 0) / 60);
  if (laborHours > 0 || (quote.machines && quote.machines.length > 0)) {
    yPos += 10;
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text("Labor & Machine Time", 20, yPos);

    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(...grayColor);

    if (laborHours > 0) {
      const laborTotal = laborHours * (parseFloat(quote.labor_rate || 0));
      doc.text(`Labor (${laborHours.toFixed(2)} hrs @ $${(quote.labor_rate || 0).toFixed(2)}/hr)`, 20, yPos);
      doc.text(`$${laborTotal.toFixed(2)}`, 190, yPos, { align: "right" });
      yPos += 6;
    }

    if (quote.machines && quote.machines.length > 0) {
      quote.machines.forEach((machine) => {
        const machineHours = (parseFloat(machine.hours || 0)) + (parseFloat(machine.minutes || 0) / 60);
        const machineTotal = machineHours * (parseFloat(machine.rate || 0));
        if (machineHours > 0) {
          doc.text(`${machine.name || "Machine"} (${machineHours.toFixed(2)} hrs @ $${(machine.rate || 0).toFixed(2)}/hr)`, 20, yPos);
          doc.text(`$${machineTotal.toFixed(2)}`, 190, yPos, { align: "right" });
          yPos += 6;
        }
      });
    }
  }

  // Calculate totals from schema fields
  const materialsTotal = (quote.materials || []).reduce((sum, m) => sum + ((parseFloat(m.cost) || 0) * (parseFloat(m.quantity) || 1)), 0);
  const laborTotal = laborHours * (parseFloat(quote.labor_rate || 0));
  const machinesTotal = (quote.machines || []).reduce((sum, m) => {
    const hrs = (parseFloat(m.hours || 0)) + (parseFloat(m.minutes || 0) / 60);
    return sum + (hrs * (parseFloat(m.rate) || 0));
  }, 0);
  const overheadTotal = (parseFloat(quote.overhead_per_item || 0)) * (parseFloat(quote.quantity) || 1);
  const shippingCost = parseFloat(quote.shipping_cost || 0);

  // Totals Section
  yPos += 10;
  doc.setDrawColor(...grayColor);
  doc.line(20, yPos, 190, yPos);

  yPos += 8;
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);

  if (materialsTotal > 0) {
    doc.text("Materials:", 130, yPos);
    doc.text(`$${materialsTotal.toFixed(2)}`, 190, yPos, { align: "right" });
    yPos += 6;
  }
  if (laborTotal + machinesTotal > 0) {
    doc.text("Labor & Machines:", 130, yPos);
    doc.text(`$${(laborTotal + machinesTotal).toFixed(2)}`, 190, yPos, { align: "right" });
    yPos += 6;
  }
  if (overheadTotal > 0) {
    doc.text("Overhead:", 130, yPos);
    doc.text(`$${overheadTotal.toFixed(2)}`, 190, yPos, { align: "right" });
    yPos += 6;
  }
  if (shippingCost > 0) {
    doc.text("Shipping:", 130, yPos);
    doc.text(`$${shippingCost.toFixed(2)}`, 190, yPos, { align: "right" });
    yPos += 6;
  }

  // Subtotal / Tax / Grand Total
  const subtotal = quote.subtotal || (materialsTotal + laborTotal + machinesTotal + overheadTotal + shippingCost);
  const taxAmount = quote.tax_amount || (subtotal * (parseFloat(quote.tax_rate || 0) / 100));
  const grandTotal = quote.total || (subtotal + taxAmount);

  yPos += 4;
  doc.text("Subtotal:", 130, yPos);
  doc.text(`$${subtotal.toFixed(2)}`, 190, yPos, { align: "right" });
  yPos += 6;

  if (taxAmount > 0) {
    doc.text(`Tax (${quote.tax_rate || 0}%):`, 130, yPos);
    doc.text(`$${taxAmount.toFixed(2)}`, 190, yPos, { align: "right" });
    yPos += 6;
  }

  yPos += 4;
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

  const safeName = (quote.project_name || "quote").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
  doc.save(`Quote_${quote.quote_number}_${safeName}.pdf`);
}