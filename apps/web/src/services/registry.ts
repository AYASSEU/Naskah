import { getEnvironment } from '@/shared/config/env';
import { createMockServices } from './mock';
import { createHttpServices } from './http';
export const services =
  getEnvironment().mode === 'live' ? createHttpServices() : createMockServices();
