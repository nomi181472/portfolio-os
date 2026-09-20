/**
 * lib/schema.ts
 *
 * The contract. portfolio.json is the source of truth for all content, and this
 * file is the only place that decides what a valid portfolio.json is.
 *
 * Design rules:
 *  - Almost everything is optional. A forked portfolio with three fields should
 *    render, not error. Required fields are limited to what the router and the
 *    reference resolver genuinely cannot work without: `id`, `slug`, `name`.
 *  - References between entities are plain id strings. Resolution happens in
 *    lib/graph.ts after validation, so a broken reference degrades to a notice
 *    rather than a failed parse.
 *  - Unknown keys are stripped, not rejected, so that a portfolio.json written
 *    against a newer schema still loads on an older deployment.
 */

import { z } from 'zod';

export const SCHEMA_VERSION = '1.0';

/* ------------------------------------------------------------------ atoms */

const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by single hyphens');

/**
 * URLs are validated for shape *and* protocol. javascript:, data: and file:
 * never reach the DOM — this is the choke point for §98.
 */
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];
export const safeUrl = z
  .string()
  .min(1)
  .superRefine((value, ctx) => {
    if (value.startsWith('/')) return; // site-relative asset
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Not a valid URL. Use https://… or a path starting with /' });
      return;
    }
    if (!SAFE_PROTOCOLS.includes(parsed.protocol)) {
      ctx.addIssue({
        code: 'custom',
        message: `Protocol "${parsed.protocol}" is not allowed. Use ${SAFE_PROTOCOLS.join(', ')}`,
      });
    }
  });

/** ISO date, or a year-month, or a bare year. Presentation formats it later. */
export const isoish = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'Expected YYYY, YYYY-MM or YYYY-MM-DD');

export const PeriodSchema = z.object({
  startDate: isoish.optional(),
  endDate: isoish.optional(),
  ongoing: z.boolean().default(false),
});

/* --------------------------------------------------------------- statuses */

/** One status vocabulary for the whole portfolio (§100). */
export const StatusSchema = z.enum([
  'live',
  'active',
  'in-progress',
  'prototype',
  'experimental',
  'in-development',
  'coming-soon',
  'archived',
  'private',
  'draft',
  'concept',
]);

/** Research moves through evidence states, which are deliberately not statuses. */
export const ResearchStateSchema = z.enum([
  'idea',
  'hypothesis',
  'experiment',
  'testing',
  'observation',
  'finding',
  'validated',
  'unresolved',
  'archived',
]);

/** Future work is labelled by certainty so ambition never reads as achievement. */
export const HorizonSchema = z.enum(['current', 'exploring', 'planned', 'long-term']);

export const SourceSchema = z.object({
  type: z.enum(['open-source', 'source-available', 'closed-source', 'private', 'prototype', 'experimental']),
  url: safeUrl.optional(),
  license: z.string().optional(),
  note: z.string().optional(),
});

export const VisibilitySchema = z.enum(['public', 'private', 'disabled', 'coming-soon']);

/* ---------------------------------------------------------- media & links */

export const OverlayBoxSchema = z.object({
  /** Left offset as a percentage (0-100) or pixel coordinate */
  left: z.number(),
  /** Top offset as a percentage (0-100) or pixel coordinate */
  top: z.number(),
  /** Width as a percentage (0-100) or pixel coordinate */
  width: z.number(),
  /** Height as a percentage (0-100) or pixel coordinate */
  height: z.number(),
  label: z.string().optional(),
  color: z.string().optional(),
  /** Optional source image pixel width/height for converting pixel coordinates to % */
  imgWidth: z.number().optional(),
  imgHeight: z.number().optional(),
});

export const MediaSchema = z.object({
  type: z.enum(['image', 'video', 'gif', 'svg', 'iframe', 'embed', 'document', 'diagram']),
  url: safeUrl,
  title: z.string().optional(),
  caption: z.string().optional(),
  alt: z.string().optional(),
  poster: safeUrl.optional(),
  /** Aspect ratio as width/height, e.g. 1.777. Prevents layout shift. */
  ratio: z.number().positive().optional(),
  visibility: VisibilitySchema.default('public'),
  order: z.number().int().optional(),
  /** Dynamic client-side bounding box overlay */
  box: OverlayBoxSchema.optional(),
  boxes: z.array(OverlayBoxSchema).optional(),
});

export const LinkSchema = z.object({
  label: z.string().min(1),
  url: safeUrl,
  type: z
    .enum(['demo', 'repository', 'documentation', 'article', 'video', 'download', 'verification', 'website', 'contact'])
    .default('website'),
  visibility: VisibilitySchema.default('public'),
});

