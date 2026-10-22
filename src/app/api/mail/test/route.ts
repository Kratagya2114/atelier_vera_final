import { NextRequest, NextResponse } from 'next/server';
import { ApiError, readJson, withApi } from '@/lib/http';
import { sendMail, verifySmtp } from '@/lib/mailer';
import { validateInquiry } from '@/lib/validate';

export const runtime = 'nodejs';

/** POST /api/mail/test  { "to": "you@example.com" }
 *  Available in development, or in production only with header x-mail-test-token = MAIL_TEST_TOKEN. */
export const POST = withApi(async (request: NextRequest) => {
  const token = process.env.MAIL_TEST_TOKEN;
  const isDev = process.env.NODE_ENV !== 'production';
  if (!isDev && (!token || request.headers.get('x-mail-test-token') !== token)) {
    throw new ApiError(404, 'Not found.');
  }

  const status = await verifySmtp();
  if (!status.ok) return NextResponse.json(status, { status: 503 });

  const body = await readJson(request);
  const to = validateInquiry({ client_name: 'x', client_email: body.to, project_location: 'x' }).client_email;
  const result = await sendMail({
    to,
    subject: 'Atelier Vera SMTP test',
    html: '<p>Your SMTP setup works. 🎉</p>',
    text: 'Your SMTP setup works.',
  });
  return NextResponse.json({ ...status, testEmail: result }, { status: result === 'sent' ? 200 : 502 });
});
