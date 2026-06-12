// MotoVault mobile — Icons (line-weight 1.6, 24px canvas)
// Matches Feather / Lucide style for a premium feel.

const MVIcon = ({ name, size = 22, color = 'currentColor', strokeWidth = 1.75 }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home':
      return <svg {...common}><path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 01-1.5 1.5h-4V14h-7v7.5h-4A1.5 1.5 0 013 20z"/></svg>;
    case 'garage':
      return <svg {...common}><circle cx="6.5" cy="16" r="3.5"/><circle cx="17.5" cy="16" r="3.5"/><path d="M3 16H1m22 0h-2m-11 0h4M9 9l2-3h3l3 6h2a1 1 0 011 1v3"/><path d="M4 14l2-5a1 1 0 011-1h2"/></svg>;
    case 'compass':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z"/></svg>;
    case 'route':
      return <svg {...common}><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M8.7 17.3C10 15 10 10 14 10h4M10 14h-4c-2 0-2-4 0-4"/></svg>;
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>;
    case 'sparkle':
      return <svg {...common}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/></svg>;
    case 'wrench':
      return <svg {...common}><path d="M14.5 3.5a4.5 4.5 0 016 6l-3-3-3 3-3-3 3-3zM11 11L3.5 18.5a2.1 2.1 0 103 3L14 14"/></svg>;
    case 'dollar':
      return <svg {...common}><path d="M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H7"/></svg>;
    case 'edit':
      return <svg {...common}><path d="M4 20h4L19 9l-4-4L4 16v4zM14 5l5 5"/></svg>;
    case 'more':
      return <svg {...common}><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>;
    case 'calendar':
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case 'gauge':
      return <svg {...common}><path d="M12 20a8 8 0 100-16 8 8 0 000 16z"/><path d="M12 12l4-3"/></svg>;
    case 'repeat':
      return <svg {...common}><path d="M17 2l3 3-3 3M3 11V9a4 4 0 014-4h13M7 22l-3-3 3-3M21 13v2a4 4 0 01-4 4H4"/></svg>;
    case 'chevron-right':
      return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevron-left':
      return <svg {...common}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'chevron-down':
      return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    case 'chevron-up':
      return <svg {...common}><path d="M18 15l-6-6-6 6"/></svg>;
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'close':
      return <svg {...common}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case 'bell':
      return <svg {...common}><path d="M6 8a6 6 0 0112 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 21a2 2 0 004 0"/></svg>;
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
    case 'camera':
      return <svg {...common}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>;
    case 'map':
      return <svg {...common}><path d="M1 6v16l7-3 8 3 7-3V3l-7 3-8-3-7 3z"/><path d="M8 3v16M16 6v16"/></svg>;
    case 'share':
      return <svg {...common}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5L8.6 10.5"/></svg>;
    case 'bookmark':
      return <svg {...common}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>;
    case 'trash':
      return <svg {...common}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>;
    case 'check':
      return <svg {...common}><path d="M4 12l6 6L20 6"/></svg>;
    case 'arrow-right':
      return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-up':
      return <svg {...common}><path d="M12 19V5M6 11l6-6 6 6"/></svg>;
    case 'arrow-down':
      return <svg {...common}><path d="M12 5v14M18 13l-6 6-6-6"/></svg>;
    case 'send':
      return <svg {...common}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>;
    case 'book':
      return <svg {...common}><path d="M4 4a2 2 0 012-2h14v18H6a2 2 0 00-2 2V4zM20 20v2H6"/></svg>;
    case 'mountain':
      return <svg {...common}><path d="M3 20l6-10 4 6 2-3 6 7H3z"/></svg>;
    case 'camera-dot':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill={color}/></svg>;
    case 'moon':
      return <svg {...common}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>;
    case 'fuel':
      return <svg {...common}><path d="M3 21V5a2 2 0 012-2h7a2 2 0 012 2v16M3 21h11M3 10h11"/><path d="M14 8l3 3v7a2 2 0 004 0V9l-3-3"/></svg>;
    case 'thermometer':
      return <svg {...common}><path d="M14 14.76V3.5a2.5 2.5 0 10-5 0v11.26a4 4 0 105 0z"/></svg>;
    case 'battery':
      return <svg {...common}><rect x="2" y="8" width="16" height="8" rx="1.5"/><path d="M20 11v2"/><rect x="4" y="10" width="8" height="4" fill={color} stroke="none"/></svg>;
    case 'lightbulb':
      return <svg {...common}><path d="M9 18h6M10 21h4M12 3a6 6 0 016 6c0 3-2 4-2 7H8c0-3-2-4-2-7a6 6 0 016-6z"/></svg>;
    case 'flag':
      return <svg {...common}><path d="M4 21V4h14l-3 4 3 4H4"/></svg>;
    case 'star':
      return <svg {...common}><path d="M12 2l3.1 6.3 7 1-5 4.9 1.2 6.9-6.3-3.3-6.3 3.3 1.2-6.9-5-4.9 7-1z"/></svg>;
    case 'star-fill':
      return <svg {...{...common, fill: color}}><path d="M12 2l3.1 6.3 7 1-5 4.9 1.2 6.9-6.3-3.3-6.3 3.3 1.2-6.9-5-4.9 7-1z"/></svg>;
    case 'medal':
      return <svg {...common}><circle cx="12" cy="15" r="6"/><path d="M8 12L5 3h14l-3 9M10 17l2 2 2-2"/></svg>;
    case 'shield':
      return <svg {...common}><path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4z"/></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'location':
      return <svg {...common}><path d="M12 21s8-7 8-13a8 8 0 10-16 0c0 6 8 13 8 13z"/><circle cx="12" cy="8" r="2.5"/></svg>;
    case 'play':
      return <svg {...{...common, fill: color}}><path d="M6 4l14 8-14 8z"/></svg>;
    case 'headphones':
      return <svg {...common}><path d="M3 18v-6a9 9 0 0118 0v6M21 19a2 2 0 01-2 2h-1v-6h3v4zM3 19a2 2 0 002 2h1v-6H3v4z"/></svg>;
    case 'download':
      return <svg {...common}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>;
    case 'sun':
      return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8"/></svg>;
  }
};

Object.assign(window, { MVIcon });
