'use client';

import { useState, useRef, useCallback } from 'react';

/**
 * Configuration options for the swipe gesture hook
 */
export interface UseSwipeGestureProps {
  /** Optional callback when the sheet is dismissed via swipe */
  onDismiss?: () => void;
  /** Distance in pixels required to trigger a dismiss */
  dismissThreshold?: number;
  /** Velocity in px/ms required to trigger a dismiss */
  velocityThreshold?: number;
  /** Resistance factor when swiping in the non-dismissible direction */
  resistance?: number;
}

/**
 * Reusable hook for managing touch swipe gestures (e.g., for bottom sheets or drawers).
 * Handles touch start, move, and end events, calculates velocity, and applies rubber-band resistance.
 */
export function useSwipeGesture({
  onDismiss,
  dismissThreshold = 80,
  velocityThreshold = 0.45,
  resistance = 0.2
}: UseSwipeGestureProps = {}) {
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const currentDeltaY = useRef<number>(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setDragOffsetY(0);
    setIsDragging(false);
  }, []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    currentDeltaY.current = 0;
    setIsDragging(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    const currentY = touch.clientY;
    const delta = currentY - touchStartY.current;
    
    if (delta > 0) {
      currentDeltaY.current = delta;
      setDragOffsetY(delta);
    } else {
      // Rubber-band resistance when pulling up
      const resisted = delta * resistance;
      currentDeltaY.current = resisted;
      setDragOffsetY(resisted);
    }
  }, [resistance]);

  const onTouchEnd = useCallback(() => {
    setIsDragging(false);
    const delta = currentDeltaY.current;
    const elapsed = Math.max(1, Date.now() - touchStartTime.current);
    const velocity = delta / elapsed; // px per ms

    if (delta > dismissThreshold || velocity > velocityThreshold) {
      // Dismiss threshold met
      setIsOpen(false);
      onDismiss?.();
    }
    setDragOffsetY(0);
    currentDeltaY.current = 0;
  }, [dismissThreshold, velocityThreshold, onDismiss]);

  return {
    sheetTranslateY: Math.max(0, dragOffsetY),
    isDragging,
    isOpen,
    open,
    close,
    toggle,
    setIsOpen,
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd
    }
  };
}
