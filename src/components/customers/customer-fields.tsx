'use client';

import { Input } from '@/components/ui/input';
import { Field } from '@/components/app/field';
import type { Customer, PostalAddress } from '@/types';

export interface CustomerDraft {
  name: string;
  phone: string;
  email: string;
  address: PostalAddress;
}

const DEFAULT_COUNTRY = 'United Kingdom';

export const emptyCustomerDraft = (): CustomerDraft => ({
  name: '',
  phone: '',
  email: '',
  address: { line1: '', line2: '', town: '', county: '', postcode: '', country: DEFAULT_COUNTRY },
});

/** Older customers only have a one-line address; it goes into Address 1 for editing. */
export function draftFromCustomer(c: Customer): CustomerDraft {
  const a = c.invoiceAddress;
  return {
    name: c.name,
    phone: c.phone,
    email: c.email ?? '',
    address: {
      line1: a?.line1 ?? c.address,
      line2: a?.line2 ?? '',
      town: a?.town ?? '',
      county: a?.county ?? '',
      postcode: a?.postcode ?? '',
      country: a?.country ?? DEFAULT_COUNTRY,
    },
  };
}

export function customerDraftError(d: CustomerDraft): string | null {
  if (!d.name.trim()) return 'Enter the company or customer name';
  if (!d.phone.trim()) return 'Enter a phone number';
  if (!d.address.line1.trim()) return 'Enter address line 1';
  if (!d.address.postcode.trim()) return 'Enter the postcode';
  if (!d.address.country.trim()) return 'Enter the country';
  return null;
}

export function draftToCustomer(d: CustomerDraft): Pick<Customer, 'name' | 'phone' | 'email' | 'address' | 'invoiceAddress'> {
  const t = (v?: string) => v?.trim() || undefined;
  const invoiceAddress: PostalAddress = {
    line1: d.address.line1.trim(),
    line2: t(d.address.line2),
    town: t(d.address.town),
    county: t(d.address.county),
    postcode: d.address.postcode.trim().toUpperCase(),
    country: d.address.country.trim(),
  };
  // `address` is rebuilt from invoiceAddress on the server; sent so the type is complete
  // Empty email is sent as '' (not undefined) so clearing it actually removes it on save
  return { name: d.name.trim(), phone: d.phone.trim(), email: d.email.trim(), address: invoiceAddress.line1, invoiceAddress };
}

export function CustomerFields({ value, onChange }: { value: CustomerDraft; onChange: (next: CustomerDraft) => void }) {
  const set = <K extends keyof CustomerDraft>(k: K, v: CustomerDraft[K]) => onChange({ ...value, [k]: v });
  const setAddr = (k: keyof PostalAddress, v: string) => onChange({ ...value, address: { ...value.address, [k]: v } });
  return (
    <div className="space-y-4">
      <Field label="Company or name" required>
        <Input value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Hillside Catering" className="h-9" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" required>
          <Input value={value.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+44 28 …" className="h-9" />
        </Field>
        <Field label="Email">
          <Input type="email" value={value.email} onChange={(e) => set('email', e.target.value)} placeholder="accounts@company.com" className="h-9" />
        </Field>
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-1.5 text-[13px] font-medium text-foreground">Invoice address</legend>
        <Field label="Address 1" required>
          <Input value={value.address.line1} onChange={(e) => setAddr('line1', e.target.value)} placeholder="Building and street" className="h-9" autoComplete="address-line1" />
        </Field>
        <Field label="Address 2">
          <Input value={value.address.line2} onChange={(e) => setAddr('line2', e.target.value)} placeholder="Unit, industrial estate (optional)" className="h-9" autoComplete="address-line2" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Town / city">
            <Input value={value.address.town} onChange={(e) => setAddr('town', e.target.value)} className="h-9" autoComplete="address-level2" />
          </Field>
          <Field label="County">
            <Input value={value.address.county} onChange={(e) => setAddr('county', e.target.value)} placeholder="e.g. Co. Antrim" className="h-9" />
          </Field>
          <Field label="Postcode" required>
            <Input value={value.address.postcode} onChange={(e) => setAddr('postcode', e.target.value)} className="h-9 uppercase" autoComplete="postal-code" />
          </Field>
          <Field label="Country" required>
            <Input value={value.address.country} onChange={(e) => setAddr('country', e.target.value)} className="h-9" autoComplete="country-name" />
          </Field>
        </div>
      </fieldset>
    </div>
  );
}
