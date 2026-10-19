import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, FileText, Search } from 'lucide-react';
import { PageBody, PageHeader, SectionTitle } from '@/components/layout/PageHeader';
import { useRecentPages, useSearch } from '@/data/pages';
import { jotTitle, relativeDayLabel } from '@/lib/dates';

function Snippet({ text }: { text: string }) {
  const parts = text.split(/(«[^»]*»)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('«') ? (
          <mark key={i} className="rounded-sm bg-primary/15 px-0.5 text-foreground">
            {p.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(q);
  const results = useSearch(debounced);
  const recent = useRecentPages();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setParams(q ? { q } : {}, { replace: true });
    }, 200);
    return () => clearTimeout(t);
  }, [q, setParams]);

  return (
    <>
      <PageHeader />
      <PageBody>
        <div className="mb-6 mt-1 flex items-center gap-2.5 rounded-lg border border-border bg-card/40 px-3 focus-within:border-muted-foreground/50 md:mt-8">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes, jots and tasks"
            enterKeyHint="search"
            className="h-12 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground/70"
          />
        </div>

        {debounced.trim() ? (
          results.data?.length ? (
            <div>
              {results.data.map((r) => (
                <Link key={r.id} to={`/p/${r.id}`} className="block border-b border-border/60 py-3 last:border-0">
                  <div className="flex items-center gap-2">
                    {r.jot_date ? (
                      <CalendarDays className="h-4 w-4 text-primary" />
                    ) : r.is_task ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="truncate">{r.jot_date ? jotTitle(r.jot_date) : r.title || 'Untitled'}</span>
                  </div>
                  {r.snippet && r.snippet.includes('«') && (
                    <p className="mt-1 line-clamp-2 pl-6 text-sm text-muted-foreground">
                      <Snippet text={r.snippet} />
                    </p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            !results.isFetching && <p className="text-sm text-muted-foreground">No matches for “{debounced}”.</p>
          )
        ) : (
          <section>
            <SectionTitle>Recently edited</SectionTitle>
            {recent.data?.map((p) => (
              <Link key={p.id} to={`/p/${p.id}`} className="flex items-center gap-2.5 border-b border-border/60 py-3 last:border-0">
                {p.jot_date ? <CalendarDays className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                <span className="flex-1 truncate">{p.jot_date ? jotTitle(p.jot_date) : p.title || 'Untitled'}</span>
                <span className="text-xs text-muted-foreground">{relativeDayLabel(new Date(p.updated_at))}</span>
              </Link>
            ))}
          </section>
        )}
      </PageBody>
    </>
  );
}
