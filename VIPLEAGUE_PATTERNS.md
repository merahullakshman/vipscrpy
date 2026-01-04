# VIPLeague-Style Streaming Sites - Common Patterns

This document describes the common structure and patterns found across VIPLeague-style streaming sites.

## Sites Using This Pattern

- cracksports.me
- fbstreams.pm
- olympicstreams.co
- qatarstreams.me
- soccerworldcup.me
- strikeout.im
- vipleague.im
- vipstand.pm
- worldsports.me
- www.vipbox.lc
- www.vipboxtv.sk
- www.vipleague.pm
- www.viprow.nu
- socceronline.me
- buffsports.io

## Common Structure

### 1. Homepage
- Lists live events organized by sport
- URLs: `/`, `/soccer`, `/basketball`, `/football`, etc.
- Event cards with team names, time, and "Watch" links

### 2. Event Pages
- URL pattern: `/event-name-stream`, `/watch/event-id`, `/stream/event-name`
- Contains multiple stream links labeled as:
  - "Link 1", "Link 2", "Link 3", etc.
  - "Server 1", "Server 2", "Server 3", etc.
  - "HD Stream", "SD Stream", etc.

### 3. Player Pages
- Opened when clicking stream links
- Contains iframe with actual player
- Iframe URL patterns:
  - `/embed/stream-id`
  - `/player/event-id`
  - External embed domains

### 4. M3U8 Sources
- Located in iframe JavaScript
- Often obfuscated using:
  - Base64 encoding
  - URL encoding
  - Packed JavaScript (eval functions)
  - atob() functions
- Variable names: `source`, `file`, `stream`, `url`, `video`

## Detection Patterns

### Link Detection
```javascript
// Pattern 1: VIPLeague-style links
<a href="/embed/123">Link 1</a>
<a href="/embed/124">Link 2</a>

// Pattern 2: Data attributes
<a data-uri="/stream/event-1">Stream 1</a>

// Pattern 3: Button elements
<button data-url="/player/123">Watch HD</button>
```

### M3U8 Extraction
```javascript
// Direct reference
source: "https://cdn.example.com/stream.m3u8"

// Base64 encoded
atob("aHR0cHM6Ly9jZG4uZXhhbXBsZS5jb20vc3RyZWFtLm0zdTg=")

// URL encoded
source: "https%3A%2F%2Fcdn.example.com%2Fstream.m3u8"

// Packed JavaScript
eval(function(p,a,c,k,e,d){...})
```

## Scraping Strategy

1. **Find Event Pages**
   - Search by keywords (team names, sport, league)
   - Look for sport-specific pages (`/soccer`, `/basketball`)
   - Match patterns: "vs", "live", "stream", "watch"

2. **Extract Stream Links**
   - Find all "Link X" or "Server X" buttons/links
   - Extract href, data-url, data-uri attributes
   - Follow each link to player page

3. **Extract M3U8 from Player**
   - Fetch iframe source
   - Search for .m3u8 URLs in:
     - Plain text
     - Base64 encoded strings
     - URL encoded strings
     - Packed JavaScript
     - Common variable names

4. **Use Proxy**
   - These sites often block direct access
   - Use rotating proxies to avoid detection
   - Set proper headers (User-Agent, Referer)

## Implementation

The scraper now includes:

- ✅ VIPLeague-style link detection ("Link 1", "Link 2", etc.)
- ✅ Sport-specific URL patterns
- ✅ Proxy support with rotation
- ✅ Enhanced keyword matching
- ✅ Obfuscated m3u8 extraction (5 methods)
- ✅ Iframe source following
- ✅ Proper headers and referer

## Usage

1. **Set up proxy** (optional but recommended):
   ```bash
   # In .env file
   PROXY_URL=http://proxy-server:port
   # Or for rotation
   PROXY_LIST=http://proxy1:port,http://proxy2:port,http://proxy3:port
   ```

2. **Add domains**:
   ```
   https://strikeout.im
   https://vipleague.im
   https://viprow.nu
   ```

3. **Enter keywords**:
   ```
   soccer, premier league, live
   ```

4. **Start scraping**:
   - Scraper finds event pages matching keywords
   - Extracts all stream links (Link 1, 2, 3, etc.)
   - Follows each link to extract m3u8 URLs
   - Returns results with server labels

## Notes

- These sites have strong bot protection
- Proxy usage is highly recommended
- Some sites may require JavaScript rendering (headless browser)
- M3U8 URLs may be temporary/time-limited
- Rate limiting is important to avoid bans
