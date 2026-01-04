const ScraperCore = require('../utils/scraper-core');
const CSVHandler = require('../utils/csv-handler');

// In-memory storage for scraping results (in production, use a database)
let scrapingResults = [];
let scrapingInProgress = false;
let scrapingProgress = {
    processed: 0,
    total: 0,
    currentDomain: '',
    currentPage: '',
    found: 0
};

/**
 * Main scraper API endpoint
 */
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET: Get scraping status and results
    if (req.method === 'GET') {
        const { action } = req.query;

        if (action === 'status') {
            return res.json({
                inProgress: scrapingInProgress,
                progress: scrapingProgress,
                resultsCount: scrapingResults.length
            });
        }

        if (action === 'results') {
            return res.json({
                success: true,
                results: scrapingResults,
                count: scrapingResults.length
            });
        }

        if (action === 'export-csv') {
            try {
                const csvBuffer = CSVHandler.generateCSVBuffer(scrapingResults);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=scraping-results.csv');
                return res.send(csvBuffer);
            } catch (error) {
                return res.status(500).json({ success: false, error: error.message });
            }
        }

        if (action === 'export-excel') {
            try {
                const excelBuffer = await CSVHandler.generateExcelBuffer(scrapingResults);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=scraping-results.xlsx');
                return res.send(excelBuffer);
            } catch (error) {
                return res.status(500).json({ success: false, error: error.message });
            }
        }

        return res.json({ success: false, error: 'Invalid action' });
    }

    // POST: Start scraping
    if (req.method === 'POST') {
        const { action, domains, keywords } = req.body;

        if (action === 'start') {
            if (scrapingInProgress) {
                return res.status(400).json({
                    success: false,
                    error: 'Scraping already in progress'
                });
            }

            if (!domains || !Array.isArray(domains) || domains.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Domains array is required'
                });
            }

            if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Keywords array is required'
                });
            }

            // Start scraping in background
            scrapingInProgress = true;
            scrapingResults = [];
            scrapingProgress = {
                processed: 0,
                total: domains.length,
                currentDomain: '',
                currentPage: '',
                found: 0
            };

            // Run scraping asynchronously
            (async () => {
                try {
                    const scraper = new ScraperCore({
                        requestDelay: parseInt(process.env.REQUEST_DELAY_MS) || 1000,
                        timeout: parseInt(process.env.TIMEOUT_MS) || 30000
                    });

                    const results = await scraper.scrapeDomainsWithKeywords(
                        domains,
                        keywords,
                        (progress) => {
                            scrapingProgress = progress;
                        }
                    );

                    scrapingResults = results;
                    scrapingInProgress = false;
                } catch (error) {
                    console.error('Scraping error:', error);
                    scrapingInProgress = false;
                }
            })();

            return res.json({
                success: true,
                message: 'Scraping started',
                domainsCount: domains.length,
                keywords: keywords
            });
        }

        if (action === 'stop') {
            scrapingInProgress = false;
            return res.json({
                success: true,
                message: 'Scraping stopped',
                resultsCount: scrapingResults.length
            });
        }

        if (action === 'clear') {
            scrapingResults = [];
            scrapingProgress = {
                processed: 0,
                total: 0,
                currentDomain: '',
                currentPage: '',
                found: 0
            };
            return res.json({
                success: true,
                message: 'Results cleared'
            });
        }

        return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
};
