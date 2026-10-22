import { NextRequest, NextResponse } from 'next/server';
import { isMailConfigured } from '@/lib/mailer';
import { withApi } from '@/lib/http';

export const runtime = 'nodejs';

export const GET = withApi(async (_request: NextRequest) => {
  return NextResponse.json({
    status: 'ok',
    smtpConfigured: isMailConfigured(),
    time: new Date().toISOString(),
  });
});
