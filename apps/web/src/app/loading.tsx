export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        background: 'oklch(0.12 0.01 55)',
      }}
    >
      {/* Inline loader — mirrors .mv-loader default (80px) */}
      <div
        style={{
          position: 'relative',
          width: '80px',
          height: '80px',
        }}
      >
        {/* Track ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid oklch(1 0 0 / 0.08)',
          }}
        />
        {/* Spinning arc */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: 'oklch(0.84 0.15 68)',
            borderRightColor: 'oklch(0.84 0.15 68)',
            animation: 'mv-root-spin 1.1s cubic-bezier(0.6,0.2,0.4,0.8) infinite',
            filter: 'drop-shadow(0 0 10px oklch(0.84 0.15 68 / 0.45))',
          }}
        />
        {/* Tread ring */}
        <div
          style={{
            position: 'absolute',
            inset: '18%',
            borderRadius: '50%',
            border: '1px dashed oklch(1 0 0 / 0.22)',
            animation: 'mv-root-spin-back 4s linear infinite',
          }}
        />
        {/* Hub */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'oklch(0.84 0.15 68)',
            transform: 'translate(-50%, -50%)',
            boxShadow:
              '0 0 0 3px oklch(1 0 0 / 0.04), 0 0 14px oklch(0.84 0.15 68)',
            animation: 'mv-root-pulse 1.4s ease-in-out infinite',
          }}
        />
      </div>

      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static keyframes
        dangerouslySetInnerHTML={{
          __html: `
@keyframes mv-root-spin{0%{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes mv-root-spin-back{0%{transform:rotate(0)}to{transform:rotate(-360deg)}}
@keyframes mv-root-pulse{0%,to{transform:translate(-50%,-50%) scale(.8);opacity:.85}50%{transform:translate(-50%,-50%) scale(1.15);opacity:1}}`,
        }}
      />
    </div>
  );
}
