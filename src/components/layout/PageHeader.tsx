import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Sticky, blurred top bar shared by every screen. */
export function PageHeader({
  back,
  children,
  actions,
  className,
}: {
  back?: boolean | string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <header className={cn('safe-top sticky top-0 z-30 bg-background/85 backdrop-blur-xl', className)}>
      <div className="mx-auto flex h-12 max-w-3xl items-center gap-2 px-3 md:h-14 md:px-8">
        {back && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            className="-ml-2 grid h-9 w-9 place-items-center rounded-lg text-primary hover:bg-muted"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
          </button>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted-foreground">{children}</div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-3xl px-5 md:px-8', className)}>{children}</div>;
}

export function ScreenTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6 mt-2 md:mt-6">
      <h1 className="text-[2.125rem] font-bold leading-tight md:text-[2.5rem]">{children}</h1>
      {sub && <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-[13px] font-semibold text-muted-foreground">
        {children}
      </h2>
      {right}
    </div>
  );
}
