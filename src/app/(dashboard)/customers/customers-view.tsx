'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { addCustomer } from '@/lib/actions';
import { Plus, Phone, Mail, MapPin, Search, Building2 } from 'lucide-react';
import type { Customer } from '@/types';

interface CustomersViewProps {
  initialCustomers: Customer[];
}

export function CustomersView({ initialCustomers }: CustomersViewProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const newCustomer = await addCustomer({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address,
      });

      setCustomers(prev => [...prev, newCustomer]);
      toast.success('Customer added successfully!', {
        description: `${newCustomer.name} has been added`,
      });
      
      setFormData({ name: '', phone: '', email: '', address: '' });
      setIsDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error('Failed to add customer', {
        description: 'Please try again',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(
    c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Search and Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--warm-gray-400)]" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 sm:pl-11 h-10 sm:h-11 rounded-xl border-[var(--warm-gray-200)] bg-white focus:ring-2 focus:ring-[var(--brand-red)]/20 focus:border-[var(--brand-red)]"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger
            render={
              <Button className="w-full sm:w-auto bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)] text-white font-semibold h-10 sm:h-11 px-5 rounded-xl shadow-sm hover:shadow-md transition-all gap-2">
                <Plus className="h-4 w-4" />
                Add Customer
              </Button>
            }
          />
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Add New Customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--charcoal)]">Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Company or individual name"
                  required
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--charcoal)]">Phone *</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+44 28 ..."
                  required
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--charcoal)]">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--charcoal)]">Address *</label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Full address"
                  required
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="flex gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1 h-11 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)] text-white h-11 rounded-xl font-semibold"
                >
                  {isSubmitting ? 'Adding...' : 'Add Customer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Customer Cards Grid */}
      {filteredCustomers.length === 0 ? (
        <Card className="rounded-xl sm:rounded-2xl border-0 shadow-[var(--shadow-sm)]">
          <CardContent className="p-8 sm:p-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <div className="text-[var(--warm-gray-500)] font-medium">No customers found</div>
            <div className="text-sm text-[var(--warm-gray-400)] mt-1">
              {searchQuery ? 'Try a different search term' : 'Add your first customer to get started'}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
          {filteredCustomers.map((customer, index) => (
            <motion.div
              key={customer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="rounded-xl sm:rounded-2xl border-0 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 sm:hover:-translate-y-1 cursor-pointer overflow-hidden group">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[var(--brand-red)]/10 to-[var(--brand-red)]/5 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-[var(--brand-red)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-[var(--charcoal)] truncate">{customer.name}</h3>
                      <p className="text-[10px] sm:text-xs text-[var(--warm-gray-400)] mt-0.5">Since {customer.createdAt}</p>
                    </div>
                  </div>
                  
                  <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-2.5">
                    <a 
                      href={`tel:${customer.phone}`}
                      className="flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm text-[var(--charcoal)] hover:text-[var(--brand-red)] transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[var(--warm-gray-100)] flex items-center justify-center">
                        <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[var(--warm-gray-500)]" />
                      </div>
                      <span className="font-medium">{customer.phone}</span>
                    </a>
                    {customer.email && (
                      <a 
                        href={`mailto:${customer.email}`}
                        className="flex items-center gap-2.5 sm:gap-3 text-xs sm:text-sm text-[var(--warm-gray-600)] hover:text-[var(--brand-red)] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[var(--warm-gray-100)] flex items-center justify-center">
                          <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[var(--warm-gray-500)]" />
                        </div>
                        <span className="truncate">{customer.email}</span>
                      </a>
                    )}
                    <div className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm text-[var(--warm-gray-600)]">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[var(--warm-gray-100)] flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[var(--warm-gray-500)]" />
                      </div>
                      <span className="line-clamp-2">{customer.address}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
