export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 50,
        overflow: 'hidden',
        background: 'oklch(0.15 0.01 55)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, oklch(0.84 0.15 68), transparent)',
          animation: 'mv-load-slide 1.2s ease-in-out infinite',
        }}
      />
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static keyframes
        dangerouslySetInnerHTML={{
          __html:
            '@keyframes mv-load-slide{0%{transform:translateX(-100%)}to{transform:translateX(100%)}}',
        }}
      />
    </div>
  );
}
