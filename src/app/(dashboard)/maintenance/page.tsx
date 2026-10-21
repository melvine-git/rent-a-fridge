import {
  getAllMaintenanceRecords,
  getMaintenanceDueNotifications,
  getUnitsInMaintenance,
  getServiceableComponents,
  getServiceableComponentList,
  getAllBOMComponents,
  getAllUnits,
} from '@/lib/actions';
import { MaintenanceView } from './maintenance-view';
import { PageHeader } from '@/components/app/page-header';

export const dynamic = 'force-dynamic';

export default async function MaintenancePage() {
  const [maintenanceRecords, maintenanceDue, unitsInMaintenance, serviceableComponents, serviceList, allComponents, allUnits] = await Promise.all([
    getAllMaintenanceRecords(),
    getMaintenanceDueNotifications(),
    getUnitsInMaintenance(),
    getServiceableComponents(),
    getServiceableComponentList(),
    getAllBOMComponents(),
    getAllUnits(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" description="Service history, due dates and component tracking across the fleet" />
      <MaintenanceView
        maintenanceRecords={maintenanceRecords}
        maintenanceDue={maintenanceDue}
        unitsInMaintenance={unitsInMaintenance}
        serviceableComponents={serviceableComponents}
        serviceList={serviceList}
        allComponents={allComponents}
        allUnits={allUnits}
      />
    </div>
  );
}
