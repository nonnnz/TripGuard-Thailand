# Bangkok Food Scraping ETL

Specialized pipeline for extracting food data from Google Maps and Wongnai, analyzed via Gemini 1.5 Flash.

## Architecture

1.  **Grid Strategy:** 500m x 500m grid search across Bangkok bounding box.
2.  **Scraper:** Playwright + Stealth plugin (targeting Bun runtime).
3.  **AI Analysis:** Gemini 1.5 Flash for menu OCR and price classification.
4.  **Storage:** PostgreSQL + PostGIS (Geometry/Geography points).

## Setup

```bash
cd apps/etl/food-scraping
bun install
```

## Environment Variables

- `DATABASE_URL`: Connection string for PostgreSQL.
- `GEMINI_API_KEY`: API key for Google Generative AI.
- `PROXY_URL`: (Optional) Residential proxy URL with Bangkok exit node.

## Implementation Notes

- **Proxy Management:** Recommended to use Bright Data or Oxylabs. The scraper should implement a rotation wrapper.
- **PostGIS:** Requires the `postgis` extension in PostgreSQL. Update `docker-compose.yml` to use a PostGIS-enabled image.
