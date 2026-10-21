'use client';

import { Snowflake } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[var(--charcoal)] text-[var(--warm-gray-400)] py-4 sm:py-5 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
        {/* Left - Mirality credit */}
        <div className="text-xs order-2 sm:order-1">
          Designed by{' '}
          <a 
            href="https://mirality.co.uk" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[var(--warm-gray-300)] hover:text-white transition-colors font-medium"
          >
            Mirality Ltd
          </a>
        </div>

        {/* Center - Copyright */}
        <div className="text-xs font-medium text-center order-1 sm:order-2">
          © 2026 Andy Keery Refrigeration
          <span className="hidden sm:inline">. All rights reserved.</span>
        </div>

        {/* Right - Snowflake accent */}
        <div className="hidden sm:flex items-center gap-2 order-3">
          <Snowflake className="h-4 w-4 text-[var(--warm-gray-500)]" />
        </div>
      </div>
    </footer>
  );
}
