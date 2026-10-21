import { Shell } from '@/components/layout/shell';
import { getShellData } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getShellData();
  return <Shell data={data}>{children}</Shell>;
}
