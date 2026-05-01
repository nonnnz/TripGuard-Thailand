# 🇹🇭 Data.go.th Tourism Database

ฐานข้อมูล SQLite สำหรับโปรเจกต์ B2B2C Tourism (เมืองรอง / Accessibility / Fair Price Guide)
ดึงข้อมูลจริงจาก **Data.go.th** และ CKAN portal ของหน่วยงานไทย — พร้อม sample data และ ingest script ใช้ต่อได้ทันที

---

## 📦 ไฟล์ในโปรเจกต์

| ไฟล์ | คำอธิบาย |
|---|---|
| `data.db` | SQLite database พร้อมข้อมูล **34,825 records** |
| `schema.sql` | DDL ของ 8 ตาราง (tourism / accessibility / economy + reference) |
| `ingest.py` | Python script ดึงข้อมูลจาก CKAN และโหลดเข้า DB |
| `queries.sql` | ตัวอย่าง SQL 12 ข้อ ครอบคลุมทุกฟีเจอร์ B2B2C |
| `README.md` | คู่มือนี้ |

---

## 📊 สรุปข้อมูลใน DB

| Dataset | หน่วยงาน | Portal | Records | Live? |
|---|---|---|---:|:---:|
| แหล่งท่องเที่ยว (ททท.) | การท่องเที่ยวแห่งประเทศไทย | datacatalog.tat.or.th | **8,242** | ✅ |
| แหล่งท่องเที่ยว อปท. | กรมส่งเสริมการปกครองท้องถิ่น | opendata.dla.go.th | **26,173** | ✅ |
| รายการแหล่งท่องเที่ยว (TTD) | กระทรวงการท่องเที่ยวฯ | ckan.mots.go.th | 10* | ⚠️ |
| รายการที่พัก (TTD) | กระทรวงการท่องเที่ยวฯ | ckan.mots.go.th | 10* | ⚠️ |
| สิ่งอำนวยความสะดวกผู้พิการ | SRT/AOT/DNP | gdc.railway.co.th | 14 | 📝 seed |
| สถิติคนพิการรายจังหวัด | กรมส่งเสริมและพัฒนาฯ คนพิการ | data.go.th | 100 | 📝 seed |
| สถิตินักท่องเที่ยวรายจังหวัด | กระทรวงการท่องเที่ยวฯ | data.go.th | 60 | 📝 seed |
| CPI ดัชนีราคาผู้บริโภค | สนค./พาณิชย์ | data.go.th | 216 | 📝 seed |
| **รวม** | | | **34,825** | |

