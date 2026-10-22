import { NextRequest, NextResponse } from 'next/server';

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const MAX_BODY_BYTES = 100 * 1024; // 100 KB

/** Parse a JSON body safely (size limit + clear 400 on bad JSON). */
export async function readJson<T = Record<string, unknown>>(request: NextRequest): Promise<T> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw new ApiError(413, 'Request body too large.');
  if (!raw.trim()) throw new ApiError(400, 'Request body is empty.');
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ApiError(400, 'Request body must be a JSON object.');
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(400, 'Request body is not valid JSON.');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler<C = any> = (request: NextRequest, context: C) => Promise<Response> | Response;

/** Wrap a route handler: catches errors and returns consistent JSON errors. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withApi<C = any>(handler: Handler<C>) {
  return async (request: NextRequest, context: C) => {
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
    try {
      return await handler(request, context);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: err.message, details: err.details, requestId },
          { status: err.status }
        );
      }
      console.error(`[api] ${request.method} ${request.nextUrl.pathname} failed`, requestId, err);
      return NextResponse.json(
        { error: 'Something went wrong on our side. Please try again.', requestId },
        { status: 500 }
      );
    }
  };
}
