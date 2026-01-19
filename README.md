# Price Tracker

A web application to track product prices from retail websites (starting with Costco.ca). Automatically checks prices daily and highlights significant price changes.

## Features

- Track product prices from Costco.ca
- Daily automatic price updates via GitHub Actions
- Visual highlighting for significant price changes (>2%)
- Green = price decreased, Red = price increased

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Turso (SQLite)
- **ORM**: Drizzle ORM
- **Styling**: Tailwind CSS
- **Scraping**: Puppeteer (via GitHub Actions)
- **Deployment**: Vercel

## Setup Instructions

### 1. Create Turso Database

1. Sign up at [turso.tech](https://turso.tech) (free tier)
2. Create a new database
3. Get your database URL and auth token

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Turso credentials and generate a random secret for the GitHub Actions:

```
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
UPDATE_PRICES_SECRET=your-random-secret
```

### 3. Initialize Database

Run the migration to create the products table:

```bash
npx drizzle-kit push
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### 5. Deploy to Vercel

1. Push your code to GitHub
2. Connect your repo to [Vercel](https://vercel.com)
3. Add the same environment variables in Vercel's project settings

### 6. Configure GitHub Actions

Add these secrets in your GitHub repository settings (Settings > Secrets and variables > Actions):

- `API_URL`: Your deployed Vercel URL (e.g., `https://price-tracker.vercel.app`)
- `UPDATE_PRICES_SECRET`: Same secret you used in `.env.local`

The GitHub Action runs daily at midnight UTC. You can also trigger it manually from the Actions tab.

## Usage

1. Open the app in your browser
2. Add a Costco.ca product URL using the form
3. Enter the product title and current price
4. The scraper will automatically update prices daily

## Project Structure

```
price-tracker/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main page
│   │   ├── layout.tsx            # Root layout
│   │   └── api/
│   │       ├── products/         # Products CRUD
│   │       └── update-prices/    # Price update endpoint
│   ├── lib/
│   │   ├── db.ts                 # Database connection
│   │   └── schema.ts             # Drizzle schema
│   └── components/
│       ├── ProductTable.tsx      # Main table
│       └── AddProductForm.tsx    # Add product form
├── scripts/
│   └── scrape-prices.js          # Puppeteer scraper
├── .github/workflows/
│   └── update-prices.yml         # Daily cron job
└── drizzle.config.ts             # Drizzle config
```

## License

MIT
