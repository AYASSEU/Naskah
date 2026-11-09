import { buildProduction } from './workflow-builder';
await buildProduction();
console.log(
  'Built Generate SRS, Revise Section and Error Handler; no secrets or credential IDs embedded.',
);
