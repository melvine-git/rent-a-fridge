/**
 * Promotional hero banner for the dashboard.
 * Replace HERO_IMAGE_URL with a self-hosted or branded image when ready.
 */
export const HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=1600&q=80&auto=format&fit=crop';

export function HeroBanner() {
  return (
    <div data-motion-img className="relative overflow-hidden rounded-2xl border shadow-(--shadow-xs)">
      {/* eslint-disable-next-line @next/next/no-img-element -- external placeholder URL, swapped for a hosted asset later */}
      <img src={HERO_IMAGE_URL} alt="Commercial refrigeration units" className="h-32 w-full object-cover sm:h-36 lg:h-40" />
      <div className="absolute inset-0 bg-linear-to-r from-stone-950/85 via-stone-950/55 to-stone-950/10" />
      <div className="absolute inset-0 flex flex-col justify-center gap-2 px-6 sm:px-8">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-red-400 uppercase">Rent-a-Fridge</p>
        <p className="font-display max-w-md text-2xl leading-tight font-bold text-white sm:text-3xl">Reliable Cooling. On Demand.</p>
        <p className="max-w-sm text-[13px] text-stone-300">Cold stores, uprights and chest freezers. Delivered, powered and serviced.</p>
      </div>
    </div>
  );
}
