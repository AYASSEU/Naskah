import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers, Shell } from '@/features/shell';
import '@/shared/styles/globals.css';
import { serverConfigured } from '@/shared/config/env';
import { BRAND } from '@/shared/config/brand';
const literata = localFont({
  src: '../../node_modules/@fontsource-variable/literata/files/literata-latin-standard-normal.woff2',
  weight: '200 900',
  variable: '--font-serif',
  display: 'swap',
});
const schibsted = localFont({
  src: '../../node_modules/@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2',
  weight: '400 900',
  variable: '--font-sans',
  display: 'swap',
});
const mono = localFont({
  src: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  weight: '100 800',
  variable: '--font-mono',
  display: 'swap',
});
export const metadata: Metadata = {
  title: BRAND.name + ' — Penyusun SRS',
  description: 'Meja kerja penyusunan dan peninjauan spesifikasi kebutuhan perangkat lunak.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${literata.variable} ${schibsted.variable} ${mono.variable}`}>
        <Providers>
          <Shell liveConfigured={serverConfigured()}>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
