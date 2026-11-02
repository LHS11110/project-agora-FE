export function parseYoutube(value) {
  try {
    const u = new URL(value.trim());
    if (!['https:', 'http:'].includes(u.protocol)) return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    let id;
    if (host === 'youtu.be') id = u.pathname.split('/')[1];
    else if (['youtube.com', 'youtube-nocookie.com'].includes(host)) id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(embed|shorts|live)\//.test(u.pathname) ? u.pathname.split('/')[2] : null;
    if (!/^[\w-]{11}$/.test(id || '')) return null;
    const raw = u.searchParams.get('t') || u.searchParams.get('start') || '0';
    const start = /^\d+$/.test(raw) ? Number(raw) : [...raw.matchAll(/(\d+)(h|m|s)/g)].reduce((n, m) => n + Number(m[1]) * ({h:3600,m:60,s:1}[m[2]]), 0);
    return {id, start: Math.min(start, 86400 * 365)};
  } catch { return null; }
}
const seconds = value => value.replace(',', '.').split(':').reduce((n, x) => n * 60 + Number(x), 0);
export function parseSubtitles(text) {
  return text.replace(/\r/g, '').split(/\n\s*\n/).flatMap(block => {
    const lines = block.split('\n');
    const i = lines.findIndex(line => line.includes('-->'));
    if (i < 0) return [];
    const [a,b] = lines[i].split('-->').map(s => s.trim().split(/\s/)[0]);
    const start = seconds(a), end = seconds(b);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    return [{start,end,text:lines.slice(i+1).join('\n').replace(/<[^>]*>/g,'')}];
  }).sort((a,b)=>a.start-b.start);
}
