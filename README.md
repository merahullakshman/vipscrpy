# Streaming Link Scraper

A powerful web application for discovering and scraping streaming links with m3u8 sources based on keywords. Features Google Sheets integration for domain management and result export.

## Features

✨ **Modern Web Interface**
- Premium dark theme with glassmorphism effects
- Real-time scraping progress tracking
- Responsive design for all devices

🔍 **Smart Scraping**
- Keyword-based page discovery with sport-specific URLs
- Multiple m3u8 detection methods (5+ techniques)
- **Multi-server stream detection** - Automatically finds and scrapes all stream servers
- **VIPLeague-style pattern detection** - Recognizes "Link 1", "Link 2", "Link 3" buttons
- Iframe source extraction and deep following
- Obfuscated JavaScript decoding (Base64, URL encoding, packed eval, atob)
- Automatic rate limiting and retry logic
- Optional headless browser for JavaScript-heavy pages
- **Proxy support** - Use HTTP/HTTPS proxies to bypass geo-restrictions and bot detection

📡 **Proxy Features**
- Single proxy or rotating proxy list
- Automatic proxy rotation for load distribution
- Works with authenticated proxies (username:password)
- Applies to both Axios and Puppeteer requests

📊 **Google Sheets Integration**
- Load domains from Google Sheets (Column A)
- Export results directly to Google Sheets
- Automatic formatting and organization

📥 **Export Options**
- CSV export with proper formatting
- Excel export with styled headers
- Direct Google Sheets sync

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your Google Sheets credentials (see Google Sheets Setup below).

### 3. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Google Sheets Setup

To use Google Sheets integration, you need to set up a Google Cloud project and service account:

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

### Step 2: Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details
4. Click "Create and Continue"
5. Skip the optional steps and click "Done"

### Step 3: Generate Service Account Key

1. Click on the created service account
2. Go to the "Keys" tab
3. Click "Add Key" > "Create New Key"
4. Select "JSON" format
5. Download the JSON file

### Step 4: Configure Environment Variables

1. Open the downloaded JSON file
2. Copy the entire JSON content
3. In your `.env` file, set:
   ```
   GOOGLE_CREDENTIALS={"type":"service_account","project_id":"..."}
   ```
   (Paste the entire JSON as a single line)

4. Also set your Google Sheet ID:
   ```
   GOOGLE_SHEET_ID=your_sheet_id_here
   ```
   (Found in the URL: `docs.google.com/spreadsheets/d/SHEET_ID/edit`)

### Step 5: Share Your Google Sheet

1. Open your Google Sheet
2. Click "Share"
3. Add the service account email (found in the JSON file as `client_email`)
4. Give it "Editor" permissions

## Deployment to Vercel

### Prerequisites

