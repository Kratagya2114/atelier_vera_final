import { NextRequest, NextResponse } from 'next/server';
import { calculateArchitecturalQuote } from '@/lib/costEngine';
import { readJson, withApi } from '@/lib/http';
import { validateQuoteInput } from '@/lib/validate';
import { sendQuoteEmail } from '@/lib/mailer';

export const runtime = 'nodejs';

export const POST = withApi(async (request: NextRequest) => {
  const input = validateQuoteInput(await readJson(request));

  const result = calculateArchitecturalQuote({
    styleCards: input.styleCards,
    spaceType: input.spaceType,
    areaSqft: input.areaSqft,
    finishTier: input.finishTier,
    currency: input.currency,
  });

  // If the visitor gave an email, send them the dossier
  let email: 'sent' | 'failed' | 'skipped' = 'skipped';
  if (input.clientEmail) {
    email = await sendQuoteEmail({
      to: input.clientEmail,
      name: input.clientName,
      referenceCode: result.referenceCode,
      persona: result.computedStylePersona,
      currency: result.currency,
      totalMin: result.breakdown.total_min,
      totalMax: result.breakdown.total_max,
      weeks: result.breakdown.estimated_weeks,
    });
  }

  return NextResponse.json({ email, ...result });
});
