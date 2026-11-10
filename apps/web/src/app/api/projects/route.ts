import { api } from '@/server/application/api';
export const runtime = 'nodejs';
export async function GET(request: Request) { return api(request, 'projects'); }
export async function POST(request: Request) { return api(request, 'projects'); }
