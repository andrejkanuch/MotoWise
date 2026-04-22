export function TestimonialSection() {
  return (
    <section
      style={{
        padding: '200px 40px',
        maxWidth: '1000px',
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {/* Quotation mark */}
      <div
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-instrument-serif, 'Instrument Serif', serif)",
          fontSize: '120px',
          lineHeight: 0.5,
          color: 'var(--mv-warm-500)',
          marginBottom: '24px',
          opacity: 0.7,
        }}
      >
        &ldquo;
      </div>

      <blockquote
        style={{
          fontFamily: "var(--font-instrument-serif, 'Instrument Serif', serif)",
          fontSize: 'clamp(36px, 4.5vw, 60px)',
          fontWeight: 400,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: 'var(--mv-ink)',
          margin: 0,
        }}
      >
        MotoVault{' '}
        <em style={{ color: 'var(--mv-warm-400)', fontStyle: 'italic' }}>
          diagnosed a chain tension issue
        </em>{' '}
        I&apos;d been ignoring for months. Saved me from a breakdown in the middle of the Pyrenees.
      </blockquote>

      {/* Author pill */}
      <div
        style={{
          marginTop: '56px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '16px',
          padding: '10px 20px 10px 10px',
          border: '1px solid var(--mv-line)',
          borderRadius: '999px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--mv-warm-400), var(--mv-warm-900))',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 600,
            color: 'oklch(0.15 0.02 55)',
            fontSize: '14px',
            letterSpacing: '-0.02em',
          }}
        >
          AR
        </div>
        <div>
          <div style={{ fontWeight: 500, fontSize: '14px', letterSpacing: '-0.01em' }}>
            Alex Renaud
          </div>
          <div style={{ color: 'var(--mv-ink-3)', fontSize: '13px' }}>
            2022 Yamaha MT-07 &middot; Lyon, FR
          </div>
        </div>
      </div>
    </section>
  );
}
