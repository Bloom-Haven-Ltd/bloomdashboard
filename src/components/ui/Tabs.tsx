'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  /** Stable id; also the URL fragment/value for `useUrlTabs`. */
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  /** aria-label describing what the tabs switch between (§53). */
  label: string;
  className?: string;
}

/**
 * Accessible tabs (§68): proper tablist/tab/tabpanel semantics, roving
 * tabindex, arrow-key navigation, Home/End support, and counts.
 */
export function Tabs({ items, active, onChange, label, className }: TabsProps) {
  const baseId = useId();
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const [focusId, setFocusId] = useState(active);

  const focusables = items.map((item) => item.id);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = Math.max(0, focusables.indexOf(focusId));
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % focusables.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + focusables.length) % focusables.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = focusables.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextId = focusables[nextIndex];
    setFocusId(nextId);
    onChange(nextId);
    refs.current.get(nextId)?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn('flex items-center gap-1 border-b border-border', className)}>
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <button
            key={item.id}
            ref={(node) => {
              if (node) refs.current.set(item.id, node);
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${baseId}-panel-${item.id}`}
            tabIndex={focusId === item.id ? 0 : -1}
            onKeyDown={handleKeyDown}
            onClick={() => {
              setFocusId(item.id);
              onChange(item.id);
            }}
            className={cn(
              '-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
              'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset--2 focus-visible:outline-primary',
              selected
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:border-border-strong hover:text-foreground'
            )}
          >
            {item.icon}
            {item.label}
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'rounded-pill px-1.5 py-0.5 text-[10px] font-bold',
                  selected ? 'bg-primary-subtle text-primary' : 'bg-surface-muted text-foreground-muted'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface TabPanelProps {
  idBase: string;
  active: string;
  children: ReactNode;
}

/** Panel wrapper rendering only the active tab's children. */
export function TabPanel({ idBase, active, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${active}`}
      aria-labelledby={`${idBase}-tab-${active}`}
      tabIndex={0}
      className="pt-4 focus:outline-none"
    >
      {children}
    </div>
  );
}

/**
 * URL-persisted tab state (§68/§31): returns `[activeId, select]` where
 * `select` writes the tab id via the caller's setter (undefined = default
 * tab, keeping URLs clean). Caller owns storage (URL param, state, etc.).
 */
export function useTabState(
  items: TabItem[],
  value: string | undefined,
  setValue: (next: string | undefined) => void
): [string, (id: string) => void] {
  const validIds = new Set(items.map((item) => item.id));
  const defaultId = items[0]?.id ?? '';
  const active = value && validIds.has(value) ? value : defaultId;
  const select = (id: string) => setValue(id === defaultId ? undefined : id);
  return [active, select];
}
