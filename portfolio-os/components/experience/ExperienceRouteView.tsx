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

export function ExperienceRouteView({ entities }: ExperienceRouteViewProps) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [expandedLogbooks, setExpandedLogbooks] = useState<Record<string, boolean>>({});
  const [expandedDeliverables, setExpandedDeliverables] = useState<Record<string, boolean>>({});

  // Sort chronological for the top schematic route (earliest to latest)
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

    return {
      stationCount: entities.length,
      totalDeliverables,
      systemsCount: systemsSet.size,
    };
  }, [entities]);

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
    }, 2500);
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
          </div>
        </div>

        <div className={styles.trackContainer}>
          {chronologicalEntities.map((entity, index) => {
            const data = entity.data as Experience;
            const period = data.period;
            const isOngoing = Boolean(period?.ongoing);
            const isLast = index === chronologicalEntities.length - 1;
            const org = data.organisation || data.name;
            const duration = formatDuration(period);

            return (
              <div key={data.id} className={styles.trackNodeGroup}>
                <button
                  type="button"
                  className={styles.trackStationButton}
                  onClick={() => scrollToStation(data.id)}
                  title={`Focus ${org}`}
                >
                  <div className={styles.nodeMarkerRow}>
                    <div className={`${styles.nodeDot} ${isOngoing ? styles.nodeDotActive : ''}`}>
                      {isOngoing ? <span className={styles.nodeDotPulse} /> : null}
                    </div>
                  </div>
                  <span className={styles.nodeStationLabel}>{org}</span>
                  <span className={styles.nodeStationMeta}>
                    {data.role || (isOngoing ? 'Active Terminal' : 'Station')}
                  </span>
                </button>

                {!isLast ? (
                  <div className={styles.nodeConnectorLine}>
                    {duration ? <span className={styles.connectorDuration}>{duration}</span> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
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
                    {employmentType ? <span className={styles.badgeContext}>{employmentType}</span> : null}
                    {location ? <span className={styles.badgeContext}>{location}</span> : null}
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
                  <span className={styles.telemetryNumber}>{deliverables.length}</span>
                  <span className={styles.telemetryLabel}>Deliverables</span>
                </div>
                <div className={styles.telemetryTile}>
                  <span className={styles.telemetryNumber}>{systems.length}</span>
                  <span className={styles.telemetryLabel}>Systems</span>
                </div>
                <div className={styles.telemetryTile}>
                  <span className={styles.telemetryNumber}>{technologies.length}</span>
                  <span className={styles.telemetryLabel}>Technologies</span>
                </div>
                <div className={styles.telemetryTile}>
                  <span className={styles.telemetryNumber}>{achievements.length}</span>
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
