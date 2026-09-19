/**
 * lib/categories.ts
 *
 * One registry describing every category: what it is called, what it means,
 * which metaphor mark stands for it, and which fields the detail view should
 * render. Adding "Talks" or "Patents" later is an entry here plus a collection
 * in the schema — no new routes, no new components (§105).
 *
 * The `question` is the phrasing used in Explore mode (§13). It is written as
 * the visitor's question, not as a section heading, because that is how people
 * actually arrive: they want to know what you build, not to read a nav label.
 */

import type { EntityKind } from '@/types/portfolio';

export type MetaphorMark =
  | 'artifact'
  | 'experiment'
  | 'notebook'
  | 'route'
  | 'foundation'
  | 'instrument'
  | 'library'
  | 'seal'
  | 'milestone'
  | 'network'
  | 'contribution'
  | 'channel'
  | 'trajectory'
  | 'incubator'
  | 'copy';

export interface CategoryDefinition {
  kind: EntityKind;
  /** Plural, sentence case. Used as the page heading. */
  label: string;
  singular: string;
  /** The metaphor, stated plainly enough to be a page subtitle. */
  metaphor: string;
  mark: MetaphorMark;
  question: string;
  /** One line explaining what belongs in this collection and what does not. */
  note: string;
  /** Detail sections, in order. Absent data is skipped, never rendered empty. */
  sections: DetailSection[];
}

export type DetailSection =
  | 'description'
  | 'impact'
  | 'responsibilities'
  | 'systems'
  | 'achievements'
  | 'features'
  | 'architecture'
  | 'metrics'
  | 'lab-notes'
  | 'findings'
  | 'abstract'
  | 'references'
  | 'datasets'
  | 'subjects'
  | 'credential'
  | 'teams'
  | 'body'
  | 'media'
  | 'evidence'
  | 'timeline'
  | 'links';

const COMMON: DetailSection[] = ['media', 'evidence', 'timeline', 'links'];

