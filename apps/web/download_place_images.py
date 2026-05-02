import csv
import json
import re
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

INPUT = Path('places_edited.csv')
OUT = Path('places_edited.csv')
PUBLIC_DIR = Path('public/place')
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; PlacesImageDownloader/1.0)',
    'Accept': 'image/jpeg,image/png,image/webp,image/avif,image/*,*/*;q=0.8',
}

def download_to_jpg(url: str, place_id: str):
    if not url:
        return 'missing_url'
    last_error = ''
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=30, allow_redirects=True)
            r.raise_for_status()
            img = Image.open(BytesIO(r.content)).convert('RGB')
            # Keep local assets reasonably sized for frontend use.
            img.thumbnail((1200, 900))
            out = PUBLIC_DIR / f'{place_id}.jpg'
            img.save(out, 'JPEG', quality=85, optimize=True)
            return 'downloaded'
        except Exception as e:
            last_error = str(e)
            time.sleep(1 + attempt)
    return f'failed: {last_error}'

with INPUT.open('r', newline='', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

for row in rows:
    row['imageDownloadStatus'] = download_to_jpg(row.get('originalThumbnailUrl', ''), row['id'])
    row['thumbnailUrl'] = f'public/place/{row["id"]}.jpg'

with OUT.open('w', newline='', encoding='utf-8-sig') as f:
    w = csv.DictWriter(f, fieldnames=rows[0].keys())
    w.writeheader()
    w.writerows(rows)

print('Done. Images saved to public/place/*.jpg and places_edited.csv updated.')
