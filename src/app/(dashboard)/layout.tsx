import { Shell } from '@/components/layout/shell';
import { PageMotion } from '@/components/app/page-motion';
import { getShellData } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getShellData();
  return <Shell data={data}>
    <PageMotion>{children}</PageMotion>
  </Shell>;
}