export const EvidenceSchema = z.object({
  claim: z.string().min(1),
  /** What backs the claim up: entity ids, links, or media. */
  supports: z.array(z.string()).default([]),
  links: z.array(LinkSchema).default([]),
  note: z.string().optional(),
});

export const TimelineEventSchema = z.object({
  date: isoish,
  label: z.string().min(1),
  detail: z.string().optional(),
});

/* ------------------------------------------------------- entity primitive */

/**
 * Every record in every collection satisfies this. The renderer only ever needs
 * to understand `EntitySchema`; category-specific fields are additive.
 */
export const EntitySchema = z.object({
  id: z.string().min(1),
  slug: slug,
  name: z.string().min(1),
  /** One line. Shown at preview depth. */
  summary: z.string().optional(),
  /** A paragraph or two. Shown at detail depth. */
  description: z.string().optional(),
  /** Long-form markdown. Shown at deep-dive depth only. */
  body: z.string().optional(),
  status: StatusSchema.optional(),
  organisation: z.string().optional(),
  period: PeriodSchema.optional(),
  tags: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  links: z.array(LinkSchema).default([]),
  media: z.array(MediaSchema).default([]),
  evidence: z.array(EvidenceSchema).default([]),
  timeline: z.array(TimelineEventSchema).default([]),
  featured: z.boolean().default(false),
  order: z.number().int().optional(),
  /** Outbound references, by entity id. */
  relatedSkills: z.array(z.string()).default([]),
  relatedProducts: z.array(z.string()).default([]),
  relatedProjects: z.array(z.string()).default([]),
  relatedResearch: z.array(z.string()).default([]),
  relatedPublications: z.array(z.string()).default([]),
  relatedExperience: z.array(z.string()).default([]),
  relatedEducation: z.array(z.string()).default([]),
  relatedAwards: z.array(z.string()).default([]),
});

/* ----------------------------------------------------------- collections */

export const ProfileSchema = z.object({
  name: z.string().min(1),
  /** e.g. "Computer vision and distributed systems". Not a job title. */
  discipline: z.string().optional(),
  /** One precise sentence. This is the only claim on the first screen. */
  positioning: z.string().optional(),
  location: z.string().optional(),
  avatar: safeUrl.optional(),
  /** The mission briefing, revealed in layers (§14). */
  briefing: z
    .object({
      focus: z.string().optional(),
      domains: z.array(z.string()).default([]),
      yearsActive: z.number().int().positive().optional(),
      philosophy: z.string().optional(),
      specialisation: z.string().optional(),
      leadership: z.string().optional(),
      industries: z.array(z.string()).default([]),
    })
    .default({ domains: [], industries: [] }),
  links: z.array(LinkSchema).default([]),
  email: z.string().email().optional(),
});

export const ExperienceSchema = EntitySchema.extend({
  organisation: z.string().optional(),
  role: z.string().optional(),
  employmentType: z.string().optional(),
  location: z.string().optional(),
  impact: z.string().optional(),
  responsibilities: z.array(z.string()).default([]),
  systems: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  teamScope: z.string().optional(),
});

export const EducationSchema = EntitySchema.extend({
  institution: z.string().optional(),
  degree: z.string().optional(),
  field: z.string().optional(),
  specialisation: z.string().optional(),
  subjects: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
});

