#!/usr/bin/env node
// generate.js — rebuilds html/index.html from a JSON data file and an HTML template
'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function flag(name) {
  const i = argv.indexOf(name);
  return (i !== -1 && argv[i + 1]) ? argv[i + 1] : null;
}

const dataPath     = argv.find(a => !a.startsWith('-'));
const templatePath = flag('--template') ?? path.resolve(__dirname, '..', 'template.html');
const outputPath   = flag('--output')   ?? path.resolve(__dirname, '..', 'html', 'index.html');

if (!dataPath) {
  process.stderr.write(
    'Usage: generate.js <data.json> [--template <file>] [--output <file>]\n'
  );
  process.exit(1);
}

// ── LOAD DATA ────────────────────────────────────────────────────────────────

const data    = JSON.parse(fs.readFileSync(path.resolve(dataPath), 'utf8'));
const seasons = data.seasons ?? [];

if (!seasons.length) {
  process.stderr.write('Error: no seasons found in data file\n');
  process.exit(1);
}

// ── DATE HELPERS ─────────────────────────────────────────────────────────────

// Parse an ISO date string (YYYY-MM-DD) without timezone shifts
function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDE(s) {
  return parseISO(s).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function countdownLabel(item) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = parseISO(item.dateFrom);
  const end   = parseISO(item.dateTo);
  const daysLeft  = Math.round((end   - today) / 86_400_000);
  const daysUntil = Math.round((start - today) / 86_400_000);

  if (daysUntil > 0)  return `Ab ${formatDE(item.dateFrom)}`;
  if (daysLeft  > 1)  return `Noch ${daysLeft} Tage`;
  if (daysLeft === 1) return 'Morgen letzter Tag';
  if (daysLeft === 0) return 'Letzter Tag';
  // already finished — show the full date range
  return `${formatDE(item.dateFrom)}\u2013${formatDE(item.dateTo)}`;
}

// ── LOAD TEMPLATE ────────────────────────────────────────────────────────────

let tpl = fs.readFileSync(path.resolve(templatePath), 'utf8');

// Extract the per-item sub-template from a named HTML comment block, then
// strip that block from the main template so it doesn't appear in output.
const subMatch = tpl.match(/<!--\s*TEMPLATE:PAST_ITEM\s*([\s\S]*?)-->/);
const itemTpl  = subMatch?.[1]?.trim() ?? '';
if (subMatch) tpl = tpl.replace(subMatch[0], '');

// ── BUILD VALUES ─────────────────────────────────────────────────────────────

const current = seasons[0];

function fill(template, vars) {
  return template.replace(/{{(\w+)}}/g, (_, key) => vars[key] ?? '');
}

function artistLink(item) {
  if (!item.artist_url) return item.artist;
  return `<a href="${item.artist_url}" target="_blank" rel="noopener noreferrer">${item.artist}</a>`;
}

function renderPastItem(item) {
  return fill(itemTpl, {
    IMAGE:        item.image,
    TITLE:        item.title,
    ARTIST:       item.artist,
    ARTIST_LINK:  artistLink(item),
    DESCRIPTION:  item.description ?? '',
    SEASON_NUM:   item.seasonNumber,
    DATE_FROM:    formatDE(item.dateFrom),
    DATE_TO:      formatDE(item.dateTo),
  });
}

const pastHtml = seasons.slice(1).map(renderPastItem).join('\n');

const vars = {
  SITE_TITLE:            data.siteTitle ?? '13 Jahreszeiten',
  CURRENT_IMAGE:         current.image,
  CURRENT_IMAGE_ALT:     `${current.title} \u2013 ${current.artist}`,
  CURRENT_TITLE:         current.title,
  CURRENT_ARTIST:        current.artist,
  CURRENT_ARTIST_LINK:   artistLink(current),
  CURRENT_DESCRIPTION:   current.description ?? '',
  SEASON_NUMBER:         current.seasonNumber,
  DATE_RANGE:            `${formatDE(current.dateFrom)}\u2013${formatDE(current.dateTo)}`,
  DAYS_REMAINING_LABEL:  countdownLabel(current),
  PAST_WORKS:            pastHtml,
};

// ── RENDER & WRITE ───────────────────────────────────────────────────────────

const output = fill(tpl, vars);

const outAbs = path.resolve(outputPath);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
fs.writeFileSync(outAbs, output, 'utf8');
process.stdout.write(`✓  ${outAbs}\n`);
