import 'server-only';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import {
  EvaluationConsentSchema,
  EvaluationContextSchema,
  type EvaluationScope,
} from '@naskah/contracts';
import { transaction, type Transaction } from '../db/client';
import { constantTimeEqual } from '../security/auth';
import { env } from '../config/env.server';
import { AppError } from '../http/errors';
export type Person = {
  id: string;
  owner_id: string;
  code: string;
  role: 'expert' | 'participant';
  consent_at: string;
  is_thesis_run: boolean;
};
const cookieName = (scope: EvaluationScope) => `naskah-evaluation-${scope}`;
const sign = (payload: string) =>
  createHmac('sha256', Buffer.from(env().APP_ENCRYPTION_KEY, 'base64'))
    .update('evaluation:' + payload)
    .digest('base64url');
function identity(request: Request, owner: string, scope: EvaluationScope): string | null {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName(scope) + '='))
    ?.slice(cookieName(scope).length + 1);
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !constantTimeEqual(sign(payload), signature)) return null;
  try {
    const data = z
      .object({
        id: z.uuid(),
        owner: z.uuid(),
        scope: z.enum(['dev', 'research']),
        expires: z.number().finite(),
      })
      .parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    return data.owner === owner && data.scope === scope && data.expires > Date.now()
      ? data.id
      : null;
  } catch {
    return null;
  }
}
export async function participantTx(
  tx: Transaction,
  request: Request,
  owner: string,
  scope: EvaluationScope,
  required = true,
) {
  const id = identity(request, owner, scope);
  const [person] = id
    ? await tx<
        Person[]
      >`select * from public.participants where id=${id} and owner_id=${owner} and is_thesis_run=${scope === 'research'} and consent=true`
    : [];
  if (!person && required) throw new AppError('research_consent_required', 403);
  return person ?? null;
}
export const contextDTO = (
  scope: EvaluationScope,
  person: Person | null,
  sus?: { id: string; score: number; project_id: string | null },
) =>
  EvaluationContextSchema.parse({
    scope,
    participant: person
      ? {
          code: person.code,
          role: person.role,
          consentedAt: new Date(person.consent_at).toISOString(),
          sus: sus ? { id: sus.id, score: Number(sus.score), projectId: sus.project_id } : null,
        }
      : null,
  });
export const context = (request: Request, owner: string, scope: EvaluationScope) =>
  transaction(async (tx) => {
    const person = await participantTx(tx, request, owner, scope, false);
    const [sus] = person
      ? await tx<
          { id: string; score: number; project_id: string | null }[]
        >`select id,score,project_id from public.sus_responses where owner_id=${owner} and participant_id=${person.id}`
      : [];
    return contextDTO(scope, person, sus);
  });
export async function consent(
  request: Request,
  owner: string,
  scope: EvaluationScope,
  input: z.infer<typeof EvaluationConsentSchema>,
) {
  const person = await transaction(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${'participant:' + owner + ':' + scope + ':' + input.code},0))`;
    const [existing] = await tx<
      Person[]
    >`select * from public.participants where owner_id=${owner} and code=${input.code} and is_thesis_run=${scope === 'research'}`;
    if (existing) {
      if (identity(request, owner, scope) !== existing.id)
        throw new AppError('participant_code_in_use', 409);
      if (existing.role !== input.role) throw new AppError('expert_role_required', 409);
      return existing;
    }
    const [created] = await tx<
      Person[]
    >`insert into public.participants(owner_id,code,role,consent,consent_at,is_thesis_run) values(${owner},${input.code},${input.role},true,now(),${scope === 'research'}) returning *`;
    return created!;
  });
  const expires = Date.now() + 7 * 24 * 3600000,
    payload = Buffer.from(JSON.stringify({ id: person.id, owner, scope, expires })).toString(
      'base64url',
    );
  return {
    data: contextDTO(scope, person),
    cookie: `${cookieName(scope)}=${payload}.${sign(payload)}; Path=/api/evaluation; HttpOnly; SameSite=Strict; Max-Age=604800`,
  };
}
