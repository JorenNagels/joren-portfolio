'use client';

import { useEffect, useState } from 'react';

/** Current time in Ghent, so people abroad know whether I'm likely awake. */
export function GhentClock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const fmt = () => new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }).format(new Date());
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 20_000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{now ?? '--:--'}</span>;
}
