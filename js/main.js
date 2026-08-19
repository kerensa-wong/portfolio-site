/* ================================================
   PORTFOLIO — MAIN JS (Cool Tone / Theme-Switchable)
   CSV parsing · Hero banner animation · Charts
   Carousels (smart show/hide + center) · Tabs
   Theme switcher · Nav avatar (no-shift) · Reveal
   ================================================ */

'use strict';

// ── UTILITIES ────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = '', inQ = false;
    for (const c of line) {
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { vals.push(cur); cur = ''; }
      else cur += c;
    }
    vals.push(cur);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim().replace(/^"|"$/g, ''); });
    return obj;
  });
}

// ── DATA LOADING ─────────────────────────────────────────
//
// Two modes — selected automatically at runtime:
//
//  BUNDLED MODE (production — GitHub Pages)
//    data-bundle.js is loaded before this script. It sets
//    window.__PORTFOLIO_DATA__ with all CSVs pre-parsed, all JSONs
//    pre-parsed, and all images/PDFs as base64 data URIs.
//    No fetch() calls are made; no raw files exist in the public repo.
//
//  FETCH MODE (local development)
//    data-bundle.js is absent. Every load call uses fetch() against
//    the local dev server (npx serve .). Raw data/ and images/ folders
//    must be present next to index.html (symlink or copy from
//    portfolio-data — see README).
//    Switch to this mode by simply not building the bundle.
//
// You never need to change this file to switch modes — it detects
// automatically which mode it's in.

const _BUNDLE = window.__PORTFOLIO_DATA__ || null;

// Detect file:// and surface a human-readable error once.
if (window.location.protocol === 'file:') {
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('file-protocol-warning');
    if (el) el.style.display = 'flex';
  });
}

/** Returns the data URI for an asset path from the bundle, or the raw
 *  path itself in fetch mode (so src= and href= work normally). */
function resolveAsset(path) {
  if (_BUNDLE && _BUNDLE.assets[path]) return _BUNDLE.assets[path];
  return path; // fetch mode: raw relative path works against local server
}

async function loadCSV(path) {
  if (_BUNDLE) return _BUNDLE.csvs[path] || [];
  try {
    let text = await (await fetch(new URL(path, document.baseURI).href)).text();
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    return parseCSV(text);
  }
  catch { return []; }
}

async function loadJSON(path) {
  if (_BUNDLE) return _BUNDLE.jsons[path] || null;
  try { return await (await fetch(new URL(path, document.baseURI).href)).json(); }
  catch { return null; }
}
function safeText(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value) el.textContent = value;
}
function splitSemi(str) {
  return (str || '').split(';').map(s => s.trim()).filter(Boolean);
}

// ── THEME SWITCHER ───────────────────────────────────────

function initTheme(defaultTheme) {
  const stored = null; // no localStorage in artifacts; use CSV default + in-session switch only
  let theme = defaultTheme || 'steel';
  document.documentElement.setAttribute('data-theme', theme);

  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.themePick === theme);
    dot.addEventListener('click', () => {
      theme = dot.dataset.themePick;
      document.documentElement.setAttribute('data-theme', theme);
      document.querySelectorAll('.theme-dot').forEach(d => d.classList.toggle('active', d === dot));
      // Redraw the current research chart so canvas colors refresh
      if (typeof showResearch === 'function' && researchItems.length) {
        showResearch(researchIdx);
      }
    });
  });
}

// ── HERO BANNER ANIMATION (light, nature-leaning, cool tone) ──
// Soft drifting "leaf-like" particles + a slow horizon gradient sweep.

