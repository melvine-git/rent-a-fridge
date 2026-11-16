import { getUnitsWithHire } from '@/lib/actions';
import { UnitsView } from './units-view';

export const dynamic = 'force-dynamic';

export default async function UnitsPage() {
  const units = await getUnitsWithHire();
  return <UnitsView units={units} />;
}
