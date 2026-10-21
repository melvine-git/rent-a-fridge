import { getCustomersWithStats } from '@/lib/actions';
import { CustomersView } from './customers-view';
import { PageHeader } from '@/components/app/page-header';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const customers = await getCustomersWithStats();
  const active = customers.filter((c) => c.activeHires > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description={`${customers.length} accounts · ${active} with units on hire`} />
      <CustomersView initialCustomers={customers} />
    </div>
  );
}
