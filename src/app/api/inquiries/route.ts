import { NextRequest, NextResponse } from 'next/server';
import { ApiError, readJson, withApi } from '@/lib/http';
import { validateInquiry } from '@/lib/validate';
import { isMailConfigured, sendInquiryEmails } from '@/lib/mailer';

export const runtime = 'nodejs'; // nodemailer needs the Node runtime

function newReceiptId(): string {
  return `INQ-2026-${crypto.randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase()}`;
}

export const POST = withApi(async (request: NextRequest) => {
  const body = await readJson(request);

  // Honeypot: real users never fill this hidden field. Pretend success to bots.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ receiptId: newReceiptId(), status: 'received' }, { status: 201 });
  }

  const data = validateInquiry(body);
  const receiptId = newReceiptId();

  if (!isMailConfigured()) {
    console.error('[inquiries] SMTP is not configured, cannot deliver enquiry', receiptId);
    throw new ApiError(503, 'Our enquiry form is temporarily unavailable. Please email us directly.');
  }

  // There is no database: the email IS the record. If it cannot be delivered, tell the visitor.
  const email = await sendInquiryEmails({
    receiptId,
    inquiry_type: data.inquiry_type,
    client_name: data.client_name,
    client_email: data.client_email,
    client_phone: data.client_phone,
    project_location: data.project_location,
    linked_quote_ref: data.linked_quote_ref,
    preferred_date: data.preferred_date,
    notes: data.notes,
    swatchCount: data.requested_swatch_ids.length,
  });

  if (email.studio !== 'sent') {
    console.error('[inquiries] studio email failed', receiptId, email);
    throw new ApiError(503, 'We could not send your request just now. Please try again in a few minutes.');
  }

  return NextResponse.json({ receiptId, status: 'received', email }, { status: 201 });
});