export const CATEGORIES: Record<EntityKind, CategoryDefinition> = {
  products: {
    kind: 'products',
    label: 'Products',
    singular: 'Product',
    metaphor: 'Engineered artifacts, held in a vault and taken out to be inspected',
    mark: 'artifact',
    question: 'What have I built?',
    note: 'Things built to be used by someone other than me. A product has users, a status, and a stated source position.',
    sections: ['description', 'features', 'architecture', 'metrics', ...COMMON],
  },
  projects: {
    kind: 'projects',
    label: 'Projects',
    singular: 'Project',
    metaphor: 'Laboratory experiments, including the ones that did not work',
    mark: 'experiment',
    question: 'What have I tried?',
    note: 'Things built to answer a question. Failures stay on the record, because a lab that only reports successes is not reporting.',
    sections: ['description', 'lab-notes', 'architecture', ...COMMON],
  },
  research: {
    kind: 'research',
    label: 'Research',
    singular: 'Research',
    metaphor: 'A laboratory notebook, open at the current page',
    mark: 'notebook',
    question: 'What am I investigating?',
    note: 'Open lines of enquiry and their findings, each labelled with how far it has actually got.',
    sections: ['abstract', 'findings', 'body', 'datasets', 'references', ...COMMON],
  },
  experience: {
    kind: 'experience',
    label: 'Experience',
    singular: 'Station',
    metaphor: 'An engineering route, station by station',
    mark: 'route',
    question: 'Where have I worked?',
    note: 'Each organisation is a station on a route: what the system was, what I owned, what changed.',
    sections: ['impact', 'description', 'responsibilities', 'systems', 'achievements', ...COMMON],
  },
  education: {
    kind: 'education',
    label: 'Education',
    singular: 'Foundation',
    metaphor: 'Structural layers, the ones everything above rests on',
    mark: 'foundation',
    question: 'What was I trained in?',
    note: 'Formal grounding, linked forward to the work it made possible.',
    sections: ['description', 'subjects', 'achievements', ...COMMON],
  },
  skills: {
    kind: 'skills',
    label: 'Skills',
    singular: 'Instrument',
    metaphor: 'Instruments on a bench, each with a record of use',
    mark: 'instrument',
    question: 'What can I work with?',
    note: 'No ratings. A skill is described by where it has actually been used, and that evidence is derived, not claimed.',
    sections: ['description', ...COMMON],
  },
  publications: {
    kind: 'publications',
    label: 'Publications',
    singular: 'Publication',
    metaphor: 'A technical library, shelved and citable',
    mark: 'library',
    question: 'What have I published?',
    note: 'Peer-reviewed and formally published work, with citations and venues.',
    sections: ['abstract', 'body', 'references', ...COMMON],
  },
  certifications: {
    kind: 'certifications',
    label: 'Certifications',
    singular: 'Credential',
    metaphor: 'Sealed credentials, each with a way to check it',
    mark: 'seal',
    question: 'What has been verified?',
    note: 'Every entry carries an issuer and, where one exists, a verification link.',
    sections: ['credential', 'description', ...COMMON],
  },
  awards: {
    kind: 'awards',
    label: 'Awards',
    singular: 'Milestone',
    metaphor: 'Markers along the route, not a trophy cabinet',
    mark: 'milestone',
    question: 'What has been recognised?',
    note: 'Recognition with its context: what it was for, and what work it points back to.',
    sections: ['description', ...COMMON],
  },
  leadership: {
    kind: 'leadership',
    label: 'Leadership',
    singular: 'Network',
    metaphor: 'A systems network: teams, ownership, decisions',
    mark: 'network',
    question: 'What have I led?',
    note: 'Scope and decisions rather than headcount theatre. No named reports, ever.',
    sections: ['description', 'teams', 'achievements', ...COMMON],
  },
  volunteering: {
    kind: 'volunteering',
    label: 'Volunteering',
    singular: 'Contribution',
    metaphor: 'A contribution network',
    mark: 'contribution',
    question: 'What have I contributed to?',
    note: 'Described by contribution and outcome, not by job-shaped formatting.',
    sections: ['description', ...COMMON],
  },
  languages: {
    kind: 'languages',
    label: 'Languages',
    singular: 'Channel',
    metaphor: 'Communication channels, with the context each is used in',
    mark: 'channel',
    question: 'How can I communicate?',
    note: 'Proficiency stated in words, with the professional context it applies to.',
    sections: ['description', ...COMMON],
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

export function categoryFor(kind: string): CategoryDefinition | undefined {
  return (CATEGORIES as Record<string, CategoryDefinition>)[kind];
}

/**
 * Categories that render long-form markdown, derived from the section profiles
 * rather than listed a second time. These get their own route segment so the
 * reader's dependencies stay off every other entity page (§78); a category that
 * gains a `body` section gains a reading route by adding one folder, and one
 * that loses it stops paying for the reader automatically.
 */
export const READING_KINDS: EntityKind[] = CATEGORY_LIST.filter((category) =>
  category.sections.includes('body'),
).map((category) => category.kind);

export function isReadingKind(kind: string): boolean {
  return READING_KINDS.includes(kind as EntityKind);
}

/** Explore mode's conceptual entry points, resolving into real collections. */
export const EXPLORE_ROUTES = [
  { question: 'Where I have worked', href: '/experience', kind: 'experience' as EntityKind },
  { question: 'What I build', href: '/products', kind: 'products' as EntityKind },
  { question: 'What I try', href: '/projects', kind: 'projects' as EntityKind },
  { question: 'What I research', href: '/research', kind: 'research' as EntityKind },
  { question: 'What I work with', href: '/skills', kind: 'skills' as EntityKind },
  { question: 'What has been recognised', href: '/awards', kind: 'awards' as EntityKind },
  { question: 'Where I am going', href: '/future', kind: undefined },
] as const;
