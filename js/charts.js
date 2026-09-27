'use strict';

const PALETTE = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5'];

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, rect.width * dpr);
  canvas.height = Math.max(1, rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function formatShort(n) {
  n = Number(n) || 0;
  if (Math.abs(n) >= 100000) return (n / 100000).toFixed(1) + 'L';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(Math.round(n));
}

/* Grouped bar chart: series = [{ name, color, values }], labels = [...] */
function drawGroupedBarChart(canvas, labels, series) {
  const { ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  if (!labels.length) { drawEmpty(ctx, width, height); return; }

  const padding = { top: 16, right: 12, bottom: 34, left: 46 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = niceCeiling(maxVal);

  // gridlines + y labels
  ctx.strokeStyle = '#e5e7eb';
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'right';
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + chartH - (chartH * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
    ctx.fillText(formatShort((niceMax * i) / gridLines), padding.left - 6, y + 3);
  }

  const groupW = chartW / labels.length;
  const barGap = 4;
  const barW = Math.max(2, (groupW - barGap * (series.length + 1)) / series.length);

  labels.forEach((label, gi) => {
    const groupX = padding.left + gi * groupW;
    series.forEach((s, si) => {
      const val = s.values[gi] || 0;
      const barH = (val / niceMax) * chartH;
      const x = groupX + barGap + si * (barW + barGap);
      const y = padding.top + chartH - barH;
      ctx.fillStyle = s.color;
      ctx.fillRect(x, y, barW, Math.max(0, barH));
    });
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(shortenLabel(label), groupX + groupW / 2, padding.top + chartH + 16);
  });

  drawLegend(ctx, width, padding.top - 10, series.map((s) => ({ label: s.name, color: s.color })));
}

/* Simple doughnut chart */
function drawDoughnutChart(canvas, labels, values) {
  const { ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const total = values.reduce((a, b) => a + b, 0);
  if (!labels.length || total <= 0) { drawEmpty(ctx, width, height); return; }

  const legendH = Math.ceil(labels.length / 2) * 18 + 10;
  const cx = width / 2;
  const cy = (height - legendH) / 2 + 6;
  const radius = Math.min(cx, cy) - 10;
  const inner = radius * 0.55;

  let start = -Math.PI / 2;
  labels.forEach((label, i) => {
    const slice = (values[i] / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fill();
    start += slice;
  });

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  drawLegend(ctx, width, height - legendH, labels.map((l, i) => ({ label: l, color: PALETTE[i % PALETTE.length] })), true);
}

function drawLegend(ctx, width, top, items, wrap) {
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'left';
  let x = 8, y = top + 12;
  const maxWidth = width - 16;
  items.forEach((item) => {
    const label = shortenLabel(item.label, 14);
    const textW = ctx.measureText(label).width;
    const itemW = 16 + textW + 14;
    if (wrap && x + itemW > maxWidth) { x = 8; y += 18; }
    ctx.fillStyle = item.color;
    ctx.fillRect(x, y - 8, 10, 10);
    ctx.fillStyle = '#374151';
    ctx.fillText(label, x + 14, y + 1);
    x += itemW;
  });
}

function drawEmpty(ctx, width, height) {
  ctx.fillStyle = '#9ca3af';
  ctx.font = '13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('কোনো ডেটা নেই', width / 2, height / 2);
}

function shortenLabel(label, max = 10) {
  const s = String(label);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function niceCeiling(value) {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  let niceFrac;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * base;
}

window.Charts = { drawGroupedBarChart, drawDoughnutChart };
