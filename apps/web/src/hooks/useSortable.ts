import { useState, useMemo } from 'react';

interface SortState<T> {
  key: keyof T | null;
  direction: 'asc' | 'desc';
}

export function useSortable<T>(items: T[]) {
  const [sort, setSort] = useState<SortState<T>>({ key: null, direction: 'asc' });

  const sorted = useMemo(() => {
    if (!sort.key) return items;
    const copy = [...items];
    copy.sort((a, b) => {
      const aVal = a[sort.key!];
      const bVal = b[sort.key!];
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [items, sort]);

  const toggleSort = (key: keyof T) => {
    if (sort.key === key) {
      setSort(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }));
    } else {
      setSort({ key, direction: 'asc' });
    }
  };

  return { sorted, sort, toggleSort };
}
