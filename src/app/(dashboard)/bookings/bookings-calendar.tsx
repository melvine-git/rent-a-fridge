'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Phone, MapPin, Thermometer, Zap, CalendarDays } from 'lucide-react';
import type { Booking, Customer, Unit } from '@/types';

type BookingWithDetails = Booking & { customer: Customer; unit: Unit };

interface BookingsCalendarProps {
  bookings: BookingWithDetails[];
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  CONFIRMED: { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-600' },
  ON_HIRE: { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-600' },
  COLLECTED: { bg: 'bg-gray-400', text: 'text-white', border: 'border-gray-500' },
};

export function BookingsCalendar({ bookings }: BookingsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const [hoveredBooking, setHoveredBooking] = useState<string | null>(null);

  const startOfWeek = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d;
  }, [currentDate]);

  const days = useMemo(() => {
    const result = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, [startOfWeek]);

  const units = useMemo(() => {
    const unitMap = new Map<string, Unit>();
    bookings.forEach(b => unitMap.set(b.unit.id, b.unit));
    return Array.from(unitMap.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [bookings]);

  const getBookingsForUnit = (unitId: string) => {
    return bookings.filter(b => b.unitId === unitId);
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <>
      <Card className="overflow-hidden rounded-xl sm:rounded-2xl border-0 shadow-[var(--shadow-md)] bg-white">
        {/* Calendar Header */}
        <div className="border-b border-[var(--warm-gray-200)] bg-gradient-to-r from-white to-[var(--warm-gray-50)] p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-[var(--warm-gray-500)] hidden sm:block" />
              <h2 className="text-base sm:text-lg font-semibold text-[var(--charcoal)]">Resource Timeline</h2>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigateWeek(-1)}
                className="rounded-lg sm:rounded-xl border-[var(--warm-gray-200)] hover:bg-[var(--warm-gray-100)] h-8 w-8 sm:h-9 sm:w-9 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs sm:text-sm font-semibold min-w-[140px] sm:min-w-[180px] text-center text-[var(--charcoal)]">
                {formatDate(days[0])} — {formatDate(days[13])}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigateWeek(1)}
                className="rounded-lg sm:rounded-xl border-[var(--warm-gray-200)] hover:bg-[var(--warm-gray-100)] h-8 w-8 sm:h-9 sm:w-9 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentDate(new Date())}
                className="rounded-lg sm:rounded-xl border-[var(--warm-gray-200)] hover:bg-[var(--warm-gray-100)] h-8 sm:h-9 px-3 sm:px-4 font-medium text-xs sm:text-sm"
              >
                Today
              </Button>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-3 sm:gap-6 mt-3 sm:mt-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-purple-500" />
              <span className="text-[10px] sm:text-xs font-medium text-[var(--warm-gray-600)]">Confirmed</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500" />
              <span className="text-[10px] sm:text-xs font-medium text-[var(--warm-gray-600)]">On Hire</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gray-400" />
              <span className="text-[10px] sm:text-xs font-medium text-[var(--warm-gray-600)]">Collected</span>
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
            <div className="min-w-[800px] sm:min-w-[1000px]">
              {/* Header row with dates */}
              <div className="flex border-b border-[var(--warm-gray-200)] bg-[var(--warm-gray-50)]">
                <div className="w-20 sm:w-28 flex-shrink-0 p-2 sm:p-3 border-r border-[var(--warm-gray-200)] font-semibold text-[10px] sm:text-xs uppercase tracking-wider text-[var(--warm-gray-500)]">
                  Unit
                </div>
                {days.map((day, i) => (
                  <div
                    key={i}
                    className={`flex-1 py-3 px-1 text-center border-r border-[var(--warm-gray-200)] last:border-r-0 transition-colors ${
                      isToday(day) ? 'bg-[var(--brand-red)]/10' : isWeekend(day) ? 'bg-[var(--warm-gray-100)]' : ''
                    }`}
                  >
                    <div className={`text-[8px] sm:text-[10px] uppercase tracking-wider font-medium ${isWeekend(day) ? 'text-[var(--warm-gray-400)]' : 'text-[var(--warm-gray-500)]'}`}>
                      {day.toLocaleDateString('en-GB', { weekday: 'short' })}
                    </div>
                    <div className={`text-xs sm:text-sm font-bold mt-0.5 ${isToday(day) ? 'text-[var(--brand-red)]' : 'text-[var(--charcoal)]'}`}>
                      {day.getDate()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Unit rows */}
              {units.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">📅</div>
                  <div className="text-[var(--warm-gray-500)] font-medium">No bookings to display</div>
                  <div className="text-sm text-[var(--warm-gray-400)] mt-1">Create a booking to see it here</div>
                </div>
              ) : (
                units.map((unit) => (
                  <motion.div 
                    key={unit.id} 
                    className="flex border-b border-[var(--warm-gray-100)] last:border-b-0 hover:bg-[var(--warm-gray-50)]/50 transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="w-20 sm:w-28 flex-shrink-0 p-2 sm:p-3 border-r border-[var(--warm-gray-200)] flex items-center">
                      <span className="font-mono-unit text-xs sm:text-sm text-[var(--charcoal)]">{unit.id}</span>
                    </div>
                    <div className="flex-1 flex relative h-12 sm:h-14">
                      {days.map((_, dayIndex) => (
                        <div
                          key={dayIndex}
                          className={`flex-1 border-r border-[var(--warm-gray-100)] last:border-r-0 ${
                            isToday(days[dayIndex]) ? 'bg-[var(--brand-red)]/5' : isWeekend(days[dayIndex]) ? 'bg-[var(--warm-gray-50)]' : ''
                          }`}
                        />
                      ))}
                      {/* Booking bars */}
                      {getBookingsForUnit(unit.id).map((booking) => {
                        const startDate = new Date(booking.startDate);
                        const endDate = new Date(booking.endDate);
                        
                        const startIndex = days.findIndex(d => d.toDateString() === startDate.toDateString());
                        const endIndex = days.findIndex(d => d.toDateString() === endDate.toDateString());
                        
                        if (startIndex === -1 && endIndex === -1) {
                          if (startDate < days[0] && endDate > days[13]) {
                            return (
                              <motion.div
                                key={booking.id}
                                initial={{ opacity: 0, scaleX: 0.9 }}
                                animate={{ opacity: 1, scaleX: 1 }}
                                whileHover={{ scale: 1.02, zIndex: 20 }}
                                className={`absolute top-2 bottom-2 left-1 right-1 ${statusColors[booking.status].bg} rounded-xl cursor-pointer flex items-center px-3 shadow-sm ${
                                  hoveredBooking === booking.id ? 'ring-2 ring-offset-2 ring-[var(--charcoal)] shadow-lg' : ''
                                }`}
                                onMouseEnter={() => setHoveredBooking(booking.id)}
                                onMouseLeave={() => setHoveredBooking(null)}
                                onClick={() => setSelectedBooking(booking)}
                              >
                                <span className="text-xs text-white font-semibold truncate">
                                  {booking.customer.name}
                                </span>
                              </motion.div>
                            );
                          }
                          return null;
                        }

                        const actualStart = startIndex === -1 ? 0 : startIndex;
                        const actualEnd = endIndex === -1 ? 13 : endIndex;
                        const cellWidth = 100 / 14;
                        const left = `calc(${actualStart * cellWidth}% + 2px)`;
                        const width = `calc(${(actualEnd - actualStart + 1) * cellWidth}% - 4px)`;

                        return (
                          <motion.div
                            key={booking.id}
                            initial={{ opacity: 0, scaleX: 0.9 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            whileHover={{ scale: 1.02, zIndex: 20 }}
                            className={`absolute top-2 bottom-2 ${statusColors[booking.status].bg} cursor-pointer flex items-center px-3 rounded-xl shadow-sm transition-shadow ${
                              hoveredBooking === booking.id ? 'ring-2 ring-offset-2 ring-[var(--charcoal)] shadow-lg' : ''
                            }`}
                            style={{ left, width }}
                            onMouseEnter={() => setHoveredBooking(booking.id)}
                            onMouseLeave={() => setHoveredBooking(null)}
                            onClick={() => setSelectedBooking(booking)}
                          >
                            <span className="text-xs text-white font-semibold truncate">
                              {booking.customer.name}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Details Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="font-mono-unit">{selectedBooking?.id}</span>
              {selectedBooking && <StatusBadge status={selectedBooking.status} />}
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-5">
              <div className="p-4 bg-[var(--warm-gray-50)] rounded-xl">
                <h4 className="font-semibold text-[var(--charcoal)] text-lg">{selectedBooking.customer.name}</h4>
                <p className="text-sm text-[var(--warm-gray-500)] mt-1">
                  Unit: <span className="font-mono-unit">{selectedBooking.unit.id}</span> ({selectedBooking.unit.size})
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                  <span className="text-xs text-green-600 font-medium">Start Date</span>
                  <p className="font-semibold text-green-800 mt-1">{selectedBooking.startDate}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                  <span className="text-xs text-red-600 font-medium">End Date</span>
                  <p className="font-semibold text-red-800 mt-1">{selectedBooking.endDate}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <a href={`tel:${selectedBooking.contactPhone}`} className="flex items-center gap-3 p-3 bg-[var(--warm-gray-50)] rounded-xl hover:bg-[var(--warm-gray-100)] transition-colors">
                  <Phone className="h-4 w-4 text-[var(--brand-red)]" />
                  <span className="text-sm font-medium">{selectedBooking.contactPhone}</span>
                </a>
                <div className="flex items-start gap-3 p-3 bg-[var(--warm-gray-50)] rounded-xl">
                  <MapPin className="h-4 w-4 text-[var(--brand-red)] mt-0.5" />
                  <span className="text-sm">{selectedBooking.deliveryAddress}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-[var(--warm-gray-50)] rounded-xl">
                  <Thermometer className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">{selectedBooking.tempRequired}°C required</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-[var(--warm-gray-50)] rounded-xl">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">{selectedBooking.powerAvailable === 'STANDARD' ? '13A Standard' : '32A Industrial'}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
