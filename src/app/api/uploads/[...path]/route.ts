import { NextRequest, NextResponse } from 'next/server';
import { readImage } from '@/lib/uploads';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const file = readImage(path);
  if (!file) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      'Content-Type': file.type,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