export const ArchitectureSchema = z.object({
  summary: z.string().optional(),
  diagram: MediaSchema.optional(),
  layers: z
    .array(
      z.object({
        name: z.string().min(1),
        detail: z.string().optional(),
        technologies: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  decisions: z
    .array(z.object({ title: z.string().min(1), rationale: z.string().optional(), tradeoff: z.string().optional() }))
    .default([]),
});

export const ProductSchema = EntitySchema.extend({
  tagline: z.string().optional(),
  category: z.string().optional(),
  source: SourceSchema.default({ type: 'closed-source' }),
  features: z
    .array(z.object({ name: z.string().min(1), detail: z.string().optional() }))
    .default([]),
  architecture: ArchitectureSchema.optional(),
  metrics: z.array(z.object({ label: z.string(), value: z.string(), note: z.string().optional() })).default([]),
});

export const ProjectSchema = EntitySchema.extend({
  concept: z.string().optional(),
  problem: z.string().optional(),
  hypothesis: z.string().optional(),
  approach: z.string().optional(),
  implementation: z.string().optional(),
  results: z.string().optional(),
  /** Kept deliberately: a lab that never fails is not a lab (§22). */
  failures: z.array(z.string()).default([]),
  lessons: z.array(z.string()).default([]),
  futureWork: z.array(z.string()).default([]),
  source: SourceSchema.optional(),
  architecture: ArchitectureSchema.optional(),
});

export const FindingSchema = z.object({
  date: isoish,
  observation: z.string().min(1),
  evidence: z.string().optional(),
  /** How much weight the author puts on it today. Revisable. */
  confidence: z.enum(['low', 'moderate', 'high']).default('moderate'),
  revisionOf: z.string().optional(),
  supersededBy: z.string().optional(),
  id: z.string().optional(),
});

export const ResearchSchema = EntitySchema.extend({
  state: ResearchStateSchema.default('idea'),
  question: z.string().optional(),
  abstract: z.string().optional(),
  findings: z.array(FindingSchema).default([]),
  references: z
    .array(z.object({ citation: z.string().min(1), url: safeUrl.optional() }))
    .default([]),
  datasets: z.array(z.object({ name: z.string(), url: safeUrl.optional(), note: z.string().optional() })).default([]),
  lastUpdated: isoish.optional(),
  readingMinutes: z.number().int().positive().optional(),
});

export const PublicationSchema = EntitySchema.extend({
  authors: z.array(z.string()).default([]),
  venue: z.string().optional(),
  abstract: z.string().optional(),
  doi: z.string().optional(),
  citation: z.string().optional(),
  keywords: z.array(z.string()).default([]),
});

export const SkillSchema = EntitySchema.extend({
  category: z.string().optional(),
  /** Deliberately coarse. There are no percentages (§24). */
  depth: z.enum(['working', 'proficient', 'deep', 'specialist']).optional(),
  firstUsed: isoish.optional(),
  context: z.string().optional(),
  level: z.string().optional(),
  reading: z.string().optional(),
  writing: z.string().optional(),
  agentic: z.string().optional(),
  aiAssisted: z.string().optional(),
  independent: z.string().optional(),
  design: z.string().optional(),
  support: z.string().optional(),
  proficiency: z.string().optional(),
  handling: z.string().optional(),
});

export const StartupSchema = EntitySchema.extend({
  logo: safeUrl.optional(),
  vision: z.string().optional(),
  mission: z.string().optional(),
  problem: z.string().optional(),
  /** What exists right now. Never mixed with the roadmap. */
  currentReality: z.array(z.string()).default([]),
  /** What is intended. Rendered under a different heading, always. */
  ambition: z.array(z.string()).default([]),
  principles: z.array(z.string()).default([]),
  roadmap: z
    .array(z.object({ horizon: HorizonSchema, label: z.string().min(1), detail: z.string().optional() }))
    .default([]),
}).partial({ slug: true });

export const AwardSchema = EntitySchema.extend({
  organisation: z.string().optional(),
  date: isoish.optional(),
  context: z.string().optional(),
  reason: z.string().optional(),
});

export const CertificationSchema = EntitySchema.extend({
  issuer: z.string().optional(),
  issued: isoish.optional(),
  expires: isoish.optional(),
  credentialId: z.string().optional(),
  verificationUrl: safeUrl.optional(),
});

export const LeadershipSchema = EntitySchema.extend({
  scope: z.string().optional(),
  organisation: z.string().optional(),
  teams: z.array(z.object({ name: z.string(), size: z.number().int().positive().optional(), focus: z.string().optional() })).default([]),
  ownership: z.array(z.string()).default([]),
  decisions: z.array(z.string()).default([]),
  mentoring: z.string().optional(),
});

export const VolunteeringSchema = EntitySchema.extend({
  organisation: z.string().optional(),
  role: z.string().optional(),
  activity: z.string().optional(),
  contribution: z.string().optional(),
  outcome: z.string().optional(),
});

export const LanguageSchema = EntitySchema.extend({
  proficiency: z.enum(['native', 'fluent', 'professional', 'conversational', 'elementary']).optional(),
  professionalContext: z.string().optional(),
  reading: z.string().optional(),
  writing: z.string().optional(),
});

export const FutureSchema = z.object({
  statement: z.string().optional(),
  directions: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        horizon: HorizonSchema,
        detail: z.string().optional(),
        relatedSkills: z.array(z.string()).default([]),
        relatedResearch: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

/* -------------------------------------------------------------- document */

export const PortfolioSchema = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
  /** Set true on the shipped sample so the UI can say so out loud (§96). */
  exampleContent: z.boolean().default(false),
  profile: ProfileSchema,
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  products: z.array(ProductSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  research: z.array(ResearchSchema).default([]),
  publications: z.array(PublicationSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  startup: StartupSchema.optional(),
  awards: z.array(AwardSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  leadership: z.array(LeadershipSchema).default([]),
  volunteering: z.array(VolunteeringSchema).default([]),
  languages: z.array(LanguageSchema).default([]),
  future: FutureSchema.optional(),
});
