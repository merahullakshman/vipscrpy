const { google } = require('googleapis');

/**
 * Google Sheets integration utilities
 */

class GoogleSheetsHandler {
    constructor() {
        this.auth = null;
        this.sheets = null;
        this.initialized = false;
    }

    /**
     * Initialize Google Sheets API with credentials
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Get credentials from environment variable
            const credentials = process.env.GOOGLE_CREDENTIALS
                ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
                : null;

            if (!credentials) {
                throw new Error('Google credentials not found in environment variables');
            }

            // Create JWT auth client
            this.auth = new google.auth.JWT(
                credentials.client_email,
                null,
                credentials.private_key,
                ['https://www.googleapis.com/auth/spreadsheets']
            );

            await this.auth.authorize();
            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize Google Sheets API:', error.message);
            throw error;
        }
    }

    /**
     * Read domains from Google Sheet (Column A)
     */
    async readDomainsFromSheet(sheetId, range = 'Sheet1!A:A') {
        await this.initialize();

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: range,
            });

            const rows = response.data.values || [];
            // Filter out empty rows and header
            const domains = rows
                .flat()
                .filter(domain => domain && domain.trim() && !domain.toLowerCase().includes('domain'))
                .map(domain => domain.trim());

            return domains;
        } catch (error) {
            console.error('Error reading from Google Sheet:', error.message);
            throw error;
        }
    }

    /**
     * Write scraping results to Google Sheet
     */
    async writeResultsToSheet(sheetId, results, sheetName = 'Scraping Results') {
        await this.initialize();

        try {
            // Prepare data rows
            const rows = [
                ['Scraped URL', 'Source URLs (m3u8)', 'Domain Index URL', 'Server/Label', 'Timestamp', 'Status']
            ];

            results.forEach(result => {
                rows.push([
                    result.scrapedUrl,
                    result.sourceUrls.join('\n'),
                    result.domainIndexUrl,
                    result.serverLabel || 'Main',
                    result.timestamp,
                    result.success ? 'Success' : 'Failed'
                ]);
            });

            // Try to create a new sheet, or clear existing one
            try {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: sheetId,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: sheetName
                                }
                            }
                        }]
                    }
                });
            } catch (error) {
                // Sheet might already exist, clear it instead
                await this.sheets.spreadsheets.values.clear({
                    spreadsheetId: sheetId,
                    range: `${sheetName}!A:Z`,
                });
            }

            // Write data
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: `${sheetName}!A1`,
                valueInputOption: 'RAW',
                resource: {
                    values: rows
                }
            });

            // Format header row
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetId,
                resource: {
                    requests: [{
                        repeatCell: {
                            range: {
                                sheetId: await this.getSheetId(sheetId, sheetName),
                                startRowIndex: 0,
                                endRowIndex: 1
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 0.27, green: 0.45, blue: 0.77 },
                                    textFormat: {
                                        foregroundColor: { red: 1, green: 1, blue: 1 },
                                        bold: true
                                    }
                                }
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat)'
                        }
                    }]
                }
            });

            return {
                success: true,
                rowsWritten: rows.length - 1,
                sheetName: sheetName
            };
        } catch (error) {
            console.error('Error writing to Google Sheet:', error.message);
            throw error;
        }
    }

    /**
     * Get sheet ID by name
     */
    async getSheetId(spreadsheetId, sheetName) {
        const response = await this.sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId
        });

        const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
        return sheet ? sheet.properties.sheetId : 0;
    }

    /**
     * Append results to existing sheet
     */
    async appendResultsToSheet(sheetId, results, range = 'Scraping Results!A:E') {
        await this.initialize();

        try {
            const rows = results.map(result => [
                result.scrapedUrl,
                result.sourceUrls.join('\n'),
                result.domainIndexUrl,
                result.serverLabel || 'Main',
                result.timestamp,
                result.success ? 'Success' : 'Failed'
            ]);

            await this.sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: range,
                valueInputOption: 'RAW',
                resource: {
                    values: rows
                }
            });

            return {
                success: true,
                rowsAppended: rows.length
            };
        } catch (error) {
            console.error('Error appending to Google Sheet:', error.message);
            throw error;
        }
    }
}

module.exports = GoogleSheetsHandler;
