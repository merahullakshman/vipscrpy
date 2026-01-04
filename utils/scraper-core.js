const axios = require('axios');
const cheerio = require('cheerio');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Add stealth plugin to evade detection
puppeteerExtra.use(StealthPlugin());
puppeteerExtra.use(AdblockerPlugin({ blockTrackers: true }));

/**
 * Core scraping utilities for finding m3u8 streaming URLs
 * Enhanced with multi-server stream detection and proxy support
 */

class ScraperCore {
  constructor(options = {}) {
    this.requestDelay = options.requestDelay || 1000;
    this.timeout = options.timeout || 30000;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.useHeadlessBrowser = options.useHeadlessBrowser !== false;
    this.browser = null;

    // Proxy configuration
    this.proxyUrl = options.proxyUrl || process.env.PROXY_URL || null;
    this.proxyList = options.proxyList || (process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : []);
    this.currentProxyIndex = 0;
  }

  /**
   * Get next proxy from rotation list
   */
  getNextProxy() {
    if (this.proxyList.length === 0) {
      return this.proxyUrl;
    }

    const proxy = this.proxyList[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyList.length;
    return proxy;
  }

  /**
   * Get axios config with proxy if available
   */
  getAxiosConfig(url) {
    const config = {
      timeout: this.timeout,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': url,
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      maxRedirects: 5,
    };

    const proxy = this.getNextProxy();
    if (proxy) {
      config.httpsAgent = new HttpsProxyAgent(proxy);
      config.proxy = false; // Disable axios default proxy handling
      console.log(`Using proxy: ${proxy.replace(/\/\/.*:.*@/, '//*****:*****@')}`); // Hide credentials in log
    }

    return config;
  }

  /**
   * Initialize Puppeteer browser with Vercel compatibility
   */
  async initBrowser() {
    if (this.browser) {
      return this.browser;
    }

    try {
      let puppeteer;
      let launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ]
      };

      // Check if running on Vercel (serverless environment)
      if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        // Use puppeteer-core with chromium for serverless
        try {
          puppeteer = require('puppeteer-core');
          const chromium = require('@sparticuz/chromium');

          launchOptions.executablePath = await chromium.executablePath();
          launchOptions.args = chromium.args;
        } catch (e) {
          console.log('Chromium not available, falling back to regular puppeteer');
          puppeteer = require('puppeteer');
        }
      } else {
        // Use regular puppeteer for local development
        puppeteer = require('puppeteer');
      }

