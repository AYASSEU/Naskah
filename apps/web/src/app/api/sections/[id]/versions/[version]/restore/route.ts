import { api } from '@/server/application/api';
export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string; version?: string }> }) { return api(request, 'sectionRestore', await context.params); }
