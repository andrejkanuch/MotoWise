'use client';

import { useEffect, useRef, useState } from 'react';

export function GoBackButton() {
  return (
    <button type="button" className="nf-btn nf-btn-ghost" onClick={() => history.back()}>
      Go back
    </button>
  );
}

export function TelemetryHeading() {
  const [deg, setDeg] = useState('---');
  const tRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      tRef.current += 0.04;
      const raw = Math.round(
        180 + Math.sin(tRef.current) * 60 + Math.cos(tRef.current * 1.7) * 20,
      );
      setDeg(String(((raw % 360) + 360) % 360).padStart(3, '0'));
    }, 80);
    return () => clearInterval(id);
  }, []);

  return <span className="nf-telemetry-val">{deg}&deg;</span>;
}

export function TelemetryPath() {
  const [path, setPath] = useState('/404');

  useEffect(() => {
    setPath((window.location.pathname || '/404').slice(0, 48));
  }, []);

  return <span className="nf-telemetry-val">{path}</span>;
}
