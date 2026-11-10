import { api } from '@/server/application/api';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string; version?: string }> }) { return api(request, 'versions', await context.params); }
export async function POST(request: Request, context: { params: Promise<{ id: string; version?: string }> }) { return api(request, 'versions', await context.params); }
