const GoogleSheetsHandler = require('../utils/google-sheets');

// Singleton instance
let sheetsHandler = null;

function getHandler() {
    if (!sheetsHandler) {
        sheetsHandler = new GoogleSheetsHandler();
    }
    return sheetsHandler;
}

/**
 * Google Sheets API endpoint
 */
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET: Read domains from Google Sheet
    if (req.method === 'GET') {
        const { action, sheetId, range } = req.query;

        if (action === 'read-domains') {
            if (!sheetId) {
                return res.status(400).json({
                    success: false,
                    error: 'Sheet ID is required'
                });
            }

            try {
                const handler = getHandler();
                const domains = await handler.readDomainsFromSheet(
                    sheetId,
                    range || 'Sheet1!A:A'
                );

                return res.json({
                    success: true,
                    domains: domains,
                    count: domains.length
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }

        return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    // POST: Write results to Google Sheet
    if (req.method === 'POST') {
        const { action, sheetId, results, sheetName, range } = req.body;

        if (action === 'write-results') {
            if (!sheetId) {
                return res.status(400).json({
                    success: false,
                    error: 'Sheet ID is required'
                });
            }

            if (!results || !Array.isArray(results)) {
                return res.status(400).json({
                    success: false,
                    error: 'Results array is required'
                });
            }

            try {
                const handler = getHandler();
                const result = await handler.writeResultsToSheet(
                    sheetId,
                    results,
                    sheetName || 'Scraping Results'
                );

                return res.json({
                    success: true,
                    ...result
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }

        if (action === 'append-results') {
            if (!sheetId) {
                return res.status(400).json({
                    success: false,
                    error: 'Sheet ID is required'
                });
            }

            if (!results || !Array.isArray(results)) {
                return res.status(400).json({
                    success: false,
                    error: 'Results array is required'
                });
            }

            try {
                const handler = getHandler();
                const result = await handler.appendResultsToSheet(
                    sheetId,
                    results,
                    range || 'Scraping Results!A:E'
                );

                return res.json({
                    success: true,
                    ...result
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }

        return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
};
