// Creates .env from .env.example the first time (never overwrites an existing .env).
const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '..', '.env');
const example = path.join(__dirname, '..', '.env.example');
if (fs.existsSync(target)) {
  console.log('.env already exists, leaving it as it is.');
} else {
  fs.copyFileSync(example, target);
  console.log('Created .env. Open it and fill in your SMTP_USER, SMTP_PASS, MAIL_FROM and STUDIO_INBOX_EMAIL.');
}
