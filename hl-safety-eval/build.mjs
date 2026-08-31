#!/usr/bin/env node
// Builds the static site from data/documents.json by fetching each Google
// Doc/Sheet's export at build time. Run with `npm run build`.
//
// Content-fidelity contract: the HTML embedded in docs/{no}.html is exactly
// what Google exported (only structural cleanup, see lib/clean-*.mjs) — the
// same export endpoints the download buttons link to. Nothing here is
// hand-typed. Re-run this script any time a source Google Doc/Sheet changes.
//
// Offline/dev convenience: set EXPORT_CACHE_DIR to a local folder to cache
// each fetch and fall back to that cache if the network call fails. Normal
// runs (Netlify, a contributor's laptop) never need this — they just fetch.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanGoogleDocHtml } from './lib/clean-doc.mjs';
import { cleanGoogleSheetCsv } from './lib/clean-sheet.mjs';
import { renderIndexPage, renderDocPage } from './lib/templates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = process.env.EXPORT_CACHE_DIR
  ? path.resolve(process.env.EXPORT_CACHE_DIR)
  : null;

const SIGNATURE_TARGETS = new Set([
  '1-1', '2-1', '2-3', '2-4', '3-1', '3-2', '4-1', '5-2', '8-1', '9-1', '11-2', '가점-1', '가점-2',
]);

function exportUrl(doc, format) {
  const kind = doc.type === 'document' ? 'document' : 'spreadsheets';
  return `https://docs.google.com/${kind}/d/${doc.id}/export?format=${format}`;
}

async function fetchExport(doc) {
  const ext = doc.type === 'document' ? 'html' : 'csv';
  const format = doc.type === 'document' ? 'html' : 'csv';
  const url = exportUrl(doc, format);
  const cachePath = CACHE_DIR ? path.join(CACHE_DIR, `${doc.no}.${ext}`) : null;

  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.includes('accounts.google.com') || text.includes('ServiceLogin')) {
      throw new Error('received a Google sign-in page — the Drive folder is not shared as "anyone with the link"');
    }
    if (cachePath) {
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, text, 'utf8');
    }
    return text;
  } catch (err) {
    if (cachePath && existsSync(cachePath)) {
      console.warn(`  ! network fetch failed for ${doc.no} (${err.message}); using cached copy at ${cachePath}`);
      return fs.readFile(cachePath, 'utf8');
    }
    throw new Error(`Failed to fetch ${doc.no} (${url}): ${err.message}`);
  }
}

async function buildDoc(doc) {
  const raw = await fetchExport(doc);
  if (doc.type === 'document') {
    return cleanGoogleDocHtml(raw, SIGNATURE_TARGETS.has(doc.no));
  }
  return cleanGoogleSheetCsv(raw);
}

async function main() {
  const documents = JSON.parse(await fs.readFile(path.join(__dirname, 'data/documents.json'), 'utf8'));
  const docsDir = path.join(__dirname, 'docs');
  await fs.mkdir(docsDir, { recursive: true });

  console.log(`Building ${documents.length} documents${CACHE_DIR ? ` (cache: ${CACHE_DIR})` : ''}...`);

  const failures = [];
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    process.stdout.write(`  [${i + 1}/${documents.length}] ${doc.no}. ${doc.title} ... `);
    try {
      const contentHtml = await buildDoc(doc);
      const prevDoc = documents[i - 1] || null;
      const nextDoc = documents[i + 1] || null;
      const pageHtml = renderDocPage(doc, contentHtml, prevDoc, nextDoc);
      const outPath = path.join(docsDir, `${doc.no}.html`);
      await fs.writeFile(outPath, pageHtml, 'utf8');
      console.log(`OK (${(contentHtml.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failures.push({ doc, error: err });
    }
  }

  const indexHtml = renderIndexPage(documents);
  await fs.writeFile(path.join(__dirname, 'index.html'), indexHtml, 'utf8');
  console.log('Wrote index.html');

  await fs.writeFile(path.join(__dirname, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');
  console.log('Wrote robots.txt');

  if (failures.length > 0) {
    console.error(`\n${failures.length} document(s) failed to build:`);
    for (const f of failures) console.error(`  - ${f.doc.no}: ${f.error.message}`);
    process.exitCode = 1;
  } else {
    console.log(`\nBuild complete: ${documents.length} documents + index.html`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
