import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--conditions=react-server','--env-file=apps/web/.env.local','--import','tsx','scripts/doctor.ts'],{stdio:'inherit'});
process.exitCode=result.status??1;
