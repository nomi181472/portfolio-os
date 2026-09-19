/**
 * types/portfolio.ts
 *
 * The content model. Every category in the portfolio is a specialisation of one
 * `Entity` primitive, which is why a new category (Talks, Patents, Datasets)
 * can be added without touching the renderer.
 *
 * These types are derived from the Zod schema in lib/schema.ts so that the
 * compile-time and run-time models can never drift apart.
 */

import type { z } from 'zod';
import type {
  PortfolioSchema,
  EntitySchema,
  MediaSchema,
  OverlayBoxSchema,
  LinkSchema,
  SourceSchema,
  PeriodSchema,
  EvidenceSchema,
  TimelineEventSchema,
  ProfileSchema,
  ExperienceSchema,
  EducationSchema,
  ProductSchema,
  ProjectSchema,
  ResearchSchema,
  PublicationSchema,
  SkillSchema,
  StartupSchema,
  AwardSchema,
  CertificationSchema,
  LeadershipSchema,
  VolunteeringSchema,
  LanguageSchema,
  FutureSchema,
} from '@/lib/schema';

export type Portfolio = z.infer<typeof PortfolioSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type Media = z.infer<typeof MediaSchema>;
export type OverlayBox = z.infer<typeof OverlayBoxSchema>;
export type Link = z.infer<typeof LinkSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Period = z.infer<typeof PeriodSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export type Profile = z.infer<typeof ProfileSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Research = z.infer<typeof ResearchSchema>;
export type Publication = z.infer<typeof PublicationSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Startup = z.infer<typeof StartupSchema>;
export type Award = z.infer<typeof AwardSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Leadership = z.infer<typeof LeadershipSchema>;
export type Volunteering = z.infer<typeof VolunteeringSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type Future = z.infer<typeof FutureSchema>;

/** Every collection the portfolio ships with. Add a key here to add a category. */
export const ENTITY_KINDS = [
  'experience',
  'education',
  'products',
  'projects',
  'research',
  'publications',
  'skills',
  'awards',
  'certifications',
  'leadership',
  'volunteering',
  'languages',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

/** A resolved entity: the raw record plus its position in the graph. */
export interface ResolvedEntity<T extends Entity = Entity> {
  kind: EntityKind;
  data: T;
  href: string;
  /** Outbound references this entity declared, resolved to real entities. */
  relations: RelationEdge[];
  /** Entities that reference this one. Derived, never authored. */
  backlinks: RelationEdge[];
  /** Declared references whose target does not exist in the JSON. */
  danglingRefs: string[];
}

export interface RelationEdge {
  kind: EntityKind;
  id: string;
  name: string;
  href: string;
  /** Which field created the edge, e.g. `relatedSkills`. */
  via: string;
}

export type DataSourceState =
  | { status: 'local'; note?: string }
  | { status: 'remote'; url: string; fetchedAt: string }
  | { status: 'fallback'; url: string; reason: string };

export interface PortfolioBundle {
  data: Portfolio;
  source: DataSourceState;
  /** Non-fatal problems: dangling references, empty collections, odd dates. */
  warnings: string[];
}
