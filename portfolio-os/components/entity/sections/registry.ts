import type { ComponentType } from 'react';
import type { ResolvedEntity } from '@/types/portfolio';

// Import all sections
import { EntityHeader } from './EntityHeader';
import { EntityDescription } from './EntityDescription';
import { EntityImpact } from './EntityImpact';
import { EntityResponsibilities } from './EntityResponsibilities';
import { EntitySystems } from './EntitySystems';
import { EntityAchievements } from './EntityAchievements';
import { EntityFeatures } from './EntityFeatures';
import { EntityIntegrations } from './EntityIntegrations';
import { EntityArchitecture } from './EntityArchitecture';
import { EntityMetricsGrid } from './EntityMetricsGrid';
import { EntityLabNotes } from './EntityLabNotes';
import { EntityFindings } from './EntityFindings';
import { EntityAbstract } from './EntityAbstract';
import { EntityReferences } from './EntityReferences';
import { EntityDatasets } from './EntityDatasets';
import { EntitySubjects } from './EntitySubjects';
import { EntityCredentials } from './EntityCredentials';
import { EntityTeams } from './EntityTeams';
import { EntityMedia } from './EntityMedia';
import { EntityEvidence } from './EntityEvidence';
import { EntityTimeline } from './EntityTimeline';
import { EntityLinks } from './EntityLinks';

export type SectionProps = {
  entity: ResolvedEntity;
  siteUrl?: string;
};

export const SECTION_REGISTRY: Record<string, ComponentType<SectionProps>> = {
  description: EntityDescription,
  impact: EntityImpact,
  responsibilities: EntityResponsibilities,
  systems: EntitySystems,
  achievements: EntityAchievements,
  features: EntityFeatures,
  integrations: EntityIntegrations,
  architecture: EntityArchitecture,
  metrics: EntityMetricsGrid,
  'lab-notes': EntityLabNotes,
  findings: EntityFindings,
  abstract: EntityAbstract,
  references: EntityReferences,
  datasets: EntityDatasets,
  subjects: EntitySubjects,
  credential: EntityCredentials,
  teams: EntityTeams,
  media: EntityMedia,
  evidence: EntityEvidence,
  timeline: EntityTimeline,
  links: EntityLinks,
  // body is explicitly handled as null in original component, we'll map it to a null returning component or skip
  body: () => null
};
