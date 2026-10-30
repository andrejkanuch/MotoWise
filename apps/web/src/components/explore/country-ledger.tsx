import { CONTINENT_ORDER, COUNTRY_CONTINENT } from '@/lib/continent-map';
import { Figure, Icon, MetaLabel } from './primitives';
import { formatNumber } from './utils';

interface CountryLedgerProps {
  countries: Array<{ code: string; name: string; routeCount: number }>;
}

/**
 * Every country with routes, grouped by continent and sorted by route
 * count: hairline rows with the count as a tabular figure.
 */
export function CountryLedger({ countries }: CountryLedgerProps) {
  if (countries.length === 0) return null;

  const grouped = CONTINENT_ORDER.map((continent) => ({
    continent,
    list: countries
      .filter((c) => (COUNTRY_CONTINENT[c.code] ?? 'Europe') === continent)
      .sort((a, b) => b.routeCount - a.routeCount),
  })).filter((g) => g.list.length > 0);

  return (
    <section className="xp-wrap xp-section">
      <h2 className="mv-h2">Every country with routes</h2>
      <p className="xp-sub">
        {formatNumber(countries.length)} {countries.length === 1 ? 'country' : 'countries'}, grouped
        by continent and sorted by how many routes we hold there.
      </p>

      <div className="xp-continents">
        {grouped.map((g) => {
          const total = g.list.reduce((s, c) => s + c.routeCount, 0);
          return (
            <div key={g.continent} className="xp-continent">
              <div className="xp-continent-head">
                <h3 className="mv-h3 xp-h3">{g.continent}</h3>
                <MetaLabel>
                  {formatNumber(g.list.length)} {g.list.length === 1 ? 'country' : 'countries'} ·{' '}
                  {formatNumber(total)} {total === 1 ? 'route' : 'routes'}
                </MetaLabel>
              </div>
              <div className="mv-rows">
                {g.list.map((c) => (
                  <a
                    key={c.code}
                    href={`/explore/${c.code.toLowerCase()}`}
                    className="mv-row xp-crow"
                  >
                    <span className="mv-row-title">{c.name}</span>
                    <Figure
                      value={formatNumber(c.routeCount)}
                      unit={c.routeCount === 1 ? 'route' : 'routes'}
                    />
                    <Icon name="arrow-right" size={14} />
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
