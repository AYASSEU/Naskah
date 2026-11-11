import {evaluationRoute} from '@/server/evaluation/routes';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request,{params}:{params:Promise<{resource:string}>}){return evaluationRoute(request,(await params).resource);}
export async function POST(request:Request,{params}:{params:Promise<{resource:string}>}){return evaluationRoute(request,(await params).resource);}
