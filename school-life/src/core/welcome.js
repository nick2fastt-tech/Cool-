// Welcome email / letter. Shared by the browser game and the Node server.
import { WELCOME, GAME } from '../config.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function welcomeSubject() {
  return WELCOME.subject;
}

export function welcomeText(email) {
  return [
    'Hi ' + email + ',',
    '',
    WELCOME.intro,
    '',
    "Here's what's in " + GAME.title + ' ' + GAME.versionLabel + ':',
    ...WELCOME.features.map((f) => '  - ' + f),
    '',
    WELCOME.comingSoon,
    '',
    WELCOME.signoff,
  ].join('\n');
}

export function welcomeHtml(email) {
  const items = WELCOME.features
    .map((f) => '<tr><td style="padding:6px 0;font-size:15px;line-height:1.45;color:#1f2937;">&#9989;&nbsp; ' + esc(f) + '</td></tr>')
    .join('');
  const sign = esc(WELCOME.signoff).replace(/\n/g, '<br>');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(WELCOME.subject)}</title></head>
<body style="margin:0;padding:0;background:#2f5d46;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2f5d46;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf5;border-radius:18px;overflow:hidden;border:4px solid #1b1f3b;">
<tr><td style="background:#ffc72c;padding:22px 24px;text-align:center;border-bottom:4px solid #1b1f3b;">
<div style="font-size:34px;font-weight:900;letter-spacing:2px;color:#1b1f3b;">SCHOOL LIFE</div>
<div style="display:inline-block;margin-top:6px;background:#1b1f3b;color:#ffc72c;font-weight:700;font-size:12px;letter-spacing:2px;padding:4px 10px;border-radius:999px;">${esc(GAME.versionLabel.toUpperCase())}</div>
</td></tr>
<tr><td style="padding:24px 26px 8px 26px;">
<p style="margin:0 0 6px 0;font-size:15px;color:#6b7280;">Hi ${esc(email)},</p>
<p style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#1b1f3b;">${esc(WELCOME.intro)} &#127890;</p>
<p style="margin:0 0 8px 0;font-size:15px;color:#1f2937;">Your account is locked in. Here's what's in the demo:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
<p style="margin:16px 0 0 0;padding:12px 14px;background:#eef6ff;border-radius:12px;font-size:14px;color:#1e3a8a;">&#128679; ${esc(WELCOME.comingSoon)}</p>
<p style="margin:18px 0 22px 0;font-size:15px;color:#1f2937;">${sign}</p>
</td></tr>
<tr><td style="background:#1b1f3b;color:#cbd5e1;font-size:12px;text-align:center;padding:12px;">You're receiving this because you created a ${esc(GAME.title)} account.</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
