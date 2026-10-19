import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { cn } from '@/lib/utils';

export interface MenuItem {
  key: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
}

interface MenuProps<T extends MenuItem> {
  items: T[];
  command: (item: T) => void;
  empty?: string;
}

export interface MenuHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

function MenuInner<T extends MenuItem>(
  { items, command, empty = 'No matches' }: MenuProps<T>,
  ref: React.Ref<MenuHandle>,
) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setActive(0), [items]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (!items.length) return false;
      if (e.key === 'ArrowDown') {
        setActive((i) => (i + 1) % items.length);
        return true;
      }
      if (e.key === 'ArrowUp') {
        setActive((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        command(items[active]);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      ref={listRef}
      className="max-h-64 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-sm shadow-xl"
    >
      {items.length === 0 && <div className="px-3 py-2 text-muted-foreground">{empty}</div>}
      {items.map((item, i) => (
        <button
          key={item.key}
          type="button"
          data-index={i}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left',
            i === active ? 'bg-muted text-foreground' : 'text-foreground/85',
          )}
          onMouseEnter={() => setActive(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command(item)}
        >
          {item.icon && <span className="text-muted-foreground">{item.icon}</span>}
          <span className="flex-1 truncate">{item.label}</span>
          {item.hint && <span className="text-2xs font-mono text-muted-foreground">{item.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export const SuggestionMenu = forwardRef(MenuInner) as <T extends MenuItem>(
  p: MenuProps<T> & { ref?: React.Ref<MenuHandle> },
) => ReturnType<typeof MenuInner>;

const MENU_HEIGHT = 270;

function place(el: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return;
  const vv = window.visualViewport;
  const viewH = vv ? vv.height + vv.offsetTop : window.innerHeight;
  const below = rect.bottom + 6;
  const top = below + MENU_HEIGHT > viewH ? Math.max(8, rect.top - MENU_HEIGHT - 6) : below;
  const left = Math.min(rect.left, window.innerWidth - 270);
  el.style.top = `${top}px`;
  el.style.left = `${Math.max(8, left)}px`;
}

/** Shared popup renderer for the slash menu and @-mentions. */
export function suggestionRender<T extends MenuItem>(empty?: string): SuggestionOptions<T>['render'] {
  return () => {
    let renderer: ReactRenderer<MenuHandle> | null = null;
    let host: HTMLDivElement | null = null;

    return {
      onStart: (props: SuggestionProps<T>) => {
        host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.zIndex = '80';
        document.body.appendChild(host);
        renderer = new ReactRenderer(SuggestionMenu as never, {
          props: { items: props.items, command: props.command, empty },
          editor: props.editor,
        });
        host.appendChild(renderer.element);
        place(host, props.clientRect?.());
      },
      onUpdate: (props: SuggestionProps<T>) => {
        renderer?.updateProps({ items: props.items, command: props.command, empty });
        if (host) place(host, props.clientRect?.());
      },
      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === 'Escape') {
          host?.remove();
          return true;
        }
        return renderer?.ref?.onKeyDown(props.event) ?? false;
      },
      onExit: () => {
        renderer?.destroy();
        host?.remove();
        renderer = null;
        host = null;
      },
    };
  };
}
