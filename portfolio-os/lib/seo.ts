/**
 * lib/seo.ts
 *
 * Two problems lived here.
 *
 * First: the root layout declared `alternates: { canonical: '/' }`, and Next merges
 * parent metadata field by field, so `/explore`, `/future`, `/startup`,
 * `/colophon` and `/copy` all told search engines they *were* the home page.
 * Those pages were consolidation candidates. Each route now states its own
 * canonical and the layout states none at all.
 *
 * Second: there was no structured data anywhere. A portfolio is one of the
 * easiest sites to describe precisely — a Person, the works they made, where they
 * worked, what they published — so the schema.org builders live here rather than
 * being scattered through page files, and each is derived from the content model
 * rather than hand-written. If a collection is empty its node is absent, so the
 * graph can never claim more than the site has.
 */
import type { Metadata } from 'next';
import { portfolioConfig } from '@/config/portfolio.config';
import { CATEGORIES, type CategoryDefinition } from '@/lib/categories';
import type { Portfolio, Profile, ResolvedEntity } from '@/types/portfolio';

/**
 * The origin every absolute URL is built from. Configured rather than inferred so
 * a preview deployment cannot accidentally canonicalise itself into the index.
 */
export const siteUrl = portfolioConfig.site.url.replace(/\/$/, '');

/** Next wants a URL instance, not a string. */
export const metadataBase = new URL(siteUrl);

/** Resolves a site-relative path against the configured origin. */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

interface StaticPage {
  title: string;
  description: string;
  /** Required, not optional: a page that cannot name its own URL is not published. */
  path: string;
  /** `article` for prose you would cite; `website` for everything else. */
  type?: 'website' | 'article';
  /** Defaults to the generated card, so a page never ships a card-less share. */
  images?: string[];
}

/**
 * Metadata for a route that is not an entity.
 *
 * Every field is set on every call rather than inherited from the root layout,
 * because Next *replaces* an `openGraph` block rather than merging it: a page that
 * sets only its own title and image silently loses `og:type`, `og:site_name` and
 * `og:locale` if those live upstream — the home page did exactly that. Writing the
 * whole block here means one page's customisation cannot delete another's defaults.
 *
 * The image defaults to the generated card because a share with no picture is the
 * common case, and a Twitter `summary_large_image` card with no image is a card that
 * renders as a text link.
 */
export function staticPage({
  title,
  description,
  path,
  type = 'website',
  images = [absoluteUrl('/opengraph-image')],
}: StaticPage): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      type,
      url,
      siteName: portfolioConfig.site.title,
      locale: portfolioConfig.site.locale.replace('-', '_'),
      images,
    },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

/** Drops keys that carry nothing, so the emitted graph has no empty nodes. */
function compact<T extends Record<string, unknown>>(value: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null) continue;
    if (Array.isArray(entry) && entry.length === 0) continue;
    if (typeof entry === 'object' && !Array.isArray(entry) && Object.keys(entry).length === 0) continue;
    result[key] = entry;
  }
  return result as T;
}

type Json = Record<string, unknown>;

const PERSON_ID = `${siteUrl}/#person`;
const WEBSITE_ID = `${siteUrl}/#website`;

