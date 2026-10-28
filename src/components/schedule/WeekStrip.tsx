import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, format, startOfWeek } from 'date-fns';
import { fromDateKey, toDateKey, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

/** Monday–Sunday around the selected day; a dot marks days with something scheduled. */
export function WeekStrip({
  selected,
  onSelect,
  busy,
}: {
  selected: string;
  onSelect: (key: string) => void;
  busy: (key: string) => boolean;
}) {
  const monday = startOfWeek(fromDateKey(selected), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today = todayKey();
  const step = (weeks: number) => onSelect(toDateKey(addDays(fromDateKey(selected), weeks * 7)));

  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center">
        <span className="flex-1 text-[13px] font-semibold text-muted-foreground">{format(monday, 'MMMM yyyy')}</span>
        {selected !== today && (
          <button type="button" onClick={() => onSelect(today)} className="mr-1 px-2 text-[13px] text-primary">
            Today
          </button>
        )}
        <button type="button" aria-label="Previous week" onClick={() => step(-1)} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Next week" onClick={() => step(1)} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = toDateKey(d);
          const isSelected = key === selected;
          return (
            <button key={key} type="button" onClick={() => onSelect(key)} className="flex flex-col items-center gap-1 py-1">
              <span className="text-[11px] text-muted-foreground">{format(d, 'EEEEE')}</span>
              <span
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full text-[15px] tabular',
                  isSelected ? 'bg-primary font-semibold text-primary-foreground' : key === today ? 'font-semibold text-primary' : '',
                )}
              >
                {format(d, 'd')}
              </span>
              <span className={cn('h-1 w-1 rounded-full', busy(key) ? 'bg-muted-foreground/60' : 'bg-transparent')} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
