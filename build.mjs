// build.mjs: reads facts.json, validates it, writes index.html. Zero dependencies.
// Usage: node build.mjs [path/to/facts.json]
// Any failed check (an unfilled question marker, a fact without a source, a health term,
// a page over 100 KB) prints the reasons and exits 1 without writing index.html.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = new URL('./index.html', import.meta.url);
const FOOTER = 'Concept built for an application. Not an official prommer.net page.';
const MARKER = /\{\{\s*HUMAN\b[^}]*\}\}|<\s*question\s*\d+\s*>/gi;
const HEALTH = /\b(injur\w*|surger\w*|diagnos\w*|hospital\w*|rehab\w*|illness\w*|cancer|medic\w*|doping|glp.?1|weight.?loss|abnehm\w*|ozempic|semaglutid\w*|therap\w*)\b/i;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const factsPath = process.argv[2] ? resolve(process.argv[2]) : new URL('./facts.json', import.meta.url);
const raw = readFileSync(factsPath, 'utf8');
const data = JSON.parse(raw);
const errors = [];
const isUrl = s => typeof s === 'string' && /^https:\/\/\S+$/.test(s);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const words = s => String(s).trim().split(/\s+/).length;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtDate = s => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const shortUrl = u => u.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');

// 1. The questions are the applicant's own: never ship a placeholder.
const markers = raw.match(MARKER) || [];
if (markers.length) errors.push(`unfilled question markers: ${markers.join(', ')}`);
if (HEALTH.test(raw)) errors.push(`health term in facts.json: ${raw.match(HEALTH)[0]}`);

