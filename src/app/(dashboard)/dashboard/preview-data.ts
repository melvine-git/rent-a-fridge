import type { BookingWithDetails, Customer, DeliveryChecklist, Unit } from '@/types';
import type { CommandCentreProps } from '@/components/dashboard/command-centre';

/**
 * A made-up but realistic Belfast day, built from copies of the real units, so the
 * dashboard map can be previewed with `?preview=1`. Nothing here is saved.
 */
export function previewData(realUnits: Unit[], today: string, tomorrow: string): Omit<CommandCentreProps, 'coords' | 'yard' | 'driver'> {
  const shift = (days: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const units = realUnits.map((u) => ({ ...u }));
  const unit = (id: string) => units.find((u) => u.id === id) ?? units[0];
  const customer = (id: string, name: string, address: string): Customer => ({ id, name, phone: '+447700900123', address, createdAt: today });

  let n = 0;
  const line = (
    c: Customer,
    unitId: string,
    o: Partial<BookingWithDetails> & Pick<BookingWithDetails, 'status' | 'startDate' | 'endDate'>,
    group?: string
  ): BookingWithDetails => {
    const id = `preview-${++n}`;
    const u = unit(unitId);
    if (o.status === 'ON_HIRE') {
      u.status = 'ON_HIRE';
      u.breakdown = undefined;
    }
    return {
      id,
      groupId: group,
      customerId: c.id,
      unitId: u.id,
      contactName: 'Sam Morgan',
      contactPhone: '+447700900456',
      deliveryAddress: c.address,
      tempRequired: 3,
      powerAvailable: 'STANDARD',
      cableLength: '15m',
      accessories: { hitchLock: true, wheelClamp: false, doorLock: true, tempRecorder: false },
      createdAt: new Date(Date.parse(`${o.startDate}T00:00:00Z`) - 5 * 86_400_000).toISOString().slice(0, 10),
      customer: c,
      unit: u,
      ...o,
    };
  };

  const hillside = customer('p-c1', 'Hillside Catering', '45 Hillside Road, Belfast BT9 5EG');
  const bistro = customer('p-c2', 'Cathedral Quarter Bistro', '23 Waring Street, Belfast BT1 2DX');
  const titanic = customer('p-c3', 'Titanic Exhibitions', '1 Olympic Way, Belfast BT3 9EP');
  const oneills = customer('p-c4', "O'Neill's Bar & Grill", '78 Ormeau Road, Belfast BT7 1SH');
  const events = customer('p-c5', 'Belfast Events Ltd', '12 Queen Street, Belfast BT1 6ED');
  const fair = customer('p-c6', 'Lagan Valley Food Fair', 'Lagan Valley Island, Lisburn BT27 4RL');
  const stormont = customer('p-c7', 'Stormont Hospitality', 'Stormont Estate, Belfast BT4 3SH');

  const doneLine = line(hillside, 'CS-04', { status: 'ON_HIRE', startDate: today, endDate: shift(6), deliveryTime: '08:30' });
  const bistroLine = line(bistro, 'UF-01', { status: 'CONFIRMED', startDate: today, endDate: shift(4), deliveryTime: '11:30', accessories: { hitchLock: false, wheelClamp: false, doorLock: true, tempRecorder: true } });
  const titanicLine = line(titanic, 'CS-05', { status: 'ON_HIRE', startDate: shift(-6), endDate: today, collectionTime: '14:00' });
  const oneillsA = line(oneills, 'CF-01', { status: 'CONFIRMED', startDate: today, endDate: shift(2), deliveryTime: '15:30', tempRequired: -18 }, 'preview-g1');
  const oneillsB = line(oneills, 'UF-02', { status: 'CONFIRMED', startDate: today, endDate: shift(2), deliveryTime: '15:30' }, 'preview-g1');
  const eventsLine = line(events, 'CS-06', { status: 'CONFIRMED', startDate: tomorrow, endDate: shift(3), deliveryTime: '09:00', accessories: { hitchLock: true, wheelClamp: true, doorLock: true, tempRecorder: true } });
  const fairA = line(fair, 'CS-02', { status: 'ON_HIRE', startDate: shift(-3), endDate: shift(3) }, 'preview-g2');
  const fairB = line(fair, 'CS-03', { status: 'ON_HIRE', startDate: shift(-3), endDate: shift(3) }, 'preview-g2');
  const stormontLine = line(stormont, 'CF-03', { status: 'ON_HIRE', startDate: shift(-9), endDate: shift(-1), collectionTime: '12:00' });

  const left: DeliveryChecklist = {
    unitClean: true,
    doorsSealed: true,
    tempVerified: true,
    powerConnected: true,
    tempSetting: 3,
    powerSupplyChecked: true,
    powerCableConnected: true,
    cableLengthUsed: '15m',
    hitchLockSecured: true,
    wheelClampSecured: false,
    doorLockSecured: true,
    tempRecorderFitted: true,
  };

  const hires = [doneLine, titanicLine, fairA, fairB, stormontLine];
  return {
    today,
    tomorrow,
    units,
    hires,
    deliveries: [bistroLine, oneillsA, oneillsB, eventsLine],
    collections: [titanicLine, stormontLine],
    doneToday: [{ kind: 'delivery', at: new Date(`${today}T08:42:00`).toISOString(), signedBy: 'J. Park', line: doneLine }],
    delivered: Object.fromEntries(hires.map((h) => [h.id, left])),
    nextOut: { [eventsLine.unitId]: { date: tomorrow, customer: events.name }, 'UF-03': { date: shift(5), customer: bistro.name } },
    jobs: Object.fromEntries([
      ...hires.map((h) => [
        h.id,
        [
          { type: 'DELIVERY' as const, status: 'COMPLETED' as const, completedAt: `${h.startDate}T08:42:00.000Z`, signedBy: h === doneLine ? 'J. Park' : 'Jane S' },
          // Stormont's collection was never given to a driver, so it shows as unassigned
          ...(h === stormontLine ? [] : [{ type: 'COLLECTION' as const, status: 'SCHEDULED' as const, signedBy: '', staff: 'Andy Keery' }]),
        ],
      ]),
      ...[bistroLine, oneillsA, oneillsB, eventsLine].map((l) => [l.id, [{ type: 'DELIVERY' as const, status: 'SCHEDULED' as const, signedBy: '', staff: 'Andy Keery' }]]),
    ]),
  };
}
