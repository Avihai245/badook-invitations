import { EVENT_DAY } from '@/features/event-day/config';

/**
 * /e/table-sw.js — the service worker that keeps a guest's table guide on their phone for the evening
 * (features/event-day/ui/guide/useOfflineSave.ts registers it for /e/<slug>/table only). The page asks
 * it to keep the page, its files and the floor plan; the page itself is always asked of the network
 * first (the guest sees today's table), and comes from the phone when there is no answer. What it
 * keeps goes after EVENT_DAY.offlineHours.
 */
const SCRIPT = `'use strict';
const CACHE = 'badook-table-v1';
const SAVED = '/__badook-table-saved';
const MAX_AGE = ${EVENT_DAY.offlineHours} * 3600 * 1000;
const OFFLINE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font:16px system-ui;padding:32px;text-align:center"><p>אין קליטה כרגע. נסו שוב בעוד רגע.</p><p>No signal right now. Try again in a moment.</p></body>';

async function expire() {
  for (const name of await caches.keys()) if (name.startsWith('badook-table-') && name !== CACHE) await caches.delete(name);
  const cache = await caches.open(CACHE);
  const saved = await cache.match(SAVED);
  if (saved && Date.now() - Number(await saved.text()) > MAX_AGE) await caches.delete(CACHE);
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(expire().then(() => self.clients.claim())));

self.addEventListener('message', (e) => {
  const d = e.data;
  const port = e.ports && e.ports[0];
  if (!d || d.type !== 'save' || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    await expire();
    const cache = await caches.open(CACHE);
    let kept = 0;
    for (const url of d.urls.slice(0, 200)) {
      try {
        const u = new URL(url, self.location.origin);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
        const own = u.origin === self.location.origin;
        const req = new Request(u.href, own ? { credentials: 'same-origin' } : { mode: 'no-cors' });
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') {
          await cache.put(req, res);
          kept++;
        }
      } catch (err) {
        // kept what could be; the rest loads from the network next time
      }
    }
    await cache.put(SAVED, new Response(String(Date.now())));
    if (port) port.postMessage({ ok: kept > 0, kept });
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await Promise.race([
          fetch(req),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000)),
        ]);
        if (res.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        const kept = await caches.match(req, { ignoreVary: true });
        return kept || new Response(OFFLINE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const kept = await caches.match(req, { ignoreVary: true });
    return kept || fetch(req);
  })());
});
`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      // a new version reaches phones the next time they open the guide
      'cache-control': 'no-cache',
      'x-robots-tag': 'noindex',
    },
  });
}
