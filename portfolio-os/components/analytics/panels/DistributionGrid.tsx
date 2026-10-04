'use client';

import { DonutChart } from '../charts/DonutChart';

interface DistributionGridProps {
  devices: { key: string; value: number }[];
  browsers: { key: string; value: number }[];
  countries: { key: string; value: number }[];
}

export function DistributionGrid({ devices, browsers, countries }: DistributionGridProps) {
  return (
    <div
      className="analytics-breakdown-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
        gap: 'var(--space)',
      }}
    >
      <section
        style={{
          background: 'var(--surface-raised)',
          border: 'var(--border-hair) solid var(--rule)',
          borderRadius: 'var(--radius-frame)',
          padding: 'var(--space)',
        }}
      >
        <DonutChart
          title="Device Form Factors"
          data={devices}
          emptyLabel="No device data"
        />
      </section>

      <section
        style={{
          background: 'var(--surface-raised)',
          border: 'var(--border-hair) solid var(--rule)',
          borderRadius: 'var(--radius-frame)',
          padding: 'var(--space)',
        }}
      >
        <DonutChart
          title="Browsers"
          data={browsers}
          emptyLabel="No browser data"
        />
      </section>

      <section
        style={{
          background: 'var(--surface-raised)',
          border: 'var(--border-hair) solid var(--rule)',
          borderRadius: 'var(--radius-frame)',
          padding: 'var(--space)',
        }}
      >
        <DonutChart
          title="Geographic Origin (Country)"
          data={countries}
          emptyLabel="No geo data"
        />
      </section>
    </div>
  );
}
