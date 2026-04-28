/**
 * Check All Applications with Invoice Numbers
 * To understand the history of invoice number generation
 */

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Application = require("../../models/Application");

async function checkAllInvoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Get all applications with payments
    const applications = await Application.find({
      payments: { $exists: true, $ne: [] }
    })
      .sort({ createdAt: 1 })
      .select("applicationId patientEmail createdAt payments")
      .lean();


    const invoices = [];
    applications.forEach((app, idx) => {
      const created = new Date(app.createdAt).toLocaleString();

      app.payments.forEach((payment, pidx) => {
        invoices.push({
          index: idx + 1,
          appId: app.applicationId,
          invoice: payment.invoiceNumber,
          created: app.createdAt,
        });
      });
    });

    // Analyze the invoice numbers

    // Extract sequences
    const sequences = invoices.map((inv) => {
      const match = inv.invoice.match(/INV-(\d{2})\/(\d{4})-(\d+)/);
      if (match) {
        return {
          month: match[1],
          year: match[2],
          seq: parseInt(match[3], 10),
          ...inv,
        };
      }
      return null;
    }).filter(Boolean);

    // Group by month/year
    const byMonth = {};
    sequences.forEach((seq) => {
      const key = `${seq.month}/${seq.year}`;
      if (!byMonth[key]) {
        byMonth[key] = [];
      }
      byMonth[key].push(seq);
    });

    Object.entries(byMonth).forEach(([monthYear, seqs]) => {
      seqs.sort((a, b) => a.seq - b.seq).forEach((seq) => {
        const timeStr = new Date(seq.created).toLocaleString();
      });
    });

    // Check for duplicates

    const invoiceMap = {};
    let hasDuplicates = false;

    sequences.forEach((seq) => {
      const inv = seq.invoice;
      if (!invoiceMap[inv]) {
        invoiceMap[inv] = [];
      }
      invoiceMap[inv].push(seq);
    });

    Object.entries(invoiceMap).forEach(([invoice, seqs]) => {
      if (seqs.length > 1) {
        seqs.forEach((seq) => {
        });
        hasDuplicates = true;
      }
    });

    if (!hasDuplicates) {
    }

    await mongoose.connection.close();
  } catch (error) {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

checkAllInvoices();
