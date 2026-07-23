// Invoice generation for Zev — produces a professional HTML invoice
// that can be included in emails or displayed on screen.

export interface InvoiceData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  productName: string;
  amount: number; // USD
  cryptoAmount: number;
  cryptocurrency: string;
  blockchain: string;
  transactionHash: string;
  paymentDate: string;
  paymentStatus: string;
}

export function generateInvoiceHtml(data: InvoiceData): string {
  const date = data.paymentDate || new Date().toISOString();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${data.orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#050807;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="background:#050807;background-image:radial-gradient(ellipse 80% 50% at 50% 0%,rgba(16,185,129,0.08),transparent),radial-gradient(ellipse 60% 40% at 100% 20%,rgba(245,158,11,0.06),transparent);min-height:100vh;padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
      <tr>
        <td style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(145deg,rgba(20,30,26,0.95),rgba(12,18,16,0.95));border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;box-shadow:0 20px 60px -20px rgba(0,0,0,0.5);">
            <!-- Header -->
            <tr>
              <td style="padding:0;">
                <div style="height:4px;background:linear-gradient(90deg,#10b981,#f59e0b);"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 0;text-align:center;">
                <div style="display:inline-block;width:48px;height:48px;line-height:48px;text-align:center;background:linear-gradient(135deg,#10b981,#f59e0b);border-radius:12px;font-size:24px;font-weight:900;color:#000;letter-spacing:-1px;">Z</div>
                <h1 style="margin:16px 0 4px;font-size:22px;font-weight:800;color:#f0f0f0;">INVOICE</h1>
                <p style="margin:0;font-size:14px;color:#888;">Order ${data.orderNumber}</p>
              </td>
            </tr>
            <!-- Invoice details -->
            <tr>
              <td style="padding:28px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:0 0 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:50%;vertical-align:top;padding-right:16px;">
                            <p style="margin:0 0 4px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Billed To</p>
                            <p style="margin:0;font-size:14px;color:#f0f0f0;font-weight:600;">${data.customerName}</p>
                            <p style="margin:2px 0 0;font-size:13px;color:#888;">${data.customerEmail}</p>
                          </td>
                          <td style="width:50%;vertical-align:top;padding-left:16px;">
                            <p style="margin:0 0 4px;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">From</p>
                            <p style="margin:0;font-size:14px;color:#f0f0f0;font-weight:600;">Zev</p>
                            <p style="margin:2px 0 0;font-size:13px;color:#888;">by Arsh Raj Sharma</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0;">
                      <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:8px 0;font-size:13px;color:#888;">Product</td>
                            <td style="padding:8px 0;font-size:13px;color:#f0f0f0;font-weight:600;text-align:right;">${data.productName}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;font-size:13px;color:#888;">Amount (USD)</td>
                            <td style="padding:8px 0;font-size:13px;color:#f0f0f0;font-weight:600;text-align:right;">$${data.amount.toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;font-size:13px;color:#888;">Cryptocurrency</td>
                            <td style="padding:8px 0;font-size:13px;color:#10b981;font-weight:600;text-align:right;">${data.cryptoAmount.toFixed(8)} ${data.cryptocurrency}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;font-size:13px;color:#888;">Network</td>
                            <td style="padding:8px 0;font-size:13px;color:#f0f0f0;text-align:right;">${data.blockchain}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;font-size:13px;color:#888;">Transaction Hash</td>
                            <td style="padding:8px 0;font-size:11px;color:#10b981;text-align:right;font-family:monospace;word-break:break-all;">${data.transactionHash}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;font-size:13px;color:#888;">Payment Date</td>
                            <td style="padding:8px 0;font-size:13px;color:#f0f0f0;text-align:right;">${date}</td>
                          </tr>
                          <tr>
                            <td style="padding:8px 0;font-size:13px;color:#888;">Status</td>
                            <td style="padding:8px 0;text-align:right;">
                              <span style="display:inline-block;padding:3px 10px;background:rgba(16,185,129,0.2);color:#10b981;font-size:12px;font-weight:600;border-radius:6px;border:1px solid rgba(16,185,129,0.3);">${data.paymentStatus}</span>
                            </td>
                          </tr>
                        </table>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Total -->
            <tr>
              <td style="padding:0 32px 32px;">
                <div style="border-top:2px solid rgba(255,255,255,0.1);padding-top:16px;display:flex;justify-content:space-between;">
                  <span style="font-size:16px;font-weight:700;color:#f0f0f0;">Total Paid</span>
                  <span style="font-size:20px;font-weight:800;color:#10b981;">$${data.amount.toFixed(2)}</span>
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 32px;background:#0d1411;border-top:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0;text-align:center;font-size:11px;color:#333;">This is a verified on-chain payment receipt. Zev by Arsh Raj Sharma. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}

// Generate a plain-text invoice (for email text fallback)
export function generateInvoiceText(data: InvoiceData): string {
  return `
ZEV INVOICE
===========

Order: ${data.orderNumber}
Date: ${data.paymentDate}

BILLED TO:
  ${data.customerName}
  ${data.customerEmail}

PRODUCT: ${data.productName}
AMOUNT: $${data.amount.toFixed(2)} USD
CRYPTO: ${data.cryptoAmount.toFixed(8)} ${data.cryptocurrency}
NETWORK: ${data.blockchain}
TX HASH: ${data.transactionHash}
STATUS: ${data.paymentStatus}

---
Zev by Arsh Raj Sharma. All rights reserved.
  `.trim();
}
