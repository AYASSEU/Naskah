import 'server-only';
import { AppError } from './errors';
const buckets=new Map<string,{count:number;reset:number}>();
export function rateLimit(owner: string, action: string, limit=10, windowMs=60000, now=Date.now()) {
  const key=`${owner}:${action}`, current=buckets.get(key);
  if(!current||current.reset<=now) {buckets.set(key,{count:1,reset:now+windowMs});}
  else if(current.count>=limit) throw new AppError('rate_limited',429,true);
  else current.count++;
  if(buckets.size>1000) for(const [k,v] of buckets) if(v.reset<=now) buckets.delete(k);
}
