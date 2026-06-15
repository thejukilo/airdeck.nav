# Data sources & licensing

This is the reference for **what aeronautical data Airdeck Nav can use for
free, what it can legally use in a commercial product, and what must be sold as
licensed add-ons.** Aviation data licensing is restrictive and varies per
country — read the license, not just the price.

> Decision (2026-06): the **free tier is built on open flightmaps + OurAirports**
> (both commercial-safe). **openAIP is dropped from the base** because its free
> license is non-commercial.

## The licensing catch (read this first)

The two main "free" aeronautical databases have **opposite licenses**:

| Database | License | Commercial use? |
| --- | --- | --- |
| **open flightmaps (OFMA)** | OFMA General Users' License — worldwide, royalty-free, non-exclusive | ✅ **Yes**, explicitly includes commercial use |
| **openAIP** | CC BY-NC-SA | ❌ **No** on the free license (non-commercial). Paid commercial license + API available. Limited exception: may ship openAIP data inside a paid app *as long as you don't exclusively sell the data*. |

➡️ We standardize on **open flightmaps** as the base so the product is
commercially clean from day one. openAIP can be revisited later *only* under its
paid commercial license.

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
