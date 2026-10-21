import { getUnitsWithHire } from '@/lib/actions';
import { UnitsView } from './units-view';
import { PageHeader } from '@/components/app/page-header';

export const dynamic = 'force-dynamic';

export default async function UnitsPage() {
  const units = await getUnitsWithHire();
  const available = units.filter((u) => u.status === 'AVAILABLE').length;

  return (
    <div className="space-y-6">
      <PageHeader title="Fleet" description={`${units.length} units · ${available} available to hire`} />
      <UnitsView units={units} />
    </div>
  );
}
