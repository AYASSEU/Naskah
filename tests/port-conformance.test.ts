import {describe,it,vi,expect} from 'vitest';
vi.mock('@/services/mock/persistence',()=>{
  const memory=new Map();return{persistence:{async get(key:string){return memory.get(key);},async set(key:string,value:unknown){memory.set(key,structuredClone(value));},async clear(){memory.clear();}}};
});
import {createMockServices} from '@/services/mock';
import {exercisePorts} from './port-conformance';
describe('shared project, generation and revision port conformance',()=>{
  it('runs the same lifecycle contract against the original mock adapter',async()=>{
    const services=createMockServices();services.simulation.speed='instant';
    expect(await exercisePorts(services)).toMatchObject({sections:15,revisionIsolation:true});
  });
});
