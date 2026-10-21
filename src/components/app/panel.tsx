import { cn } from '@/lib/utils';

interface PanelProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Standard content container: white surface, header row with title/count/action, flush body. */
export function Panel({ title, description, count, action, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={cn('surface flex flex-col overflow-hidden', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
              {count !== undefined && (
                <span className="tabular rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {count}
                </span>
              )}
            </div>
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn('flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}