- [Vercel Account](https://vercel.com/signup)
- [Vercel CLI](https://vercel.com/cli) (optional)

### Option 1: Deploy via Vercel Dashboard

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Add environment variables:
   - `GOOGLE_CREDENTIALS`
   - `GOOGLE_SHEET_ID`
   - `NODE_ENV=production`
6. Click "Deploy"

### Option 2: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Add environment variables
vercel env add GOOGLE_CREDENTIALS
vercel env add GOOGLE_SHEET_ID

# Deploy to production
vercel --prod
```

---

## 🌐 Proxy Configuration (Optional)

For sites that block direct access (VIPLeague, Strikeout, VIPRow, etc.), configure a proxy:

### Option 1: Single Proxy
```bash
# In .env file
PROXY_URL=http://proxy-server:8080
# Or with authentication
PROXY_URL=http://username:password@proxy-server:8080
```

### Option 2: Rotating Proxy List
```bash
# In .env file
PROXY_LIST=http://proxy1:8080,http://proxy2:8080,http://proxy3:8080
```

### Free Proxy Sources
- [Free Proxy List](https://free-proxy-list.net/)
- [ProxyScrape](https://proxyscrape.com/free-proxy-list)
- [GeoNode](https://geonode.com/free-proxy-list)

**Note**: Free proxies may be slow or unreliable. For production use, consider paid proxy services.

---

## 🎯 Supported Site Patterns

### VIPLeague-Style Sites
The scraper is optimized for these streaming site patterns:
- cracksports.me, fbstreams.pm, olympicstreams.co
- qatarstreams.me, soccerworldcup.me, strikeout.im
- vipleague.im, vipstand.pm, worldsports.me
- vipbox.lc, vipboxtv.sk, vipleague.pm, viprow.nu
- socceronline.me, buffsports.io

**Features**:
- Detects "Link 1", "Link 2", "Link 3" stream buttons
- Follows iframe embeds to extract m3u8 sources
- Handles obfuscated JavaScript players
- Sport-specific URL patterns (/soccer, /basketball, etc.)

See [VIPLEAGUE_PATTERNS.md](VIPLEAGUE_PATTERNS.md) for detailed pattern documentation.

---

## Usage

### 1. Add Domains

**Manually:**
- Enter domain URLs in the input field
- Click "Add Domain"

**From Google Sheets:**
- Click "Load from Google Sheets"
- Enter your Google Sheet ID
- Specify the range (default: `Sheet1!A:A`)
- Click "Load Domains"

### 2. Configure Scraping

- Enter keywords (comma-separated) to search for streaming pages
- Example: `live, stream, watch, video`

### 3. Start Scraping

- Click "Start Scraping"
- Monitor real-time progress
- View results as they appear

### 4. Export Results

**CSV Export:**
- Click "Export CSV" to download results as CSV

**Excel Export:**
- Click "Export Excel" to download formatted Excel file

**Google Sheets Sync:**
- Click "Sync to Google Sheets"
- Enter your Google Sheet ID
- Results will be written to a new sheet

## Output Format

Results are exported with the following columns:

| Column | Description |
|--------|-------------|
| **Column A** | Scraped URL - The page where m3u8 was found |
| **Column B** | Source URLs (m3u8) - All m3u8 streaming URLs found |
| **Column C** | Domain Index URL - The original domain |
| **Column D** | Server/Label - Which stream server the m3u8 came from (e.g., "Stream 1", "Stream 2", "Main Page") |
| **Column E** | Timestamp - When the scraping occurred |
| **Column F** | Status - Success or Failed |

## Project Structure

```
scrpy/
├── api/                    # Serverless API endpoints
│   ├── scraper.js         # Main scraping logic
│   ├── sheets.js          # Google Sheets integration
│   └── domains.js         # Domain management
├── public/                # Frontend files
│   ├── index.html        # Main HTML
│   ├── styles.css        # Premium CSS styling
│   └── app.js            # Frontend JavaScript
├── utils/                 # Utility modules
│   ├── scraper-core.js   # Core scraping engine
│   ├── csv-handler.js    # CSV/Excel export
│   └── google-sheets.js  # Google Sheets utilities
├── server.js             # Local development server
├── vercel.json           # Vercel deployment config
├── package.json          # Dependencies
└── .env                  # Environment variables
```

## API Endpoints

### Scraper API (`/api/scraper`)

- `POST /api/scraper` - Start/stop scraping
  - Body: `{ action: 'start', domains: [], keywords: [] }`
- `GET /api/scraper?action=status` - Get scraping status
- `GET /api/scraper?action=results` - Get results
- `GET /api/scraper?action=export-csv` - Export CSV
- `GET /api/scraper?action=export-excel` - Export Excel

### Domains API (`/api/domains`)

- `GET /api/domains` - Get all domains
- `POST /api/domains` - Add domain(s)
- `PUT /api/domains` - Replace all domains
- `DELETE /api/domains` - Remove domain

### Google Sheets API (`/api/sheets`)

- `GET /api/sheets?action=read-domains` - Read domains from sheet
- `POST /api/sheets` - Write/append results to sheet

## Troubleshooting

### Google Sheets API Errors

**Error: "The caller does not have permission"**
- Make sure you've shared your Google Sheet with the service account email
- Check that the service account has "Editor" permissions

**Error: "Invalid credentials"**
- Verify your `GOOGLE_CREDENTIALS` environment variable is set correctly
- Ensure the JSON is properly formatted (no extra spaces or line breaks)

### Scraping Issues

**No m3u8 URLs found**
- Some sites may block scraping or use JavaScript-heavy players
- Try different keywords
- Check if the domain actually contains streaming content

**Timeout errors**
- Increase `TIMEOUT_MS` in `.env`
- Some domains may be slow to respond

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.
