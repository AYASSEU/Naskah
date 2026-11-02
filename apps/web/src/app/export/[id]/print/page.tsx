import { PrintDocument } from '@/features/export';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PrintDocument id={(await params).id} />;
}
