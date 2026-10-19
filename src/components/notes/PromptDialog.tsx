import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export function PromptDialog({
  open,
  title,
  initial = '',
  placeholder,
  confirm = 'Save',
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  initial?: string;
  placeholder?: string;
  confirm?: string;
  onSubmit: (value: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[25%] translate-y-0 sm:max-w-sm">
        <DialogTitle className="text-xl">{title}</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!value.trim()) return;
            onSubmit(value.trim());
            onOpenChange(false);
          }}
          className="space-y-4"
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="h-11 w-full rounded-md border border-border bg-background px-3 outline-none focus:border-muted-foreground/60"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="h-9 px-3 text-sm text-muted-foreground">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {confirm}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