// 2. No source, no fact.
if (!isDate(data.as_of)) errors.push('as_of must be YYYY-MM-DD');
for (const f of data.facts) {
  if (!f.value) errors.push(`${f.id}: no value`);
  if (!isUrl(f.source)) errors.push(`${f.id}: no source URL`);
  if (!f.evidence) errors.push(`${f.id}: no evidence snippet`);
}
const numbers = data.facts.filter(f => f.kind === 'number');
const angles = data.facts.filter(f => f.kind === 'angle');
if (!numbers.length) errors.push('no proof numbers');
if (angles.length !== 5) errors.push(`expected 5 angles, found ${angles.length}`);
for (const a of angles) {
  for (const k of ['title', 'outlet', 'date', 'role']) if (!a[k]) errors.push(`${a.id}: missing ${k}`);
  if (!isDate(a.date)) errors.push(`${a.id}: date must be YYYY-MM-DD`);
  if (words(a.value) > 30) errors.push(`${a.id}: angle sentence over 30 words`);
  if (/["“”]/.test(a.value)) errors.push(`${a.id}: angle sentence must paraphrase, not quote`);
}

// 3. Three questions, or an explicit omission recorded by the applicant.
const questions = data.questions || [];
if (!data.questions_omitted && questions.length !== 3) errors.push(`expected 3 questions, found ${questions.length}`);

const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const angleItems = angles.map(a => `<li data-fact="${esc(a.id)}"><h3>${link(a.source, a.title)}</h3><p class="meta">${esc(a.outlet)} · ${fmtDate(a.date)} · ${esc(a.role)}</p><p>${esc(a.value)}</p></li>`).join('\n');
const numberItems = numbers.map(n => `<li data-fact="${esc(n.id)}"><span class="num">${esc(n.value)}</span>${esc(n.label)}<br><a class="src" href="${esc(n.source)}">Source: ${esc(shortUrl(n.source))}</a></li>`).join('\n');
const questionItems = questions.map(q => `<li>${esc(q)}</li>`).join('\n');

const md = [
  `# ${data.subject}: story angles for producers`,
  '',
  `Unofficial concept. Bios, headshots and the contact form: ${data.press_page}`,
  '',
  '## Five angles',
  '',
  ...angles.map((a, i) => `${i + 1}. [${a.title}](${a.source}). ${a.outlet}, ${fmtDate(a.date)}. ${a.value}`),
  '',
  `## Proof numbers (as of ${fmtDate(data.as_of)})`,
  '',
  ...numbers.map(n => `* ${n.value} ${n.label}. Source: ${n.source}`),
  '',
  ...(questions.length ? ['## Three interview questions', '', ...questions.map((q, i) => `${i + 1}. ${q}`), ''] : []),
  FOOTER,
  '',
].join('\n');

const css = `*{box-sizing:border-box}
body{margin:0;background:#fff;color:#1a1a1a;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;overflow-wrap:break-word}
.wrap{max-width:46rem;margin:0 auto;padding:1.25rem 1rem 2.5rem}
.tag{display:inline-block;margin:0 0 .75rem;padding:.1rem .5rem;border:1px solid #7a4d00;border-radius:4px;color:#7a4d00;font-size:.8rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
h1{font-size:1.65rem;line-height:1.2;margin:0 0 .5rem}
h2{font-size:1.25rem;margin:2.25rem 0 .75rem;padding-top:1rem;border-top:1px solid #d0d0d0}
h3{font-size:1.05rem;line-height:1.35;margin:0}
p{margin:.4rem 0}
a{color:#0b57d0;text-underline-offset:2px}
a:focus-visible,button:focus-visible{outline:3px solid #0b57d0;outline-offset:2px}
.lede{font-size:1.05rem;color:#333}
.actions{display:flex;flex-wrap:wrap;gap:.6rem;margin:1rem 0 0}
.btn,button{display:inline-flex;align-items:center;min-height:44px;padding:.55rem 1rem;border:2px solid #0b57d0;border-radius:6px;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.btn{background:#fff;color:#0b57d0}
button{background:#0b57d0;color:#fff}
button:hover{background:#0842a0;border-color:#0842a0}
.status{min-height:1.5em;font-size:.9rem;color:#1e6b2f}
.angles,.proof,.qs{margin:0;padding:0}
.angles{list-style:none}
.angles li{padding:1rem 0;border-bottom:1px solid #e2e2e2}
.meta,.asof{font-size:.9rem;color:#555}
.proof{list-style:none;display:grid;gap:.75rem}
.proof li{padding:.85rem 1rem;border:1px solid #d0d0d0;border-radius:8px}
.num{display:block;font-size:1.6rem;font-weight:700;line-height:1.15}
.src{display:inline-block;margin-top:.25rem;font-size:.9rem}
.qs{padding-left:1.4rem}
.qs li{margin:.5rem 0}
footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid #d0d0d0;font-size:.9rem;color:#444}
@media (min-width:48rem){.wrap{padding:2.5rem 1.5rem 3rem}h1{font-size:2.15rem}.proof{grid-template-columns:repeat(2,1fr)}}
@media print{.actions,.status{display:none}}`;

const js = `document.getElementById('dl').addEventListener('click', function () {
  var md = document.getElementById('kit-md').textContent;
  var url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
  var a = document.createElement('a');
  a.href = url;
  a.download = 'prommer-booker-kit.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  document.getElementById('dl-status').textContent = 'Saved prommer-booker-kit.md';
});`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(data.subject)}: story angles for producers (concept)</title>
<meta name="description" content="Unofficial concept: published angles, proof numbers with sources and interview questions for producers.">
<style>${css}</style>
</head>
<body>
<div class="wrap">
<header>
<p class="tag">Unofficial concept</p>
<h1>${esc(data.subject)}: story angles for producers</h1>
<p class="lede">Five published angles, proof numbers with sources${questions.length ? ', and three interview questions' : ''}. Bios, headshots and the contact form stay on his official press page.</p>
<p class="actions"><a class="btn" href="${esc(data.press_page)}">Bios, headshots, contact</a><button type="button" id="dl">Download as .md</button></p>
<p id="dl-status" class="status" role="status" aria-live="polite"></p>
</header>
<main>
<section aria-labelledby="h-angles"><h2 id="h-angles">Five angles</h2><ol class="angles">
${angleItems}
</ol></section>
<section aria-labelledby="h-proof"><h2 id="h-proof">Proof numbers</h2><p class="asof">As of ${fmtDate(data.as_of)}. Each number links to the page it came from.</p><ul class="proof">
${numberItems}
</ul></section>
${questions.length ? `<section aria-labelledby="h-q"><h2 id="h-q">Three interview questions</h2><ol class="qs">\n${questionItems}\n</ol></section>` : ''}
<section aria-labelledby="h-book"><h2 id="h-book">Bios, headshots and booking</h2><p>Use the ${link(data.press_page, 'official press page')}: it has his bios, downloadable headshots and the contact form. This page does not copy them.</p></section>
</main>
<footer><p>${FOOTER}</p></footer>
</div>
<script type="text/markdown" id="kit-md">${md}</script>
<script>${js}</script>
</body>
</html>
`;

// 4. Output checks: no health detail, no third-party resources, size, footer, noindex, house style.
const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ');
if (HEALTH.test(text) || HEALTH.test(md)) errors.push(`health term on page: ${(text.match(HEALTH) || md.match(HEALTH))[0]}`);
if (/<link[^>]+stylesheet|<script[^>]+src=|<img\b/i.test(html) || /@import|url\(/i.test(css)) errors.push('external resource reference found');
if (md.includes('</script')) errors.push('markdown would break its script tag');
if (/-{2}|—|–/.test(text + md)) errors.push('double hyphen or em/en dash in page text');
if (!html.includes(`<footer><p>${FOOTER}</p></footer>`) || !html.includes('content="noindex')) errors.push('footer or noindex missing');
const bytes = Buffer.byteLength(html);
if (bytes >= 100 * 1024) errors.push(`page is ${bytes} bytes, limit 102400`);

if (errors.length) {
  console.error(`BUILD FAILED (${errors.length}):\n${errors.map(e => `  ${e}`).join('\n')}`);
  process.exit(1);
}
writeFileSync(OUT, html);
console.log(`OK index.html ${bytes} bytes: ${angles.length} angles, ${numbers.length} numbers, ${questions.length} questions`);
