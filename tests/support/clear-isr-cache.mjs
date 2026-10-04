// Run before the e2e stack's `next start` (playwright.config.ts). The invitation pages Next cached on disk
// in an earlier run (.next/server/app/i/<slug>: ISR output — none is prerendered by the build) outlive the
// database a run resets, and the new run hands out the same slugs ("noa-and-itay"): a draft would be
// answered with the page of the invitation that was published under that slug last time (a 200 where the
// test expects the friendly 404).
import { rmSync } from 'node:fs';

rmSync('.next/server/app/i', { recursive: true, force: true });
