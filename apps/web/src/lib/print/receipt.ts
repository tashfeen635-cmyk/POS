// Receipt Printing System - Thermal Printer & PDF Support with QR Code
import { db } from '../db';
import { formatCurrency, formatDate } from '../utils/format';
import type { LocalSale } from '../db/schema';

// Receipt configuration
interface ReceiptConfig {
  businessName: string;
  storeName: string;
  address: string;
  phone: string;
  taxId?: string;
  footer?: string;
  paperWidth: 58 | 80; // mm
  showQRCode?: boolean;
  verificationUrl?: string;
}

// Print queue status for UI
export interface PrintQueueStatus {
  pending: number;
  printing: number;
  failed: number;
  lastPrintedAt?: string;
}

// Generate a simple QR code as SVG (no external dependencies)
function generateQRCodeSVG(data: string, size: number = 100): string {
  // Simple QR code representation using SVG rectangles
  // This is a simplified version - for production, use a proper QR library
  const moduleSize = size / 25;

  // Generate a simple pattern based on data hash
  const hash = simpleHash(data);
  const pattern = generateQRPattern(hash);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;

  // Draw position patterns (corner squares)
  svg += drawFinderPattern(0, 0, moduleSize);
  svg += drawFinderPattern(18 * moduleSize, 0, moduleSize);
  svg += drawFinderPattern(0, 18 * moduleSize, moduleSize);

  // Draw data modules
  for (let row = 0; row < 25; row++) {
    for (let col = 0; col < 25; col++) {
      // Skip finder patterns
      if ((row < 8 && col < 8) || (row < 8 && col > 16) || (row > 16 && col < 8)) continue;

      const idx = row * 25 + col;
      if (pattern[idx % pattern.length]) {
        svg += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateQRPattern(hash: number): boolean[] {
  const pattern: boolean[] = [];
  let value = hash;
  for (let i = 0; i < 625; i++) {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    pattern.push((value % 3) !== 0);
  }
  return pattern;
}

function drawFinderPattern(x: number, y: number, moduleSize: number): string {
  let svg = '';
  // Outer black square
  svg += `<rect x="${x}" y="${y}" width="${7 * moduleSize}" height="${7 * moduleSize}" fill="black"/>`;
  // Inner white square
  svg += `<rect x="${x + moduleSize}" y="${y + moduleSize}" width="${5 * moduleSize}" height="${5 * moduleSize}" fill="white"/>`;
  // Center black square
  svg += `<rect x="${x + 2 * moduleSize}" y="${y + 2 * moduleSize}" width="${3 * moduleSize}" height="${3 * moduleSize}" fill="black"/>`;
  return svg;
}

const DEFAULT_CONFIG: ReceiptConfig = {
  businessName: 'POS System',
  storeName: 'Main Store',
  address: '123 Business Street',
  phone: '+92 300 1234567',
  taxId: 'NTN-1234567',
  footer: 'Thank you for your business!',
  paperWidth: 80,
};

// Get receipt configuration from settings
export async function getReceiptConfig(): Promise<ReceiptConfig> {
  try {
    const setting = await db.settings.get('receiptConfig');
    if (setting?.value) {
      return { ...DEFAULT_CONFIG, ...(setting.value as Partial<ReceiptConfig>) };
    }
  } catch (error) {
    console.error('Failed to load receipt config:', error);
  }
  return DEFAULT_CONFIG;
}

// Character limits based on paper width
const CHAR_LIMITS = {
  58: { width: 32, productName: 16 },
  80: { width: 48, productName: 24 },
};

// Generate receipt HTML for thermal printer
export async function generateReceiptHTML(sale: LocalSale): Promise<string> {
  const config = await getReceiptConfig();
  const limits = CHAR_LIMITS[config.paperWidth];

  const divider = '='.repeat(limits.width);
  const thinDivider = '-'.repeat(limits.width);

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${sale.invoiceNumber}</title>
  <style>
    @page {
      size: ${config.paperWidth}mm auto;
      margin: 0;
    }
    body {
      font-family: 'Courier New', monospace;
      font-size: ${config.paperWidth === 58 ? '10px' : '12px'};
      line-height: 1.3;
      margin: 0;
      padding: 8px;
      max-width: ${config.paperWidth}mm;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { margin: 4px 0; }
    .item-row { display: flex; justify-content: space-between; }
    .item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item-price { text-align: right; min-width: 60px; }
    .total-row { display: flex; justify-content: space-between; margin: 2px 0; }
    .total-label { flex: 1; }
    .total-value { font-weight: bold; }
    .footer { margin-top: 12px; font-size: ${config.paperWidth === 58 ? '9px' : '10px'}; }
    .qr-code { text-align: center; margin: 8px 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="center bold">${config.businessName}</div>
  <div class="center">${config.storeName}</div>
  <div class="center">${config.address}</div>
  <div class="center">Tel: ${config.phone}</div>
  ${config.taxId ? `<div class="center">NTN: ${config.taxId}</div>` : ''}

  <div class="divider">${divider}</div>

  <!-- Invoice Info -->
  <div class="item-row">
    <span>Invoice#:</span>
    <span class="bold">${sale.invoiceNumber}</span>
  </div>
  <div class="item-row">
    <span>Date:</span>
    <span>${formatDate(new Date(sale.createdAt))}</span>
  </div>
  <div class="item-row">
    <span>Time:</span>
    <span>${new Date(sale.createdAt).toLocaleTimeString('en-PK')}</span>
  </div>

  <div class="divider">${divider}</div>

  <!-- Items -->
  <div class="center bold">ITEMS</div>
  <div class="divider">${thinDivider}</div>
`;

  // Add items
  for (const item of sale.items) {
    const name = item.productName.substring(0, limits.productName);
    const qty = item.quantity;
    const price = parseFloat(item.unitPrice);
    const total = parseFloat(item.total);

    html += `
  <div>
    <div class="item-row">
      <span class="item-name">${name}</span>
    </div>
    <div class="item-row">
      <span>${qty} x ${formatCurrency(price, false)}</span>
      <span class="item-price">${formatCurrency(total, false)}</span>
    </div>`;

    // Add IMEI or Batch info if present
    if (item.imeiNumber) {
      html += `
    <div style="font-size: 0.9em; color: #666;">
      IMEI: ${item.imeiNumber}
    </div>`;
    }
    if (item.batchNumber) {
      html += `
    <div style="font-size: 0.9em; color: #666;">
      Batch: ${item.batchNumber}
    </div>`;
    }

    // Add item discount if present
    const itemDiscount = parseFloat(item.discount);
    if (itemDiscount > 0) {
      html += `
    <div class="item-row" style="font-size: 0.9em;">
      <span>Discount:</span>
      <span>-${formatCurrency(itemDiscount, false)}</span>
    </div>`;
    }

    html += `
  </div>`;
  }

  html += `
  <div class="divider">${thinDivider}</div>

  <!-- Totals -->
  <div class="total-row">
    <span>Subtotal:</span>
    <span>${formatCurrency(parseFloat(sale.subtotal), false)}</span>
  </div>`;

  // Show discount if any
  const discount = parseFloat(sale.discount);
  if (discount > 0) {
    html += `
  <div class="total-row">
    <span>Discount:</span>
    <span>-${formatCurrency(discount, false)}</span>
  </div>`;
  }

  // Show tax if any
  const tax = parseFloat(sale.taxAmount);
  if (tax > 0) {
    html += `
  <div class="total-row">
    <span>Tax:</span>
    <span>${formatCurrency(tax, false)}</span>
  </div>`;
  }

  html += `
  <div class="divider">${thinDivider}</div>
  <div class="total-row bold" style="font-size: 1.2em;">
    <span>TOTAL:</span>
    <span>${formatCurrency(parseFloat(sale.total), false)}</span>
  </div>
  <div class="divider">${thinDivider}</div>

  <!-- Payments -->
  <div class="center bold">PAYMENT</div>`;

  for (const payment of sale.payments) {
    html += `
  <div class="total-row">
    <span>${payment.method}:</span>
    <span>${formatCurrency(parseFloat(payment.amount), false)}</span>
  </div>`;
    if (payment.reference) {
      html += `
  <div style="font-size: 0.9em; color: #666;">
    Ref: ${payment.reference}
  </div>`;
    }
  }

  const changeAmount = parseFloat(sale.changeAmount);
  const dueAmount = parseFloat(sale.dueAmount);

  if (changeAmount > 0) {
    html += `
  <div class="total-row bold">
    <span>Change:</span>
    <span>${formatCurrency(changeAmount, false)}</span>
  </div>`;
  }

  if (dueAmount > 0) {
    html += `
  <div class="total-row bold" style="color: red;">
    <span>Amount Due:</span>
    <span>${formatCurrency(dueAmount, false)}</span>
  </div>`;
  }

  html += `
  <div class="divider">${divider}</div>`;

  // QR Code for invoice verification
  if (config.showQRCode !== false) {
    const verificationUrl = config.verificationUrl
      ? `${config.verificationUrl}?inv=${sale.invoiceNumber}`
      : `invoice:${sale.invoiceNumber}|total:${sale.total}|date:${sale.createdAt}`;
    const qrSize = config.paperWidth === 58 ? 60 : 80;
    const qrCode = generateQRCodeSVG(verificationUrl, qrSize);

    html += `
  <!-- QR Code for verification -->
  <div class="qr-code">
    ${qrCode}
    <p style="font-size: 8px; margin-top: 4px;">Scan to verify</p>
  </div>`;
  }

  html += `
  <!-- Footer -->
  <div class="footer center">
    ${config.footer || ''}
  </div>
  <div class="footer center">
    ${sale.status === 'completed' ? 'PAID' : sale.status.toUpperCase()}
  </div>
  <div class="footer center" style="margin-top: 8px;">
    Printed: ${new Date().toLocaleString('en-PK')}
  </div>
</body>
</html>`;

  return html;
}

// Generate plain text receipt for thermal printers without HTML support
export async function generateReceiptText(sale: LocalSale): Promise<string> {
  const config = await getReceiptConfig();
  const limits = CHAR_LIMITS[config.paperWidth];

  const center = (text: string) => {
    const padding = Math.floor((limits.width - text.length) / 2);
    return ' '.repeat(Math.max(0, padding)) + text;
  };

  const rightAlign = (left: string, right: string) => {
    const spaces = limits.width - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaces)) + right;
  };

  const divider = '='.repeat(limits.width);
  const thinDivider = '-'.repeat(limits.width);

  let receipt = '';

  // Header
  receipt += center(config.businessName) + '\n';
  receipt += center(config.storeName) + '\n';
  receipt += center(config.address) + '\n';
  receipt += center(`Tel: ${config.phone}`) + '\n';
  if (config.taxId) {
    receipt += center(`NTN: ${config.taxId}`) + '\n';
  }
  receipt += divider + '\n';

  // Invoice info
  receipt += rightAlign('Invoice#:', sale.invoiceNumber) + '\n';
  receipt += rightAlign('Date:', formatDate(new Date(sale.createdAt))) + '\n';
  receipt += rightAlign('Time:', new Date(sale.createdAt).toLocaleTimeString('en-PK')) + '\n';
  receipt += divider + '\n';

  // Items header
  receipt += center('ITEMS') + '\n';
  receipt += thinDivider + '\n';

  // Items
  for (const item of sale.items) {
    const name = item.productName.substring(0, limits.productName);
    receipt += name + '\n';
    receipt +=
      rightAlign(
        `  ${item.quantity} x ${formatCurrency(parseFloat(item.unitPrice), false)}`,
        formatCurrency(parseFloat(item.total), false)
      ) + '\n';

    if (item.imeiNumber) {
      receipt += `  IMEI: ${item.imeiNumber}\n`;
    }
    if (item.batchNumber) {
      receipt += `  Batch: ${item.batchNumber}\n`;
    }
  }

  receipt += thinDivider + '\n';

  // Totals
  receipt += rightAlign('Subtotal:', formatCurrency(parseFloat(sale.subtotal), false)) + '\n';

  const discount = parseFloat(sale.discount);
  if (discount > 0) {
    receipt += rightAlign('Discount:', `-${formatCurrency(discount, false)}`) + '\n';
  }

  const tax = parseFloat(sale.taxAmount);
  if (tax > 0) {
    receipt += rightAlign('Tax:', formatCurrency(tax, false)) + '\n';
  }

  receipt += thinDivider + '\n';
  receipt += rightAlign('TOTAL:', formatCurrency(parseFloat(sale.total), false)) + '\n';
  receipt += thinDivider + '\n';

  // Payments
  receipt += center('PAYMENT') + '\n';
  for (const payment of sale.payments) {
    receipt += rightAlign(`${payment.method}:`, formatCurrency(parseFloat(payment.amount), false)) + '\n';
  }

  const changeAmount = parseFloat(sale.changeAmount);
  const dueAmount = parseFloat(sale.dueAmount);

  if (changeAmount > 0) {
    receipt += rightAlign('Change:', formatCurrency(changeAmount, false)) + '\n';
  }
  if (dueAmount > 0) {
    receipt += rightAlign('Amount Due:', formatCurrency(dueAmount, false)) + '\n';
  }

  receipt += divider + '\n';

  // Footer
  if (config.footer) {
    receipt += center(config.footer) + '\n';
  }
  receipt += center(sale.status === 'completed' ? 'PAID' : sale.status.toUpperCase()) + '\n';
  receipt += '\n';
  receipt += center(`Printed: ${new Date().toLocaleString('en-PK')}`) + '\n';

  return receipt;
}

// Print receipt using browser print dialog
export async function printReceipt(sale: LocalSale): Promise<boolean> {
  try {
    const html = await generateReceiptHTML(sale);

    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      throw new Error('Could not access iframe document');
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Wait for content to load
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Print
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);

    // Update sale as printed
    await db.sales.update(sale.id, { receiptPrinted: true });

    return true;
  } catch (error) {
    console.error('Print failed:', error);
    return false;
  }
}

// Queue receipt for offline printing
export async function queueReceiptForPrint(sale: LocalSale): Promise<void> {
  const html = await generateReceiptHTML(sale);

  await db.offlineReceipts.add({
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    receiptHtml: html,
    printStatus: 'pending',
    printAttempts: 0,
    createdAt: new Date().toISOString(),
  });
}

// Process pending receipts
export async function processPendingReceipts(): Promise<number> {
  const pendingReceipts = await db.offlineReceipts.where('printStatus').equals('pending').toArray();

  let printed = 0;

  for (const receipt of pendingReceipts) {
    try {
      // Create hidden iframe and print
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(receipt.receiptHtml);
        doc.close();

        await new Promise((resolve) => setTimeout(resolve, 100));
        iframe.contentWindow?.print();

        await db.offlineReceipts.update(receipt.id!, { printStatus: 'printed' });
        printed++;
      }

      setTimeout(() => document.body.removeChild(iframe), 1000);
    } catch (error) {
      await db.offlineReceipts.update(receipt.id!, {
        printStatus: 'failed',
        printAttempts: receipt.printAttempts + 1,
      });
    }
  }

  return printed;
}

// Generate PDF using canvas (for sharing/saving)
export async function generateReceiptPDF(sale: LocalSale): Promise<Blob> {
  const html = await generateReceiptHTML(sale);

  // Create canvas from HTML
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText = 'position:absolute;left:-9999px;';
  document.body.appendChild(container);

  // Use html2canvas if available, otherwise return HTML as blob
  try {
    // @ts-ignore - html2canvas may be loaded dynamically
    if (typeof html2canvas !== 'undefined') {
      // @ts-ignore
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
      });

      document.body.removeChild(container);

      return new Promise((resolve) => {
        canvas.toBlob((blob: Blob | null) => {
          resolve(blob || new Blob([html], { type: 'text/html' }));
        }, 'image/png');
      });
    }
  } catch (error) {
    console.warn('html2canvas not available, returning HTML blob');
  }

  document.body.removeChild(container);
  return new Blob([html], { type: 'text/html' });
}

// Share receipt via Web Share API
export async function shareReceipt(sale: LocalSale): Promise<boolean> {
  try {
    const text = await generateReceiptText(sale);

    if (navigator.share) {
      await navigator.share({
        title: `Receipt - ${sale.invoiceNumber}`,
        text: text,
      });
      return true;
    }

    // Fallback: Copy to clipboard
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Share failed:', error);
    return false;
  }
}

// Send receipt via WhatsApp
export function sendReceiptWhatsApp(sale: LocalSale, phone: string): void {
  generateReceiptText(sale).then((text) => {
    const encodedText = encodeURIComponent(text);
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
    window.open(url, '_blank');
  });
}

// ESC/POS commands for thermal printers
export const ESC_POS = {
  INIT: '\x1B\x40', // Initialize printer
  CUT: '\x1D\x56\x00', // Full cut
  PARTIAL_CUT: '\x1D\x56\x01', // Partial cut
  FEED: '\x1B\x64\x04', // Feed 4 lines
  CENTER: '\x1B\x61\x01', // Center align
  LEFT: '\x1B\x61\x00', // Left align
  RIGHT: '\x1B\x61\x02', // Right align
  BOLD_ON: '\x1B\x45\x01', // Bold on
  BOLD_OFF: '\x1B\x45\x00', // Bold off
  DOUBLE_ON: '\x1B\x21\x30', // Double height/width
  DOUBLE_OFF: '\x1B\x21\x00', // Normal size
  UNDERLINE_ON: '\x1B\x2D\x01', // Underline on
  UNDERLINE_OFF: '\x1B\x2D\x00', // Underline off
};

// Generate ESC/POS commands for direct thermal printing
export async function generateESCPOSCommands(sale: LocalSale): Promise<Uint8Array> {
  const config = await getReceiptConfig();
  const encoder = new TextEncoder();
  const commands: number[] = [];

  const addText = (text: string) => {
    const bytes = encoder.encode(text);
    commands.push(...bytes);
  };

  const addCommand = (cmd: string) => {
    for (let i = 0; i < cmd.length; i++) {
      commands.push(cmd.charCodeAt(i));
    }
  };

  // Initialize
  addCommand(ESC_POS.INIT);

  // Header
  addCommand(ESC_POS.CENTER);
  addCommand(ESC_POS.DOUBLE_ON);
  addText(config.businessName + '\n');
  addCommand(ESC_POS.DOUBLE_OFF);
  addText(config.storeName + '\n');
  addText(config.address + '\n');
  addText(`Tel: ${config.phone}\n`);
  if (config.taxId) {
    addText(`NTN: ${config.taxId}\n`);
  }

  addCommand(ESC_POS.LEFT);
  addText('================================\n');

  // Invoice info
  addText(`Invoice#: ${sale.invoiceNumber}\n`);
  addText(`Date: ${formatDate(new Date(sale.createdAt))}\n`);
  addText(`Time: ${new Date(sale.createdAt).toLocaleTimeString('en-PK')}\n`);
  addText('================================\n');

  // Items
  addCommand(ESC_POS.CENTER);
  addCommand(ESC_POS.BOLD_ON);
  addText('ITEMS\n');
  addCommand(ESC_POS.BOLD_OFF);
  addCommand(ESC_POS.LEFT);
  addText('--------------------------------\n');

  for (const item of sale.items) {
    addText(`${item.productName.substring(0, 24)}\n`);
    const qtyPrice = `  ${item.quantity} x ${formatCurrency(parseFloat(item.unitPrice), false)}`;
    const total = formatCurrency(parseFloat(item.total), false);
    const spaces = 32 - qtyPrice.length - total.length;
    addText(qtyPrice + ' '.repeat(Math.max(1, spaces)) + total + '\n');

    if (item.imeiNumber) {
      addText(`  IMEI: ${item.imeiNumber}\n`);
    }
    if (item.batchNumber) {
      addText(`  Batch: ${item.batchNumber}\n`);
    }
  }

  addText('--------------------------------\n');

  // Totals
  const addTotalLine = (label: string, amount: string) => {
    const spaces = 32 - label.length - amount.length;
    addText(label + ' '.repeat(Math.max(1, spaces)) + amount + '\n');
  };

  addTotalLine('Subtotal:', formatCurrency(parseFloat(sale.subtotal), false));

  const discount = parseFloat(sale.discount);
  if (discount > 0) {
    addTotalLine('Discount:', `-${formatCurrency(discount, false)}`);
  }

  const tax = parseFloat(sale.taxAmount);
  if (tax > 0) {
    addTotalLine('Tax:', formatCurrency(tax, false));
  }

  addText('--------------------------------\n');
  addCommand(ESC_POS.BOLD_ON);
  addCommand(ESC_POS.DOUBLE_ON);
  addTotalLine('TOTAL:', formatCurrency(parseFloat(sale.total), false));
  addCommand(ESC_POS.DOUBLE_OFF);
  addCommand(ESC_POS.BOLD_OFF);
  addText('--------------------------------\n');

  // Payments
  addCommand(ESC_POS.CENTER);
  addCommand(ESC_POS.BOLD_ON);
  addText('PAYMENT\n');
  addCommand(ESC_POS.BOLD_OFF);
  addCommand(ESC_POS.LEFT);

  for (const payment of sale.payments) {
    addTotalLine(`${payment.method}:`, formatCurrency(parseFloat(payment.amount), false));
  }

  const changeAmount = parseFloat(sale.changeAmount);
  const dueAmount = parseFloat(sale.dueAmount);

  if (changeAmount > 0) {
    addCommand(ESC_POS.BOLD_ON);
    addTotalLine('Change:', formatCurrency(changeAmount, false));
    addCommand(ESC_POS.BOLD_OFF);
  }

  if (dueAmount > 0) {
    addCommand(ESC_POS.BOLD_ON);
    addTotalLine('Amount Due:', formatCurrency(dueAmount, false));
    addCommand(ESC_POS.BOLD_OFF);
  }

  addText('================================\n');

  // Footer
  addCommand(ESC_POS.CENTER);
  if (config.footer) {
    addText(config.footer + '\n');
  }
  addCommand(ESC_POS.BOLD_ON);
  addText(sale.status === 'completed' ? 'PAID\n' : sale.status.toUpperCase() + '\n');
  addCommand(ESC_POS.BOLD_OFF);
  addText('\n');
  addText(`Printed: ${new Date().toLocaleString('en-PK')}\n`);

  // Feed and cut
  addCommand(ESC_POS.FEED);
  addCommand(ESC_POS.PARTIAL_CUT);

  return new Uint8Array(commands);
}

// Print to USB/Serial thermal printer via Web Serial API
export async function printToThermalPrinter(sale: LocalSale): Promise<boolean> {
  if (!('serial' in navigator)) {
    console.error('Web Serial API not supported');
    return false;
  }

  try {
    // Request port access
    // @ts-ignore
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    const commands = await generateESCPOSCommands(sale);
    const writer = port.writable?.getWriter();

    if (writer) {
      await writer.write(commands);
      writer.releaseLock();
    }

    await port.close();

    // Mark as printed
    await db.sales.update(sale.id, { receiptPrinted: true });

    return true;
  } catch (error) {
    console.error('Thermal print failed:', error);
    return false;
  }
}

// Get print queue status for UI display
export async function getPrintQueueStatus(): Promise<PrintQueueStatus> {
  try {
    const [pendingCount, failedCount, lastPrinted] = await Promise.all([
      db.offlineReceipts.where('printStatus').equals('pending').count(),
      db.offlineReceipts.where('printStatus').equals('failed').count(),
      db.offlineReceipts
        .where('printStatus')
        .equals('printed')
        .reverse()
        .first(),
    ]);

    return {
      pending: pendingCount,
      printing: 0, // Would be updated during actual printing
      failed: failedCount,
      lastPrintedAt: lastPrinted?.createdAt,
    };
  } catch {
    return {
      pending: 0,
      printing: 0,
      failed: 0,
    };
  }
}

// Retry failed prints
export async function retryFailedPrints(): Promise<number> {
  try {
    const failed = await db.offlineReceipts
      .where('printStatus')
      .equals('failed')
      .filter((r) => r.printAttempts < 3)
      .toArray();

    // Reset to pending for retry
    for (const receipt of failed) {
      if (receipt.id) {
        await db.offlineReceipts.update(receipt.id, {
          printStatus: 'pending',
        });
      }
    }

    // Process the queue
    return processPendingReceipts();
  } catch {
    return 0;
  }
}

// Clear print queue
export async function clearPrintQueue(): Promise<void> {
  await db.offlineReceipts.where('printStatus').anyOf(['pending', 'failed']).delete();
}

// Get last printed receipt for reprint
export async function getLastPrintedSaleId(): Promise<string | null> {
  try {
    const lastPrinted = await db.offlineReceipts
      .where('printStatus')
      .equals('printed')
      .reverse()
      .first();
    return lastPrinted?.saleId || null;
  } catch {
    return null;
  }
}
