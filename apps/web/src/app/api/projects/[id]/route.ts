import { api } from '@/server/application/api';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string; version?: string }> }) { return api(request, 'project', await context.params); }
export async function PATCH(request: Request, context: { params: Promise<{ id: string; version?: string }> }) { return api(request, 'project', await context.params); }
export async function DELETE(request: Request, context: { params: Promise<{ id: string; version?: string }> }) { return api(request, 'project', await context.params); }
