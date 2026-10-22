import { ApiError } from './http';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;

export const INQUIRY_TYPES = ['discovery_call', 'sample_box', 'object_commission'] as const;
export const FINISH_TIERS = ['tier1', 'tier2', 'tier3'] as const;
export const CURRENCIES = ['INR', 'USD'] as const;

/** Trim, strip control characters, and cap length. */
export function clean(value: unknown, max = 500): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function validateInquiry(body: Record<string, unknown>) {
  const errors: Record<string, string> = {};

  const client_name = clean(body.client_name, 120);
  const client_email = clean(body.client_email, 200).toLowerCase();
  const client_phone = clean(body.client_phone, 20);
  const project_location = clean(body.project_location, 200);
  const notes = clean(body.notes, 2000);
  const preferred_date = clean(body.preferred_date, 60);
  const linked_quote_ref = clean(body.linked_quote_ref, 40);
  const commissioned_object_id = clean(body.commissioned_object_id, 60);
  const inquiry_type = clean(body.inquiry_type, 30) || 'discovery_call';

  if (!client_name) errors.client_name = 'Name is required.';
  if (!client_email) errors.client_email = 'Email is required.';
  else if (!EMAIL_RE.test(client_email)) errors.client_email = 'Enter a valid email address.';
  if (!project_location) errors.project_location = 'Project location is required.';
  if (client_phone && !PHONE_RE.test(client_phone)) errors.client_phone = 'Enter a valid phone number.';
  if (!(INQUIRY_TYPES as readonly string[]).includes(inquiry_type)) {
    errors.inquiry_type = `Must be one of: ${INQUIRY_TYPES.join(', ')}.`;
  }

  const swatches = Array.isArray(body.requested_swatch_ids)
    ? body.requested_swatch_ids.slice(0, 30).map((s) => clean(s, 60)).filter(Boolean)
    : [];

  if (Object.keys(errors).length) {
    throw new ApiError(400, 'Please fix the highlighted fields.', errors);
  }

  return {
    inquiry_type,
    client_name,
    client_email,
    client_phone: client_phone || null,
    project_location,
    linked_quote_ref: linked_quote_ref || null,
    requested_swatch_ids: swatches,
    commissioned_object_id: commissioned_object_id || null,
    preferred_date: preferred_date || null,
    notes: notes || null,
  };
}

export function validateQuoteInput(body: Record<string, unknown>) {
  const areaSqft = Number(body.areaSqft ?? 3200);
  if (!Number.isFinite(areaSqft) || areaSqft < 250 || areaSqft > 10000) {
    throw new ApiError(400, 'areaSqft must be a number between 250 and 10,000.');
  }
  const finishTier = clean(body.finishTier, 10) || 'tier2';
  if (!(FINISH_TIERS as readonly string[]).includes(finishTier)) {
    throw new ApiError(400, `finishTier must be one of: ${FINISH_TIERS.join(', ')}.`);
  }
  const currency = (clean(body.currency, 3) || 'INR').toUpperCase();
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    throw new ApiError(400, `currency must be one of: ${CURRENCIES.join(', ')}.`);
  }
  const styleCards = Array.isArray(body.styleCards)
    ? body.styleCards.slice(0, 3).map((s) => clean(s, 40)).filter(Boolean)
    : ['wabi-sabi', 'warm-brutalism'];
  const clientEmail = clean(body.clientEmail, 200).toLowerCase();
  if (clientEmail && !EMAIL_RE.test(clientEmail)) {
    throw new ApiError(400, 'clientEmail is not a valid email address.');
  }
  return {
    areaSqft: Math.round(areaSqft),
    finishTier: finishTier as 'tier1' | 'tier2' | 'tier3',
    currency: currency as 'INR' | 'USD',
    styleCards,
    spaceType: clean(body.spaceType, 60) || 'Full Residence',
    clientName: clean(body.clientName, 120) || null,
    clientEmail: clientEmail || null,
  };
}