      this.browser = await puppeteer.launch(launchOptions);
      return this.browser;
    } catch (error) {
      console.error('Error initializing browser:', error.message);
      this.useHeadlessBrowser = false; // Disable browser if it fails
      return null;
    }
  }

  /**
   * Close browser
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Delay execution for rate limiting
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch page content with error handling and proxy support
   */
  async fetchPage(url) {
    try {
      const config = this.getAxiosConfig(url);
      const response = await axios.get(url, config);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch page with Puppeteer for JavaScript-heavy sites
   */
  async fetchPageWithBrowser(url) {
    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();

      await page.setUserAgent(this.userAgent);
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
      });

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      const content = await page.content();
      await page.close();

      return content;
    } catch (error) {
      console.error(`Error fetching with browser ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Detect search URL pattern for a specific domain
   */
  async detectSearchPattern(domain) {
    try {
      const html = await this.fetchPage(domain);
      if (!html) return null;

      const $ = cheerio.load(html);

      // Look for search forms
      const searchForm = $('form[action*="search"], form[role="search"], input[type="search"]').first();
      if (searchForm.length > 0) {
        const form = searchForm.closest('form');
        const action = form.attr('action');
        const method = form.attr('method') || 'get';
        const inputName = form.find('input[type="search"], input[name*="search"], input[name="q"], input[name="s"]').attr('name');

        if (action && inputName) {
          const searchUrl = action.startsWith('http') ? action : new URL(action, domain).href;
          return {
            url: searchUrl,
            param: inputName,
            method: method.toLowerCase()
          };
        }
      }

      // Look for search links in navigation
      const searchLinks = $('a[href*="search"], a[href*="?s="], a[href*="?q="]').first();
      if (searchLinks.length > 0) {
        const href = searchLinks.attr('href');
        if (href.includes('?s=')) {
          return { url: `${domain}`, param: 's', method: 'get' };
        }
        if (href.includes('?q=')) {
          return { url: `${domain}`, param: 'q', method: 'get' };
        }
      }

      return null;
    } catch (error) {
      console.error(`Error detecting search pattern for ${domain}:`, error.message);
      return null;
    }
  }

  /**
   * Check if text matches any keyword (strict matching)
   */
  matchesKeywords(text, keywords) {
    if (!text || keywords.length === 0) return false;

    const lowerText = text.toLowerCase();

    // Check if text contains ALL keywords (AND logic) or ANY keyword (OR logic)
    // Using OR logic for flexibility
    return keywords.some(keyword => {
      const lowerKeyword = keyword.toLowerCase().trim();
      if (!lowerKeyword) return false;

      // Match whole words or phrases
      const regex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(lowerText);
    });
  }

  /**
   * Extract team names from a match page URL or title
   * Handles patterns like "team-a-vs-team-b", "team-a-team-b", etc.
   */
  extractTeamNames(pageUrl, pageTitle = '') {
    const teams = [];

    try {
      // Extract from URL path
      const urlPath = new URL(pageUrl).pathname.toLowerCase();

      // Pattern 1: "team-a-vs-team-b" or "team-a-v-team-b"
      const vsPattern = /([a-z0-9-]+)-(?:vs?|versus)-([a-z0-9-]+)/i;
      const vsMatch = urlPath.match(vsPattern);

      if (vsMatch) {
        teams.push(vsMatch[1], vsMatch[2]);
      } else {
        // Pattern 2: Look for team names in title
        const titleVsPattern = /(.+?)\s+(?:vs?\.?|versus|-)\s+(.+?)(?:\s+live|\s+stream|$)/i;
        const titleMatch = pageTitle.match(titleVsPattern);

        if (titleMatch) {
          // Convert to URL-friendly format
          const team1 = titleMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
          const team2 = titleMatch[2].trim().toLowerCase().replace(/\s+/g, '-');
          teams.push(team1, team2);
        }
      }

      // Clean up team names (remove common prefixes/suffixes)
      return teams.map(team => {
        return team
          .replace(/^(live-|watch-|stream-)/, '')
          .replace(/(-live-stream|-live|-stream|-watch)$/, '')
          .replace(/^\/+|\/+$/g, '')
          .trim();
      }).filter(team => team.length > 2); // Filter out very short names

    } catch (error) {
      console.error('Error extracting team names:', error.message);
      return [];
    }
  }

  /**
   * Find team-specific tag pages by extracting actual links from match pages
   * This finds the real team tag links instead of guessing URL patterns
   */
  async findTeamTagPagesFromMatchPage(matchPageUrl, teamNames) {
    const teamPages = [];

    if (!teamNames || teamNames.length === 0) {
      return teamPages;
    }

    try {
      console.log(`Extracting team tag links from match page: ${matchPageUrl}`);

      // Fetch the match page
      const html = await this.fetchPage(matchPageUrl);
      if (!html) return teamPages;

      const $ = cheerio.load(html);

      // Find all links on the match page
      $('a[href]').each((i, elem) => {
        const href = $(elem).attr('href');
        const linkText = $(elem).text().toLowerCase().trim();

        if (!href) return;

        // Check if this link is for one of our teams
        const isTeamLink = teamNames.some(teamName => {
          const teamLower = teamName.toLowerCase();
          // Link href or text should contain the team name
          return (href.toLowerCase().includes(teamName) || linkText.includes(teamLower)) &&
            // Should be a stream/live link
            (href.includes('stream') || href.includes('live')) &&
            // Should NOT be the match page itself (no "vs" in it)
            !href.includes('-vs-') && !href.includes(' vs ');
        });

        if (isTeamLink) {
          try {
            const fullUrl = href.startsWith('http') ? href : new URL(href, matchPageUrl).href;

            // Only add if from same domain and not already added
            const matchDomain = new URL(matchPageUrl).origin;
            if (fullUrl.startsWith(matchDomain) && !teamPages.includes(fullUrl)) {
              teamPages.push(fullUrl);
              console.log(`✓ Found team tag link: ${fullUrl}`);
            }
          } catch (e) {
            // Invalid URL
          }
        }
      });

      return teamPages;

    } catch (error) {
      console.error('Error extracting team tag links:', error.message);
      return teamPages;
    }
  }

  /**
   * Find team-specific tag pages for discovered teams
   * Returns URLs like /soccer/team-name-live-stream
   * Enhanced to handle strikeout.im patterns and numbered variants
   */
  async findTeamTagPages(domain, teamNames, sport = 'soccer') {
    const teamPages = [];

    if (!teamNames || teamNames.length === 0) {
      return teamPages;
    }

    console.log(`Looking for team tag pages for: ${teamNames.join(', ')}`);

    // Common URL patterns for team-specific pages
    const patterns = [
      // Standard patterns
      `/${sport}/{team}-live-stream`,
      `/${sport}/{team}-stream`,
      `/${sport}/{team}-live`,
      `/streams/{team}`,
      `/{sport}/{team}`,
      `/{team}-live-stream`,
      `/{team}-stream`,

      // Strikeout.im specific patterns
      `/${sport}/stream-{team}-live`,  // /serie-a/stream-lazio-live
      `/${sport}/1/{team}-stream`,      // /serie-a/1/lazio-stream
      `/${sport}/2/{team}-stream`,      // /serie-a/2/lazio-stream
      `/${sport}/3/{team}-stream`,
      `/${sport}/4/{team}-stream`,
      `/${sport}/5/{team}-stream`,
    ];

    for (const teamName of teamNames) {
      for (const pattern of patterns) {
        const teamUrl = pattern.replace('{team}', teamName).replace('{sport}', sport);
        const fullUrl = `${domain}${teamUrl}`;

        try {
          // Quick check if page exists
          const config = this.getAxiosConfig(fullUrl);
          const response = await axios.head(fullUrl, {
            ...config,
            timeout: 5000,
            validateStatus: (status) => status < 500 // Accept redirects and 404s
          });

          if (response.status === 200) {
            teamPages.push(fullUrl);
            console.log(`✓ Found team page: ${teamUrl}`);

            // For strikeout.im, if we found a numbered variant, don't break
            // Continue to find all numbered variants (1/, 2/, 3/, etc.)
            if (!pattern.match(/\/\d+\//)) {
              break; // For non-numbered patterns, move to next team
            }
          }
        } catch (error) {
          // Page doesn't exist or error, try next pattern
          continue;
        }

        await this.delay(200); // Small delay between checks
      }
    }

    return teamPages;
  }

  /**
   * Find all event/match links on a domain (when no keywords provided)
   * Discovers all streaming event pages across common sport categories
   */
  async findAllEventLinks(domain) {
    const eventLinks = new Set();

    console.log(`Discovering all event links on ${domain}...`);

    try {
      // Common sport categories to check
      const sports = ['soccer', 'football', 'basketball', 'baseball', 'hockey', 'mma', 'boxing', 'tennis', 'f1', 'nfl', 'nba', 'nhl'];
      const pagesToCheck = [
        domain, // Homepage
        `${domain}/live`,
        `${domain}/streams`,
        `${domain}/schedule`,
        `${domain}/events`,
      ];

      // Add sport-specific pages
      sports.forEach(sport => {
        pagesToCheck.push(`${domain}/${sport}`);
        pagesToCheck.push(`${domain}/${sport}-streams`);
        pagesToCheck.push(`${domain}/streams/${sport}`);
      });

      // Check each page for event links
      for (const pageUrl of pagesToCheck) {
        const html = await this.fetchPage(pageUrl);
        if (!html) continue;

        const $ = cheerio.load(html);

        // Find all links that look like events/matches
        $('a[href]').each((i, elem) => {
          const href = $(elem).attr('href');
          const linkText = $(elem).text().trim();
          const title = $(elem).attr('title') || '';
          const combinedText = `${linkText} ${title}`.toLowerCase();

          // Check if this looks like an event/match link
          const isEventLink =
            href.includes('stream') ||
            href.includes('watch') ||
            href.includes('live') ||
            href.includes('event') ||
            combinedText.includes('vs') ||
            combinedText.includes('v ') ||
            combinedText.match(/\d{1,2}:\d{2}/) || // Time pattern
            combinedText.match(/\d{2}\/\d{2}/) || // Date pattern
            (href.includes('-') && (href.includes('stream') || href.includes('live')));

          if (isEventLink && href) {
            try {
              const fullUrl = href.startsWith('http') ? href : new URL(href, domain).href;

              // Only add if from same domain and not a category page
              if (fullUrl.startsWith(domain) && !this.isCategoryPage(fullUrl)) {
                eventLinks.add(fullUrl);
              }
            } catch (e) {
              // Invalid URL
            }
          }
        });

        await this.delay(500); // Small delay between pages

        // Limit to avoid too many requests
        if (eventLinks.size > 50) {
          console.log(`Found ${eventLinks.size} event links, stopping discovery...`);
          break;
        }
      }

      console.log(`✓ Discovered ${eventLinks.size} event links`);
      return Array.from(eventLinks);

    } catch (error) {
      console.error('Error finding all event links:', error.message);
      return Array.from(eventLinks);
    }
  }

  /**
   * Check if URL is a category/schedule page rather than an event page
   */
  isCategoryPage(url) {
    const categoryPatterns = [
      /\/soccer\/?$/,
      /\/football\/?$/,
      /\/basketball\/?$/,
      /\/streams\/?$/,
      /\/live\/?$/,
      /\/schedule\/?$/,
      /\/events\/?$/,
      /\/(soccer|football|basketball)-streams\/?$/
    ];

    return categoryPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Search domain for pages matching keywords
   * Enhanced with adaptive search URL detection and strict keyword filtering
   */
  async findPagesWithKeywords(domain, keywords) {
    const foundPages = [];

    if (keywords.length === 0) {
      // If no keywords, discover all event links
      return await this.findAllEventLinks(domain);
    }

    try {
      console.log(`Searching ${domain} for keywords: ${keywords.join(', ')}`);

      // Step 1: Try to detect the site's search pattern
      const searchPattern = await this.detectSearchPattern(domain);

      const searchUrls = [];

      if (searchPattern) {
        // Use detected search pattern
        const searchQuery = keywords.join(' ');
        if (searchPattern.method === 'get') {
          searchUrls.push(`${searchPattern.url}?${searchPattern.param}=${encodeURIComponent(searchQuery)}`);
        }
        console.log(`Using detected search pattern: ${searchPattern.url}?${searchPattern.param}=...`);
      }

      // Step 2: Try common search URL patterns
      const searchQuery = keywords.join('+');
      searchUrls.push(
        `${domain}/search?q=${searchQuery}`,
        `${domain}/?s=${searchQuery}`,
        `${domain}/search?query=${searchQuery}`,
        `${domain}/search/${searchQuery}`,
        `${domain}/?search=${searchQuery}`
      );

      // Step 3: Try sport-specific pages if keywords match sports
      const sports = ['soccer', 'football', 'basketball', 'baseball', 'hockey', 'mma', 'boxing', 'tennis', 'f1', 'formula'];
      keywords.forEach(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        sports.forEach(sport => {
          if (lowerKeyword.includes(sport)) {
            searchUrls.push(`${domain}/${sport}`);
            searchUrls.push(`${domain}/${sport}-streams`);
            searchUrls.push(`${domain}/streams/${sport}`);
          }
        });
      });

      // Step 4: Try homepage as fallback
      searchUrls.push(domain);

      // Step 5: Search each URL and collect matching links
      for (const searchUrl of searchUrls) {
        const html = await this.fetchPage(searchUrl);
        if (!html) continue;

        const $ = cheerio.load(html);

        // Find all links on the page
        const links = new Set();

        $('a[href]').each((i, elem) => {
          const href = $(elem).attr('href');
          const linkText = $(elem).text().trim();
          const title = $(elem).attr('title') || '';

          // Combine text sources for matching
          const combinedText = `${linkText} ${title}`.toLowerCase();

          // STRICT: Only add links that match keywords
          if (this.matchesKeywords(combinedText, keywords)) {
            // Additional filters for streaming links
            const isStreamLink =
              href.includes('stream') ||
              href.includes('watch') ||
              href.includes('live') ||
              href.includes('event') ||
              combinedText.includes('vs') ||
              combinedText.includes('live');

            if (isStreamLink && href) {
              try {
                const fullUrl = href.startsWith('http') ? href : new URL(href, domain).href;

                // Only add if it's from the same domain
                if (fullUrl.startsWith(domain)) {
                  links.add(fullUrl);
                  console.log(`✓ Found matching link: ${linkText.substring(0, 50)}...`);
                }
              } catch (e) {
                // Invalid URL, skip
              }
            }
          }
        });

        foundPages.push(...Array.from(links));

        // If we found matches, stop searching other URLs
        if (foundPages.length > 0) {
          console.log(`Found ${foundPages.length} keyword-matching pages`);
          break;
        }

        await this.delay(this.requestDelay);
      }

      // If still no results, try a more lenient search on homepage
      if (foundPages.length === 0) {
        console.log(`No strict matches found, trying lenient search on homepage...`);
        const html = await this.fetchPage(domain);
        if (html) {
          const $ = cheerio.load(html);

          // Look for any streaming-related links
          $('a[href*="stream"], a[href*="watch"], a[href*="live"]').each((i, elem) => {
            const href = $(elem).attr('href');
            const linkText = $(elem).text().trim();

            if (this.matchesKeywords(linkText, keywords) && href) {
              try {
                const fullUrl = href.startsWith('http') ? href : new URL(href, domain).href;
                if (fullUrl.startsWith(domain)) {
                  foundPages.push(fullUrl);
                }
              } catch (e) {
                // Invalid URL
              }
            }
          });
        }
      }

      // STEP 6: For schedule/category pages, collect actual event links from within them
      if (foundPages.length > 0) {
        console.log(`Collecting event links from ${foundPages.length} schedule pages...`);
        const eventPages = [];

        // Check first few pages to see if they're schedule/category pages
        for (const pageUrl of foundPages.slice(0, 5)) {
          // Skip if URL looks like an actual event (has date, team names, vs, etc.)
          const urlLower = pageUrl.toLowerCase();
          if (urlLower.match(/\d{4}-\d{2}-\d{2}|vs-|\d+pm|\d+am|live-/)) {
            // This looks like an actual event page, keep it
            eventPages.push(pageUrl);
            continue;
          }

          // This might be a schedule/category page, fetch it to find event links
          console.log(`Checking for events in: ${pageUrl.substring(domain.length)}`);
          const pageHtml = await this.fetchPage(pageUrl);
          if (!pageHtml) continue;

          const $ = cheerio.load(pageHtml);

          // Look for event links within this page
          $('a[href]').each((i, elem) => {
            const href = $(elem).attr('href');
            const linkText = $(elem).text().trim();
            const title = $(elem).attr('title') || '';
            const combinedText = `${linkText} ${title}`;

            // Check if this is an event link
            const isEventLink =
              href.includes('watch') ||
              href.includes('stream') ||
              href.includes('live') ||
              href.includes('event') ||
              combinedText.toLowerCase().includes('vs') ||
              combinedText.toLowerCase().match(/\d{1,2}:\d{2}|pm|am/);

            if (isEventLink && href) {
              try {
                const fullUrl = href.startsWith('http') ? href : new URL(href, domain).href;

                // Only add if from same domain and matches keywords
                if (fullUrl.startsWith(domain) && this.matchesKeywords(combinedText, keywords)) {
                  eventPages.push(fullUrl);
                  console.log(`  ✓ Found event: ${linkText.substring(0, 60)}...`);
                }
              } catch (e) {
                // Invalid URL
              }
            }
          });

          await this.delay(500); // Small delay between schedule page checks
        }

        // If we found event pages, use those instead of schedule pages
        if (eventPages.length > 0) {
          console.log(`Collected ${eventPages.length} event pages from schedule pages`);
          foundPages = [...new Set([...foundPages, ...eventPages])]; // Combine both
        }
      }

    } catch (error) {
      console.error(`Error searching domain ${domain}:`, error.message);
    }

    // Remove duplicates and limit results
    const uniquePages = [...new Set(foundPages)];
    console.log(`Final result: ${uniquePages.length} unique pages matching keywords`);

    return uniquePages.slice(0, 20); // Increased limit to 20 to capture more events
  }

  /**
   * Find multi-server stream links on a page
   * Enhanced for VIPLeague-style sites (Link 1, Link 2, Link 3, etc.)
   */
  findStreamServerLinks(html, baseUrl) {
    const streamLinks = [];

    if (!html) return streamLinks;

    const $ = cheerio.load(html);

    // Pattern 1: VIPLeague-style "Link 1", "Link 2", "Link 3" buttons
    $('a:contains("Link"), button:contains("Link")').each((i, elem) => {
      const text = $(elem).text().trim();
      const href = $(elem).attr('href') || $(elem).attr('data-url') || $(elem).attr('data-src');

      if (text.match(/Link\s*\d+/i) && href) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        streamLinks.push({
          url: fullUrl,
          label: text,
          type: 'vipleague-link'
        });
      }
    });

    // Pattern 2: Links with data-uri attribute (BuffStreams pattern)
    $('a[data-uri*="stream"]').each((i, elem) => {
      const dataUri = $(elem).attr('data-uri');
      const text = $(elem).text().trim();

      if (dataUri) {
        const fullUrl = dataUri.startsWith('http') ? dataUri : new URL(dataUri, baseUrl).href;
        streamLinks.push({
          url: fullUrl,
          label: text || `Stream ${i + 1}`,
          type: 'data-uri'
        });
      }
    });

    // Pattern 3: Links with text containing "stream" or "server"
    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      const text = $(elem).text().toLowerCase();

      if ((text.includes('stream') || text.includes('server') || text.includes('watch')) &&
        (text.match(/\d+/) || text.includes('hd') || text.includes('sd'))) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;

        // Avoid duplicates
        if (!streamLinks.some(link => link.url === fullUrl)) {
          streamLinks.push({
            url: fullUrl,
            label: $(elem).text().trim(),
            type: 'text-match'
          });
        }
      }
    });

    // Pattern 4: DaddyHD-style channel links (watch.php?id=XXX)
    $('a[href*="watch.php"], a[href*="stream"]').each((i, elem) => {
      const href = $(elem).attr('href');
      const text = $(elem).text().trim();

      const isChannelLink = text.match(/DAZN|ESPN|SKY|BT SPORT|BEIN|TNT|NBC|FOX|CBS|CHANNEL/i) ||
        href.match(/id=\d+|stream-\d+/i);

      if (isChannelLink && href) {
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;

        if (!streamLinks.some(link => link.url === fullUrl)) {
          streamLinks.push({
            url: fullUrl,
            label: text || `Channel ${i + 1}`,
            type: 'channel-link'
          });
        }
      }
    });

    // Pattern 5: ID-based channels (DaddyHD pattern)
    $('*').each((i, elem) => {
      const elemText = $(elem).text();
      const idMatch = elemText.match(/ID:\s*(\d+)/i);

      if (idMatch) {
        const channelId = idMatch[1];
        const channelName = elemText.split('\n')[0].trim();

        let link = $(elem).find('a[href]').first().attr('href');

        if (!link) {
          link = `watch.php?id=${channelId}`;
        }

        const fullUrl = link.startsWith('http') ? link : new URL(link, baseUrl).href;

        if (!streamLinks.some(l => l.url === fullUrl)) {
          streamLinks.push({
            url: fullUrl,
            label: channelName,
            type: 'id-based',
            channelId: channelId
          });
        }
      }
    });

    return streamLinks;
  }

  /**
   * Extract iframe sources from a page
   */
  extractIframeSources(html, baseUrl) {
    const iframeSources = [];

    if (!html) return iframeSources;

    const $ = cheerio.load(html);

    $('iframe[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        const fullUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
        iframeSources.push(fullUrl);
      }
    });

    return iframeSources;
  }

  /**
   * Extract m3u8 URLs from page content
   */
  extractM3U8URLs(html, pageUrl) {
    const m3u8URLs = new Set();

    if (!html) return Array.from(m3u8URLs);

    // Method 1: Direct regex search for m3u8 URLs
    const m3u8Regex = /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi;
    const matches = html.match(m3u8Regex);
    if (matches) {
      matches.forEach(url => m3u8URLs.add(url));
    }

    // Method 2: Parse HTML for video sources
    const $ = cheerio.load(html);

    // Check video tags
    $('video source[src*=".m3u8"], video[src*=".m3u8"]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        const fullUrl = src.startsWith('http') ? src : new URL(src, pageUrl).href;
        m3u8URLs.add(fullUrl);
      }
    });

    // Check data attributes
    $('[data-src*=".m3u8"], [data-video*=".m3u8"], [data-stream*=".m3u8"], [data-file*=".m3u8"]').each((i, elem) => {
      const src = $(elem).attr('data-src') || $(elem).attr('data-video') ||
        $(elem).attr('data-stream') || $(elem).attr('data-file');
      if (src) {
        const fullUrl = src.startsWith('http') ? src : new URL(src, pageUrl).href;
        m3u8URLs.add(fullUrl);
      }
    });

    // Method 3: Search in script tags
    $('script').each((i, elem) => {
      const scriptContent = $(elem).html();
      if (scriptContent) {
        const scriptMatches = scriptContent.match(m3u8Regex);
        if (scriptMatches) {
          scriptMatches.forEach(url => m3u8URLs.add(url));
        }
      }
    });

    return Array.from(m3u8URLs);
  }

  /**
   * Extract m3u8 URLs from obfuscated JavaScript
   */
  extractObfuscatedM3U8(html) {
    const m3u8URLs = new Set();

    if (!html) return Array.from(m3u8URLs);

    try {
      // Method 1: Base64 encoded URLs
      const base64Regex = /([A-Za-z0-9+/]{20,}={0,2})/g;
      const base64Matches = html.match(base64Regex) || [];

      base64Matches.forEach(encoded => {
        try {
          const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
          if (decoded.includes('.m3u8')) {
            const m3u8Match = decoded.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi);
            if (m3u8Match) {
              m3u8Match.forEach(url => m3u8URLs.add(url));
            }
          }
        } catch (e) {
          // Not valid base64
        }
      });

      // Method 2: URL-encoded m3u8 URLs
      const urlEncodedRegex = /(https?%3A%2F%2F[^"'\s<>]+\.m3u8[^"'\s<>]*)/gi;
      const urlEncodedMatches = html.match(urlEncodedRegex) || [];

      urlEncodedMatches.forEach(encoded => {
        try {
          const decoded = decodeURIComponent(encoded);
          m3u8URLs.add(decoded);
        } catch (e) {
          // Invalid encoding
        }
      });

      // Method 3: Packed JavaScript
      const packedRegex = /eval\(function\(p,a,c,k,e,d\).*?\}\((.*?)\)\)/gs;
      const packedMatches = html.match(packedRegex) || [];

      packedMatches.forEach(packed => {
        const m3u8InPacked = packed.match(/['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/gi);
        if (m3u8InPacked) {
          m3u8InPacked.forEach(url => {
            const cleanUrl = url.replace(/['"]/g, '');
            m3u8URLs.add(cleanUrl);
          });
        }
      });

      // Method 4: atob() decoded strings
      const atobRegex = /atob\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      let atobMatch;

      while ((atobMatch = atobRegex.exec(html)) !== null) {
        try {
          const decoded = Buffer.from(atobMatch[1], 'base64').toString('utf-8');
          const m3u8Match = decoded.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi);
          if (m3u8Match) {
            m3u8Match.forEach(url => m3u8URLs.add(url));
          }
        } catch (e) {
          // Invalid base64
        }
      }

      // Method 5: Common variable names
      const varPatterns = [
        /(?:source|src|stream|url|file|video)\s*[:=]\s*['"]([^'"]*\.m3u8[^'"]*)['"]/gi,
        /['"]([^'"]*\.m3u8[^'"]*)['"]\s*[:=]\s*(?:source|src|stream|url|file|video)/gi,
      ];

      varPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          if (match[1] && match[1].includes('.m3u8') && match[1].startsWith('http')) {
            m3u8URLs.add(match[1]);
          }
        }
      });

    } catch (error) {
      console.error('Error extracting obfuscated m3u8:', error.message);
    }

    return Array.from(m3u8URLs);
  }

  /**
   * Recursively extract M3U8 URLs from iframes (up to maxDepth levels)
   * This is crucial for sites that nest players in multiple iframe levels
   */
  async deepExtractIframes(url, depth = 0, maxDepth = 3, visited = new Set()) {
    // Prevent infinite loops
    if (depth > maxDepth || visited.has(url)) {
      return [];
    }

    visited.add(url);
    const allM3U8s = [];

    try {
      console.log(`${'  '.repeat(depth)}→ Checking iframe level ${depth}: ${url.substring(0, 60)}...`);

      // Fetch the page
      const html = await this.fetchPage(url);
      if (!html) return allM3U8s;

      // Extract M3U8 URLs from current page
      const pageM3U8s = this.extractM3U8URLs(html, url);
      const obfuscatedM3U8s = this.extractObfuscatedM3U8(html);
      allM3U8s.push(...pageM3U8s, ...obfuscatedM3U8s);

      if (allM3U8s.length > 0) {
        console.log(`${'  '.repeat(depth)}✓ Found ${allM3U8s.length} M3U8(s) at level ${depth}`);
      }

      // Get all iframes from this page
      const iframes = this.extractIframeSources(html, url);

      if (iframes.length > 0) {
        console.log(`${'  '.repeat(depth)}→ Found ${iframes.length} iframe(s), checking deeper...`);

        // Recursively check each iframe in parallel
        const iframeResults = await Promise.all(
          iframes.slice(0, 5).map(async (iframeUrl) => {
            await this.delay(200); // Small delay to avoid overwhelming
            return await this.deepExtractIframes(iframeUrl, depth + 1, maxDepth, visited);
          })
        );

        // Flatten results
        iframeResults.forEach(results => allM3U8s.push(...results));
      }

      return [...new Set(allM3U8s)]; // Remove duplicates

    } catch (error) {
      console.error(`Error extracting from iframe at depth ${depth}:`, error.message);
      return allM3U8s;
    }
  }

  /**
   * Scrape page with Puppeteer network interception to catch M3U8 URLs
   * This captures URLs loaded dynamically via JavaScript
   */
  async scrapeWithNetworkInterception(url) {
    const m3u8URLs = new Set();

    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();

      // Set up network interception
      await page.setRequestInterception(true);

      page.on('request', (request) => {
        request.continue();
      });

      page.on('response', async (response) => {
        const responseUrl = response.url();

        // Capture any M3U8 URLs from network requests
        if (responseUrl.includes('.m3u8')) {
          m3u8URLs.add(responseUrl);
          console.log(`  🎯 Network intercepted: ${responseUrl.substring(0, 80)}...`);
        }
      });

      // Navigate and wait for network activity
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 15000
      });

      // Wait a bit for any delayed requests
      await this.delay(2000);

      await page.close();

      return Array.from(m3u8URLs);

    } catch (error) {
      console.error(`Error with network interception for ${url}:`, error.message);
      return Array.from(m3u8URLs);
    }
  }

  /**
   * Deep scrape a page for m3u8 URLs including multi-server streams
   */
  async deepScrapePage(pageUrl, domainUrl) {
    const allResults = [];

    try {
      console.log(`Deep scraping: ${pageUrl}`);

      // Fetch main page
      const html = await this.fetchPage(pageUrl);

      // Extract m3u8 URLs from main page
      const mainM3U8s = this.extractM3U8URLs(html, pageUrl);
      const obfuscatedM3U8s = this.extractObfuscatedM3U8(html);
      mainM3U8s.push(...obfuscatedM3U8s);

      if (mainM3U8s.length > 0) {
        allResults.push({
          scrapedUrl: pageUrl,
          sourceUrls: [...new Set(mainM3U8s)],
          domainIndexUrl: domainUrl,
          timestamp: new Date().toISOString(),
          success: true,
          serverLabel: 'Main Page'
        });
      }

      // Find multi-server stream links
      const streamLinks = this.findStreamServerLinks(html, pageUrl);

      if (streamLinks.length > 0) {
        console.log(`Found ${streamLinks.length} stream server links, scraping in parallel...`);

        // NEW: Scrape stream servers in parallel for much faster processing
        const streamResults = await Promise.all(
          streamLinks.slice(0, 20).map(async (streamLink) => {
            try {
              console.log(`→ Scraping: ${streamLink.label}`);

              // Try deep iframe extraction (network interception disabled due to anti-bot issues)
              let serverM3U8s = await this.deepExtractIframes(streamLink.url, 0, 3);
              console.log(`  Deep iframe extraction returned ${serverM3U8s.length} M3U8(s)`);

              // Fallback: If deep extraction didn't find anything, try basic extraction
              if (serverM3U8s.length === 0) {
                console.log(`  Trying basic extraction...`);
                const serverHtml = await this.fetchPage(streamLink.url);
                if (serverHtml) {
                  serverM3U8s = this.extractM3U8URLs(serverHtml, streamLink.url);
                  const obfuscated = this.extractObfuscatedM3U8(serverHtml);
                  serverM3U8s.push(...obfuscated);
                }
              }



              if (serverM3U8s.length > 0) {
                console.log(`  ✓ Found ${serverM3U8s.length} M3U8(s) for ${streamLink.label}`);
                return {
                  scrapedUrl: streamLink.url,
                  sourceUrls: [...new Set(serverM3U8s)],
                  domainIndexUrl: domainUrl,
                  timestamp: new Date().toISOString(),
                  success: true,
                  serverLabel: streamLink.label
                };
              } else {
                console.log(`  ✗ No M3U8 found for ${streamLink.label}`);
                return {
                  scrapedUrl: streamLink.url,
                  sourceUrls: [],
                  domainIndexUrl: domainUrl,
                  timestamp: new Date().toISOString(),
                  success: false,
                  serverLabel: streamLink.label
                };
              }

            } catch (error) {
              console.error(`Error scraping ${streamLink.label}:`, error.message);
              return {
                scrapedUrl: streamLink.url,
                sourceUrls: [],
                domainIndexUrl: domainUrl,
                timestamp: new Date().toISOString(),
                success: false,
                serverLabel: streamLink.label,
                error: error.message
              };
            }
          })
        );

        allResults.push(...streamResults);
      }

      // If no results, try headless browser
      if (allResults.length === 0 && this.useHeadlessBrowser) {
        console.log(`Trying headless browser for: ${pageUrl}`);
        const browserHtml = await this.fetchPageWithBrowser(pageUrl);
        const browserM3U8s = this.extractM3U8URLs(browserHtml, pageUrl);
        const browserObfuscated = this.extractObfuscatedM3U8(browserHtml);
        browserM3U8s.push(...browserObfuscated);

        if (browserM3U8s.length > 0) {
          allResults.push({
            scrapedUrl: pageUrl,
            sourceUrls: [...new Set(browserM3U8s)],
            domainIndexUrl: domainUrl,
            timestamp: new Date().toISOString(),
            success: true,
            serverLabel: 'Browser Render'
          });
        }
      }

      return allResults.length > 0 ? allResults : [{
        scrapedUrl: pageUrl,
        sourceUrls: [],
        domainIndexUrl: domainUrl,
        timestamp: new Date().toISOString(),
        success: false,
        serverLabel: 'No streams found'
      }];

    } catch (error) {
      console.error(`Error deep scraping page ${pageUrl}:`, error.message);
      return [{
        scrapedUrl: pageUrl,
        sourceUrls: [],
        domainIndexUrl: domainUrl,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      }];
    }
  }

  /**
   * Scrape a single page for m3u8 URLs (legacy method)
   */
  async scrapePage(pageUrl, domainUrl) {
    try {
      const html = await this.fetchPage(pageUrl);
      const m3u8URLs = this.extractM3U8URLs(html, pageUrl);
      const obfuscatedM3U8s = this.extractObfuscatedM3U8(html);
      m3u8URLs.push(...obfuscatedM3U8s);

      return {
        scrapedUrl: pageUrl,
        sourceUrls: [...new Set(m3u8URLs)],
        domainIndexUrl: domainUrl,
        timestamp: new Date().toISOString(),
        success: m3u8URLs.length > 0,
      };
    } catch (error) {
      console.error(`Error scraping page ${pageUrl}:`, error.message);
      return {
        scrapedUrl: pageUrl,
        sourceUrls: [],
        domainIndexUrl: domainUrl,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Scrape multiple domains with keywords
   */
  async scrapeDomainsWithKeywords(domains, keywords, onProgress) {
    const results = [];
    let processed = 0;

    for (const domain of domains) {
      try {
        // Ensure domain has protocol
        const domainUrl = domain.startsWith('http') ? domain : `https://${domain}`;

        // Find pages with keywords
        const pages = await this.findPagesWithKeywords(domainUrl, keywords);

        if (pages.length === 0) {
          // If no pages found, try homepage
          pages.push(domainUrl);
        }

        // Collect all team names and detect sport from found pages
        const allTeamNames = new Set();
        const matchPages = []; // Store match pages for team tag extraction
        let detectedSport = 'soccer'; // default

        // Deep scrape each found page
        for (const pageUrl of pages.slice(0, 5)) { // Increased to 5 pages per domain
          // Extract team names from this page
          const teamNames = this.extractTeamNames(pageUrl);
          teamNames.forEach(team => allTeamNames.add(team));

          // Store match page for later team tag extraction
          if (teamNames.length > 0) {
            matchPages.push(pageUrl);
          }

          // Detect sport from URL (e.g., /serie-a/, /nba/, /nfl/)
          const sportMatch = pageUrl.match(/\/(serie-a|premier-league|la-liga|bundesliga|ligue-1|nba|nfl|nhl|mma|boxing|tennis|f1|soccer|football|basketball|baseball|hockey)/i);
          if (sportMatch) {
            detectedSport = sportMatch[1].toLowerCase();
          }

          const pageResults = await this.deepScrapePage(pageUrl, domainUrl);
          results.push(...pageResults);

          if (onProgress) {
            processed++;
            const totalFound = pageResults.reduce((sum, r) => sum + r.sourceUrls.length, 0);
            onProgress({
              processed,
              total: domains.length,
              currentDomain: domain,
              currentPage: pageUrl,
              found: totalFound,
            });
          }

          await this.delay(this.requestDelay);
        }

        // NEW: Extract team-specific tag pages from match pages
        if (allTeamNames.size > 0 && matchPages.length > 0) {
          console.log(`\nDiscovered ${allTeamNames.size} teams from ${matchPages.length} match pages`);
          console.log(`Extracting team tag links from match pages...`);

          const allTeamPages = new Set();

          // Extract team tag links from each match page
          for (const matchPage of matchPages) {
            const teamNames = this.extractTeamNames(matchPage);
            const teamPagesFromMatch = await this.findTeamTagPagesFromMatchPage(matchPage, teamNames);
            teamPagesFromMatch.forEach(url => allTeamPages.add(url));
          }

          const teamPages = Array.from(allTeamPages);

          if (teamPages.length > 0) {
            console.log(`Found ${teamPages.length} team-specific tag pages from match pages`);

            // Deduplicate: remove team pages that were already scraped as match pages
            const scrapedUrls = new Set(results.map(r => r.scrapedUrl));
            const uniqueTeamPages = teamPages.filter(url => !scrapedUrls.has(url));

            console.log(`After deduplication: ${uniqueTeamPages.length} unique team pages to scrape`);

            for (const teamPageUrl of uniqueTeamPages) {
              const teamPageResults = await this.deepScrapePage(teamPageUrl, domainUrl);

              // Add team page results (avoid duplicates by URL)
              teamPageResults.forEach(result => {
                const isDuplicate = results.some(r => r.scrapedUrl === result.scrapedUrl);
                if (!isDuplicate) {
                  results.push(result);
                }
              });

              if (onProgress) {
                processed++;
                const totalFound = teamPageResults.reduce((sum, r) => sum + r.sourceUrls.length, 0);
                onProgress({
                  processed,
                  total: domains.length,
                  currentDomain: domain,
                  currentPage: teamPageUrl,
                  found: totalFound,
                });
              }

              await this.delay(this.requestDelay);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing domain ${domain}:`, error.message);
        if (onProgress) {
          processed++;
          onProgress({
            processed,
            total: domains.length,
            currentDomain: domain,
            error: error.message,
          });
        }
      }
    }

    // Close browser if opened
    await this.closeBrowser();

    return results;
  }

  /**
   * Verify if a URL is a valid m3u8 stream
   */
  async verifyM3U8(url) {
    try {
      const config = this.getAxiosConfig(url);
      const response = await axios.head(url, config);

      const contentType = response.headers['content-type'] || '';
      return contentType.includes('mpegurl') ||
        contentType.includes('m3u8') ||
        url.endsWith('.m3u8');
    } catch (error) {
      return false;
    }
  }
}

module.exports = ScraperCore;
