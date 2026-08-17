"use client";

import { useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopology from "us-atlas/states-10m.json";

type StateFeature = GeoJSON.Feature<GeoJSON.Geometry, { name?: string }> & {
  id?: string | number;
};

const alerts = [
  {
    place: "Mecklenburg County",
    rate: "7.25% → 8.25%",
    effective: "Effective Jul 1, 2026",
    shipTos: 34,
    tone: "urgent",
  },
  {
    place: "Wake County",
    rate: "7.25%",
    effective: "Source needs review",
    shipTos: 21,
    tone: "review",
  },
  {
    place: "Durham County",
    rate: "7.50%",
    effective: "A+ tax body unverified",
    shipTos: 8,
    tone: "review",
  },
];

export default function Home() {
  const [selectedState, setSelectedState] = useState("37");
  const [selectedAlert, setSelectedAlert] = useState<(typeof alerts)[number] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});

  const { states, path } = useMemo(() => {
    const collection = feature(
      statesTopology as never,
      statesTopology.objects.states as never,
    ) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    const projection = geoAlbersUsa().fitSize([820, 500], collection);
    return {
      states: collection.features as StateFeature[],
      path: geoPath(projection),
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="TaxAP home">
          <img
            className="atlantic-logo"
            src="/atlantic-packaging-horizontal.svg"
            alt="Atlantic Packaging"
          />
          <span className="product-lockup">
            <strong>TaxAP</strong>
            <small>Sales &amp; use tax monitoring</small>
          </span>
        </a>
        <nav className="nav" aria-label="Primary navigation">
          <a className="active" href="#overview">Overview</a>
          <a href="#queue">Rate changes</a>
          <a href="#sources">Sources</a>
          <a href="#queue">Approval queue</a>
        </nav>
        <div className="sync-status">
          <span className="sync-dot" />
          Last checked today, 6:00 AM
        </div>
      </header>

      <section className="page-content" id="overview">
        <div className="eyebrow-row">
          <span className="eyebrow">North Carolina pilot</span>
          <span className="prototype-badge">Prototype · sample data</span>
        </div>
        <div className="intro">
          <div>
            <h1>Know which tax rates need attention.</h1>
            <p>
              Compare official sales and use tax rates with A+ ship-to records,
              then send only confirmed differences to the approval queue.
            </p>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => document.querySelector("#queue")?.scrollIntoView({ behavior: "smooth" })}
          >
            Review 3 changes <span aria-hidden="true">→</span>
          </button>
        </div>

        <section className="stats" aria-label="Tax rate monitoring summary">
          <article>
            <span>Active A+ ship-tos</span>
            <strong>1,284</strong>
            <small>North Carolina only</small>
          </article>
          <article>
            <span>Needs approval</span>
            <strong className="stat-alert">3</strong>
            <small>63 customer locations affected</small>
          </article>
          <article>
            <span>Current</span>
            <strong>1,221</strong>
            <small>95.1% match the official source</small>
          </article>
          <article>
            <span>Next scheduled check</span>
            <strong className="stat-date">Tomorrow</strong>
            <small>6:00 AM Eastern</small>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="map-card">
            <div className="card-heading">
              <div>
                <span className="section-label">Coverage map</span>
                <h2>United States</h2>
              </div>
              <div className="legend" aria-label="Map legend">
                <span><i className="legend-current" /> Current</span>
                <span><i className="legend-alert" /> Needs review</span>
                <span><i className="legend-untracked" /> Not monitored</span>
              </div>
            </div>

            <div className="map-wrap">
              <svg
                className="us-map"
                viewBox="0 0 820 500"
                role="img"
                aria-label="United States tax monitoring coverage map. North Carolina is selected."
              >
                {states.map((state) => {
                  const id = String(state.id).padStart(2, "0");
                  const isNc = id === "37";
                  return (
                    <path
                      className={isNc ? "state state-selected" : "state"}
                      d={path(state) || undefined}
                      key={id}
                      onClick={() => isNc && setSelectedState(id)}
                      aria-label={isNc ? "North Carolina, three changes need review" : "Not monitored in this pilot"}
                    />
                  );
                })}
              </svg>
              <div className="nc-callout" aria-hidden="true">
                <span>3</span>
                <div><strong>North Carolina</strong><small>changes need review</small></div>
              </div>
            </div>

            <div className="map-footer">
              <span><strong>NC</strong> is the active pilot</span>
              <button type="button" onClick={() => setSelectedState("37")}>
                {selectedState === "37" ? "Viewing North Carolina" : "View North Carolina"}
              </button>
            </div>
          </article>

          <aside className="alerts-card" id="queue">
            <div className="card-heading alert-heading">
              <div>
                <span className="section-label">Approval queue</span>
                <h2>3 rate checks</h2>
              </div>
              <span className="count-pill">3</span>
            </div>

            <div className="alert-list">
              {alerts.map((alert) => (
                <button
                  className="alert-row"
                  type="button"
                  key={alert.place}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <span className={`alert-icon ${alert.tone}`} aria-hidden="true">!</span>
                  <span className="alert-copy">
                    <strong>{alert.place}</strong>
                    <span>{alert.rate}</span>
                    <small>{decisions[alert.place] || alert.effective}</small>
                  </span>
                  <span className="shipto-count">
                    <strong>{alert.shipTos}</strong>
                    <small>ship-tos</small>
                  </span>
                  <span className="row-arrow" aria-hidden="true">›</span>
                </button>
              ))}
            </div>

            <div className="source-note" id="sources">
              <span className="source-icon">✓</span>
              <div>
                <strong>Official source connected</strong>
                <p>NCDOR rate publication · last checked today</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="workflow" aria-label="How TaxAP works">
          <div className="workflow-intro">
            <span className="section-label">Protected workflow</span>
            <h2>A decision aid, not an automatic A+ update.</h2>
            <p>
              Every detected difference keeps its official source, effective date,
              and impacted ship-tos attached so the tax administrator can make the call.
            </p>
          </div>
          <ol>
            <li><span>01</span><strong>Read</strong><small>Active NC ship-to addresses from A+</small></li>
            <li><span>02</span><strong>Compare</strong><small>NCDOR rates by jurisdiction and date</small></li>
            <li><span>03</span><strong>Review</strong><small>Confirm the discrepancy and its impact</small></li>
            <li><span>04</span><strong>Record</strong><small>Create an approved A+ maintenance task</small></li>
          </ol>
        </section>

        <footer>
          <span>TaxAP · North Carolina pilot</span>
          <span>Read-only A+ monitoring</span>
        </footer>
      </section>

      {selectedAlert && (
        <div
          className="drawer-layer"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedAlert(null);
          }}
        >
          <section
            className="review-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
          >
            <button className="drawer-close" type="button" onClick={() => setSelectedAlert(null)} aria-label="Close review">×</button>
            <span className="section-label">Rate discrepancy</span>
            <h2 id="review-title">{selectedAlert.place}</h2>
            <p className="drawer-lede">Review the official rate against the current A+ value before creating a maintenance task.</p>

            <div className="rate-comparison">
              <div><span>Current A+ rate</span><strong>{selectedAlert.place === "Mecklenburg County" ? "7.25%" : selectedAlert.rate}</strong></div>
              <span className="compare-arrow">→</span>
              <div className="official-rate"><span>Official rate</span><strong>{selectedAlert.place === "Mecklenburg County" ? "8.25%" : selectedAlert.rate}</strong></div>
            </div>

            <dl className="review-facts">
              <div><dt>Effective date</dt><dd>{selectedAlert.place === "Mecklenburg County" ? "July 1, 2026" : "Needs verification"}</dd></div>
              <div><dt>Rate type</dt><dd>General sales and use</dd></div>
              <div><dt>Affected records</dt><dd>{selectedAlert.shipTos} A+ ship-tos</dd></div>
              <div><dt>Official source</dt><dd><a href="https://www.ncdor.gov/taxes-forms/sales-and-use-tax/sales-and-use-tax-rates" target="_blank" rel="noreferrer">North Carolina DOR ↗</a></dd></div>
            </dl>

            <div className="no-write-note"><strong>No A+ records will be changed.</strong> Confirming creates a reviewed flag for the tax administrator.</div>

            <div className="drawer-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setDecisions((current) => ({ ...current, [selectedAlert.place]: "Marked as not a rate change" }));
                  setSelectedAlert(null);
                }}
              >
                Not a rate change
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setDecisions((current) => ({ ...current, [selectedAlert.place]: "Confirmed · ready for A+ review" }));
                  setSelectedAlert(null);
                }}
              >
                Confirm discrepancy
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
