# Data sources & licensing

This is the reference for **what aeronautical data Airdeck Nav can use for
free, what it can legally use in a commercial product, and what must be sold as
licensed add-ons.** Aviation data licensing is restrictive and varies per
country — read the license, not just the price.

> Decision (2026-06): **airspace is sourced from openAIP** (its license permits
> shipping data inside a paid app); airports from **OurAirports** (CC0); weather
> from **Open-Meteo / NWS**. open flightmaps remains a good alternative base.

## The licensing catch (read this first)

The two main aeronautical databases:

| Database | License | Use in our app? |
| --- | --- | --- |
| **openAIP** | CC BY-NC 4.0 | ✅ **Yes.** Per openAIP's own terms, third parties **may ship openAIP data inside paid/commercial applications as long as they don't *exclusively* sell the data** (e.g. as a paid data-only update). Attribution required; data must stay free for everyone. |
| **open flightmaps (OFMA)** | OFMA General Users' License — royalty-free, non-exclusive | ✅ Yes, explicitly includes commercial use. Requires attribution + an error-reporting path. |

➡️ We use **openAIP** for airspace (clean API, geometry resolved) under the
ship-inside-a-paid-app clause, **with visible attribution** and without ever
selling the data standalone. OFM stays available as an alternative.

## Free data we can use (commercial-safe)

| Layer | Source | License | Notes |
| --- | --- | --- | --- |
| Airspace, navaids, reporting points, VFR chart tiles | **open flightmaps** | OFMA, royalty-free, commercial OK | Covers most of Europe (CH/LS, NL/EH, DE, IT, AT, …). Per-AIRAC region bundles, downloadable for offline. |
| Airfields, runways, frequencies (70k+ worldwide) | **OurAirports** | **CC0 / public domain** | No strings. CSV: `airports.csv`, `runways.csv`, `airport-frequencies.csv`. |
| Terrain / elevation | **Copernicus DEM GLO-30**, SRTM | Free (Copernicus license) | GLO-30 meets ICAO Area 1/2 terrain requirements. For hillshade + terrain-awareness alerts. |
| Weather: METAR / TAF / SIGMET / AIRMET | **aviationweather.gov** (US NWS/AWC) | Public domain, free | JSON REST API, no key. Global METAR coverage. |
| US only: sectional charts, obstacles, full nav data | **FAA** (d-VC GeoTIFF, Digital Obstacle File, NASR) | **Public domain** | Gold standard of free data — but US-only. |

### Conditions we must honor

- **open flightmaps**: (1) attribute OFM as the data source, visibly; (2) provide
  an **error-reporting path** so end users can report data errors back to OFMA.
- **OurAirports**: none (CC0), but data is community-sourced — no accuracy guarantee.
- **aviationweather.gov / FAA**: attribution courtesy; data is US-government public domain.

### Weaker spots (free but limited)

- **NOTAMs** — no clean free European feed. FAA has a NOTAM API (US, registration).
  For Europe, evaluate **autorouter** (free GA API: METAR/TAF/NOTAM/AIP).
- **EAD / national AIP (AIXM)** — authoritative and complete, but access-controlled
  and individually copyrighted per state. Not a casual free source.

## "Allowed for navigation" — the reality (certification vs. provenance)

There is **no certification** that makes a consumer VFR app "legal for
navigation." On a tablet it is an **Electronic Flight Bag (EFB)** — an advisory
aid, pilot's discretion. SkyDemon and EasyVFR **disclaim exactly the same way**
(in their EULA/first-run, not an on-map banner); SkyDemon is even limited from
"primary navigation in IMC."

What they have that raw free data doesn't is **provenance + currency**, not a
stamp:

- **EasyVFR / PocketFMS AeroData** is fed from **EUROCONTROL EAD** (AIP, NOTAM,
  AUP/UUP, plates), **DWD** weather, NASA terrain, EuroGeographics/OSM —
  refreshed on the **28-day AIRAC cycle**.
- **SkyDemon renders its own charts** from licensed official-sourced data (it does
  *not* use the official ICAO chart scans).

### The EUROCONTROL EAD path (how to match them)

- **EAD Basic** — free, instant after registration, but a **human web tool**
  (browse AIP/charts, build NOTAM PIBs). Not a feed for your app.
- **EAD Pro** — requires signing an **EAD Data User Agreement**; redistributing
  AIP data to end users triggers **member-state royalty fees**. This is *why
  EasyVFR makes in-app registration mandatory* — EUROCONTROL/states require
  counting third-party end users. EasyVFR's "endorsed by EUROCONTROL/DFS" + EASA
  GA Safety Award implies favorable/waived terms earned as a recognized tool.
- **NM data** (AUP/UUP activation, etc.) needs *additional explicit* agreement.
- **DWD weather** is genuinely **free open data** (GeoNutzV, attribution) — the
  weather half needs no deal.

