'use client';

import { useState, useCallback } from 'react';

export interface Ripple {
  id: string;
  x: number;
  y: number;
}

/**
 * Reusable hook for managing ripple effects on touch or click events.
 */
export function useRipple(duration = 450) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const triggerRipple = useCallback((id: string, e: React.TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    setRipples((prev) => [...prev, { id: `${id}-${Date.now()}`, x, y }]);
    
    setTimeout(() => {
      setRipples((prev) => prev.slice(1));
    }, duration);
  }, [duration]);

  return { ripples, triggerRipple };
}