function initHeroCanvas(canvas, style) {
  style = style || 'particles';
  if (style === 'none') return;

  const ctx = canvas.getContext('2d');
  let W, H, items = [];

  function resize() {
    W = canvas.width  = canvas.parentElement.clientWidth;
    H = canvas.height = canvas.parentElement.clientHeight;
  }

  function accentColor() {
    const cs = getComputedStyle(document.documentElement);
    return {
      accent: cs.getPropertyValue('--accent').trim() || '#3D6E8C',
      accent2: cs.getPropertyValue('--accent2').trim() || '#C9A227',
    };
  }

  // ── Leaf style: slow drifting ellipses with gentle rotation + sway ──
  class Leaf {
    constructor() { this.reset(true); }
    reset(rand) {
      this.x = rand ? Math.random() * W : Math.random() * W;
      this.y = rand ? Math.random() * H : -20;
      this.size = Math.random() * 5 + 3;
      this.speedY = Math.random() * 0.25 + 0.08;
      this.speedX = (Math.random() - 0.5) * 0.18;
      this.rot = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.01;
      this.sway = Math.random() * 0.6 + 0.2;
      this.swayOffset = Math.random() * Math.PI * 2;
      this.alpha = Math.random() * 0.18 + 0.06;
      this.gold = Math.random() > 0.6;
    }
    update(t) {
      this.y += this.speedY;
      this.x += this.speedX + Math.sin(t * 0.001 + this.swayOffset) * this.sway * 0.02;
      this.rot += this.rotSpeed;
      if (this.y > H + 20) this.reset(false);
      if (this.x < -20) this.x = W + 20;
      if (this.x > W + 20) this.x = -20;
    }
    draw(colors) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size, this.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fillStyle = (this.gold ? colors.accent2 : colors.accent) +
        Math.round(this.alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Particle style: v1-inspired floating dots/stars with connecting lines ──
  class Particle {
    constructor() { this.reset(true); }
    reset(rand) {
      this.x = rand ? Math.random() * W : (Math.random() > 0.5 ? -5 : W + 5);
      this.y = rand ? Math.random() * H : Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.22;
      this.vy = (Math.random() - 0.5) * 0.22;
      this.r = Math.random() * 1.5 + 0.6;
      this.alpha = Math.random() * 0.4 + 0.12;
      this.gold = Math.random() > 0.72;
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < -10 || this.x > W + 10 || this.y < -10 || this.y > H + 10) this.reset(false);
    }
    draw(colors) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = (this.gold ? colors.accent2 : colors.accent) +
        Math.round(this.alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();
    }
  }

  function drawParticleLines(colors) {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const dx = items[i].x - items[j].x, dy = items[i].y - items[j].y;
        const d = Math.hypot(dx, dy);
        if (d < 100) {
          ctx.beginPath();
          ctx.moveTo(items[i].x, items[i].y);
          ctx.lineTo(items[j].x, items[j].y);
          ctx.strokeStyle = colors.accent + Math.round(0.09 * (1 - d/100) * 255).toString(16).padStart(2,'0');
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  }

  function build() {
    if (style === 'leaves') items = Array.from({ length: 36 }, () => new Leaf());
    else items = Array.from({ length: 75 }, () => new Particle());
  }

  function loop(t) {
    ctx.clearRect(0, 0, W, H);
    const colors = accentColor();

    const glow = ctx.createRadialGradient(W*0.15, H*0.95, 0, W*0.15, H*0.95, H*0.9);
    glow.addColorStop(0, colors.accent + '14');
    glow.addColorStop(1, colors.accent + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    items.forEach(it => { it.update(t || 0); it.draw(colors); });
    if (style === 'particles') drawParticleLines(colors);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => { resize(); build(); });
  resize();
  build();
  requestAnimationFrame(loop);
}

// ── HERO BACKGROUND PHOTO — shows only if the image actually loads ──

function initHeroBgPhoto(path) {
  const el = document.getElementById('hero-bg-photo');
  if (!el || !path) return;
  const img = new Image();
  img.onload = () => {
    el.style.backgroundImage = `url('${path}')`;
    el.classList.add('visible');
  };
  img.onerror = () => { /* keep default hero background, no photo layer */ };
  img.src = path;
}

// ── CHART COLOUR HELPERS (reads live CSS vars so theme switch updates charts) ──

function chartPalette() {
  const cs = getComputedStyle(document.documentElement);
  const accent  = cs.getPropertyValue('--accent').trim();
  const accent2 = cs.getPropertyValue('--accent2').trim();
  const accentL = cs.getPropertyValue('--accent-light').trim();
  return {
    accent, accent2, accentL,
    sectorColors: {
      'Financials':      accent,
      'Industrials':     accent2,
      'Real Estate':     '#8C7BA8',
      'Sovereign':       '#4A9E7A',
      'Sovereign / SSA': '#4A9E7A',
      'Consumer':        '#A88C6A',
      'Utilities':       accentL,
      'Energy':          '#B06A6A',
    },
    series: [accent, accent2, '#8C7BA8', '#4A9E7A', '#A88C6A', accentL, '#B06A6A', '#8A9A6A'],
  };
}

// ── SCATTER ──────────────────────────────────────────────

function drawScatter(canvas, data) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  const pal = chartPalette();

  const series = data.series || [];
  const xMin = 30, xMax = 100, yMin = 25, yMax = 310;
  const pad = { top: 18, right: 18, bottom: 46, left: 50 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;
  const xS = v => pad.left + (v - xMin) / (xMax - xMin) * pw;
  const yS = v => pad.top  + (1 - (v - yMin) / (yMax - yMin)) * ph;

  ctx.font = `10px 'JetBrains Mono', monospace`; ctx.fillStyle = '#82909E';
  for (let y = 50; y <= 300; y += 50) {
    const yp = yS(y);
    ctx.beginPath(); ctx.moveTo(pad.left, yp); ctx.lineTo(pad.left + pw, yp);
    ctx.strokeStyle = 'rgba(20,32,46,0.06)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(y, pad.left - 7, yp + 3.5);
  }
  for (let x = 40; x <= 100; x += 20) {
    const xp = xS(x);
    ctx.beginPath(); ctx.moveTo(xp, pad.top); ctx.lineTo(xp, pad.top + ph);
    ctx.strokeStyle = 'rgba(20,32,46,0.06)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillText(x, xp, pad.top + ph + 16);
  }

  const n = series.length;
  let sx=0, sy=0, sxy=0, sxx=0;
  series.forEach(d => { sx+=d.x; sy+=d.y; sxy+=d.x*d.y; sxx+=d.x*d.x; });
  const m = (n*sxy - sx*sy) / (n*sxx - sx*sx);
  const b = (sy - m*sx) / n;
  ctx.beginPath();
  ctx.moveTo(xS(xMin), yS(m*xMin+b)); ctx.lineTo(xS(xMax), yS(m*xMax+b));
  ctx.strokeStyle = pal.accent + '4D'; ctx.lineWidth = 1.5;
  ctx.setLineDash([5,4]); ctx.stroke(); ctx.setLineDash([]);

  ctx.fillStyle = '#82909E'; ctx.font = `10px 'JetBrains Mono', monospace`; ctx.textAlign = 'center';
  ctx.fillText(data.x_axis || 'X', pad.left + pw/2, H - 4);
  ctx.save(); ctx.translate(10, pad.top + ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText(data.y_axis || 'Y', 0, 0); ctx.restore();

  const dots = [];
  series.forEach(d => {
    const cx = xS(d.x), cy = yS(d.y);
    const color = pal.sectorColors[d.group] || pal.accent;
    ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, Math.PI*2);
    ctx.fillStyle = color + 'CC'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, Math.PI*2);
    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
    dots.push({ cx, cy, ...d, color });
  });

  return { type: 'scatter', dots, xAxis: data.x_axis, yAxis: data.y_axis };
}

// ── DONUT ────────────────────────────────────────────────

function drawDonut(canvas, data) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  const pal = chartPalette();

  const series = data.series || [];
  const total  = series.reduce((s, d) => s + d[data.value_field], 0);
  const cx = W/2, cy = H/2;
  const outerR = Math.min(W, H) * 0.38;
  const innerR = outerR * 0.58;
  let angle = -Math.PI/2;
  const wedges = [];

  series.forEach((d, i) => {
    const slice = (d[data.value_field] / total) * Math.PI * 2;
    const color = pal.series[i % pal.series.length];
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, angle, angle + slice); ctx.closePath();
    ctx.fillStyle = color + 'CC'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, outerR, angle, angle + slice);
    ctx.arc(cx, cy, innerR, angle + slice, angle, true); ctx.closePath();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

    wedges.push({
      startAngle: angle, endAngle: angle + slice,
      cx, cy, innerR, outerR,
      label: d[data.label_field], value: d[data.value_field], color,
    });
    angle += slice;
  });

  ctx.beginPath(); ctx.arc(cx, cy, innerR - 2, 0, Math.PI*2);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = '#1B2838'; ctx.font = `bold 14px 'Cormorant Garamond', serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Portfolio', cx, cy - 8);
  ctx.font = `10px 'JetBrains Mono', monospace`; ctx.fillStyle = '#82909E';
  ctx.fillText('Allocation', cx, cy + 10);

  return { type: 'donut', series, wedges, palette: pal.series, labelField: data.label_field, valueField: data.value_field };
}

// ── BAR ──────────────────────────────────────────────────

function drawBar(canvas, data) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  const pal = chartPalette();

  const series  = data.series || [];
  const groups  = data.groups || ['A', 'B'];
  const pad     = { top: 18, right: 18, bottom: 56, left: 36 };
  const pw      = W - pad.left - pad.right;
  const ph      = H - pad.top - pad.bottom;
  const maxVal  = Math.max(...series.flatMap(d => groups.map(g => d[g] || 0)));
  const yMax    = Math.ceil(maxVal / 5) * 5 + 5;

  const xS = (i, sub, subCount) => {
    const slotW = pw / series.length;
    const barW  = slotW * 0.7 / subCount;
    const gapW  = slotW * 0.3 / (subCount + 1);
    return pad.left + i * slotW + gapW * (sub + 1) + barW * sub;
  };
  const barW = () => (pw / series.length) * 0.7 / groups.length;
  const yS = v => pad.top + (1 - v / yMax) * ph;

  ctx.font = `9px 'JetBrains Mono', monospace`; ctx.fillStyle = '#82909E';
  for (let y = 0; y <= yMax; y += 5) {
    const yp = yS(y);
    ctx.beginPath(); ctx.moveTo(pad.left, yp); ctx.lineTo(pad.left + pw, yp);
    ctx.strokeStyle = 'rgba(20,32,46,0.06)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(y, pad.left - 5, yp + 3);
  }

  const colors = [pal.accent, '#B06A6A'];
  const bars = [];
  series.forEach((d, i) => {
    groups.forEach((g, gi) => {
      const x = xS(i, gi, groups.length);
      const bw = barW();
      const val = d[g] || 0;
      const y = yS(val);
      const barH = ph - (y - pad.top);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, bw, barH, [3,3,0,0]); else ctx.rect(x, y, bw, barH);
      ctx.fillStyle = colors[gi] + 'CC'; ctx.fill();
      ctx.strokeStyle = colors[gi]; ctx.lineWidth = 1; ctx.stroke();
      bars.push({ x, y, w: bw, h: barH, label: d.label, group: g, value: val, color: colors[gi] });
    });
    ctx.fillStyle = '#82909E'; ctx.textAlign = 'center'; ctx.font = `8.5px 'JetBrains Mono', monospace`;
    const midX = pad.left + (i + 0.5) * (pw / series.length);
    const shortLabel = d.label.length > 8 ? d.label.slice(0,8) + '…' : d.label;
    ctx.fillText(shortLabel, midX, pad.top + ph + 16);
  });

  const legendY = H - 14;
  groups.forEach((g, i) => {
    const lx = pad.left + i * 90;
    ctx.fillStyle = colors[i]; ctx.fillRect(lx, legendY - 7, 10, 7);
    ctx.fillStyle = '#82909E'; ctx.font = `9px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'left'; ctx.fillText(g, lx + 14, legendY);
  });

  return { type: 'bar', bars };
}

