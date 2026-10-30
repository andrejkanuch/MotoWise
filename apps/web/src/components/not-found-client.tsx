'use client';

import { useEffect, useState } from 'react';

export function GoBackButton() {
  return (
    <button type="button" className="nf-btn nf-btn-ghost" onClick={() => history.back()}>
      Go back
    </button>
  );
}

export function TelemetryPath() {
  const [path, setPath] = useState('/404');

  useEffect(() => {
    setPath((window.location.pathname || '/404').slice(0, 48));
  }, []);

  return <span className="nf-telemetry-val">{path}</span>;
}
