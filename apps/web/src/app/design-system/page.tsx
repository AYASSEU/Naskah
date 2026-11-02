import { notFound } from 'next/navigation';
import { DesignSystem } from '@/features/design-system';
export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DesignSystem />;
}
