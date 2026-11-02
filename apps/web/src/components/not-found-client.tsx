'use client';

import { useEffect, useState } from 'react';

const PATH_MAX_CHARS = 48;
const FALLBACK_PATH = '/404';

export function GoBackButton({ label = 'Go back' }: { label?: string }) {
  return (
    <button type="button" className="mv-btn mv-btn-ghost" onClick={() => history.back()}>
      {label}
    </button>
  );
}

/** Reads the path the visitor typed; percent-encoded letters are shown as
 *  the letters (a malformed sequence falls back to the raw path). */
function readPath(): string {
  const raw = window.location.pathname || FALLBACK_PATH;
  try {
    return decodeURIComponent(raw).slice(0, PATH_MAX_CHARS);
  } catch {
    return raw.slice(0, PATH_MAX_CHARS);
  }
}

export function TelemetryPath() {
  const [path, setPath] = useState(FALLBACK_PATH);

  useEffect(() => {
    setPath(readPath());
  }, []);

  return <span className="nf-telemetry-val">{path}</span>;
}
