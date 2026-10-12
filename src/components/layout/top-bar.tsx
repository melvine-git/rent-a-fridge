'use client';

import { Button } from '@/components/ui/button';
import { Phone, Mail, Menu } from 'lucide-react';

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="h-16 sm:h-20 bg-white border-b border-[var(--warm-gray-200)] flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-[var(--shadow-xs)]">
      {/* Mobile menu button */}
      <button 
        onClick={onMenuClick}
        className="lg:hidden w-10 h-10 rounded-xl bg-[var(--warm-gray-100)] flex items-center justify-center hover:bg-[var(--warm-gray-200)] transition-colors"
      >
        <Menu className="h-5 w-5 text-[var(--charcoal)]" />
      </button>

      {/* Logo - ANDY KEERY wordmark with red rules */}
      <div className="flex items-center">
        <div className="flex flex-col items-center select-none">
          <div className="h-[2px] sm:h-[3px] w-28 sm:w-40 bg-[var(--brand-red)] rounded-full" />
          <div className="py-1 sm:py-1.5">
            <span 
              className="font-black text-lg sm:text-2xl tracking-tight text-[var(--charcoal)] uppercase"
              style={{ 
                fontStretch: 'condensed',
                letterSpacing: '0.02em',
              }}
            >
              ANDY KEERY
            </span>
          </div>
          <div className="h-[2px] sm:h-[3px] w-28 sm:w-40 bg-[var(--brand-red)] rounded-full" />
          <span className="hidden sm:block text-[10px] text-[var(--warm-gray-500)] tracking-[0.15em] mt-1 font-medium">
            www.rent-a-fridge.co.uk
          </span>
        </div>
      </div>

      {/* Contact Info - Right side */}
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-8">
        {/* Phone - icon only on mobile */}
        <a 
          href="tel:+442892622633" 
          className="flex items-center gap-2.5 text-sm text-[var(--charcoal)] hover:text-[var(--brand-red)] transition-colors group"
        >
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-red)]/10 flex items-center justify-center group-hover:bg-[var(--brand-red)]/20 transition-colors">
            <Phone className="h-4 w-4 text-[var(--brand-red)]" />
          </div>
          <span className="hidden lg:inline font-semibold">+44 28 9262 2633</span>
        </a>
        {/* Email - hidden on mobile */}
        <a 
          href="mailto:info@rent-a-fridge.co.uk" 
          className="hidden sm:flex items-center gap-2.5 text-sm text-[var(--charcoal)] hover:text-[var(--brand-red)] transition-colors group"
        >
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-red)]/10 flex items-center justify-center group-hover:bg-[var(--brand-red)]/20 transition-colors">
            <Mail className="h-4 w-4 text-[var(--brand-red)]" />
          </div>
          <span className="hidden lg:inline font-medium">info@rent-a-fridge.co.uk</span>
        </a>
        <Button 
          className="hidden md:flex bg-[var(--brand-red)] hover:bg-[var(--brand-red-dark)] text-white font-semibold h-10 sm:h-11 px-4 sm:px-6 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          CONTACT
        </Button>
      </div>
    </header>
  );
}
