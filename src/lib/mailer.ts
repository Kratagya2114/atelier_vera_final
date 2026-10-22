import nodemailer, { Transporter } from 'nodemailer';

export type MailResult = 'sent' | 'failed' | 'skipped';

const globalForMail = globalThis as unknown as { mailTransport?: Transporter };

export function isMailConfigured(): boolean {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  // Values copied straight from .env.example (still "your-...") count as not configured.
  const real = (v?: string) => Boolean(v && v.trim() && !/^your-/i.test(v.trim()));
  return real(SMTP_HOST) && real(SMTP_USER) && real(SMTP_PASS);
}

function getTransport(): Transporter {
  if (globalForMail.mailTransport) return globalForMail.mailTransport;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  globalForMail.mailTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure, // true for 465, false for 587 (STARTTLS)
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return globalForMail.mailTransport;
}

/** Verify the SMTP connection + credentials (used by /api/mail/test and `npm run mail:test`). */
export async function verifySmtp(): Promise<{ ok: boolean; message: string }> {
  if (!isMailConfigured()) {
    return { ok: false, message: 'SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.' };
  }
  try {
    await getTransport().verify();
    return { ok: true, message: 'SMTP connection and login succeeded.' };
  } catch (err) {
    return { ok: false, message: `SMTP verify failed: ${(err as Error).message}` };
  }
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<MailResult> {
  if (!isMailConfigured()) {
    console.warn('[mail] SMTP not configured, skipping email to', opts.to);
    return 'skipped';
  }
  try {
    const from = process.env.MAIL_FROM || `Atelier Vera <${process.env.SMTP_USER}>`;
    await getTransport().sendMail({ from, ...opts });
    return 'sent';
  } catch (err) {
    console.error('[mail] send failed:', (err as Error).message);
    return 'failed';
  }
}

/* ---------- templates ---------- */

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F6F3EE;font-family:Arial,Helvetica,sans-serif;color:#1C1917">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:1px;margin-bottom:18px">ATELIER VERA</div>
    <div style="background:#FAF8F5;border:1px solid #d9d2c7;border-radius:10px;padding:24px">
      <h2 style="margin:0 0 14px;font-family:Georgia,serif;font-weight:500">${esc(title)}</h2>
      ${body}
    </div>
    <p style="font-size:12px;color:#655E57;margin-top:16px">Atelier Vera · Mumbai · New Delhi · London</p>
  </div></body></html>`;
}

function row(label: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return `<tr><td style="padding:6px 12px 6px 0;color:#655E57;vertical-align:top">${esc(label)}</td><td style="padding:6px 0"><strong>${esc(value)}</strong></td></tr>`;
}

export interface InquiryMailData {
  receiptId: string;
  inquiry_type: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  project_location: string;
  linked_quote_ref: string | null;
  preferred_date: string | null;
  notes: string | null;
  swatchCount: number;
}

const TYPE_LABEL: Record<string, string> = {
  discovery_call: 'Discovery call',
  sample_box: 'Material sample box',
  object_commission: 'Studio object commission',
};

export async function sendInquiryEmails(d: InquiryMailData) {
  const typeLabel = TYPE_LABEL[d.inquiry_type] || d.inquiry_type;

  // 1) Notify the studio
  const inbox = process.env.STUDIO_INBOX_EMAIL || process.env.SMTP_USER || '';
  const studioRows =
    row('Receipt', d.receiptId) + row('Type', typeLabel) + row('Name', d.client_name) +
    row('Email', d.client_email) + row('Phone', d.client_phone) + row('Location', d.project_location) +
    row('Preferred date', d.preferred_date) + row('Quote ref', d.linked_quote_ref) +
    row('Swatches requested', d.swatchCount || '') + row('Notes', d.notes);
  const studio: MailResult = inbox
    ? await sendMail({
        to: inbox,
        replyTo: d.client_email,
        subject: `New ${typeLabel.toLowerCase()} request: ${d.client_name} (${d.receiptId})`,
        html: shell('New enquiry received', `<table style="border-collapse:collapse;font-size:14px">${studioRows}</table>`),
        text: `New ${typeLabel} enquiry ${d.receiptId}\nName: ${d.client_name}\nEmail: ${d.client_email}\nPhone: ${d.client_phone || '-'}\nLocation: ${d.project_location}\nPreferred date: ${d.preferred_date || '-'}\nNotes: ${d.notes || '-'}`,
      })
    : 'skipped';

  // 2) Confirm to the client
  const client = await sendMail({
    to: d.client_email,
    subject: `We received your request (${d.receiptId})`,
    html: shell(
      `Thank you, ${d.client_name.split(' ')[0]}`,
      `<p style="font-size:15px;line-height:1.6">We have received your <strong>${esc(typeLabel.toLowerCase())}</strong> request for <strong>${esc(d.project_location)}</strong>. A member of our studio will reply within 1 working day.</p>
       <table style="border-collapse:collapse;font-size:14px">${row('Your receipt', d.receiptId)}${row('Preferred date', d.preferred_date)}</table>`
    ),
    text: `Thank you, ${d.client_name}. We received your ${typeLabel} request for ${d.project_location}. Receipt: ${d.receiptId}. We will reply within 1 working day.`,
  });

  return { studio, client };
}

export async function sendQuoteEmail(opts: {
  to: string;
  name: string | null;
  referenceCode: string;
  persona: string;
  currency: 'INR' | 'USD';
  totalMin: number;
  totalMax: number;
  weeks: string;
}): Promise<MailResult> {
  const sym = opts.currency === 'USD' ? '$' : '₹';
  const fmt = (n: number) => `${sym}${n.toLocaleString(opts.currency === 'USD' ? 'en-US' : 'en-IN')}`;
  return sendMail({
    to: opts.to,
    subject: `Your Atelier Vera dossier ${opts.referenceCode}`,
    html: shell(
      `Your style & cost dossier`,
      `<table style="border-collapse:collapse;font-size:14px">${row('Reference', opts.referenceCode)}${row('Style', opts.persona)}${row('Estimated range', `${fmt(opts.totalMin)} to ${fmt(opts.totalMax)}`)}${row('Timeline', `${opts.weeks} weeks`)}</table>
       <p style="font-size:13px;color:#655E57;line-height:1.6">This is an indicative estimate. Reply to this email to book a discovery call and refine the scope.</p>`
    ),
    text: `Dossier ${opts.referenceCode}\nStyle: ${opts.persona}\nEstimate: ${fmt(opts.totalMin)} to ${fmt(opts.totalMax)}\nTimeline: ${opts.weeks} weeks`,
  });
}
