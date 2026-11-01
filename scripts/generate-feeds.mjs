import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSitemap, generateRss } from '../feed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sitemap = await generateSitemap();
const rss = await generateRss();

await fs.writeFile(path.join(root, 'sitemap.xml'), sitemap, 'utf8');
await fs.writeFile(path.join(root, 'rss.xml'), rss, 'utf8');

const sourceStatic = path.join(root, 'source/static');
try {
  await fs.writeFile(path.join(sourceStatic, 'sitemap.xml'), sitemap, 'utf8');
  await fs.writeFile(path.join(sourceStatic, 'rss.xml'), rss, 'utf8');
} catch (e) {
  // ignore if source/static doesn't exist
}

console.log('✔ sitemap.xml and rss.xml generated successfully!');
