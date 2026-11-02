import { ExportDocument } from '@/features/export';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ExportDocument id={(await params).id} />;
}
