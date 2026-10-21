import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Globe, Mail, MapPin, Phone } from 'lucide-react';

const QUICK_LINKS = [
  { href: '/bookings/new', label: 'New booking' },
  { href: '/deliveries', label: 'Dispatch' },
  { href: '/collections', label: 'Collections' },
  { href: '/maintenance', label: 'Maintenance' },
];

const CONTACT = [
  { href: 'tel:+442892622633', label: '+44 28 9262 2633', icon: Phone },
  { href: 'mailto:info@rent-a-fridge.co.uk', label: 'info@rent-a-fridge.co.uk', icon: Mail },
  { href: 'https://www.rent-a-fridge.co.uk', label: 'rent-a-fridge.co.uk', icon: Globe, external: true },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t bg-white">
      {/* Brand accent echoing the logo's red rules */}
      <div className="h-0.5 bg-gradient-to-r from-[var(--brand-red)] via-[var(--brand-red)]/40 to-transparent" />

      <div className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="space-y-3 sm:col-span-2 lg:col-span-1">
          <Image src="/andy-keery-logo.svg" alt="Andy Keery Temperature Controlled Solutions" width={170} height={36} unoptimized />
          <p className="max-w-sm text-sm text-muted-foreground">
            Operations platform for Rent-a-Fridge: bookings, dispatch, fleet and maintenance in one place.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" /> Northern Ireland
          </p>
        </div>

        <nav aria-label="Footer">
          <h2 className="text-xs font-semibold tracking-wider text-foreground uppercase">Quick links</h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-1">
            {QUICK_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-semibold tracking-wider text-foreground uppercase">Office & support</h2>
          <ul className="mt-3 space-y-2">
            {CONTACT.map(({ href, label, icon: Icon, external }) => (
              <li key={href}>
                <a
                  href={href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="flex size-7 items-center justify-center rounded-md border bg-muted/40 transition-colors group-hover:border-[var(--brand-red)]/30 group-hover:bg-[var(--brand-red)]/5">
                    <Icon className="size-3.5 group-hover:text-[var(--brand-red)]" />
                  </span>
                  <span className="tabular">{label}</span>
                  {external && <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t bg-muted/30">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {year} Andy Keery Refrigeration. All rights reserved.</p>
          <p>
            Designed &amp; built by{' '}
            <a href="https://mirality.co.uk" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground/80 underline-offset-4 hover:text-foreground hover:underline">
              Mirality
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
