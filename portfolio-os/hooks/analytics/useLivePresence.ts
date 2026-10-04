import { useState, useEffect } from 'react';

export function useLivePresence(initialLive: { online: number; activeSections: { section: string; count: number }[] }) {
  const [live, setLive] = useState(initialLive);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      setIsPolling(true);
      try {
        const res = await fetch('/api/analytics/admin/live');
        if (res.ok) {
          const data = await res.json();
          if (mounted && data) {
            setLive(data);
          }
        }
      } catch {
        /* silent on failure */
      } finally {
        if (mounted) setIsPolling(false);
      }
    };

    const interval = setInterval(poll, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { activeCount: live.online, activeSections: live.activeSections, isPolling, live };
}
