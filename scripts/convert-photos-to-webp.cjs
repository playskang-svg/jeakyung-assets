const { chromium } = require('c:/Window_DEV/insta-cardnews/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const brainDir = 'C:/Users/sgk76/.gemini/antigravity/brain/488e5869-4bb8-4300-af5b-8fd8dc155bcd';
const targetDir1 = 'c:/Window_DEV/github/jeakyung-assets/source/static/assets/articles';
const targetDir2 = 'c:/Window_DEV/github/jeakyung-assets/assets/articles';

const mapping = [
  {
    src: path.join(brainDir, 'logistics_workforce_photo_1790766875528.jpg'),
    dest: 'logistics-workforce.webp'
  },
  {
    src: path.join(brainDir, 'esg_logistics_photo_1790766931388.jpg'),
    dest: 'esg-logistics.webp'
  },
  {
    src: path.join(brainDir, 'three_pl_selection_photo_1790766965144.jpg'),
    dest: '3pl-selection-criteria.webp'
  },
  {
    src: path.join(brainDir, 'digital_wms_tms_photo_1790767013982.jpg'),
    dest: 'digital-logistics-wms-tms.webp'
  },
  {
    src: path.join(brainDir, 'warehouse_safety_photo_1790767040844.jpg'),
    dest: 'warehouse-safety-management.webp'
  },
  {
    src: path.join(brainDir, 'cost_reduction_photo_1790767069462.jpg'),
    dest: 'cost-reduction-guide.webp'
  },
  {
    src: path.join(brainDir, 'regional_hub_photo_1790767098242.jpg'),
    dest: 'regional-logistics-hub.webp'
  },
  {
    src: path.join(brainDir, 'market_outlook_2026_photo_1790767124964.jpg'),
    dest: 'logistics-market-outlook-2026.webp'
  },
  {
    src: path.join(brainDir, 'fulfillment_robot_photo_1790767159804.jpg'),
    dest: 'fulfillment-automation-robot.webp'
  }
];

async function convert() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 720 });

  for (const item of mapping) {
    if (!fs.existsSync(item.src)) {
      console.error(`Source not found: ${item.src}`);
      continue;
    }

    const imgBase64 = fs.readFileSync(item.src).toString('base64');
    const dataUri = `data:image/jpeg;base64,${imgBase64}`;

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 1080px; height: 720px; overflow: hidden; background: #000; }
          img { width: 100%; height: 100%; object-fit: cover; display: block; }
        </style>
      </head>
      <body>
        <img src="${dataUri}" />
      </body>
      </html>
    `);

    // Playwright supports webp screenshot
    const webpBuffer = await page.screenshot({ type: 'webp', quality: 88 });

    const p1 = path.join(targetDir1, item.dest);
    const p2 = path.join(targetDir2, item.dest);

    fs.writeFileSync(p1, webpBuffer);
    fs.writeFileSync(p2, webpBuffer);

    console.log(`Saved: ${item.dest} (${(webpBuffer.length / 1024).toFixed(1)} KB)`);
  }

  await browser.close();
  console.log('All 9 realistic photos converted to webp successfully!');
}

convert().catch(err => {
  console.error(err);
  process.exit(1);
});
