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
import { HeroScene } from '@/components/dispatch/hero-scene';

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
      <section className="relative -mx-4 -mt-6 px-4 pt-8 pb-12 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-10 lg:pb-12">
        <HeroScene image="/fleet/hero-mountains.jpg" layout="full" />
        <div className="relative">
          <h1 className="font-display text-[34px] leading-tight font-bold tracking-[-0.03em] text-foreground [text-shadow:0_0_16px_rgb(255_255_255/0.9)] sm:text-[40px]">Maintenance</h1>
          <p className="mt-1 text-[15px] text-foreground/70 [text-shadow:0_0_12px_rgb(255_255_255/0.95),0_0_4px_rgb(255_255_255/0.9)]">Service history, due dates and component tracking across the fleet</p>
        </div>
      </section>
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
