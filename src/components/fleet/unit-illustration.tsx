import { cn } from '@/lib/utils';
import type { UnitType } from '@/types';

/** Clean product-style drawing of each unit type, used when a unit has no photo. */
export function UnitIllustration({ type, className }: { type: UnitType; className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={cn('h-full w-full', className)} role="img" aria-label={LABEL[type]}>
      <ellipse cx="120" cy="148" rx="92" ry="7" fill="#000" opacity="0.08" />
      {type === 'COLD_STORE' && <ColdStore />}
      {type === 'UPRIGHT_FRIDGE' && <UprightFridge />}
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

function UprightFridge() {
  const shelves = [56, 78, 100, 122];
  const bottle = (x: number, y: number, c: string, h = 14) => <rect key={`${x}-${y}`} x={x} y={y - h} width="5" height={h} rx="1.5" fill={c} opacity="0.85" />;
  return (
    <g>
      <defs>
        <linearGradient id="uf-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dcebf3" />
          <stop offset="0.5" stopColor="#c4dbe8" />
          <stop offset="1" stopColor="#e6f1f7" />
        </linearGradient>
        <linearGradient id="uf-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="70" y="10" width="100" height="134" rx="6" fill="#26292d" />
      <rect x="74" y="14" width="92" height="14" rx="3" fill="#121416" />
      <rect x="86" y="19" width="40" height="3" rx="1.5" fill="#e30613" opacity="0.85" />
      {[76, 121].map((x) => (
        <g key={x}>
          <rect x={x} y="32" width="43" height="106" rx="2" fill="url(#uf-glass)" stroke="#0f1113" strokeWidth="2.5" />
          {shelves.map((y) => (
            <line key={y} x1={x + 3} y1={y} x2={x + 40} y2={y} stroke="#8fa9b8" strokeWidth="1.2" />
          ))}
          {bottle(x + 6, 56, '#3b82f6')}
          {bottle(x + 14, 56, '#ef4444', 12)}
          {bottle(x + 22, 56, '#22c55e')}
          {bottle(x + 30, 56, '#f59e0b', 11)}
          {bottle(x + 8, 78, '#64748b', 12)}
          {bottle(x + 17, 78, '#3b82f6')}
          {bottle(x + 27, 78, '#ef4444', 13)}
          {bottle(x + 6, 100, '#22c55e', 12)}
          {bottle(x + 16, 100, '#f59e0b')}
          {bottle(x + 26, 100, '#64748b', 12)}
          {bottle(x + 10, 122, '#3b82f6', 12)}
          {bottle(x + 22, 122, '#ef4444', 13)}
          <rect x={x + 4} y="34" width="12" height="102" fill="url(#uf-shine)" />
        </g>
      ))}
      <rect x="114" y="70" width="3" height="34" rx="1.5" fill="#cfd4d9" />
      <rect x="123" y="70" width="3" height="34" rx="1.5" fill="#cfd4d9" />
      <rect x="78" y="142" width="8" height="4" rx="1" fill="#1a1c1f" />
      <rect x="154" y="142" width="8" height="4" rx="1" fill="#1a1c1f" />
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
