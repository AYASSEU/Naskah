import { api } from '@/server/application/api';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string; version?: string }> }) { return api(request, 'sectionVersions', await context.params); }