*\* MOTS API จำกัด 10 records ต่อ public download — ต้องสมัคร [API key](https://api.thailandtourismdirectory.go.th/openapi/read) เพื่อดึงครบ 354 รายการ*

> **Live** = ดึงข้อมูลจริงผ่าน CKAN ได้ทุกครั้งที่รัน `ingest.py`
> **Seed** = ใช้ representative sample data ที่ schema/structure ตรงกับ dataset จริงใน data.go.th — ต้องรันจาก IP ไทยจึงจะ sync จาก [catalog-dga.data.go.th](https://catalog-dga.data.go.th) ได้

---

## 🚀 การใช้งาน

### 1. รัน ingest (สร้าง DB ใหม่)
```bash
# โหลดทุกแหล่ง (~30 วินาที)
python3 ingest.py

# โหลดเฉพาะบางแหล่ง
python3 ingest.py --only tat-tourist-attraction dla-travel
```

### 2. Query ข้อมูล
```bash
# เปิด CLI
sqlite3 data.db

# รัน query ตัวอย่างทั้งหมด
sqlite3 data.db < queries.sql
```

### 3. ใช้ใน Python / Jupyter
```python
import sqlite3, pandas as pd
conn = sqlite3.connect("data.db")

# แหล่งท่องเที่ยวเมืองรองพร้อมพิกัด
df = pd.read_sql("""
    SELECT name_th, province, latitude, longitude, type
    FROM tourism_attractions
    WHERE is_secondary_city = 1 AND latitude IS NOT NULL
""", conn)
print(df.head())
```

---

## 🗺 Schema Overview

```
source_dataset                ── ตาราง metadata ของทุก dataset (ที่มา + lineage)
├── tourism_attractions        ── แหล่งท่องเที่ยว (TAT + DLA + MOTS) พร้อม lat/lon
├── tourism_accommodations     ── ที่พักจดทะเบียน (MOTS)
├── tourism_stats_province     ── สถิตินักท่องเที่ยว/รายได้รายจังหวัด
├── accessibility_facilities   ── สิ่งอำนวยความสะดวกผู้พิการ (สนามบิน/สถานี/อุทยาน)
├── accessibility_stats_disabled ── สถิติคนพิการรายจังหวัด (DEP)
├── economy_cpi                ── ดัชนีราคาผู้บริโภค รายเดือน รายภูมิภาค
└── ref_secondary_cities       ── รายชื่อเมืองรอง 55 จังหวัด (ตามประกาศกระทรวงการคลัง)
```

**Indexes สำคัญ** — `(province)`, `(latitude, longitude)`, `(year, region)` เพื่อ geo + time-series query

---

## 🔌 การเชื่อมต่อ Data.go.th จริง

### ปัญหาที่เจอจาก sandbox
`data.go.th` บล็อค IP ของ cloud sandbox (Cloudflare 403) — ทั้ง browser และ CKAN API
ระบบจึงต้อง **รันจากเครื่องที่ IP อยู่ในไทย** หรือใช้ **mirror endpoint** [`catalog-dga.data.go.th`](https://catalog-dga.data.go.th)

### แหล่งข้อมูลทางเลือก (ใช้ได้ทันที)
| Portal | API | Tested |
|---|---|---|
| [datacatalog.tat.or.th](https://datacatalog.tat.or.th) | `/api/3/action/datastore_search` | ✅ |
| [opendata.dla.go.th](https://opendata.dla.go.th) | resource download URL | ✅ |
| [ckan.mots.go.th](https://ckan.mots.go.th) | `/api/3/action/package_show` | ✅ |
| [catalog.nso.go.th](https://catalog.nso.go.th) | (ปิดจาก IP ภายนอก) | ❌ |

### CKAN API patterns ที่ใช้
```python
# 1. ค้นหา dataset
GET https://<portal>/api/3/action/package_search?q=KEYWORD&rows=20

# 2. ดูรายละเอียด dataset (resources)
GET https://<portal>/api/3/action/package_show?id=<slug-or-uuid>

# 3. ดึงข้อมูลใน datastore (ดีที่สุด — รองรับ pagination + filter)
GET https://<portal>/api/3/action/datastore_search?resource_id=<uuid>&limit=1000&offset=0

# 4. SQL ตรงๆ (ถ้า portal เปิด)
GET https://<portal>/api/3/action/datastore_search_sql?sql=SELECT...
```

---

## 🏷 Dataset IDs สำหรับ data.go.th (ใช้รันจาก IP ไทย)

| Slug บน data.go.th | ชื่อ |
|---|---|
| `2893a9fd-1679-4ae7-95e0-01e37fc45428` | สถิตินักท่องเที่ยว (จำนวนและรายได้รายจังหวัด) |
| `f8a0676a-c3b4-43cb-816b-974750749e71` | ดัชนีราคาผู้บริโภค (CPI) |
| `item_b5966a54-0b48-4128-b180-a22d2baed159` | สถิติคนพิการที่มีบัตรประจำตัว (รายจังหวัด) |
| `496eec73-0761-4894-9fbf-2f56c4aad5c4` | สถานประกอบการสำรวจที่พักแรม (NSO) |
| `db0103-002` | โรงแรม Green Hotel ที่ได้รับการรับรอง |
| `dataset-51_01` | จำนวนนักท่องเที่ยวในอุทยานแห่งชาติ |
| `after08` (railway.co.th) | สิ่งอำนวยความสะดวกผู้พิการระบบราง |
| `tourist-attraction` (datacatalog.tat.or.th) | แหล่งท่องเที่ยวพร้อมพิกัด ✅ |
| `travel` (opendata.dla.go.th) | แหล่งท่องเที่ยวของ อปท. ✅ |

---

## 💡 ตัวอย่าง Query ตามฟีเจอร์

### 🏞 ฟีเจอร์ "เมืองรอง"
```sql
-- top 10 เมืองรองที่มีแหล่งท่องเที่ยวเยอะสุด
SELECT province, COUNT(*) AS attractions
FROM tourism_attractions
WHERE is_secondary_city = 1
GROUP BY province
ORDER BY attractions DESC LIMIT 10;
-- ผลลัพธ์: เชียงราย 734, นครศรีธรรมราช 485, ชุมพร 423 ...
```

### ♿ ฟีเจอร์ "Accessibility"
```sql
-- หาแหล่งท่องเที่ยวเมืองรองที่อยู่ใกล้สิ่งอำนวยความสะดวกผู้พิการ
SELECT att.name_th, att.province, fac.place_name, fac.facility_type
FROM tourism_attractions att
JOIN accessibility_facilities fac ON att.province = fac.province
WHERE att.is_secondary_city = 1
  AND ABS(att.latitude  - fac.latitude)  < 0.3
  AND ABS(att.longitude - fac.longitude) < 0.3;
```

### 💰 ฟีเจอร์ "Fair Price Guide"
```sql
-- เปรียบเทียบ avg spend ของนักท่องเที่ยวต่างชาติ เมืองหลัก vs เมืองรอง
SELECT
    CASE WHEN province IN (SELECT province FROM ref_secondary_cities)
         THEN 'เมืองรอง' ELSE 'เมืองหลัก' END AS tier,
    ROUND(AVG(avg_spend_per_day), 0) AS avg_spend_thb_per_day
FROM tourism_stats_province
WHERE nationality = 'foreign' AND year = 2567
GROUP BY tier;
```

ดูตัวอย่างเพิ่มเติมใน `queries.sql` (12 queries)

---

## 🔄 การอัปเดตข้อมูล

```bash
# refresh ทั้งหมด (จะ insert records ใหม่ — ลบของเก่าก่อนถ้าต้องการ)
sqlite3 data.db "DELETE FROM tourism_attractions WHERE source_id IN (SELECT id FROM source_dataset WHERE portal!='data.go.th')"
python3 ingest.py
```

แนะนำตั้ง **cron job** รายสัปดาห์เพื่อ sync ข้อมูลใหม่:
```cron
0 3 * * 0  cd /path/to/datagoth_db && python3 ingest.py >> sync.log 2>&1
```

---

## 📚 อ้างอิง

- [Data.go.th — ศูนย์กลางข้อมูลเปิดภาครัฐ](https://data.go.th/)
- [TAT Data Catalog](https://datacatalog.tat.or.th/)
- [DLA Open Data](https://opendata.dla.go.th/)
- [CKAN MOTS](https://ckan.mots.go.th/)
- [Thailand Tourism Directory API Manual](https://admin.thailandtourismdirectory.go.th/manual/ttd-open-api.pdf)
- [ประกาศกระทรวงการคลัง: 55 จังหวัดเมืองรอง](https://www.rd.go.th/)

---

*สร้างโดย Perplexity Computer · พฤษภาคม 2569*
