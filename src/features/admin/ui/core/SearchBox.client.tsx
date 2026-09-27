'use client';

import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/app';
import { useQueryUpdater } from './query';

/**
 * A list's search: it writes the address (?q=) a moment after typing stops, and the list reads again.
 * Labelled for screen readers; `help` says what it searches.
 */
export function SearchBox({
  label,
  placeholder,
  initial,
  helpId,
  testId,
}: {
  label: string;
  placeholder: string;
  initial: string;
  helpId?: string;
  testId?: string;
}) {
  const { set } = useQueryUpdater();
  const [value, setValue] = useState(initial);
  const last = useRef(initial);
  // the address changed from elsewhere ("clear filters", back): the box follows it
  useEffect(() => {
    if (initial !== last.current) {
      last.current = initial;
      setValue(initial);
    }
  }, [initial]);
  useEffect(() => {
    if (value.trim() === last.current.trim()) return;
    const timer = window.setTimeout(() => {
      last.current = value;
      set({ q: value.trim() || null });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [value, set]);
  return (
    <Input
      type="search"
      aria-label={label}
      aria-describedby={helpId}
      placeholder={placeholder}
      value={value}
      maxLength={100}
      onChange={(e) => setValue(e.target.value)}
      icon={<Search />}
      wrapperClassName="min-w-0 flex-1 sm:min-w-[260px]"
      data-testid={testId}
    />
  );
}
