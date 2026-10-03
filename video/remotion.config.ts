// Remotion CLI config (studio + render). See README.md.
import fs from 'node:fs';
import path from 'node:path';
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);

/**
 * Prefer a Chromium that is already on the machine (Playwright's headless shell under
 * /opt/pw-browsers, or REMOTION_BROWSER_EXECUTABLE) over downloading Remotion's own. If neither is
 * found, Remotion downloads chrome-headless-shell on first render.
 */
function findBrowser(): string | null {
  const fromEnv = process.env.REMOTION_BROWSER_EXECUTABLE;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(root)) return null;
  const dirs = fs.readdirSync(root).sort().reverse();
  for (const d of dirs.filter((x) => x.startsWith('chromium_headless_shell'))) {
    const p = path.join(root, d, 'chrome-linux', 'headless_shell');
    if (fs.existsSync(p)) return p;
  }
  for (const d of dirs.filter((x) => /^chromium-\d+/.test(x))) {
    const p = path.join(root, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const browser = findBrowser();
if (browser) Config.setBrowserExecutable(browser);
