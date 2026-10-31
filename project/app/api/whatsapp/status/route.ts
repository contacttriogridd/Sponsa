import { NextResponse } from 'next/server';
import { whatsappApiConfig } from '@/lib/whatsapp-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ configured: whatsappApiConfig() !== null });
}
