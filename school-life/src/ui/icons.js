// Inline SVG icons (all drawn for this game).
const s = (body, vb = '0 0 24 24', extra = '') =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false" ${extra}>${body}</svg>`;
const stroke = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';

function gearPath(cx = 12, cy = 12, rOut = 10.2, rIn = 7.6, teeth = 8) {
  const pts = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const w = step * 0.22;
    pts.push([a - step / 2 + w, rIn], [a - w * 1.15, rOut], [a + w * 1.15, rOut], [a + step / 2 - w, rIn]);
  }
  return (
    pts
      .map(([a, r], i) => (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(2) + ' ' + (cy + Math.sin(a) * r).toFixed(2))
      .join(' ') + ' Z'
  );
}

export const ICONS = {
  play: s('<path d="M8 4.8v14.4a1.2 1.2 0 0 0 1.8 1l11-7.2a1.2 1.2 0 0 0 0-2L9.8 3.8A1.2 1.2 0 0 0 8 4.8z" fill="currentColor"/>'),
  lock: s(
    '<path d="M7.5 10.5V7.8a4.5 4.5 0 0 1 9 0v2.7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>' +
      '<rect x="4" y="10" width="16" height="11.5" rx="3" fill="currentColor"/>' +
      '<circle cx="12" cy="15.2" r="1.7" fill="#fff" opacity=".85"/><rect x="11.2" y="15.6" width="1.6" height="3" rx=".8" fill="#fff" opacity=".85"/>',
  ),
  gear: s(`<path d="${gearPath()}" fill="currentColor"/><circle cx="12" cy="12" r="3.4" fill="#fff" opacity=".9"/>`),
  user: s('<circle cx="12" cy="8" r="4.2"/><path d="M4 21a8 8 0 0 1 16 0"/>', '0 0 24 24', stroke),
  hand: s(
    '<path d="M8.2 13.2V6.3a1.6 1.6 0 0 1 3.2 0v5.6"/><path d="M11.4 11.6V4.6a1.6 1.6 0 0 1 3.2 0v7"/>' +
      '<path d="M14.6 11.6V6.4a1.6 1.6 0 0 1 3.2 0v6.2"/>' +
      '<path d="M17.8 10.2a1.6 1.6 0 0 1 3.2 0v4.6a7.2 7.2 0 0 1-7.2 7.2h-1.2a7 7 0 0 1-5.6-2.8l-3.2-4.3a1.7 1.7 0 0 1 2.6-2.2l1.8 1.9"/>',
    '0 0 24 24',
    stroke,
  ),
  calendar: s(
    '<rect x="3" y="4.8" width="18" height="16.2" rx="3.2" fill="currentColor"/><rect x="3" y="4.8" width="18" height="5" rx="2" fill="#e4572e"/>' +
      '<rect x="7" y="2.5" width="2.4" height="5" rx="1.2" fill="currentColor"/><rect x="14.6" y="2.5" width="2.4" height="5" rx="1.2" fill="currentColor"/>' +
      '<g fill="#fff"><rect x="6" y="12" width="3" height="2.6" rx=".6"/><rect x="10.5" y="12" width="3" height="2.6" rx=".6"/><rect x="15" y="12" width="3" height="2.6" rx=".6"/><rect x="6" y="16" width="3" height="2.6" rx=".6"/><rect x="10.5" y="16" width="3" height="2.6" rx=".6"/></g>',
  ),
  clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>', '0 0 24 24', stroke),
  mail: s('<rect x="2.5" y="5" width="19" height="14" rx="2.6"/><path d="m3.2 6.6 8.8 6.6 8.8-6.6"/>', '0 0 24 24', stroke),
  key: s('<circle cx="7.6" cy="15.6" r="4.4"/><path d="m10.8 12.4 9.4-9.4M17.2 6l2.8 2.8M14.6 8.6l2.4 2.4"/>', '0 0 24 24', stroke),
  eye: s('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', '0 0 24 24', stroke),
  eyeOff: s(
    '<path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/>',
    '0 0 24 24',
    stroke,
  ),
  check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>', '0 0 24 24', 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"'),
  close: s('<path d="M6 6l12 12M18 6L6 18"/>', '0 0 24 24', 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"'),
  back: s('<path d="M15 5l-7 7 7 7"/>', '0 0 24 24', 'fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"'),
  bell: s(
    '<path d="M12 3a6 6 0 0 0-6 6v3.5L4.2 16a.8.8 0 0 0 .7 1.2h14.2a.8.8 0 0 0 .7-1.2L18 12.5V9a6 6 0 0 0-6-6z" fill="currentColor"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  ),
  door: s('<path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21M3 21h18"/><circle cx="15.2" cy="12.4" r="1.2" fill="currentColor"/>', '0 0 24 24', stroke),
  info: s('<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.4v.2"/>', '0 0 24 24', stroke),
  star: s('<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="currentColor"/>'),
  menu: s('<path d="M4 6.5h16M4 12h16M4 17.5h16"/>', '0 0 24 24', 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"'),
  crest: s(
    '<path d="M24 2 44 8v18c0 14-9 23-20 28C13 49 4 40 4 26V8Z" fill="#1b1f3b"/>' +
      '<path d="M24 6.2 40 11v15c0 11.5-7 19-16 23.5C15 45 8 37.5 8 26V11Z" fill="#ffc72c"/>' +
      '<path d="M24 10.4 36.4 14v12c0 9-5.4 15.6-12.4 19.5C17 41.6 11.6 35 11.6 26V14Z" fill="#2d6cdf"/>' +
      '<path d="M14.5 22.5c3.6-1.4 6.6-1 9.5 1 2.9-2 5.9-2.4 9.5-1v12.2c-3.6-1.4-6.6-1-9.5 1-2.9-2-5.9-2.4-9.5-1z" fill="#fff"/>' +
      '<path d="M24 23.6v12" stroke="#1b1f3b" stroke-width="1.3"/>' +
      '<path d="m24 12.6 1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" fill="#ffc72c"/>',
    '0 0 48 56',
  ),
  male: s(
    '<path d="M8 46c0-10 5.4-15.5 12-15.5S32 36 32 46z" fill="#fff" stroke="#1b1f3b" stroke-width="2"/>' +
      '<rect x="16.6" y="21" width="6.8" height="10" rx="3" fill="#e9b98f"/>' +
      '<ellipse cx="20" cy="15" rx="7.6" ry="8.6" fill="#f1c7a0" stroke="#1b1f3b" stroke-width="1.6"/>' +
      '<path d="M12.2 14.6c-.6-6.2 3-9.6 7.8-9.6 5.2 0 8.6 3.4 7.8 9.6-1.6-2.8-4.8-4.2-7.8-4.2-3 0-6.2 1.4-7.8 4.2z" fill="#5a3a22"/>' +
      '<circle cx="17.2" cy="16" r="1" fill="#1b1f3b"/><circle cx="22.8" cy="16" r="1" fill="#1b1f3b"/><path d="M17.6 19.4c1.4 1.1 3.4 1.1 4.8 0" fill="none" stroke="#1b1f3b" stroke-width="1.2" stroke-linecap="round"/>',
    '0 0 40 48',
  ),
  female: s(
    '<path d="M10.6 16c0-7 4.2-11 9.4-11s9.4 4 9.4 11v11.5c-2.6 1.6-6 2.4-9.4 2.4s-6.8-.8-9.4-2.4z" fill="#5a3a22"/>' +
      '<path d="M9 46c0-9.6 5-15 11-15s11 5.4 11 15z" fill="#fff" stroke="#1b1f3b" stroke-width="2"/>' +
      '<rect x="17" y="21.5" width="6" height="9" rx="3" fill="#e9b98f"/>' +
      '<ellipse cx="20" cy="15.6" rx="7" ry="8" fill="#f1c7a0" stroke="#1b1f3b" stroke-width="1.6"/>' +
      '<path d="M12.6 14.4c.4-5.2 3.4-8 7.4-8s7 2.8 7.4 8c-3-.6-6-2.4-7.4-4.6-1.4 2.2-4.4 4-7.4 4.6z" fill="#5a3a22"/>' +
      '<circle cx="17.4" cy="16.6" r="1" fill="#1b1f3b"/><circle cx="22.6" cy="16.6" r="1" fill="#1b1f3b"/><path d="M17.8 19.8c1.3 1 3.1 1 4.4 0" fill="none" stroke="#1b1f3b" stroke-width="1.2" stroke-linecap="round"/>',
    '0 0 40 48',
  ),
  pencil: s(
    '<path d="M6 2h14v20H6a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z" fill="#f28b9b"/>' +
      '<rect x="18" y="1" width="12" height="22" fill="#cbd5e1"/><rect x="21" y="1" width="1.6" height="22" fill="#94a3b8"/><rect x="25.4" y="1" width="1.6" height="22" fill="#94a3b8"/>' +
      '<rect x="30" y="1" width="62" height="22" fill="#ffc72c"/><rect x="30" y="8.6" width="62" height="1.6" fill="#e0a800"/><rect x="30" y="14" width="62" height="1.6" fill="#e0a800"/>' +
      '<path d="M92 1l20 8.6v4.8L92 23z" fill="#f2cf9a"/><path d="M106.4 7.2 120 12l-13.6 4.8z" fill="#374151"/>' +
      '<path d="M1 7a5 5 0 0 1 5-5h86v22H6a5 5 0 0 1-5-5z" fill="none" stroke="#1b1f3b" stroke-width="2"/>',
    '0 0 122 24',
  ),
  plane: s(
    '<path d="M2 20 62 2 40 38 30 24Z" fill="#fff" stroke="#1b1f3b" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M30 24 62 2 24 29Z" fill="#dbeafe" stroke="#1b1f3b" stroke-width="2.4" stroke-linejoin="round"/>',
    '0 0 64 40',
  ),
  padlockBig: s(
    '<path class="shackle" d="M22 44V30a18 18 0 0 1 36 0v14" fill="none" stroke="#1b1f3b" stroke-width="10" stroke-linecap="round"/>' +
      '<path class="shackle" d="M22 44V30a18 18 0 0 1 36 0v14" fill="none" stroke="#cbd5e1" stroke-width="5" stroke-linecap="round"/>' +
      '<rect x="10" y="40" width="60" height="46" rx="10" fill="#ffc72c" stroke="#1b1f3b" stroke-width="5"/>' +
      '<rect x="16" y="46" width="48" height="8" rx="4" fill="#fff" opacity=".45"/>' +
      '<circle cx="40" cy="62" r="6" fill="#1b1f3b"/><rect x="37" y="63" width="6" height="12" rx="3" fill="#1b1f3b"/>',
    '0 0 80 90',
  ),
};

export function icon(name, cls = '') {
  const svg = ICONS[name] || '';
  return cls ? svg.replace('<svg ', `<svg class="${cls}" `) : svg;
}
