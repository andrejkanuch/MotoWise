import crypto from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';

const BASE_URL = 'https://motovault.app';
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
const INDEXNOW_SECRET = process.env.INDEXNOW_SECRET || '';

// Simple in-memory rate limiter
const requests = new Map<string, number[]>();
const RATE_LIMIT = 50;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = (requests.get(ip) || []).filter((t) => t > windowStart);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  requests.set(ip, timestamps);
  return false;
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === BASE_URL && parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  // Auth check
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  if (!timingSafeEqual(token, INDEXNOW_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse body
  const body = await request.json().catch(() => null);
  if (!body?.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  // SSRF prevention
  if (!isAllowedUrl(body.url)) {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  // Submit to IndexNow
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'motovault.app',
        key: INDEXNOW_KEY,
        urlList: [body.url],
      }),
    });
    return NextResponse.json({ success: true, status: response.status });
  } catch {
    return NextResponse.json({ error: 'Submission failed' }, { status: 502 });
  }
}
