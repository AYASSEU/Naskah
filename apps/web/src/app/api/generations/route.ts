import { api } from '@/server/application/api';
export const runtime = 'nodejs';
export async function POST(request: Request) { return api(request, 'generations'); }
