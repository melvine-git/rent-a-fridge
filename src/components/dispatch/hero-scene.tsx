import { cn } from '@/lib/utils';

/**
 * Wintry mountain backdrop for the top of Dispatch. If a photo is supplied it is shown on the
 * right instead, fading into the page; either way the bottom blends into the page background.
 */
export function HeroScene({ image, layout = 'right', className }: { image?: string; /** `full`: a landscape across the whole band; `right`: a subject photo on the right */ layout?: 'right' | 'full'; className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-b from-[#e8edf3] via-[#f1f4f7] to-background" />
      {image && layout === 'full' ? (
        // eslint-disable-next-line @next/next/no-img-element -- static file in /public
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_42%] [mask-image:linear-gradient(to_bottom,black_55%,transparent_100%)]" />
      ) : image ? (
        // eslint-disable-next-line @next/next/no-img-element -- static file in /public
        <img
          src={image}
          alt=""
          className="absolute inset-y-0 right-0 h-full w-full object-cover object-right [mask-image:linear-gradient(to_right,transparent_0%,black_45%),linear-gradient(to_bottom,black_60%,transparent_100%)] [mask-composite:intersect] sm:w-[70%]"
        />
      ) : (
        <svg className="absolute right-0 bottom-0 h-full w-full" viewBox="0 0 1200 360" preserveAspectRatio="xMaxYMax meet">
          <defs>
            <linearGradient id="hs-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c3ccd7" />
              <stop offset="1" stopColor="#e5eaf0" />
            </linearGradient>
            <linearGradient id="hs-mid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8796a8" />
              <stop offset="0.75" stopColor="#d3dae3" />
            </linearGradient>
            <linearGradient id="hs-fog" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="hs-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="white" stopOpacity="0" />
              <stop offset="0.35" stopColor="white" stopOpacity="1" />
            </linearGradient>
            <mask id="hs-mask">
              <rect width="1200" height="360" fill="url(#hs-fade)" />
            </mask>
          </defs>
          <g mask="url(#hs-mask)">
            {/* Far range */}
            <path d="M0 250 L120 190 L210 220 L330 140 L420 190 L520 120 L610 175 L700 105 L790 160 L880 115 L980 170 L1080 125 L1200 165 L1200 360 L0 360 Z" fill="url(#hs-far)" opacity="0.8" />
            {/* Main peaks */}
            <path d="M260 300 L420 170 L480 205 L590 95 L660 150 L720 120 L820 205 L900 160 L1010 230 L1100 190 L1200 230 L1200 360 L260 360 Z" fill="url(#hs-mid)" />
            {/* Snow caps */}
            <path d="M590 95 L630 128 L612 126 L600 142 L585 124 L566 136 Z M720 120 L748 144 L732 141 L722 154 L710 140 Z M420 170 L446 191 L430 189 L421 200 L410 188 Z M900 160 L925 178 L911 177 L902 188 L891 176 Z" fill="#ffffff" opacity="0.95" />
            <path d="M590 95 L560 150 L600 140 L612 170 L640 140 L660 150 Z" fill="#ffffff" opacity="0.35" />
            {/* Fog and foreground snow */}
            <rect x="0" y="200" width="1200" height="160" fill="url(#hs-fog)" />
            <path d="M0 330 C200 300 380 320 560 305 C760 288 960 318 1200 296 L1200 360 L0 360 Z" fill="#ffffff" opacity="0.9" />
          </g>
        </svg>
      )}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}