// ── LINE ─────────────────────────────────────────────────

function drawLine(canvas, data) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  const pal = chartPalette();

  const lines = data.lines || [];
  const xField = data.x_field || 'period';
  const allPoints = lines.flatMap(l => l.points);
  const allVals   = allPoints.map(p => p.value);
  const yMax = Math.ceil(Math.max(...allVals) / 50) * 50 + 20;
  const yMin = 0;
  const categories = lines[0] ? lines[0].points.map(p => p[xField]) : [];

  const pad = { top: 18, right: 18, bottom: 42, left: 44 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const xS = i => pad.left + (categories.length <= 1 ? 0 : i / (categories.length - 1) * pw);
  const yS = v => pad.top + (1 - (v - yMin) / (yMax - yMin)) * ph;

  // Grid
  ctx.font = `9px 'JetBrains Mono', monospace`; ctx.fillStyle = '#82909E';
  const steps = 4;
  for (let s = 0; s <= steps; s++) {
    const v = (yMax / steps) * s;
    const yp = yS(v);
    ctx.beginPath(); ctx.moveTo(pad.left, yp); ctx.lineTo(pad.left + pw, yp);
    ctx.strokeStyle = 'rgba(20,32,46,0.06)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(Math.round(v), pad.left - 6, yp + 3);
  }
  categories.forEach((c, i) => {
    if (i % Math.ceil(categories.length / 6) !== 0 && i !== categories.length - 1) return;
    ctx.textAlign = 'center'; ctx.fillText(c, xS(i), pad.top + ph + 16);
  });

  // Lines + points
  const colors = lines.map((l, i) => l.color || pal.series[i % pal.series.length]);
  const allDots = [];
  lines.forEach((line, li) => {
    ctx.beginPath();
    line.points.forEach((p, i) => {
      const x = xS(i), y = yS(p.value);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = colors[li]; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    line.points.forEach((p, i) => {
      const x = xS(i), y = yS(p.value);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = colors[li]; ctx.lineWidth = 1.5; ctx.stroke();
      allDots.push({ cx: x, cy: y, value: p.value, period: p[xField], series: line.name, color: colors[li] });
    });
  });

  // Legend
  const legendY = H - 6;
  lines.forEach((l, i) => {
    const lx = pad.left + i * 110;
    ctx.fillStyle = colors[i]; ctx.fillRect(lx, legendY - 7, 10, 3);
    ctx.fillStyle = '#82909E'; ctx.font = `9px 'JetBrains Mono', monospace`; ctx.textAlign = 'left';
    ctx.fillText(l.name, lx + 14, legendY - 3);
  });

  return { type: 'line', dots: allDots, xAxis: data.x_axis, yAxis: data.y_axis };
}

// ── LEGEND BUILDER ───────────────────────────────────────

function buildLegend(wrap, chartInfo) {
  const el = wrap.querySelector('.chart-legend');
  if (!el) return;
  if (chartInfo.type === 'scatter') {
    const seen = new Set();
    const items = (chartInfo.dots || [])
      .filter(d => { if (seen.has(d.group)) return false; seen.add(d.group); return true; })
      .map(d => `<span class="legend-item"><span class="legend-dot" style="background:${d.color}"></span>${safeText(d.group)}</span>`);
    el.innerHTML = items.join('');
  } else if (chartInfo.type === 'donut') {
    el.innerHTML = (chartInfo.series || []).map((d, i) =>
      `<span class="legend-item"><span class="legend-dot" style="background:${chartInfo.palette[i % chartInfo.palette.length]}"></span>${safeText(d[chartInfo.labelField])} ${d[chartInfo.valueField]}%</span>`
    ).join('');
  } else {
    el.innerHTML = '';
  }
}

// ── CHART TOOLTIP — rebuilt fresh per-chart, so old hits never linger ──
// Supports scatter, line (point proximity), donut (wedge angle/radius test),
// and bar (rectangle bounds test).

let currentTooltipCanvas = null;
let currentTooltipHandler = null;

function findDonutHit(wedges, mx, my) {
  for (const w of wedges) {
    const dx = mx - w.cx, dy = my - w.cy;
    const dist = Math.hypot(dx, dy);
    if (dist < w.innerR || dist > w.outerR) continue;
    let ang = Math.atan2(dy, dx);
    // normalize both the point angle and wedge range to a 0..2π span
    // starting at the same -π/2 origin used when drawing
    let start = w.startAngle, end = w.endAngle;
    while (ang < start) ang += Math.PI * 2;
    if (ang >= start && ang <= end) return w;
  }
  return null;
}

function findBarHit(bars, mx, my) {
  return bars.find(b => mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h);
}

function attachChartTooltip(canvas, chartInfo) {
  const tt = document.getElementById('scatter-tooltip');
  if (!tt) return;

  // Detach previous canvas's listeners completely before attaching new ones,
  // so navigating to a new chart never shows stale data from the last one.
  if (currentTooltipCanvas && currentTooltipHandler) {
    currentTooltipCanvas.removeEventListener('mousemove', currentTooltipHandler.move);
    currentTooltipCanvas.removeEventListener('mouseleave', currentTooltipHandler.leave);
  }
  tt.style.opacity = '0';

  const hasHitData =
    (chartInfo.type === 'scatter' || chartInfo.type === 'line') && chartInfo.dots?.length ||
    chartInfo.type === 'donut' && chartInfo.wedges?.length ||
    chartInfo.type === 'bar' && chartInfo.bars?.length;

  if (!hasHitData) {
    currentTooltipCanvas = null;
    currentTooltipHandler = null;
    return;
  }

  const moveHandler = e => {
    const r  = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let html = null;

    if (chartInfo.type === 'scatter' || chartInfo.type === 'line') {
      const hit = chartInfo.dots.find(d => Math.hypot(mx - d.cx, my - d.cy) < 10);
      if (hit) {
        html = chartInfo.type === 'scatter'
          ? `<strong>${safeText(hit.label)}</strong> · ${safeText(hit.group)}<br>${safeText(chartInfo.xAxis)}: ${hit.x} · ${safeText(chartInfo.yAxis)}: ${hit.y}bps`
          : `<strong>${safeText(hit.series)}</strong><br>${safeText(hit.period)}: ${hit.value}`;
      }
    } else if (chartInfo.type === 'donut') {
      const hit = findDonutHit(chartInfo.wedges, mx, my);
      if (hit) {
        html = `<strong>${safeText(hit.label)}</strong><br>${hit.value}% allocation`;
      }
    } else if (chartInfo.type === 'bar') {
      const hit = findBarHit(chartInfo.bars, mx, my);
      if (hit) {
        html = `<strong>${safeText(hit.label)}</strong> · ${safeText(hit.group)}<br>${hit.value}`;
      }
    }

    if (html) {
      tt.style.opacity = '1';
      tt.style.left = (e.clientX + 14) + 'px';
      tt.style.top  = (e.clientY - 12) + 'px';
      tt.innerHTML = html;
    } else {
      tt.style.opacity = '0';
    }
  };
  const leaveHandler = () => { tt.style.opacity = '0'; };

  canvas.addEventListener('mousemove', moveHandler);
  canvas.addEventListener('mouseleave', leaveHandler);

  currentTooltipCanvas = canvas;
  currentTooltipHandler = { move: moveHandler, leave: leaveHandler };
}

// ── SMART CAROUSEL ───────────────────────────────────────
// Strict forward continuity, matching standard carousel conventions
// (the same pattern used by most product/content carousels): paging
// always slides forward by a full row, and the next page picks up exactly
// where the previous one left off. No item is ever re-shown, and a
// trailing partial page (1–2 items) is simply left-aligned in its natural
// position rather than re-centered — re-centering was confusing because
// it made earlier items appear to "come back" into view on every click.
//
// `windowIdx` indexes into a precomputed list of window-start item indices
// — e.g. for 5 items at perView=3, the starts are [0, 3], so page 2 shows
// items 3 and 4, continuing directly on from where page 1 ended.

function initCarousel(section) {
  if (!section) return;
  const trackOuter = section.querySelector('.carousel-track-outer');
  const track   = section.querySelector('.carousel-track');
  const prev    = section.querySelector('.carousel-prev');
  const next    = section.querySelector('.carousel-next');
  const dotsWrap= section.querySelector('.carousel-dots');
  const controls= section.querySelector('.carousel-controls');
  if (!track) return;

  const items = Array.from(track.children);
  const perView = () => window.innerWidth <= 640 ? 1 : window.innerWidth <= 960 ? 2 : 3;
  const GAP = 24;
  let windowIdx = 0;

  function windowStarts() {
    const pv = perView();
    const starts = [];
    for (let i = 0; i < items.length; i += pv) starts.push(i);
    return starts.length ? starts : [0];
  }

  function equalizeHeight() {
    items.forEach(it => { it.style.minHeight = ''; });
    requestAnimationFrame(() => {
      const tallest = Math.max(...items.map(it => it.getBoundingClientRect().height));
      items.forEach(it => { it.style.minHeight = tallest + 'px'; });
    });
  }

  function updateVisibility() {
    const needsNav = items.length > perView();
    if (controls) controls.classList.toggle('hidden', !needsNav);
  }

  function buildDots() {
    if (!dotsWrap) return;
    const starts = windowStarts();
    dotsWrap.innerHTML = '';
    starts.forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'carousel-dot' + (i === windowIdx ? ' active' : '');
      d.setAttribute('aria-label', `Page ${i + 1}`);
      d.addEventListener('click', () => goToWindow(i));
      dotsWrap.appendChild(d);
    });
  }

  function goToWindow(idx) {
    const starts = windowStarts();
    windowIdx = Math.max(0, Math.min(idx, starts.length - 1));
    const pv = perView();
    const startItem = starts[windowIdx];
    const isFullRow = items.length > pv;

    // Only the "whole collection fits in one view" case centers (via CSS);
    // every paged state simply slides — no per-page centering correction.
    if (trackOuter) trackOuter.classList.toggle('center-content', !isFullRow);

    if (!isFullRow) {
      track.style.transform = 'translateX(0)';
    } else {
      const containerW = track.parentElement.clientWidth;
      const itemW = (containerW - GAP * (pv - 1)) / pv;
      const slotW = itemW + GAP;
      track.style.transform = `translateX(-${startItem * slotW}px)`;
    }

    dotsWrap && dotsWrap.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === windowIdx));
    if (prev) prev.disabled = windowIdx === 0;
    if (next) next.disabled = windowIdx >= starts.length - 1;
  }

  prev && prev.addEventListener('click', () => goToWindow(windowIdx - 1));
  next && next.addEventListener('click', () => goToWindow(windowIdx + 1));
  window.addEventListener('resize', () => {
    updateVisibility(); buildDots(); equalizeHeight();
    goToWindow(0);
  });

  updateVisibility();
  buildDots();
  equalizeHeight();
  goToWindow(0);

  window.addEventListener('load', equalizeHeight);
}

