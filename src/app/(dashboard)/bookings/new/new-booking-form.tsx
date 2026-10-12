'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createBooking, getAvailableUnits } from '@/lib/actions';
import { Snowflake, Zap, CheckCircle2, XCircle, Wrench } from 'lucide-react';
import type { Customer, Unit, UnitStatus } from '@/types';
import { cn } from '@/lib/utils';

interface NewBookingFormProps {
  customers: Customer[];
  allUnits: Unit[];
}

interface FormData {
  customerId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  contactName: string;
  contactPhone: string;
  deliveryAddress: string;
  accessInstructions: string;
  tempRequired: string;
  powerAvailable: 'STANDARD' | 'INDUSTRIAL';
}

export function NewBookingForm({ customers, allUnits }: NewBookingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableUnitIds, setAvailableUnitIds] = useState<Set<string>>(new Set());
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    customerId: '',
    unitId: '',
    startDate: '',
    endDate: '',
    contactName: '',
    contactPhone: '',
    deliveryAddress: '',
    accessInstructions: '',
    tempRequired: '4',
    powerAvailable: 'STANDARD',
  });

  const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  useEffect(() => {
    async function checkAvailability() {
      if (formData.startDate && formData.endDate) {
        setIsCheckingAvailability(true);
        try {
          const available = await getAvailableUnits(formData.startDate, formData.endDate);
          setAvailableUnitIds(new Set(available.map(u => u.id)));
        } catch (error) {
          console.error('Failed to check availability:', error);
        } finally {
          setIsCheckingAvailability(false);
        }
      }
    }
    checkAvailability();
  }, [formData.startDate, formData.endDate]);

  useEffect(() => {
    if (formData.customerId) {
      const customer = customers.find(c => c.id === formData.customerId);
      if (customer) {
        setFormData(prev => ({
          ...prev,
          contactName: prev.contactName || customer.name,
          contactPhone: prev.contactPhone || customer.phone,
          deliveryAddress: prev.deliveryAddress || customer.address,
        }));
      }
    }
  }, [formData.customerId, customers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await createBooking({
        customerId: formData.customerId,
        unitId: formData.unitId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        deliveryAddress: formData.deliveryAddress,
        accessInstructions: formData.accessInstructions || undefined,
        tempRequired: parseInt(formData.tempRequired),
        powerAvailable: formData.powerAvailable,
      });

      if (result.success) {
        toast.success('Booking created successfully!', {
          description: `Booking ${result.booking?.id} for ${formData.startDate} to ${formData.endDate}`,
        });
        router.push('/bookings');
        router.refresh();
      } else {
        toast.error('Failed to create booking', {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error('An error occurred', {
        description: 'Please try again later',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUnitStatus = (unit: Unit): { disabled: boolean; label: string } => {
    if (unit.status === 'MAINTENANCE') {
      return { disabled: true, label: 'Maintenance' };
    }
    if (unit.status === 'ON_HIRE') {
      return { disabled: true, label: 'On hire' };
    }
    if (formData.startDate && formData.endDate && !availableUnitIds.has(unit.id)) {
      return { disabled: true, label: 'Booked' };
    }
    return { disabled: false, label: 'Available' };
  };

  const getStatusIcon = (unit: Unit, label: string) => {
    if (unit.status === 'MAINTENANCE') return <Wrench className="h-3.5 w-3.5 text-gray-400" />;
    if (label === 'Available') return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Main Form */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-[var(--shadow-sm)]">
            <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Customer Selection */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs sm:text-sm font-semibold text-[var(--charcoal)]">Customer *</label>
                <select
                  value={formData.customerId}
                  onChange={(e) => updateField('customerId', e.target.value)}
                  className="w-full h-10 sm:h-11 rounded-lg sm:rounded-xl border border-[var(--warm-gray-200)] bg-white px-3 sm:px-4 text-sm outline-none focus:border-[var(--brand-red)] focus:ring-2 focus:ring-[var(--brand-red)]/20 transition-all"
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-xs sm:text-sm font-semibold text-[var(--charcoal)]">Start Date *</label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => updateField('startDate', e.target.value)}
                    className="h-10 sm:h-11 rounded-lg sm:rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-xs sm:text-sm font-semibold text-[var(--charcoal)]">End Date *</label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => updateField('endDate', e.target.value)}
                    className="h-10 sm:h-11 rounded-lg sm:rounded-xl"
                    required
                  />
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-3 sm:space-y-4 pt-2">
                <h3 className="font-semibold text-sm sm:text-base text-[var(--charcoal)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-red)]" />
                  Contact & Delivery
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-[var(--warm-gray-600)]">Contact Name *</label>
                    <Input
                      value={formData.contactName}
                      onChange={(e) => updateField('contactName', e.target.value)}
                      className="h-10 sm:h-11 rounded-lg sm:rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-[var(--warm-gray-600)]">Contact Phone *</label>
                    <Input
                      value={formData.contactPhone}
                      onChange={(e) => updateField('contactPhone', e.target.value)}
                      className="h-10 sm:h-11 rounded-lg sm:rounded-xl"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-xs sm:text-sm font-medium text-[var(--warm-gray-600)]">Delivery Address *</label>
                  <Input
                    value={formData.deliveryAddress}
                    onChange={(e) => updateField('deliveryAddress', e.target.value)}
                    className="h-10 sm:h-11 rounded-lg sm:rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-xs sm:text-sm font-medium text-[var(--warm-gray-600)]">Access Instructions</label>
                  <Input
                    value={formData.accessInstructions}
                    onChange={(e) => updateField('accessInstructions', e.target.value)}
                    placeholder="e.g., Ring bell twice, side entrance"
                    className="h-10 sm:h-11 rounded-lg sm:rounded-xl"
                  />
                </div>
              </div>

              {/* Requirements */}
              <div className="space-y-3 sm:space-y-4 pt-2">
                <h3 className="font-semibold text-sm sm:text-base text-[var(--charcoal)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-red)]" />
                  Requirements
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-[var(--warm-gray-600)]">Temperature (°C) *</label>
                    <Input
                      type="number"
                      value={formData.tempRequired}
                      onChange={(e) => updateField('tempRequired', e.target.value)}
                      min="-20"
                      max="10"
                      className="h-10 sm:h-11 rounded-lg sm:rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-[var(--warm-gray-600)]">Power Available *</label>
                    <select
                      value={formData.powerAvailable}
                      onChange={(e) => updateField('powerAvailable', e.target.value as 'STANDARD' | 'INDUSTRIAL')}
                      className="w-full h-10 sm:h-11 rounded-lg sm:rounded-xl border border-[var(--warm-gray-200)] bg-white px-3 sm:px-4 text-sm outline-none focus:border-[var(--brand-red)] focus:ring-2 focus:ring-[var(--brand-red)]/20 transition-all"
                    >
                      <option value="STANDARD">13A Standard</option>
                      <option value="INDUSTRIAL">32A Industrial</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-[var(--warm-gray-200)]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="h-10 sm:h-11 px-4 sm:px-6 rounded-lg sm:rounded-xl order-2 sm:order-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.customerId || !formData.unitId || !formData.startDate || !formData.endDate}
                  className="bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)] text-white h-10 sm:h-11 px-4 sm:px-6 rounded-lg sm:rounded-xl font-semibold shadow-sm hover:shadow-md transition-all order-1 sm:order-2"
                >
                  {isSubmitting ? 'Creating...' : 'Create Booking'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Unit Selection */}
        <div className="space-y-4 order-first lg:order-last">
          <Card className="rounded-xl sm:rounded-2xl border-0 shadow-[var(--shadow-sm)] lg:sticky lg:top-6">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="font-semibold text-sm sm:text-base text-[var(--charcoal)]">Select Unit *</h3>
                {isCheckingAvailability && (
                  <span className="text-[10px] sm:text-xs text-[var(--warm-gray-500)] animate-pulse">Checking...</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 lg:max-h-[600px] lg:overflow-y-auto lg:pr-1">
                {allUnits.map((unit, index) => {
                  const { disabled, label } = getUnitStatus(unit);
                  const isSelected = formData.unitId === unit.id;
                  
                  return (
                    <motion.button
                      key={unit.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => updateField('unitId', unit.id)}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        'w-full p-2.5 sm:p-3 rounded-lg sm:rounded-xl border-2 text-left transition-all',
                        disabled
                          ? 'opacity-50 cursor-not-allowed bg-[var(--warm-gray-50)] border-transparent'
                          : 'cursor-pointer hover:border-[var(--brand-red)]/50 bg-white border-transparent hover:bg-[var(--warm-gray-50)]',
                        isSelected && !disabled && 'border-[var(--brand-red)] bg-red-50 shadow-sm'
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className={cn(
                            'w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center',
                            label === 'Available' ? 'bg-green-100' : 'bg-gray-100'
                          )}>
                            <Snowflake className={cn(
                              'h-3.5 w-3.5 sm:h-4 sm:w-4',
                              label === 'Available' ? 'text-green-600' : 'text-gray-400'
                            )} />
                          </div>
                          <div>
                            <div className="font-mono-unit text-xs sm:text-sm">{unit.id}</div>
                            <div className="text-[10px] sm:text-xs text-[var(--warm-gray-500)] flex items-center gap-1">
                              {unit.size}
                              <span className="text-[var(--warm-gray-300)] hidden sm:inline">•</span>
                              <Zap className={cn(
                                'h-2.5 w-2.5 sm:h-3 sm:w-3 hidden sm:block',
                                unit.powerType === 'INDUSTRIAL' ? 'text-orange-500' : 'text-green-500'
                              )} />
                              <span className="hidden sm:inline">{unit.powerType === 'INDUSTRIAL' ? '32A' : '13A'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-1.5 ml-10 sm:ml-0">
                          {getStatusIcon(unit, label)}
                          <span className={cn(
                            'text-[10px] sm:text-xs font-medium',
                            label === 'Available' ? 'text-green-600' : 'text-gray-400'
                          )}>
                            {label}
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
