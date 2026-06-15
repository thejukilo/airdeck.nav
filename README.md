# Airdeck Nav

A VFR flight navigation tool focused on **UX and usability** — in the spirit of
SkyDemon and EasyVFR, but with a cleaner, more glanceable cockpit experience.

> ⚠️ **Not for navigation.** This is in early development and ships with sample
> aeronautical data only. Do not use for real flight operations.

## Status

This is the **moving-map foundation** — the core that everything else builds on:

- 🗺️ **High-performance moving map** (MapLibre GL) with day / night themes.
- ✈️ **Ownship** symbol with track-up arrow, driven by a **flight simulator**
  (no GPS required to develop) or the **real Geolocation API** on a device.
- 🛩️ **Aeronautical layers** — airspace (CTR/TMA/restricted), airports, and
  navaids, each independently toggleable.
- 📊 **Glanceable HUD** — ground speed, track, altitude.
- 👆 **Tap any feature** for details (frequencies, runways, airspace limits).
- 📱 **Installable PWA** with offline tile/data caching for cockpit use.

## Stack

| Concern        | Choice                                   |
| -------------- | ---------------------------------------- |
| Framework      | React 18 + TypeScript                    |
| Build          | Vite                                     |
| Map            | MapLibre GL JS (raster basemap, no keys) |
| Offline / PWA  | vite-plugin-pwa (Workbox)                |
| Aero data      | Static GeoJSON in `public/data`          |

The basemap uses free CARTO + OpenStreetMap raster tiles, so the project runs
with **zero API keys**. Swap in a vector basemap (MapTiler, Stadia, self-hosted)
when you want crisper labels and rotation.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run preview    # serve the production build
```

## Project layout

```
public/data/        Sample aeronautical GeoJSON (airports, navaids, airspaces)
src/lib/geo.ts      Geodesy: distance, bearing, projection, formatting
src/data/aero.ts    Typed data model + loader (swap for a live source later)
src/map/            MapLibre setup, base style, aero layer rendering
src/nav/            Ownship position (simulator + GPS)
src/components/     HUD, toolbar, layer control, info panel, icons
src/App.tsx         App shell wiring it all together
```

## Roadmap

The architecture is deliberately set up so these slot in without rework:

- **Flight planning** — route builder, nav log, headings/distances/ETE.
  (`route` map source + `src/lib/geo.ts` helpers are already in place.)
- **Weather** — METAR/TAF and NOTAM overlays.
- **Live data source** — replace the static GeoJSON with OpenAIP / a tile
  server / an offline-synced database behind `src/data/aero.ts`.
- **Vertical profile & terrain awareness.**

## Deployment (Vercel)

The repo is deploy-ready (`vercel.json`, Vite preset). To put it at
`nav.airdeck.ch`:

1. **Import** the GitHub repo in the Vercel dashboard (New Project → pick
   `thejukilo/airdeck.nav`). Framework auto-detects as Vite; no env vars needed.
2. **Add the domain**: Project → Settings → Domains → add `nav.airdeck.ch`.
3. **DNS**: in the `airdeck.ch` zone, add a `CNAME` record
   `nav → cname.vercel-dns.com` (Vercel shows the exact target). It verifies and
   issues TLS automatically.

After the first import, every push to the default branch auto-deploys; pushes to
other branches get preview URLs.

## Replacing the sample data

The files in `public/data/*.geojson` are simplified samples around the
Netherlands for development. To go operational, point `loadAeroData()` in
`src/data/aero.ts` at a licensed source and keep the same feature shapes.
