import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { env } from '../config/env.server';
import { AppError } from '../http/errors';
import type { Database } from './types';

let supabase: SupabaseClient<Database>|undefined;
let pool: ReturnType<typeof postgres>|undefined;
export function db() {
  const cfg=env();
  return supabase??=createClient<Database>(cfg.SUPABASE_URL,cfg.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export function sql() {
  return pool??=postgres(env().DATABASE_URL,{max:8,idle_timeout:20,connect_timeout:10,prepare:false,onnotice:()=>{}});
}
export type Transaction=postgres.TransactionSql;
export async function transaction<T>(operation:(tx:Transaction)=>Promise<T>):Promise<T> {
  try {
    return await sql().begin(async tx=>{await tx`set local role service_role`;await tx`set local statement_timeout = '30s'`;return operation(tx);}) as T;
  } catch(error) {
    if(error instanceof AppError)throw error;
    const message=error instanceof Error?error.message:'';
    const safe=['section_changed','section_locked','not_found','revision_not_ready','embedding_model_mismatch','embedding_dimension_mismatch','corpus_leakage'];
    if(safe.includes(message))throw new AppError(message,message==='not_found'?404:409);
    if(error && typeof error==='object' && 'code' in error && error.code==='23505') throw new AppError('revision_pending',409);
    throw new AppError('internal_error',500,true);
  }
}