**Strategy:** ship now on OFM + OurAirports + free weather (≈ EasyVFR Essential's
free tier, minus live NOTAM); pursue an EAD Data User Agreement in parallel for
official provenance + NOTAM/airspace-activation.

## Implemented so far

- ✅ **Airports + frequencies** — live from OurAirports (CC0) via `/api/airports`
  (Edge function, bbox-filtered, CDN-cached), with the bundled sample as offline
  fallback.
- ✅ **Airport weather** — live METAR via `/api/metar` (aviationweather.gov / NWS,
  public domain); flight-category dots, tap for detail (wind, vis, ceiling, QNH).
- ✅ **Wind field** — gridded model wind via `/api/wind` (Open-Meteo, CC-BY, no
  key); dense arrows + speed labels across the map (METAR is station-only).
- ✅ **VFR chart look** — topographic base (**OpenTopoMap**) + the **openAIP
  rendered tile overlay** (airspace bands, navaids, reporting points) proxied via
  `/api/aiptile` so the key stays server-side. This is what gives the
  SkyDemon-style chart appearance.
- ✅ **Airspace detail** — `/api/airspaces` (openAIP) geometry kept as an
  invisible click target so taps surface type/class/limits over the overlay.
- ✅ **Advisory** — first-run acknowledgment + subtle attribution (competitor norm).
- 🚫 **NOTAM** — `/api/notam` is an honest stub; needs EAD/FAA agreement.

### Environment variables

| Var | Used by | Notes |
| --- | --- | --- |
| `OPENAIP_API_KEY` | `/api/airspaces`, `/api/aiptile` | Free key from openaip.net. Set in Vercel → Settings → Environment Variables. **Never commit it.** |
| `OPENAIP_TILE_LAYER` | `/api/aiptile` | Optional. Overlay layer name, default `openaip` (full). E.g. `airspaces` for airspace-only. |

## Paid add-ons (the proven monetization model)

Official georeferenced charts are **copyrighted and licensed per country** — this
is exactly how SkyDemon and EasyVFR monetize.

1. **Official ICAO 1:500,000 VFR charts** — per-country annual subscriptions from
   national providers: **DFS** (DE + resells many EU states), **NATS/CAA** (UK),
   **SIA** (FR), **skyguide** (CH), etc.
   → For airdeck.**ch**, the **Swiss ICAO chart (skyguide)** is the flagship add-on.
2. **Approach / IFR plates** — national AIP charts, Jeppesen. Licensed.
3. **Premium currency/SLA data** — openAIP commercial license or direct AIP feeds
   with guaranteed AIRAC update cycles.
4. **Enhanced terrain/obstacle, weather radar/satellite overlays** — premium tiers.

**Pricing shape:** free tier = OFM VFR charts + OSM/terrain base; paid add-ons =
official national ICAO charts + plates, sold per region, gated behind an
entitlement check.

## How this maps to the app

The existing data boundary already fits this plan:

- `src/data/aero.ts` → swap sample GeoJSON for **OurAirports (CC0)** + **open
  flightmaps** region bundles behind `loadAeroData()`.
- Add a **Copernicus terrain** raster/hillshade layer.
- Wire **aviationweather.gov** for METAR/TAF (new weather layer).
- Gate **official chart tiles** behind a license/entitlement check for the add-on
  store.
- Surface required **OFM attribution** + an **error-report** action in the UI.

## Sources

- [openAIP — Legal / Terms](https://www.openaip.net/legal)
- [open flightmaps](https://openflightmaps.org/) · [FAQ](https://openflightmaps.org/faq/) · [About](https://www.openflightmaps.org/about/)
- [OurAirports — Open data](https://ourairports.com/data/) · [data repo + CC0 license](https://github.com/davidmegginson/ourairports-data)
- [EUROCONTROL — European AIS Database (EAD)](https://www.eurocontrol.int/service/european-ais-database) · [AIXM](https://www.eurocontrol.int/model/aeronautical-information-exchange-model)
- [FAA — Aeronautical data portal](https://adds-faa.opendata.arcgis.com/) · [Digital VFR charts](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/) · [Digital Obstacle File](https://adds-faa.opendata.arcgis.com/datasets/faa::digital-obstacle-file/about)
- [aviationweather.gov — Data API](https://aviationweather.gov/data/api/)
- [Copernicus DEM (Data Space Ecosystem)](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) · [Copernicus GLO-30 on OpenTopography](https://portal.opentopography.org/raster?opentopoID=OTSDEM.032021.4326.3)
- [DFS / Eisenschmidt — ICAO 1:500,000 charts](https://www.eisenschmidt.aero/en/en/faq-aeronautical-chart) · [NATS-UK VFR charts](https://nats-uk.ead-it.com/cms-nats/opencms/en/Charts/vfr-charts/)
- [autorouter (free GA API: METAR/TAF/NOTAM/AIP)](https://www.autorouter.aero)

> ⚠️ Licenses and access terms change. Re-verify each source's current terms
> before shipping, and keep attribution/error-reporting obligations in the UI.
