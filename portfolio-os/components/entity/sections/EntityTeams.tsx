import { Disclosure } from '../Disclosure';
import type { SectionProps } from './registry';

export function EntityTeams({ entity }: SectionProps) {
  const data = entity.data as Record<string, unknown>;
  if (!Array.isArray(data.teams) || !data.teams.length) return null;
  return (
    <Disclosure label="Teams">
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--space-tight)' }}>
        {(data.teams as { name: string; size?: number; focus?: string }[]).map((team) => (
          <li key={team.name}>
            <span style={{ color: 'var(--ink-bright)' }}>{team.name}</span>
            {team.size ? <span className="meta"> · {team.size} engineers</span> : null}
            {team.focus ? <span className="label"> — {team.focus}</span> : null}
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
