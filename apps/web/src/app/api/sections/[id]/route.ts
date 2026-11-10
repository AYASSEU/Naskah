import { api } from '@/server/application/api';
export const runtime = 'nodejs';
export async function PUT(request: Request, context: { params: Promise<{ id: string; version?: string }> }) { return api(request, 'section', await context.params); }
