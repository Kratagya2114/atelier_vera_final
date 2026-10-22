import 'dotenv/config';
import { sendMail, verifySmtp } from '../src/lib/mailer';

async function main() {
  const status = await verifySmtp();
  console.log(status.ok ? '✅' : '❌', status.message);
  if (!status.ok) process.exit(1);

  const to = process.argv[2] || process.env.STUDIO_INBOX_EMAIL || process.env.SMTP_USER;
  if (!to) { console.log('Pass a recipient: npm run mail:test -- you@example.com'); return; }
  const result = await sendMail({ to, subject: 'Atelier Vera SMTP test', html: '<p>SMTP works.</p>', text: 'SMTP works.' });
  console.log(result === 'sent' ? `✅ Test email sent to ${to}` : `❌ Send result: ${result}`);
}
main();
