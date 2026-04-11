import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-static';

/**
 * Android Digital Asset Links JSON for App Links verification.
 * Served from /.well-known/assetlinks.json with Content-Type: application/json.
 *
 * Enables automatic handling of https://motovault.app/t/* and /r/* URLs by the MotoVault app.
 *
 * See https://developer.android.com/training/app-links/verify-android-applinks
 */
export async function GET() {
  const fingerprint = process.env.ANDROID_CERT_SHA256;

  if (!fingerprint) {
    return new NextResponse('ANDROID_CERT_SHA256 not configured', { status: 500 });
  }

  const body = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.motovault.app',
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ];

  return NextResponse.json(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