/** Profile links, normalised into `sameAs`. The identity resolves to one person. */
function sameAs(profile: Profile): string[] {
  return profile.links
    .map((link) => link.url)
    .filter((url) => /^https?:\/\//.test(url))
    .slice(0, 12);
}

/**
 * The person the whole site is about. Emitted once, on the home page: repeating a
 * `#person` node on every route is how you end up with several contradictory
 * descriptions of the same human.
 */
export function personEntity(profile: Profile, portfolio: Portfolio): Json {
  /*
   * Only citable work appears here, and as an ItemList rather than a bare array
   * because schema.org wants positions — a crawler that sees an unordered pile
   * cannot tell what the author chose to lead with.
   */
  const works = (['publications', 'research'] as const)
    .flatMap((kind) => portfolio[kind].map((item) => ({ kind, item })))
    .slice(0, 24)
    .map(({ kind, item }, index) =>
      compact({
        '@type': kind === 'publications' ? 'ScholarlyArticle' : 'CreativeWork',
        position: index + 1,
        name: item.name,
        url: absoluteUrl(`/${kind}/${item.slug}`),
        abstract: item.summary,
      }),
    );

  // Only live roles belong in `worksFor`. History has its own property, and
  // mixing the two is how a site claims someone is still somewhere they left.
  const current = portfolio.experience
    .filter((record) => record.period?.ongoing)
    .slice(0, 8)
    .map((record) =>
      compact({
        '@type': 'Role',
        roleName: record.role,
        startDate: record.period?.startDate,
        worksFor: record.organisation
          ? {
              '@type': 'Organization',
              name: record.organisation,
              url: absoluteUrl(`/experience/${record.slug}`),
            }
          : undefined,
      }),
    );

  const knowsAbout = Array.from(
    new Set([...(profile.briefing?.domains ?? []), ...(profile.briefing?.industries ?? [])]),
  ).slice(0, 16);

  const education = portfolio.education.map((edu) =>
    compact({
      '@type': 'EducationalOrganization',
      name: edu.institution,
    }),
  );

  return compact({
    '@type': 'Person',
    '@id': PERSON_ID,
    name: profile.name,
    url: absoluteUrl('/'),
    description: profile.positioning,
    jobTitle: portfolio.experience.find((record) => record.period?.ongoing)?.role,
    email: profile.email ? `mailto:${profile.email}` : undefined,
    image: profile.avatar ? absoluteUrl(profile.avatar) : undefined,
    address: profile.location
      ? { '@type': 'PostalAddress', addressLocality: profile.location }
      : undefined,
    sameAs: sameAs(profile),
    alumniOf: education.length ? education : undefined,
    worksFor: current.length ? current : undefined,
    knowsAbout: knowsAbout.length ? knowsAbout : undefined,
    hasOccupationalCredential: portfolio.certifications
      .slice(0, 12)
      .map((record) => ({ '@type': 'EducationalOccupationalCredential', name: record.name })),
    mainEntityOfPage: works.length
      ? {
          '@type': 'ItemList',
          numberOfItems: portfolio.publications.length + portfolio.research.length,
          itemListElement: works,
        }
      : undefined,
  });
}

/** The site itself, plus the sections it actually ships. */
export function websiteEntity(profile: Profile, portfolio: Portfolio): Json {
  /*
   * A section is only advertised if it has content in it. An empty hub is a 404
   * with a nicer heading, and describing one to Google is worse than silence.
   */
  const sections = (Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[])
    .filter((kind) => (portfolio[kind] as unknown[] | undefined)?.length)
    .map((kind) =>
      compact({
        '@type': 'SiteNavigationElement',
        name: CATEGORIES[kind].label,
        description: CATEGORIES[kind].question,
        url: absoluteUrl(`/${String(kind)}`),
      }),
    );

  return compact({
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: profile.name || portfolioConfig.site.title,
    alternateName: portfolioConfig.site.title,
    url: absoluteUrl('/'),
    description: profile.positioning ?? portfolioConfig.site.description,
    inLanguage: portfolioConfig.site.locale,
    publisher: { '@id': PERSON_ID },
    codeRepository: 'https://github.com/nomi181472/portfolio-os',
    hasPart: sections.length ? sections : undefined,
  });
}

/** BreadcrumbList mirroring the visible trail, for every page that shows one. */
export function breadcrumbEntity(trail: { label: string; href?: string }[]): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) =>
      compact({
        '@type': 'ListItem',
        // Positions are 1-based in the spec. The final crumb carries no `item`
        // because it is the page you are on, not a place you can navigate to —
        // emitting it anyway is the common mistake that makes the trail
        // self-referential and gets the whole node discarded by validators.
        position: index + 1,
        name: crumb.label,
        item: crumb.href && index < trail.length - 1 ? absoluteUrl(crumb.href) : undefined,
      }),
    ),
  };
}

/** A hub page: the collection, described as the ItemList it is. */
export function itemListEntity(definition: CategoryDefinition, entities: ResolvedEntity[]): Json {
  return compact({
    '@type': 'ItemList',
    name: definition.label,
    description: definition.note,
    // `numberOfItems` is the true total even though the list below is capped:
    // a hub with 400 entries should not describe itself as having 100.
    numberOfItems: entities.length,
    itemListElement: entities.slice(0, 100).map((entity, index) =>
      compact({
        '@type': 'ListItem',
        position: index + 1,
        name: entity.data.name,
        url: absoluteUrl(entity.href),
        description: entity.data.summary,
      }),
    ),
  });
}

/**
 * An entity page. Research and publications read as Articles because they carry
 * prose someone might cite; everything else is a CreativeWork. Both point back at
 * the WebSite so the graph is connected rather than a pile of isolated nodes.
 */
export function entityPageEntity(
  entity: ResolvedEntity,
  definition: CategoryDefinition,
  profile: Profile,
): Json {
  const data = entity.data;
  const isArticle = entity.kind === 'research' || entity.kind === 'publications';
  /*
   * Only public media may be referenced. An entity can carry a private or
   * draft upload URL, and a graph block is the one place on the page that is
   * read by a machine which will happily go and fetch whatever it finds there.
   */
  const image = data.media.find((item) => item.type === 'image' && item.visibility === 'public')?.url;
  const keywords = [...data.tags, ...data.technologies].slice(0, 12).join(', ');

  return compact({
    '@type': isArticle ? 'Article' : 'CreativeWork',
    '@id': absoluteUrl(entity.href),
    name: data.name,
    headline: isArticle ? data.name : undefined,
    url: absoluteUrl(entity.href),
    abstract: isArticle ? undefined : data.summary,
    description: data.summary ?? data.description?.slice(0, 300),
    articleBody: isArticle ? data.description?.slice(0, 5000) : undefined,
    image: image ? absoluteUrl(image) : undefined,
    datePublished: data.period?.startDate,
    // An open-ended engagement has not been modified; asserting "today" for it
    // would be a claim the content model does not actually make.
    dateModified: data.period?.ongoing ? undefined : data.period?.endDate ?? data.period?.startDate,
    keywords: keywords || undefined,
    provider: data.organisation ? { '@type': 'Organization', name: data.organisation } : undefined,
    author: { '@type': 'Person', name: profile.name, '@id': PERSON_ID },
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@type': 'Thing', name: definition.singular },
  });
}
