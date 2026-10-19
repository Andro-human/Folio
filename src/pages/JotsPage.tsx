import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PageBody, PageHeader, ScreenTitle } from '@/components/layout/PageHeader';
import { PageEditor } from '@/components/editor/PageEditor';
import { useJot, useJotsFeed, usePage, type JotSummary } from '@/data/pages';
import { fromDateKey, jotTitle, relativeDayLabel, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

export default function JotsPage() {
  const today = todayKey();
  const todayJot = useJot(today);
  const feed = useJotsFeed();
  const past = (feed.data?.pages.flat() ?? []).filter((j) => j.jot_date !== today);

  return (
    <>
      <PageHeader back="/notes" />
      <PageBody>
        <ScreenTitle sub="One page per day">Jots</ScreenTitle>

        <DayHeading date={today} />
        <div className="mb-10 rounded-lg border border-border/70 bg-card/30 px-4 py-3 md:px-5">
          {todayJot.isLoading ? (
            <div className="h-16 animate-pulse rounded bg-muted/50" />
          ) : (
            <PageEditor page={todayJot.data ?? null} mode="jot" jotDate={today} />
          )}
        </div>

        <div className="space-y-2">
          {past.map((j) => (
            <PastJot key={j.id} jot={j} />
          ))}
        </div>

        {feed.hasNextPage && (
          <button
            type="button"
            onClick={() => void feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
            className="mt-6 w-full rounded-md border border-border py-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {feed.isFetchingNextPage ? 'Loading…' : 'Older jots'}
          </button>
        )}
        {!feed.isLoading && past.length === 0 && (
          <p className="text-sm text-muted-foreground">Earlier days will collect here.</p>
        )}
      </PageBody>
    </>
  );
}

function DayHeading({ date }: { date: string }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <span className="font-heading text-lg">{relativeDayLabel(fromDateKey(date))}</span>
      <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">{jotTitle(date)}</span>
    </div>
  );
}

function PastJot({ jot }: { jot: JotSummary }) {
  const [open, setOpen] = useState(false);
  const lines = jot.content_text.split('\n').filter(Boolean);

  return (
    <div className="rounded-lg border border-border/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-heading">{relativeDayLabel(fromDateKey(jot.jot_date!))}</span>
            <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">{jotTitle(jot.jot_date!)}</span>
          </div>
          {!open && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {lines.length ? lines.slice(0, 3).join(' · ') : 'Empty'}
            </p>
          )}
        </div>
      </button>
      {open && <PastJotEditor id={jot.id} date={jot.jot_date!} />}
    </div>
  );
}

function PastJotEditor({ id, date }: { id: string; date: string }) {
  const { data: page, isLoading } = usePage(id);
  return (
    <div className="border-t border-border/60 px-4 py-3 md:px-5">
      {isLoading || !page ? (
        <div className="h-12 animate-pulse rounded bg-muted/50" />
      ) : (
        <PageEditor page={page} mode="jot" jotDate={date} />
      )}
    </div>
  );
}
