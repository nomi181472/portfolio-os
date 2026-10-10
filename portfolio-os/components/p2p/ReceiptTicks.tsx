import React from 'react';
import type { P2PMessageStatus } from '@/lib/p2p/types';
import styles from './ReceiptTicks.module.css';

interface ReceiptTicksProps {
  status?: P2PMessageStatus;
  className?: string;
}

/**
 * ReceiptTicks: Visual message status indicators.
 * - 'sent' (✓): Single gray tick (dispatched into WebRTC / signaling relay)
 * - 'delivered' (✓✓): Double gray tick (received by recipient device)
 * - 'read' (✓✓): Double blue tick (recipient room is active & viewed)
 */
export function ReceiptTicks({ status = 'sent', className }: ReceiptTicksProps) {
  if (status === 'read') {
    return (
      <span
        className={`${styles.tickWrapper} ${styles.tickRead} ${className || ''}`}
        title="Read (seen by recipient)"
        aria-label="Read"
      >
        <svg
          width="16"
          height="11"
          viewBox="0 0 19 11"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={styles.svg}
        >
          <path
            d="M1.5 5.5L5 9L12.5 1.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 5.5L10 9L17.5 1.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (status === 'delivered') {
    return (
      <span
        className={`${styles.tickWrapper} ${styles.tickDelivered} ${className || ''}`}
        title="Delivered to recipient"
        aria-label="Delivered"
      >
        <svg
          width="16"
          height="11"
          viewBox="0 0 19 11"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={styles.svg}
        >
          <path
            d="M1.5 5.5L5 9L12.5 1.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 5.5L10 9L17.5 1.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  // Default: sent (single tick)
  return (
    <span
      className={`${styles.tickWrapper} ${styles.tickSent} ${className || ''}`}
      title="Sent"
      aria-label="Sent"
    >
      <svg
        width="13"
        height="11"
        viewBox="0 0 14 11"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
      >
        <path
          d="M1.5 5.5L5 9L12.5 1.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
