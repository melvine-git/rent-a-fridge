import { HeroScene } from '@/components/dispatch/hero-scene';

/** Page title over the mountain photo band, bleeding to the edges of the content area. */
export function PageHero({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="relative -mx-4 -mt-6 px-4 pt-8 pb-12 sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-10 lg:pb-12">
      <HeroScene image="/fleet/hero-mountains.jpg" layout="full" />
      <div className="relative">
        <h1 className="font-display text-[34px] leading-tight font-bold tracking-[-0.03em] text-foreground [text-shadow:0_0_16px_rgb(255_255_255/0.9)] sm:text-[40px]">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-foreground/70 [text-shadow:0_0_12px_rgb(255_255_255/0.95),0_0_4px_rgb(255_255_255/0.9)]">{description}</p>}
        {children}
      </div>
    </section>
  );
}
