# AllWay Thailand 🇹🇭

**Super AI Engineer SS6 by AiAT | Hackathon Project**

> AI Trust Layer for Safer Local Travel in Thailand

AllWay is not a booking super-app. It is an **AI trust layer** that helps tourists decide where to go next, what to trust, and which local packages are safer and more suitable — starting with Bangkok and nearby continuation trips.

## Team 5 Houses · 5 disciplines · 1 mission

- **Non** - Engineering (EXP) : @nonnnz
- **Palm** - Design (Kiddee) : @PalmWorapat
- **Earth** - Data (Pangpuriye) : @earth-repo
- **Heng** - Business (Machima) : @hengkp
- **Cookie** - Data (Scamper) : @thanstore22-cpu

---

## Monorepo Structure

```
AllWay/
├── apps/
│   ├── web/          # Vite + React + Tailwind (SSR-ready)
│   ├── api/          # ElysiaJS (TypeScript) backend
│   └── etl/          # Python ETL scripts (TAT API → PostgreSQL → Neo4j)
├── packages/
│   └── shared/       # Shared types/constants between web & api
├── docs/             # SDD documents
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- Bun (for ElysiaJS)
- Python 3.11+
- Docker (for local PostgreSQL)
- Neo4j AuraDB free tier account

### 1. Clone & install

```bash
# Install API deps
cd apps/api && bun install

# Install web deps
cd apps/web && npm install

# Install ETL deps
cd apps/etl && pip install -r requirements.txt
```

### 2. Setup environment

```bash
cp .env.example .env
# Fill in your secrets (see .env.example)
```

### 3. Start local services

```bash
docker-compose up -d   # starts PostgreSQL
```

### 4. Run ETL (seed data)

```bash
cd apps/etl
python run_all.py
```

### 5. Start dev servers

```bash
# Terminal 1 - API
cd apps/api && bun dev

# Terminal 2 - Web
cd apps/web && npm run dev
```

---

## Deployment (POC)

| Service        | Where                          |
| -------------- | ------------------------------ |
| PostgreSQL     | Docker on local PC             |
| Neo4j          | AuraDB Free Tier (cloud)       |
| API (ElysiaJS) | Local PC via Cloudflare Tunnel |
| Web (Vite)     | Local PC via Cloudflare Tunnel |
| ETL            | Python cronjob on local PC     |

Cloudflare Tunnel exposes local ports publicly without opening firewall ports.

---

## Docs

See [`/docs`](./docs/) for full Specification-Driven Development docs.
