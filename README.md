# Farm Manager

Cloud farm app for beef finishing plus land, feeding, spray and health records.

The first Supabase project was created as **Cattle Manager**. This repo now talks to that same project as **Farm Manager**. Use the project URL (`https://<ref>.supabase.co`) — never the `/rest/v1/` REST endpoint.

## Features

- **Multi-farm & multi-user** with role-based access (Owner / Manager / Worker / Viewer)
- **Pens / Fields** and **Groups** (Grazing vs Finishing + custom)
- **Animal registry** with purchase price, purchase weight, DOB, source
- **XLS / CSV import** from market files
- **Liveweight recording** (kg) with automatic **Average Daily Gain (ADG)**
- **Powerful multi-filter + sort**:
  - Group, Pen, Status, Sex
  - Days on farm (min/max)
  - Age (min/max)
  - Purchase date range / Exit date range
  - ADG range / Current weight range
  - Free-text search (tag, EID, breed)
  - Combine any filters + sort by any column
- Real-time sync ready for mobile (Supabase Realtime)
- Photo upload support
- Dashboard with herd stats

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend / DB / Auth / Storage**: Supabase
- **Tables**: farms, profiles, farm_members, pens, groups, herds, animals, weights, medicines, treatments, feeding, land/spray jobs
- **View**: `animals_enriched` (ADG, days_on_farm, age_days, latest weight, herd_number, sale fields)

## Quick Start

### 1. Create a Supabase project

1. Go to https://supabase.com → New project
2. Copy the Project URL and anon key

### 2. Run migrations (existing Cattle Manager project)

In the Supabase SQL Editor, run in order if they have not already been applied:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_land_jobs_spray.sql
supabase/migrations/003_cattle_to_farm_manager.sql
```

`003` is idempotent. It adds Farm Manager tables/columns (herds, medicines, treatments, feeding, sale fields) and onboarding RLS on top of the original Cattle Manager schema.

The hosted project already in `.env.example` is `bjzvjmaiyuvjmyhozbpq` and already has the Farm Manager tables.

### 3. Configure environment

```bash
cp .env.example .env.local
```

`NEXT_PUBLIC_SUPABASE_URL` must be the project URL only:

```
NEXT_PUBLIC_SUPABASE_URL=https://bjzvjmaiyuvjmyhozbpq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Do not use `https://….supabase.co/rest/v1/` — that was the Cattle Manager copy-paste mistake and breaks Auth.

### 4. Install & run

```bash
npm install
npm run dev
```

Open http://localhost:3000

### 5. First-time setup

1. Sign up / log in
2. Create your first farm (or use the onboarding flow)
3. Create Groups: e.g. “Grazing” (type=grazing), “Finishing” (type=finishing)
4. Create Pens / Fields
5. Import animals via XLS or add manually
6. Start recording weights

## XLS Import Format

Expected columns (header row required – order flexible, matching is case-insensitive):

| Column examples                  | Maps to              |
|----------------------------------|----------------------|
| Tag / Visual ID / NLIS           | tag                  |
| EID / Electronic ID              | eid                  |
| Breed                            | breed                |
| Sex / Gender                     | sex                  |
| DOB / Date of Birth              | date_of_birth        |
| Purchase Date / Sale Date        | purchase_date        |
| Purchase Weight / Weight         | purchase_weight_kg   |
| Purchase Price / Price / Cost    | purchase_price       |
| Source / Vendor / Market         | source               |
| Group / Lot                      | group name (matched) |
| Pen / Paddock                    | pen name (matched)   |

Dates accepted: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY

## Mobile App (Expo)

A matching React Native / Expo app can share the same Supabase project and types.

Key points for mobile:
- Use `@supabase/supabase-js` + offline persistence
- Weight entry form works offline → queues and syncs when online
- Same RLS policies protect data
- Realtime subscriptions keep the animal list live

Ask for the Expo starter if you need it generated.

## Folder Structure

```
farm-manager/
├── supabase/migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_land_jobs_spray.sql
│   └── 003_cattle_to_farm_manager.sql
├── src/
│   ├── app/                  # Next.js App Router pages
│   ├── components/
│   │   ├── animals/          # Table, filters, detail, weight form
│   │   ├── dashboard/
│   │   └── layout/
│   ├── lib/
│   │   ├── supabase/         # client + server helpers
│   │   ├── animals.ts        # filtered queries
│   │   └── utils.ts
│   └── types/database.ts
├── package.json
└── README.md
```

## Next Steps / Roadmap

- [ ] Full animals list page with advanced filter UI
- [ ] Animal detail + weight chart (Recharts)
- [ ] XLS import page
- [ ] Pens & Groups management
- [ ] Farm settings + invite users
- [ ] Dashboard KPIs (avg ADG, head count by group, etc.)
- [ ] Expo mobile app
- [ ] PDF / CSV export of filtered lists
- [ ] Push notifications for weigh days

## License

Private – for your farm use.
