import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@naskah/contracts', '@naskah/core'],
  devIndicators: false,
};
export default config;
