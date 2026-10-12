'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { markDelivered, markCollected } from '@/lib/actions';
import type { Booking, Customer, Unit, Staff } from '@/types';
import { cn } from '@/lib/utils';

type JobWithDetails = Booking & { customer: Customer; unit: Unit };

interface DeliveriesViewProps {
  tomorrowDeliveries: JobWithDetails[];
  todayDeliveries: JobWithDetails[];
  activeHires: JobWithDetails[];
  collectionsDue: JobWithDetails[];
  staff: Staff[];
}

const powerLabels: Record<string, string> = {
  STANDARD: '13A Standard',
  INDUSTRIAL: '32A Industrial',
};

export function DeliveriesView({
  tomorrowDeliveries,
  todayDeliveries,
  activeHires,
  collectionsDue,
  staff,
}: DeliveriesViewProps) {
  const [selectedJob, setSelectedJob] = useState<JobWithDetails | null>(null);
  const [jobType, setJobType] = useState<'delivery' | 'collection'>('delivery');

  const allDeliveries = [...todayDeliveries, ...tomorrowDeliveries];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <StatCard label="Tomorrow" count={tomorrowDeliveries.length} color="blue" />
        <StatCard label="Today" count={todayDeliveries.length} color="amber" />
        <StatCard label="On Hire" count={activeHires.length} color="green" />
        <StatCard label="Collections" count={collectionsDue.length} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Left: Job Lists */}
        <div className="space-y-6">
          {/* Tomorrow's Deliveries */}
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-[var(--shadow-sm)] overflow-hidden">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6 bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2 sm:gap-2.5 font-semibold text-[var(--charcoal)]">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-500" />
                Tomorrow&apos;s Deliveries
                <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-700 border-0 text-xs">{tomorrowDeliveries.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              {tomorrowDeliveries.length === 0 ? (
                <EmptyState message="No deliveries scheduled for tomorrow" />
              ) : (
                <div className="space-y-2">
                  {tomorrowDeliveries.map((job, idx) => (
                    <JobListItem
                      key={job.id}
                      job={job}
                      index={idx + 1}
                      isSelected={selectedJob?.id === job.id}
                      onClick={() => { setSelectedJob(job); setJobType('delivery'); }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Hires - Collections */}
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-[var(--shadow-sm)] overflow-hidden">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6 bg-gradient-to-r from-green-50 to-white border-b border-green-100">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2 sm:gap-2.5 font-semibold text-[var(--charcoal)]">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500" />
                Active Hires
                <Badge variant="secondary" className="ml-auto bg-green-100 text-green-700 border-0 text-xs">{activeHires.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              {activeHires.length === 0 ? (
                <EmptyState message="No active hires" />
              ) : (
                <div className="space-y-2">
                  {activeHires.map((job) => (
                    <JobListItem
                      key={job.id}
                      job={job}
                      isSelected={selectedJob?.id === job.id}
                      onClick={() => { setSelectedJob(job); setJobType('collection'); }}
                      isOnHire
                      isDue={collectionsDue.some(c => c.id === job.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Phone Preview */}
        <div className="flex justify-center order-first lg:order-last">
          <PhonePreview 
            job={selectedJob} 
            jobType={jobType}
            staff={staff}
            onComplete={() => setSelectedJob(null)}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colorClasses: Record<string, { bg: string; text: string; dot: string }> = {
    blue: { bg: 'bg-white', text: 'text-blue-700', dot: 'bg-blue-500' },
    amber: { bg: 'bg-white', text: 'text-amber-700', dot: 'bg-amber-500' },
    green: { bg: 'bg-white', text: 'text-green-700', dot: 'bg-green-500' },
    red: { bg: 'bg-white', text: 'text-red-700', dot: 'bg-red-500' },
  };
  const c = colorClasses[color];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={cn('rounded-xl sm:rounded-2xl shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] p-3 sm:p-5 text-center transition-shadow cursor-default', c.bg)}
    >
      <div className={cn('text-2xl sm:text-4xl font-bold', c.text)}>{count}</div>
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-1">
        <span className={cn('w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full', c.dot)} />
        <span className="text-xs sm:text-sm font-medium text-[var(--warm-gray-600)]">{label}</span>
      </div>
    </motion.div>
  );
}

function JobListItem({
  job,
  index,
  isSelected,
  onClick,
  isOnHire,
  isDue,
}: {
  job: JobWithDetails;
  index?: number;
  isSelected: boolean;
  onClick: () => void;
  isOnHire?: boolean;
  isDue?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'w-full p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl border-2 text-left transition-all',
        isSelected
          ? 'border-[var(--brand-red)] bg-red-50 shadow-md'
          : 'border-transparent bg-[var(--warm-gray-50)] hover:bg-[var(--warm-gray-100)]'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          {index && (
            <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-[var(--brand-red)] text-white text-[10px] sm:text-xs font-bold flex items-center justify-center shadow-sm">
              {index}
            </span>
          )}
          <div>
            <div className="font-mono-unit text-sm sm:text-base text-[var(--charcoal)]">{job.unit.id}</div>
            <div className="text-xs sm:text-sm text-[var(--warm-gray-500)] truncate max-w-[120px] sm:max-w-none">{job.customer.name}</div>
          </div>
        </div>
        <div className="text-right space-y-1">
          <Badge variant="secondary" className="text-[10px] sm:text-xs bg-[var(--warm-gray-200)] text-[var(--charcoal)] border-0">
            {job.unit.size}
          </Badge>
          {isOnHire && (
            <div>
              {isDue ? (
                <Badge className="bg-red-100 text-red-700 text-[10px] sm:text-xs border-0 font-semibold">Due</Badge>
              ) : (
                <Badge className="bg-blue-100 text-blue-700 text-[10px] sm:text-xs border-0">On Hire</Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-6 sm:py-10 text-center">
      <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">📦</div>
      <div className="text-xs sm:text-sm text-[var(--warm-gray-500)] font-medium">{message}</div>
    </div>
  );
}

function PhonePreview({
  job,
  jobType,
  staff,
  onComplete,
}: {
  job: JobWithDetails | null;
  jobType: 'delivery' | 'collection';
  staff: Staff[];
  onComplete: () => void;
}) {
  return (
    <div className="w-full max-w-[320px]">
      {/* Phone Frame */}
      <div className="bg-gray-900 rounded-[2rem] sm:rounded-[2.5rem] p-2 sm:p-3 shadow-2xl">
        {/* Notch */}
        <div className="bg-black rounded-t-[1.5rem] sm:rounded-t-[2rem] pt-4 sm:pt-6 pb-1 sm:pb-2 relative">
          <div className="absolute top-1.5 sm:top-2 left-1/2 -translate-x-1/2 w-20 sm:w-24 h-5 sm:h-6 bg-gray-900 rounded-full" />
        </div>
        
        {/* Screen */}
        <div className="bg-white rounded-b-[1.5rem] sm:rounded-b-[2rem] min-h-[480px] sm:min-h-[560px] overflow-hidden">
          <AnimatePresence mode="wait">
            {job ? (
              <motion.div
                key={job.id + jobType}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                {jobType === 'delivery' ? (
                  <DeliveryJobCard job={job} staff={staff} onComplete={onComplete} />
                ) : (
                  <CollectionJobCard job={job} staff={staff} onComplete={onComplete} />
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex items-center justify-center p-6 text-center"
              >
                <div>
                  <div className="text-6xl mb-4">📱</div>
                  <div className="text-lg font-semibold text-[var(--charcoal)]">
                    Andy&apos;s Phone
                  </div>
                  <div className="text-sm text-[var(--grey-500)] mt-1">
                    Select a job from the list to preview
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function DeliveryJobCard({
  job,
  staff,
  onComplete,
}: {
  job: JobWithDetails;
  staff: Staff[];
  onComplete: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [checklist, setChecklist] = useState({
    unitClean: false,
    doorsSealed: false,
    tempVerified: false,
    powerConnected: false,
  });
  const [signature, setSignature] = useState('');
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState('');

  const allChecked = Object.values(checklist).every(Boolean) && signature.trim().length > 0;
  const driver = staff.find(s => s.role === 'DRIVER');

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await markDelivered({
        bookingId: job.id,
        staffId: driver?.id || 'staff-01',
        checklist,
        tempSet: job.tempRequired,
        signedBy: signature,
        damageNotes: hasDamage ? damageNotes : undefined,
        photoUrls: [],
      });

      if (result.success) {
        toast.success('Delivery confirmed!', {
          description: `${job.unit.id} is now ON HIRE`,
        });
        onComplete();
      } else {
        toast.error('Failed to confirm delivery', {
          description: result.error,
        });
      }
    });
  };

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Header */}
      <div className="bg-[var(--brand-red)] text-white -m-4 mb-0 p-4 rounded-t-lg">
        <div className="text-xs uppercase tracking-wide opacity-80">Delivery</div>
        <div className="text-xl font-bold">{job.unit.id}</div>
        <div className="text-sm opacity-90">{job.unit.size} • {powerLabels[job.unit.powerType]}</div>
      </div>

      {/* Unit Specs */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-xs text-gray-500 uppercase mb-1">Unit Location</div>
        <div className="font-semibold">Yard Bay A-{job.unit.id.split('-')[1]}</div>
      </div>

      {/* Contact - Tap to Call */}
      <a
        href={`tel:${job.contactPhone}`}
        className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
      >
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
          📞
        </div>
        <div>
          <div className="font-semibold text-blue-900">{job.contactName}</div>
          <div className="text-blue-700">{job.contactPhone}</div>
        </div>
      </a>

      {/* Address - Tap to Navigate */}
      <a
        href={`https://maps.google.com/?q=${encodeURIComponent(job.deliveryAddress)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-3 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white flex-shrink-0">
            📍
          </div>
          <div>
            <div className="font-semibold text-green-900">{job.deliveryAddress}</div>
            {job.accessInstructions && (
              <div className="text-green-700 text-xs mt-1">📝 {job.accessInstructions}</div>
            )}
          </div>
        </div>
      </a>

      {/* Requirements */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-cyan-50 rounded-lg p-3 text-center border border-cyan-200">
          <div className="text-2xl">🌡️</div>
          <div className="font-bold text-cyan-900">{job.tempRequired}°C</div>
          <div className="text-xs text-cyan-700">Temperature</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-200">
          <div className="text-2xl">⚡</div>
          <div className="font-bold text-amber-900">{powerLabels[job.powerAvailable]}</div>
          <div className="text-xs text-amber-700">Power</div>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <div className="font-semibold text-gray-700">Pre-Delivery Checklist</div>
        {Object.entries(checklist).map(([key, value]) => (
          <label
            key={key}
            className={cn(
              'flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors',
              value ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
            )}
          >
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => setChecklist(prev => ({ ...prev, [key]: e.target.checked }))}
              className="w-5 h-5 rounded"
            />
            <span className={value ? 'text-green-800' : 'text-gray-700'}>
              {key === 'unitClean' && 'Unit cleaned & inspected'}
              {key === 'doorsSealed' && 'Doors sealed properly'}
              {key === 'tempVerified' && 'Temperature set & verified'}
              {key === 'powerConnected' && 'Power connected & working'}
            </span>
          </label>
        ))}
      </div>

      {/* Damage */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasDamage}
          onChange={(e) => setHasDamage(e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span>Report damage</span>
      </label>
      {hasDamage && (
        <Input
          placeholder="Describe damage..."
          value={damageNotes}
          onChange={(e) => setDamageNotes(e.target.value)}
        />
      )}

      {/* Signature */}
      <div>
        <div className="text-xs text-gray-500 mb-1">Customer Signature</div>
        <Input
          placeholder="Customer name..."
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
        />
      </div>

      {/* Confirm Button */}
      <Button
        onClick={handleConfirm}
        disabled={!allChecked || isPending}
        className="w-full h-12 bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)] text-white font-bold text-base"
      >
        {isPending ? 'Confirming...' : '✓ Confirm Delivery'}
      </Button>
    </div>
  );
}

function CollectionJobCard({
  job,
  staff,
  onComplete,
}: {
  job: JobWithDetails;
  staff: Staff[];
  onComplete: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [checklist, setChecklist] = useState({
    unitClean: false,
    doorsSealed: false,
    tempVerified: false,
    powerConnected: false,
  });
  const [signature, setSignature] = useState('');
  const [hasDamage, setHasDamage] = useState(false);
  const [damageNotes, setDamageNotes] = useState('');

  const allChecked = Object.values(checklist).every(Boolean) && signature.trim().length > 0;
  const driver = staff.find(s => s.role === 'DRIVER');

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await markCollected({
        bookingId: job.id,
        staffId: driver?.id || 'staff-01',
        checklist,
        tempSet: 0,
        signedBy: signature,
        damageNotes: hasDamage ? damageNotes : undefined,
        photoUrls: [],
      });

      if (result.success) {
        toast.success('Collection confirmed!', {
          description: `${job.unit.id} is now AVAILABLE`,
        });
        onComplete();
      } else {
        toast.error('Failed to confirm collection', {
          description: result.error,
        });
      }
    });
  };

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Header */}
      <div className="bg-green-600 text-white -m-4 mb-0 p-4 rounded-t-lg">
        <div className="text-xs uppercase tracking-wide opacity-80">Collection</div>
        <div className="text-xl font-bold">{job.unit.id}</div>
        <div className="text-sm opacity-90">On hire since {job.startDate}</div>
      </div>

      {/* Contact - Tap to Call */}
      <a
        href={`tel:${job.contactPhone}`}
        className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
      >
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
          📞
        </div>
        <div>
          <div className="font-semibold text-blue-900">{job.contactName}</div>
          <div className="text-blue-700">{job.contactPhone}</div>
        </div>
      </a>

      {/* Address - Tap to Navigate */}
      <a
        href={`https://maps.google.com/?q=${encodeURIComponent(job.deliveryAddress)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-3 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white flex-shrink-0">
            📍
          </div>
          <div>
            <div className="font-semibold text-green-900">{job.deliveryAddress}</div>
            {job.accessInstructions && (
              <div className="text-green-700 text-xs mt-1">📝 {job.accessInstructions}</div>
            )}
          </div>
        </div>
      </a>

      {/* Collection Checklist */}
      <div className="space-y-2">
        <div className="font-semibold text-gray-700">Collection Checklist</div>
        <label
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors',
            checklist.powerConnected ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
          )}
        >
          <input
            type="checkbox"
            checked={checklist.powerConnected}
            onChange={(e) => setChecklist(prev => ({ ...prev, powerConnected: e.target.checked }))}
            className="w-5 h-5 rounded"
          />
          <span className={checklist.powerConnected ? 'text-green-800' : 'text-gray-700'}>
            Power disconnected
          </span>
        </label>
        <label
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors',
            checklist.unitClean ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
          )}
        >
          <input
            type="checkbox"
            checked={checklist.unitClean}
            onChange={(e) => setChecklist(prev => ({ ...prev, unitClean: e.target.checked }))}
            className="w-5 h-5 rounded"
          />
          <span className={checklist.unitClean ? 'text-green-800' : 'text-gray-700'}>
            Unit cleaned out
          </span>
        </label>
        <label
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors',
            checklist.doorsSealed ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
          )}
        >
          <input
            type="checkbox"
            checked={checklist.doorsSealed}
            onChange={(e) => setChecklist(prev => ({ ...prev, doorsSealed: e.target.checked }))}
            className="w-5 h-5 rounded"
          />
          <span className={checklist.doorsSealed ? 'text-green-800' : 'text-gray-700'}>
            Unit inspected - no damage
          </span>
        </label>
        <label
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors',
            checklist.tempVerified ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
          )}
        >
          <input
            type="checkbox"
            checked={checklist.tempVerified}
            onChange={(e) => setChecklist(prev => ({ ...prev, tempVerified: e.target.checked }))}
            className="w-5 h-5 rounded"
          />
          <span className={checklist.tempVerified ? 'text-green-800' : 'text-gray-700'}>
            Photos taken
          </span>
        </label>
      </div>

      {/* Damage */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasDamage}
          onChange={(e) => setHasDamage(e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span>Report damage</span>
      </label>
      {hasDamage && (
        <Input
          placeholder="Describe damage..."
          value={damageNotes}
          onChange={(e) => setDamageNotes(e.target.value)}
        />
      )}

      {/* Signature */}
      <div>
        <div className="text-xs text-gray-500 mb-1">Customer Sign-off</div>
        <Input
          placeholder="Customer name..."
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
        />
      </div>

      {/* Confirm Button */}
      <Button
        onClick={handleConfirm}
        disabled={!allChecked || isPending}
        className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold text-base"
      >
        {isPending ? 'Confirming...' : '✓ Confirm Collection'}
      </Button>
    </div>
  );
}
