'use client';

/**
 * components/experience/ExperienceRouteView.tsx
 *
 * Visual Metaphor: "The Engineering Route (Station by Station)"
 *
 * Implements an interactive transit route line and telemetry station cards
 * derived dynamically from portfolio.json / SQLite database.
 * Zero hardcoded profile information.
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { MetaphorMark } from '@/components/metaphors/MetaphorMark';
import { formatPeriod, formatDuration } from '@/lib/format';
import { CATEGORIES } from '@/lib/categories';
import type { ResolvedEntity, Experience, Period } from '@/types/portfolio';
import styles from './ExperienceRouteView.module.css';

interface ExperienceRouteViewProps {
  entities: ResolvedEntity[];
}

function formatStationYears(period?: Period): string {
  if (!period) return '';
  const startYear = period.startDate ? period.startDate.slice(0, 4) : '';
  if (period.ongoing) return `${startYear} — Present`;
  const endYear = period.endDate ? period.endDate.slice(0, 4) : '';
  if (startYear && endYear && startYear !== endYear) return `${startYear} — ${endYear}`;
  return startYear || endYear || '';
}

export function ExperienceRouteView({ entities }: ExperienceRouteViewProps) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [expandedLogbooks, setExpandedLogbooks] = useState<Record<string, boolean>>({});
  const [expandedDeliverables, setExpandedDeliverables] = useState<Record<string, boolean>>({});

  // Sort chronological for the route overview (earliest origin to latest terminal)
  const chronologicalEntities = useMemo(() => {
    return [...entities].sort((a, b) => {
      const startA = (a.data as Experience).period?.startDate ?? '';
      const startB = (b.data as Experience).period?.startDate ?? '';
      return startA.localeCompare(startB);
    });
  }, [entities]);

  // Aggregate high-level route telemetry
  const routeTelemetry = useMemo(() => {
    let totalDeliverables = 0;
    const systemsSet = new Set<string>();

    for (const entity of entities) {
      const data = entity.data as Experience;
      const deliverables = entity.relations.filter(
        (r) => r.kind === 'products' || r.kind === 'projects',
      );
      totalDeliverables += deliverables.length;

      if (Array.isArray(data.systems)) {
        for (const sys of data.systems) {
          systemsSet.add(sys);
        }
      }
    }

    const first = (chronologicalEntities[0]?.data as Experience)?.period?.startDate;
    let spanLabel = '';
    if (first) {
      const startYear = Number(first.slice(0, 4));
      const currentYear = new Date().getFullYear();
      const diff = currentYear - startYear;
      if (diff > 0) {
        spanLabel = `~${diff}+ yr Route`;
      }
    }

    return {
      stationCount: entities.length,
      totalDeliverables,
      systemsCount: systemsSet.size,
      spanLabel,
    };
  }, [entities, chronologicalEntities]);

  const toggleLogbook = (id: string) => {
    setExpandedLogbooks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleDeliverables = (id: string) => {
    setExpandedDeliverables((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const scrollToStation = (id: string) => {
    setHighlightedId(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      setHighlightedId(null);
    }, 2800);
  };

  if (entities.length === 0) {
    return (
      <p className="notice">
        No experience stations found. Add entries in <code>content/portfolio.json</code>.
      </p>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* 1. Top Route Schematic Strip (Transit Line Overview) */}
      <section className={styles.routeOverview} aria-label="Engineering Route Overview">
        <div className={styles.routeOverviewHeader}>
          <div className={styles.routeOverviewTitle}>
            <MetaphorMark name="route" size={16} />
            <span>Route Telemetry Map</span>
          </div>
          <div className={styles.routeOverviewStats}>
            <span className={styles.statPill}>
              {routeTelemetry.stationCount} {routeTelemetry.stationCount === 1 ? 'Station' : 'Stations'}
            </span>
            {routeTelemetry.totalDeliverables > 0 ? (
              <span className={styles.statPill}>
                {routeTelemetry.totalDeliverables} Deliverables
              </span>
            ) : null}
            {routeTelemetry.systemsCount > 0 ? (
              <span className={styles.statPill}>
                {routeTelemetry.systemsCount} Systems
              </span>
            ) : null}
            {routeTelemetry.spanLabel ? (
              <span className={styles.statPill}>
                {routeTelemetry.spanLabel}
              </span>
            ) : null}
          </div>
        </div>

        {/* Mobile Route Track (< 640px): Vertical Transit Circuit (Guarantees zero overlap) */}
        <div className={styles.mobileTrack}>
          {chronologicalEntities.map((entity, index) => {
            const data = entity.data as Experience;
            const period = data.period;
            const isOngoing = Boolean(period?.ongoing);
            const isLast = index === chronologicalEntities.length - 1;
            const org = data.organisation || data.name;
            const years = formatStationYears(period);
            const duration = formatDuration(period);

            return (
              <div key={data.id} className={styles.mobileStationBlock}>
                {/* Station Interactive Row */}
                <button
                  type="button"
                  className={styles.mobileStationButton}
                  onClick={() => scrollToStation(data.id)}
                  title={`Focus ${org}`}
                >
                  <div className={styles.mobileGutterCol}>
                    <div className={`${styles.nodeDot} ${isOngoing ? styles.nodeDotActive : ''}`}>
                      {isOngoing ? <span className={styles.nodeDotPulse} /> : null}
                    </div>
                  </div>

                  <div className={styles.mobileStationBody}>
                    <div className={styles.mobileStationHeader}>
                      <span className={styles.mobileStationName}>{org}</span>
                      {years ? <span className={styles.mobileStationYears}>{years}</span> : null}
                    </div>
                    <div className={styles.mobileStationRoleLine}>
                      {data.role ? (
                        <span className={styles.mobileStationRole}>{data.role}</span>
                      ) : null}
                      <span className={styles.mobileStationStatusTag}>
                        {isOngoing ? 'Active Terminal' : `Stop 0${index + 1}`}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Vertical Transit Connector between stations */}
                {!isLast ? (
                  <div className={styles.mobileConnectorRow} aria-hidden="true">
                    <div className={styles.mobileGutterCol}>
                      <div className={styles.mobileConnectorLine} />
                    </div>
                    <div className={styles.mobileConnectorBody}>
                      {duration ? (
                        <span className={styles.mobileStrideBadge}>
                          <span className={styles.strideIcon}>↕</span>
                          {duration} tenure
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Desktop Route Track (>= 640px): Seamless Transit Rail + Aligned Nodes */}
        <div className={styles.desktopTrack}>
          <div className={styles.desktopTrackRail}>
            {chronologicalEntities.map((entity, index) => {
              const data = entity.data as Experience;
              const period = data.period;
              const isOngoing = Boolean(period?.ongoing);
              const isLast = index === chronologicalEntities.length - 1;
              const org = data.organisation || data.name;
              const years = formatStationYears(period);
              const duration = formatDuration(period);

              return (
                <div
                  key={data.id}
                  className={`${styles.desktopStationSegment} ${isLast ? styles.desktopStationSegmentLast : ''}`}
                >
                  {/* Top Track Row with Dot and Rail Line */}
                  <div className={styles.desktopSegmentTrack}>
                    <div className={`${styles.nodeDot} ${isOngoing ? styles.nodeDotActive : ''}`}>
                      {isOngoing ? <span className={styles.nodeDotPulse} /> : null}
                    </div>
                    {!isLast ? (
                      <div className={styles.desktopRailLineWrap}>
                        <div className={styles.desktopRailLine} />
                        {duration ? (
                          <span className={styles.desktopStridePill}>{duration} stride</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {/* Station Interactive Content aligned directly below its dot */}
                  <button
                    type="button"
                    className={styles.desktopStationButton}
                    onClick={() => scrollToStation(data.id)}
                    title={`Focus ${org}`}
                  >
                    <div className={styles.desktopStationHeader}>
                      <span className={styles.desktopStationName}>{org}</span>
                      {years ? <span className={styles.desktopStationYears}>{years}</span> : null}
                    </div>
                    <div className={styles.desktopStationMeta}>
                      {data.role ? (
                        <span className={styles.desktopStationRole}>{data.role}</span>
                      ) : null}
                      <span className={styles.desktopStationTag}>
                        {isOngoing ? 'Active Terminal' : `Stop 0${index + 1}`}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Station List (Detailed Station Cards) */}
      <div className={styles.stationList}>
        {entities.map((entity, index) => {
          const data = entity.data as Experience;
          const period = data.period as Period | undefined;
          const isOngoing = Boolean(period?.ongoing);
          const rawPeriod = formatPeriod(period);
          const duration = formatDuration(period);
          const org = data.organisation || data.name;
          const role = data.role;
          const employmentType = data.employmentType;
          const location = data.location;
          const isHighlighted = highlightedId === data.id;

          // Relations (Master Deliverables)
          const deliverables = entity.relations.filter(
            (r) => r.kind === 'products' || r.kind === 'projects',
          );
          const showAllDeliverables = Boolean(expandedDeliverables[data.id]);
          const visibleDeliverables = showAllDeliverables ? deliverables : deliverables.slice(0, 4);
          const hasHiddenDeliverables = deliverables.length > 4 && !showAllDeliverables;

          // Arrays
          const systems = Array.isArray(data.systems) ? data.systems : [];
          const achievements = Array.isArray(data.achievements) ? data.achievements : [];
          const technologies = Array.isArray(data.technologies) ? data.technologies : [];
          const responsibilities = Array.isArray(data.responsibilities) ? data.responsibilities : [];

          // Primary transformation milestone (first achievement or impact)
          const primaryMilestone = achievements[0] || data.impact;

          // Verification letter or link
          const verificationLink =
            data.links?.find((l) => l.type === 'verification' && l.visibility !== 'private') ||
            data.evidence?.[0]?.links?.find((l) => l.type === 'verification');

          const isLogbookOpen = Boolean(expandedLogbooks[data.id]);

          // Station numbering: Station 01 for the latest / top station
          const stationNumber = String(index + 1).padStart(2, '0');

          return (
            <article
              key={data.id}
              id={data.id}
              className={`${styles.stationCard} ${isHighlighted ? styles.stationCardHighlighted : ''}`}
            >
              {/* Station Header Row */}
              <div className={styles.stationHeaderRow}>
                <div className={styles.stationIdentification}>
                  <div className={styles.stationIndexMeta}>
                    <MetaphorMark name="milestone" size={13} />
                    <span>Station {stationNumber}</span>
                    {isOngoing ? <span>· Terminal Stop</span> : null}
                  </div>
                  <h2 className={styles.stationOrgTitle}>
                    <Link href={entity.href} className={styles.stationOrgLink}>
                      {org}
                    </Link>
                  </h2>
                  <div className={styles.stationRoleBadges}>
                    {role ? <span className={styles.badgeRole}>{role}</span> : null}
                    {employmentType || location ? (
                      <span className={styles.badgeContext}>
                        {[employmentType, location].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className={styles.stationMetaAside}>
                  <span
                    className={`${styles.statusIndicator} ${
                      isOngoing ? styles.statusOngoing : styles.statusCompleted
                    }`}
                  >
                    {isOngoing ? <span className={styles.liveDot} /> : null}
                    {isOngoing ? 'Active Terminal' : 'Completed Station'}
                  </span>
                  {rawPeriod ? (
                    <div className={styles.periodLabel}>
                      <span>{rawPeriod}</span>
                      {duration ? <span className={styles.durationBadge}>{duration}</span> : null}
                    </div>
                  ) : null}
                  {verificationLink ? (
                    <a
                      href={verificationLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.verifiedBadge}
                      title={verificationLink.label}
                    >
                      <MetaphorMark name="seal" size={12} />
                      <span>Verified Tenure (PDF)</span>
                    </a>
                  ) : null}
                </div>
              </div>

              {/* Station Telemetry HUD Grid */}
              <div className={styles.telemetryGrid}>
                <div className={styles.telemetryTile}>
                  <div className={styles.telemetryValueRow}>
                    <MetaphorMark name="artifact" size={14} />
                    <span className={styles.telemetryNumber}>{deliverables.length}</span>
                  </div>
                  <span className={styles.telemetryLabel}>Deliverables</span>
                </div>
                <div className={styles.telemetryTile}>
                  <div className={styles.telemetryValueRow}>
                    <MetaphorMark name="route" size={14} />
                    <span className={styles.telemetryNumber}>{systems.length}</span>
                  </div>
                  <span className={styles.telemetryLabel}>Systems</span>
                </div>
                <div className={styles.telemetryTile}>
                  <div className={styles.telemetryValueRow}>
                    <MetaphorMark name="instrument" size={14} />
                    <span className={styles.telemetryNumber}>{technologies.length}</span>
                  </div>
                  <span className={styles.telemetryLabel}>Technologies</span>
                </div>
                <div className={styles.telemetryTile}>
                  <div className={styles.telemetryValueRow}>
                    <MetaphorMark name="milestone" size={14} />
                    <span className={styles.telemetryNumber}>{achievements.length}</span>
                  </div>
                  <span className={styles.telemetryLabel}>Key Milestones</span>
                </div>
              </div>

              {/* Triad 1: Mandate & Context */}
              {data.summary || data.description ? (
                <p className={styles.mandateText}>
                  {data.summary || data.description}
                </p>
              ) : null}

              {/* Triad 2: Master Deliverables & Artifacts */}
              {deliverables.length > 0 ? (
                <div className={styles.deliverablesSection}>
                  <div className={styles.deliverablesHeader}>
                    <span className={styles.deliverablesTitle}>Master Deliverables</span>
                    <span className={styles.deliverablesCount}>
                      {deliverables.length} {deliverables.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className={styles.deliverablesWrap}>
                    {visibleDeliverables.map((del) => {
                      const markName = CATEGORIES[del.kind]?.mark || 'artifact';
                      const cleanName = (del.name.split('—')[0] ?? del.name).trim();

                      return (
                        <Link
                          key={`${del.kind}:${del.id}`}
                          href={del.href}
                          className={styles.deliverableChip}
                          title={del.name}
                        >
                          <MetaphorMark name={markName} size={12} />
                          <span className={styles.deliverableName}>{cleanName}</span>
                        </Link>
                      );
                    })}

                    {hasHiddenDeliverables ? (
                      <button
                        type="button"
                        className={styles.moreDeliverablesButton}
                        onClick={() => toggleDeliverables(data.id)}
                      >
                        +{deliverables.length - 4} more
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Triad 3: High-Impact Transformation Milestone */}
              {primaryMilestone ? (
                <div className={styles.transformationCard}>
                  <div className={styles.transformationHeader}>
                    <MetaphorMark name="milestone" size={12} />
                    <span>Key Transformation & Impact</span>
                  </div>
                  <p className={styles.transformationText}>{primaryMilestone}</p>
                </div>
              ) : null}

              {/* Progressive Disclosure: Station Logbook */}
              <div className={styles.logbookSection}>
                <button
                  type="button"
                  className={styles.logbookToggle}
                  onClick={() => toggleLogbook(data.id)}
                  aria-expanded={isLogbookOpen}
                >
                  <span>
                    {isLogbookOpen ? '▲ Close Station Logbook' : '▼ Inspect Station Logbook (Full Specs)'}
                  </span>
                  <span style={{ opacity: 0.6 }}>
                    {responsibilities.length} specs · {systems.length} systems
                  </span>
                </button>

                {isLogbookOpen ? (
                  <div className={styles.logbookDrawer}>
                    {responsibilities.length > 0 ? (
                      <div>
                        <h3 className={styles.drawerBlockTitle}>Core Responsibilities & Mandate</h3>
                        <ul className={styles.responsibilitiesList}>
                          {responsibilities.map((resp, i) => (
                            <li key={i} className={styles.responsibilityItem}>
                              {resp}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {systems.length > 0 ? (
                      <div>
                        <h3 className={styles.drawerBlockTitle}>Engineered Systems Architecture</h3>
                        <div className={styles.systemsWrap}>
                          {systems.map((sys) => (
                            <span key={sys} className={styles.systemChip}>
                              {sys}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {technologies.length > 0 ? (
                      <div>
                        <h3 className={styles.drawerBlockTitle}>Technology Stack</h3>
                        <div className={styles.techWrap}>
                          {technologies.map((tech) => (
                            <span key={tech} className={styles.techChip}>
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className={styles.detailLinkRow}>
                      <Link href={entity.href} className={styles.detailLink}>
                        <span>Go to full station technical record</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
