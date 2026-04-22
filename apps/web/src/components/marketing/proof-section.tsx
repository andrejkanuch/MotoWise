export function ProofSection() {
  const stats = [
    { value: '2,400', suffix: '+', label: 'Active riders across 40 countries.' },
    { value: '18,000', suffix: '+', label: 'Bikes tracked in-app \u2014 and counting.' },
    { value: '12,000', suffix: '+', label: 'Maintenance services logged.' },
    {
      value: '4.8',
      suffix: '/5',
      suffixSerif: true,
      label: 'Average rating on the App Store.',
    },
  ];

  return (
    <section
      id="proof"
      style={{
        padding: '120px 40px',
        maxWidth: 'var(--mv-container)',
        margin: '0 auto',
        borderTop: '1px solid var(--mv-line)',
        borderBottom: '1px solid var(--mv-line)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '48px',
      }}
      className="proof-grid"
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          style={{
            borderLeft: '1px solid var(--mv-line)',
            paddingLeft: '24px',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(40px, 4.5vw, 68px)',
              fontWeight: 500,
              letterSpacing: '-0.04em',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--mv-ink)',
            }}
          >
            {stat.value}
            {stat.suffixSerif ? (
              <span
                style={{
                  fontFamily: "var(--font-instrument-serif, 'Instrument Serif', serif)",
                  fontWeight: 400,
                  fontStyle: 'italic',
                  color: 'var(--mv-warm-400)',
                }}
              >
                {stat.suffix}
              </span>
            ) : (
              stat.suffix
            )}
          </div>
          <div
            style={{
              marginTop: '14px',
              color: 'var(--mv-ink-3)',
              fontSize: '13px',
              letterSpacing: '-0.005em',
            }}
          >
            {stat.label}
          </div>
        </div>
      ))}

      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 820px) {
              .proof-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 40px !important; padding: 80px 24px !important; }
            }
          `,
        }}
      />
    </section>
  );
}
