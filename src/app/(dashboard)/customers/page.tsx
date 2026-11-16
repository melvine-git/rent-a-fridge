import { getCustomersWithStats } from '@/lib/actions';
import { CustomersView } from './customers-view';
import { PageHero } from '@/components/app/page-hero';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const customers = await getCustomersWithStats();
  const active = customers.filter((c) => c.activeHires > 0).length;

  return (
    <div className="space-y-6">
      <PageHero title="Customers" description={`${customers.length} accounts · ${active} with units on hire`} />
      <CustomersView initialCustomers={customers} />
    </div>
  );
}
