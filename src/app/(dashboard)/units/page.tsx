import { unitsWithStatus } from '@/lib/actions';
import { UnitsView } from './units-view';
import { Box } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function UnitsPage() {
  const units = await unitsWithStatus();

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[var(--brand-red)]/10 flex items-center justify-center">
          <Box className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--brand-red)]" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--charcoal)] tracking-tight">Units</h1>
          <p className="text-xs sm:text-sm text-[var(--warm-gray-500)]">Fleet inventory and status</p>
        </div>
      </div>

      <UnitsView units={units} />
    </div>
  );
}