// ── RESEARCH NAVIGATION ──────────────────────────────────

let researchItems = [], researchIdx = 0;

async function buildResearch(research) {
  researchItems = research;
  const wrap = document.getElementById('research-card-wrap');
  if (!wrap) return;

  const navControls = document.getElementById('research-nav-controls');
  if (navControls) navControls.classList.toggle('hidden', researchItems.length <= 1);

  await showResearch(0);

  document.getElementById('research-prev')?.addEventListener('click', () => {
    showResearch((researchIdx - 1 + researchItems.length) % researchItems.length);
  });
  document.getElementById('research-next')?.addEventListener('click', () => {
    showResearch((researchIdx + 1) % researchItems.length);
  });
}

async function showResearch(idx) {
  researchIdx = idx;
  const item = researchItems[idx];
  if (!item) return;

  const label = document.getElementById('research-nav-label');
  if (label) label.textContent = `${idx + 1} / ${researchItems.length}`;

  const prev = document.getElementById('research-prev');
  const next = document.getElementById('research-next');
  if (prev) prev.disabled = researchItems.length <= 1;
  if (next) next.disabled = researchItems.length <= 1;

  const card = document.getElementById('research-card-wrap');
  card.style.opacity = '0';
  card.style.transform = 'translateY(8px)';

  document.getElementById('research-title').textContent    = item.title || '';
  document.getElementById('research-subtitle').textContent = item.subtitle || '';

  const type = item.chart_type || 'scatter';
  const body = document.getElementById('research-body');

  if (type === 'photo') {
    // For photo-type samples, chart_data_file is a direct image path
    // (e.g. images/research/research.jpg) — separate from the gallery,
    const imgPath = item.chart_data_file || '';
    const imgSrc  = imgPath ? resolveAsset(imgPath) : '';
    body.innerHTML = `
      <div class="research-photo-panel">
        ${imgSrc
          ? `<img src="${safeText(imgSrc)}" alt="${safeText(item.title)}"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='none'; this.parentElement.querySelector('.research-photo-placeholder').style.display='flex';">`
          : ''}
        <div class="research-photo-caption">${safeText(item.source_note || '')}</div>
        <div class="research-photo-placeholder" style="display:${imgSrc ? 'none' : 'flex'};">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="width:40px;height:40px;opacity:0.3;">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
          </svg>
          <span style="font-size:0.78rem;color:var(--text-muted);text-align:center;margin-top:0.6rem;">
            Set <code style="font-size:0.7rem;color:var(--accent)">chart_data_file</code> in research.csv
          </span>
        </div>
      </div>
      <div class="research-findings-panel" id="research-findings-panel"></div>`;
  } else if (type === 'pdf') {
    const pdfPath = item.chart_data_file || '';
    const pdfSrc  = resolveAsset(pdfPath);
    body.innerHTML = `
      <div class="research-photo-panel">
        <div class="pdf-preview-wrap">
          <iframe id="research-pdf-frame" class="pdf-preview-frame" title="${safeText(item.title)}" loading="lazy"></iframe>
          <button class="pdf-fullscreen-btn" id="pdf-fullscreen-btn" aria-label="View fullscreen" title="View fullscreen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
          </button>
          <div class="pdf-fallback-prompt" id="pdf-fallback-prompt" style="display:none;">
            <span>Inline preview unavailable in this browser.</span>
          </div>
        </div>
        <a href="${safeText(pdfSrc)}" target="_blank" rel="noopener" class="research-photo-caption pdf-open-link">
          Open full PDF
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;display:inline;vertical-align:-1px;">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
          </svg>
        </a>
      </div>
      <div class="research-findings-panel" id="research-findings-panel"></div>`;
  } else {
    body.innerHTML = `
      <div class="research-chart-panel">
        <div class="chart-label">Chart</div>
        <div class="chart-canvas-wrap"><canvas id="research-chart-canvas" class="chart-canvas"></canvas></div>
        <div class="chart-legend"></div>
        <div class="research-source" id="research-source"></div>
      </div>
      <div class="research-findings-panel" id="research-findings-panel"></div>`;
  }

  // Findings
  const findingsPanel = document.getElementById('research-findings-panel');
  let findingsHtml = '';
  for (let i = 1; i <= 3; i++) {
    const t = item[`finding_${i}_title`] || '';
    const p = item[`finding_${i}_text`]  || '';
    if (!t && !p) continue;
    findingsHtml += `<div class="finding-card"><h4>${safeText(t)}</h4><p>${safeText(p)}</p></div>`;
  }
  if (findingsPanel) findingsPanel.innerHTML = findingsHtml;

  if (type === 'pdf') {
    const pdfPath = item.chart_data_file || '';
    initPdfViewer(resolveAsset(pdfPath));
    attachChartTooltip(document.createElement('canvas'), {});
  } else if (type !== 'photo') {
    document.getElementById('research-source').textContent = item.source_note || '';
    const chartData = await loadJSON(item.chart_data_file);
    const canvas = document.getElementById('research-chart-canvas');
    if (canvas && chartData) {
      canvas.style.width = '100%';
      canvas.style.height = '240px';
      setTimeout(() => {
        let info = {};
        if      (type === 'scatter') info = drawScatter(canvas, chartData);
        else if (type === 'donut')   info = drawDonut(canvas, chartData);
        else if (type === 'bar')     info = drawBar(canvas, chartData);
        else if (type === 'line')    info = drawLine(canvas, chartData);
        buildLegend(document.getElementById('research-card-wrap'), info);
        attachChartTooltip(canvas, info);
      }, 60);
    }
  } else {
    // Clear any stale tooltip handlers from a previous chart-type sample
    attachChartTooltip(document.createElement('canvas'), {});
  }

  setTimeout(() => {
    card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  }, 30);
}

// ── PDF VIEWER (native browser rendering, embedded inline + fullscreen) ──
// The canvas/PDF.js single-page-preview approach was unreliable across
// sandboxed environments (worker loading is often blocked or restricted),
// and it only ever showed page 1. Native <iframe> rendering uses the
// browser's own built-in PDF engine: it supports full multi-page scrolling,
// zooming, and text selection with zero external dependencies, and the
// Fullscreen API lets it expand to fill the screen on demand — directly
// matching "view the whole deck, optionally fullscreen" rather than a
// static first-page thumbnail.

function initPdfViewer(pdfPath) {
  const frame = document.getElementById('research-pdf-frame');
  const fallback = document.getElementById('pdf-fallback-prompt');
  const fullscreenBtn = document.getElementById('pdf-fullscreen-btn');
  if (!frame || !pdfPath) {
    if (fallback) fallback.style.display = 'flex';
    return;
  }

  // #toolbar=0&navpanes=0 trims the native PDF viewer's chrome down to just
  // the document itself wherever the browser's PDF engine honours it
  // (Chrome/Edge do; Firefox/Safari show their own minimal toolbar — either
  // way the document underneath renders the same).
  frame.src = pdfPath + '#toolbar=0&navpanes=0&view=FitH';

  // If the browser can't render PDFs inline at all (rare, but some locked-
  // down mobile browsers force a download instead), the iframe will just
  // stay blank. We can't reliably detect that across browsers, so the
  // "Open full PDF" link remains visible at all times as a sure path.

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      const container = frame.closest('.pdf-preview-wrap');
      if (!container) return;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
    });
  }
}


// ── ICON SET ──────────────────────────────────────────────

const ICONS = {
  'chart-line': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  'leaf':       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 8C8 10 5.9 16.17 3.82 19.3c.92.15 1.87.16 2.79-.04C14 17.5 21 12 21 3c-3 2-5 4-4 5z"/></svg>`,
  'shield':     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  'monitor':    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  'award':      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>`,
  'bar-chart':  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  'users':      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  'network':    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
};

// ── RENDER FUNCTIONS ─────────────────────────────────────

function renderEdge(items) {
  return items.map(item => {
    const icon = ICONS[item.icon] || ICONS['bar-chart'];
    const tags = splitSemi(item.tags).map(t => `<span class="edge-tag">${safeText(t)}</span>`).join('');
    return `
      <div class="edge-card">
        <div class="edge-card-icon">${icon}</div>
        <h3>${safeText(item.title)}</h3>
        <p>${safeText(item.description)}</p>
        <div class="edge-tags">${tags}</div>
      </div>`;
  }).join('');
}

function renderAchievements(items) {
  return items.map(item => {
    const tags = splitSemi(item.tags).map(t => `<span class="ach-tag">${safeText(t)}</span>`).join('');
    return `
      <div class="ach-card">
        <div class="ach-metric">${safeText(item.metric_value)}</div>
        <div class="ach-metric-label">${safeText(item.metric_label)}</div>
        <div class="ach-title">${safeText(item.title)}</div>
        <div class="ach-subtitle">${safeText(item.subtitle)}</div>
        <div class="ach-desc">${safeText(item.description)}</div>
        <div class="ach-tags">${tags}</div>
      </div>`;
  }).join('');
}

function renderExperience(items, type) {
  return items.filter(i => i.type === type).map(item => {
    const highlights = splitSemi(item.highlights).map(h => `<li>${safeText(h)}</li>`).join('');
    const hasLogo = !!(item.logo && item.logo.trim());
    const hasLink = !!(item.external_link && item.external_link.trim());

    // The logo column div is ALWAYS rendered, even when this item has no
    // logo — only its contents differ. This keeps every item's grid
    // (logo | rail | content) at identical column widths, so the rail and
    // content line up perfectly whether or not a given row has a logo.
    // Visually, a logo-less row just shows an empty 56px gap on the left.
    const logoColHtml = hasLogo
      ? `<div class="timeline-logo-col">
           <div class="timeline-logo">
             <img src="${safeText(resolveAsset(item.logo))}" alt="${safeText(item.organization)} logo"
                  onerror="this.closest('.timeline-item').classList.add('no-logo');">
           </div>
         </div>`
      : `<div class="timeline-logo-col"></div>`;

    // External link sits below the highlights and is simply omitted (not
    // a disabled/greyed placeholder) when the CSV cell is blank.
    const linkHtml = hasLink
      ? `<a href="${safeText(item.external_link)}" target="_blank" rel="noopener" class="timeline-link">
           View details
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
         </a>`
      : '';

    return `
      <div class="timeline-item reveal${hasLogo ? '' : ' no-logo'}">
        ${logoColHtml}
        <div class="timeline-rail">
          <div class="timeline-dot"></div>
        </div>
        <div class="timeline-content">
          <div class="timeline-period">${safeText(item.period)}</div>
          <div class="timeline-title">${safeText(item.title)}</div>
          <div class="timeline-org">${safeText(item.organization)} · ${safeText(item.location)}</div>
          <div class="timeline-desc">${safeText(item.description)}</div>
          <ul class="timeline-highlights">${highlights}</ul>
          ${linkHtml}
        </div>
      </div>`;
  }).join('');
}

function renderCredentials(items) {
  return items.map(item => {
    const logoImg = item.logo_file
      ? `<img src="${safeText(resolveAsset(item.logo_file))}" alt="${safeText(item.credential)} logo"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <span class="cred-logo-fallback" style="display:none">${safeText(item.credential)}</span>`
      : `<span class="cred-logo-fallback">${safeText(item.credential)}</span>`;
    return `
      <div class="cred-card" style="--card-accent:${item.badge_color || 'var(--accent)'}">
        <div class="cred-logo-wrap">${logoImg}</div>
        <div class="cred-full-name">${safeText(item.credential_full_name)}</div>
        <div class="cred-meta">${safeText(item.issuer)} · ${safeText(item.year)}</div>
        <div class="cred-status">${safeText(item.status)}</div>
        <div class="cred-desc">${safeText(item.description)}</div>
        <a href="${safeText(item.verify_url)}" target="_blank" rel="noopener" class="cred-link">
          Verify
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
        </a>
      </div>`;
  }).join('');
}

function renderGallery(items) {
  return items.map(item => {
    const icon = ICONS[item.placeholder_icon] || ICONS['monitor'];
    return `
      <div class="gallery-item">
        <img src="${safeText(resolveAsset(item.image))}" alt="${safeText(item.caption)}"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
        <div class="gallery-placeholder" style="display:none">
          ${icon}
          <span>${safeText(item.placeholder_label)}<br><code style="font-size:0.62rem;color:var(--accent)">${safeText(item.image)}</code></span>
        </div>
        <div class="gallery-caption">${safeText(item.caption)}</div>
      </div>`;
  }).join('');
}

function populateProfile(profile) {
  const g = k => profile.find(p => p.key === k)?.value || '';

  // The full name renders as one consistent bold weight — previously only
  // the last word was bolded, which would have looked inconsistent once a
  // smaller, unbolded credentials suffix (", CFA, FRM, CAIA") is appended
  // right after it. Bolding the whole name uniformly, then dropping the
  // suffix down in both weight and size, reads as a natural extension of
  // the name rather than two competing styles.
  const nameEl = document.getElementById('hero-name');
  const suffix = g('name_suffix');
  if (nameEl) {
    nameEl.innerHTML = `<strong>${safeText(g('name'))}</strong>` +
      (suffix ? `<span class="hero-name-suffix">${safeText(suffix)}</span>` : '');
  }

  const titleEl = document.getElementById('hero-title');
  if (titleEl) {
    const t1 = g('title_line1');
    const t2 = g('title_line2');
    titleEl.textContent = t2 ? t1 + ' · ' + t2 : t1;
  }

  const taglineEl = document.getElementById('hero-tagline');
  if (taglineEl) taglineEl.textContent = g('tagline');

  // Nav logo (top-left header) intentionally shows the name ONLY — no
  // credentials suffix, since that space is tight and the suffix is a
  // hero-only flourish, not an identity label needed throughout the page.
  const parts = g('name').split(' ');
  const logoName = document.getElementById('nav-logo-name');
  const logoSurname = document.getElementById('nav-logo-surname');
  if (logoName) logoName.textContent = parts[0] || '';
  if (logoSurname) logoSurname.textContent = ' ' + parts.slice(1).join(' ');

  // Nav avatar — only the image OR initials shows, never both
  const avatarImg = document.getElementById('nav-avatar-img');
  const avatarInitials = document.getElementById('nav-avatar-initials');
  const initialsText = parts.map(w => w[0]).join('').slice(0,2).toUpperCase();
  if (avatarInitials) avatarInitials.textContent = initialsText;

  const thumbSrc = g('photo_thumb') || g('photo');
  if (avatarImg && thumbSrc) {
    avatarImg.src = resolveAsset(thumbSrc);
    avatarImg.style.display = '';
    avatarImg.onload = () => { if (avatarInitials) avatarInitials.style.display = 'none'; };
    avatarImg.onerror = () => {
      avatarImg.style.display = 'none';
      if (avatarInitials) avatarInitials.style.display = 'flex';
    };
  } else if (avatarInitials) {
    avatarInitials.style.display = 'flex';
    if (avatarImg) avatarImg.style.display = 'none';
  }

  const photoImg = document.getElementById('hero-photo-img');
  const photoSrc = g('photo');
  const photoHint = document.getElementById('hero-photo-hint');
  if (photoHint) photoHint.textContent = photoSrc;
  if (photoImg) {
    photoImg.style.display = 'block';
    photoImg.src = resolveAsset(photoSrc);
  }

  document.querySelectorAll('[data-email]').forEach(el => { el.href = 'mailto:' + g('email'); });
  document.querySelectorAll('[data-linkedin]').forEach(el => { el.href = g('linkedin'); });
  const cvSrc = resolveAsset(g('cv_file'));
  const cvFilename = g('name') ? g('name').replace(/\s+/g, '_') + '_CV.pdf' : 'CV.pdf';
  document.querySelectorAll('[data-cv]').forEach(el => {
    el.href = cvSrc;
    el.setAttribute('download', cvFilename);
  });

  // Theme + section visibility from CSV
  initTheme(g('theme'));
  if (g('show_research').toLowerCase() === 'false') {
    const researchSection = document.getElementById('research');
    if (researchSection) researchSection.style.display = 'none';
  }
  if (g('show_hero_stats').toLowerCase() === 'false') {
    const proofStrip = document.getElementById('hero-proof-strip');
    if (proofStrip) proofStrip.style.display = 'none';
    const spotlight = document.getElementById('hero-spotlight-wrap');
    if (spotlight) spotlight.style.display = 'none';
  }

  // Re-stripe the alternating section backgrounds based on which sections
  // are ACTUALLY visible, not their fixed position in the HTML. Without
  // this, hiding a section (e.g. Research via show_research=false) would
  // leave a stale gap in the pattern — the sections before and after the
  // hidden one could end up with the same background and no visual
  // separation between them, which is exactly what happened previously.
  restripeSectionBackgrounds();

  // Hero background photo (optional, falls back to the plain animated banner
  // if the file is missing) and animation style: particles | leaves | none
  initHeroBgPhoto(resolveAsset(g('hero_bg_photo')));
  const heroCanvas = document.getElementById('hero-canvas');
  if (heroCanvas) initHeroCanvas(heroCanvas, g('hero_animation'));

  // ── Text fields from CSV — every visible string is configurable ──────

  // Page title and hero mono strip
  const pageTitle = g('page_title');
  if (pageTitle) document.title = pageTitle;
  setText('hero-mono',    g('hero_mono'));
  setText('footer-meta',  g('footer_meta'));

  // Section eyebrows, titles, subtitles
  setText('edge-eyebrow',          g('edge_eyebrow'));
  setText('edge-title',            g('edge_title'));
  setText('edge-subtitle',         g('edge_subtitle'));
  setText('achievements-eyebrow',  g('achievements_eyebrow'));
  setText('achievements-title',    g('achievements_title'));
  setText('achievements-subtitle', g('achievements_subtitle'));
  setText('experience-eyebrow',    g('experience_eyebrow'));
  setText('experience-title',      g('experience_title'));
  setText('experience-subtitle',   g('experience_subtitle'));
  setText('credentials-eyebrow',   g('credentials_eyebrow'));
  setText('credentials-title',     g('credentials_title'));
  setText('credentials-subtitle',  g('credentials_subtitle'));
  setText('research-eyebrow',      g('research_eyebrow'));
  setText('research-title-section',g('research_title'));
  setText('research-subtitle',     g('research_subtitle'));
  setText('gallery-eyebrow',       g('gallery_eyebrow'));
  setText('gallery-title',         g('gallery_title'));
  setText('gallery-subtitle',      g('gallery_subtitle'));

  // Contact section title (supports inner <strong> via innerHTML)
  const contactTitleEl = document.getElementById('contact-title');
  if (contactTitleEl) {
    const ct = g('contact_title') || "Let's Connect";
    // Bold the last word for visual emphasis, matching the original design
    const words = ct.split(' ');
    contactTitleEl.innerHTML = words.slice(0, -1).join(' ') +
      (words.length > 1 ? ' ' : '') +
      `<strong>${safeText(words[words.length - 1])}</strong>`;
  }

  // Experience tab labels
  setText('tab-corporate',  g('experience_tab_corporate'));
  setText('tab-academic',   g('experience_tab_academic'));
  setText('tab-continuous', g('experience_tab_continuous'));
}

// ── NAV SCROLL — avatar slides in without shifting nav links ──

function initNav() {
  const slot = document.getElementById('nav-avatar-slot');
  const avatarImg = document.getElementById('nav-avatar-img');
  const avatarInitials = document.getElementById('nav-avatar-initials');
  const heroSection = document.getElementById('hero');

  window.addEventListener('scroll', () => {
    const heroH = heroSection ? heroSection.offsetHeight * 0.5 : 300;
    const past  = window.scrollY > heroH;
    if (slot) slot.classList.toggle('visible', past);
    if (avatarImg && avatarImg.style.display !== 'none') avatarImg.classList.toggle('visible', past);
    if (avatarInitials && avatarInitials.style.display !== 'none') avatarInitials.classList.toggle('visible', past);
  }, { passive: true });
}

function initProgress() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
    bar.style.width = pct + '%';
  }, { passive: true });
}

// Sections that participate in the page/surface background alternation —
// the hero and contact band are excluded since they have their own fixed
// treatments (hero banner, dark navy footer band).
const ALTERNATING_SECTION_IDS = ['edge', 'achievements', 'experience', 'credentials', 'research', 'gallery'];

function restripeSectionBackgrounds() {
  let visibleIndex = 0;
  ALTERNATING_SECTION_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    // getComputedStyle, not el.style.display, so this also respects a
    // section hidden via a CSS rule rather than only an inline style.
    const isHidden = getComputedStyle(el).display === 'none';
    if (isHidden) return;
    el.classList.toggle('section-alt', visibleIndex % 2 === 1);
    visibleIndex++;
  });
}

function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const links    = document.querySelectorAll('.nav-links a');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const a = document.querySelector(`.nav-links a[href="#${e.target.id}"]`);
        if (a) a.classList.add('active');
      }
    });
  }, { rootMargin: '-35% 0px -60% 0px' });
  sections.forEach(s => io.observe(s));
}

function initReveal() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

function initExpTabs() {
  document.querySelectorAll('.exp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.exp-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.exp-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) {
        panel.classList.add('active');
        panel.querySelectorAll('.reveal').forEach(el => {
          if (!el.classList.contains('visible')) setTimeout(() => el.classList.add('visible'), 50);
        });
      }
    });
  });
}

// ── MAIN ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  const [profile, edge, achievements, experience, credentials, research, gallery, stats] = await Promise.all([
    loadCSV('data/profile.csv'),
    loadCSV('data/edge.csv'),
    loadCSV('data/achievements.csv'),
    loadCSV('data/experience.csv'),
    loadCSV('data/credentials.csv'),
    loadCSV('data/research.csv'),
    loadCSV('data/gallery.csv'),
    loadCSV('data/stats.csv'),
  ]);

  if (profile.length) populateProfile(profile);

  // Inline proof strip — editorial row of stats inside the hero text column
  const heroProofStrip = document.getElementById('hero-proof-strip');
  if (heroProofStrip && stats.length) {
    heroProofStrip.innerHTML = stats.map(s => `
      <div class="hero-proof-item">
        <span class="hero-proof-value">${safeText(s.value)}</span>
        <span class="hero-proof-label">${safeText(s.label)}</span>
      </div>`).join('');
  }

  // Achievement spotlight — rotating teaser at hero base
  const spotlightInner = document.getElementById('hero-spotlight-inner');
  if (spotlightInner && achievements.length) {
    let spotIdx = 0;
    const renderSpotlight = (idx) => {
      const a = achievements[idx];
      const dots = achievements.map((_, i) =>
        `<button class="hero-spotlight-dot${i === idx ? ' active' : ''}" data-i="${i}" aria-label="Achievement ${i+1}"></button>`
      ).join('');
      spotlightInner.innerHTML = `
        <div class="hero-spotlight-eyebrow">Key Achievement</div>
        <a href="#achievements" class="hero-spotlight">
          <div class="hero-spotlight-metric">
            <div class="hero-spotlight-metric-value">${safeText(a.metric_value)}</div>
            <div class="hero-spotlight-metric-label">${safeText(a.metric_label)}</div>
          </div>
          <div class="hero-spotlight-body">
            <div class="hero-spotlight-title">${safeText(a.title)}</div>
            <div class="hero-spotlight-sub">${safeText(a.subtitle)}</div>
          </div>
          <div class="hero-spotlight-nav">${dots}</div>
        </a>`;
      // dot click handlers
      spotlightInner.querySelectorAll('.hero-spotlight-dot').forEach(dot => {
        dot.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          spotIdx = parseInt(dot.dataset.i);
          clearInterval(timer);
          renderSpotlight(spotIdx);
          timer = setInterval(advance, 7000);
        });
      });
    };
    const advance = () => {
      spotIdx = (spotIdx + 1) % achievements.length;
      renderSpotlight(spotIdx);
    };
    renderSpotlight(0);
    let timer = setInterval(advance, 7000);
  }

  const edgeTrack = document.getElementById('edge-track');
  if (edgeTrack && edge.length) {
    edgeTrack.innerHTML = renderEdge(edge);
    initCarousel(document.getElementById('edge-carousel'));
  }

  const achTrack = document.getElementById('ach-track');
  if (achTrack && achievements.length) {
    achTrack.innerHTML = renderAchievements(achievements);
    initCarousel(document.getElementById('ach-carousel'));
  }

  const corpPanel = document.getElementById('tab-corporate');
  if (corpPanel) corpPanel.innerHTML = `<div class="timeline">${renderExperience(experience, 'corporate')}</div>`;
  const acadPanel = document.getElementById('tab-academic');
  if (acadPanel) acadPanel.innerHTML = `<div class="timeline">${renderExperience(experience, 'academic')}</div>`;

  // The Professional Development tab is entirely optional — it only
  // appears if experience.csv actually contains at least one row with
  // type=continuous. This keeps the tab bar from showing an empty,
  // pointless third tab for anyone who hasn't added that content yet.
  const hasContinuous = experience.some(i => i.type === 'continuous');
  const contPanel = document.getElementById('tab-continuous');
  const contBtn = document.querySelector('.exp-tab-btn[data-tab="continuous"]');
  if (hasContinuous) {
    if (contPanel) contPanel.innerHTML = `<div class="timeline">${renderExperience(experience, 'continuous')}</div>`;
  } else {
    if (contBtn) contBtn.style.display = 'none';
    if (contPanel) contPanel.style.display = 'none';
  }

  const credTrack = document.getElementById('cred-track');
  if (credTrack && credentials.length) {
    credTrack.innerHTML = renderCredentials(credentials);
    initCarousel(document.getElementById('cred-carousel'));
  }

  const galleryTrack = document.getElementById('gallery-track');
  if (galleryTrack && gallery.length) {
    galleryTrack.innerHTML = renderGallery(gallery);
    initCarousel(document.getElementById('gallery-carousel'));
  }

  if (research.length) await buildResearch(research);

  initNav();
  initProgress();
  initActiveNav();
  initExpTabs();

  setTimeout(initReveal, 150);
});
