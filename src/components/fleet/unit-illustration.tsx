import { cn } from '@/lib/utils';
import type { UnitType } from '@/types';

/** Stock photos per type (in /public/fleet); types without one use the drawings below. */
const PHOTO: Partial<Record<UnitType, string>> = { UPRIGHT_FRIDGE: '/fleet/upright-fridge.png' };

/** Product image of each unit type, used when a unit has no photo of its own. */
export function UnitIllustration({ type, className }: { type: UnitType; className?: string }) {
  const photo = PHOTO[type];
  if (photo)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small static file in /public
      <img src={photo} alt={LABEL[type]} className={cn('h-full w-full object-contain py-2 drop-shadow-[0_6px_6px_rgb(0_0_0/0.12)]', className)} />
    );
  return (
    <svg viewBox="0 0 240 160" className={cn('h-full w-full', className)} role="img" aria-label={LABEL[type]}>
      <ellipse cx="120" cy="148" rx="92" ry="7" fill="#000" opacity="0.08" />
      {type === 'COLD_STORE' && <ColdStore />}
      {type === 'CHEST_FREEZER' && <ChestFreezer />}
    </svg>
  );
}

const LABEL: Record<UnitType, string> = { COLD_STORE: 'Cold store', UPRIGHT_FRIDGE: 'Upright fridge', CHEST_FREEZER: 'Chest freezer' };

function ColdStore() {
  return (
    <g>
      <defs>
        <linearGradient id="cs-front" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e4e8ec" />
        </linearGradient>
        <linearGradient id="cs-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d3d8de" />
          <stop offset="1" stopColor="#bfc5cd" />
        </linearGradient>
      </defs>
      <polygon points="172,40 206,27 206,127 172,142" fill="url(#cs-side)" />
      <polygon points="44,40 78,27 206,27 172,40" fill="#f1f3f5" stroke="#d6dbe0" strokeWidth="0.8" />
      <rect x="44" y="40" width="128" height="102" fill="url(#cs-front)" stroke="#cdd3d9" strokeWidth="1" />
      <line x1="86" y1="40" x2="86" y2="142" stroke="#dde1e6" strokeWidth="1" />
      <line x1="189" y1="34" x2="189" y2="135" stroke="#b3bac3" strokeWidth="0.8" />
      <rect x="97" y="51" width="60" height="89" rx="1.5" fill="#f7f8f9" stroke="#bcc3cb" strokeWidth="1.2" />
      <rect x="100" y="54" width="54" height="83" rx="1" fill="none" stroke="#e3e7eb" strokeWidth="1" />
      <rect x="148" y="86" width="4.5" height="20" rx="2" fill="#8e98a3" />
      <rect x="95" y="62" width="3" height="9" rx="1" fill="#a7afb8" />
      <rect x="95" y="118" width="3" height="9" rx="1" fill="#a7afb8" />
      <rect x="52" y="47" width="16" height="9" rx="1.5" fill="#e0e4e8" stroke="#cbd1d7" strokeWidth="0.6" />
      <circle cx="56" cy="51.5" r="1.4" fill="#34c759" />
      <rect x="44" y="136" width="128" height="6" fill="#d4d9de" />
      <polygon points="172,136 206,122 206,127 172,142" fill="#aeb5be" />
    </g>
  );
}

function ChestFreezer() {
  return (
    <g>
      <defs>
        <linearGradient id="cf-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e3e7eb" />
        </linearGradient>
      </defs>
      <rect x="38" y="66" width="164" height="72" rx="6" fill="url(#cf-body)" stroke="#cfd4da" strokeWidth="1" />
      <rect x="34" y="52" width="172" height="17" rx="5" fill="#f8f9fa" stroke="#cfd4da" strokeWidth="1" />
      <line x1="38" y1="69" x2="202" y2="69" stroke="#c6ccd3" strokeWidth="1.2" />
      <rect x="102" y="71" width="36" height="5" rx="2.5" fill="#c3c9d0" />
      <rect x="168" y="84" width="22" height="10" rx="2" fill="#e2e6ea" stroke="#ccd2d8" strokeWidth="0.6" />
      <circle cx="173" cy="89" r="1.5" fill="#34c759" />
      <rect x="177" y="88" width="9" height="2" rx="1" fill="#b6bdc5" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={160 + i * 7} y="120" width="4" height="10" rx="1" fill="#d3d8de" />
      ))}
      <rect x="46" y="136" width="10" height="5" rx="1.5" fill="#b9c0c8" />
      <rect x="184" y="136" width="10" height="5" rx="1.5" fill="#b9c0c8" />
    </g>
  );
}
