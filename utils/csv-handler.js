const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

/**
 * CSV/Excel handler for exporting scraping results
 */

class CSVHandler {
    /**
     * Convert scraping results to CSV format
     */
    static resultsToCSV(results) {
        const rows = [
            ['Scraped URL', 'Source URLs (m3u8)', 'Domain Index URL', 'Server/Label', 'Timestamp', 'Status']
        ];

        results.forEach(result => {
            const sourceUrls = result.sourceUrls.join('\n');
            rows.push([
                result.scrapedUrl,
                sourceUrls,
                result.domainIndexUrl,
                result.serverLabel || 'Main',
                result.timestamp,
                result.success ? 'Success' : 'Failed'
            ]);
        });

        return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }

    /**
     * Create Excel workbook from results
     */
    static async createExcelWorkbook(results) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Scraping Results');

        // Define columns
        worksheet.columns = [
            { header: 'Scraped URL', key: 'scrapedUrl', width: 50 },
            { header: 'Source URLs (m3u8)', key: 'sourceUrls', width: 60 },
            { header: 'Domain Index URL', key: 'domainIndexUrl', width: 40 },
            { header: 'Server/Label', key: 'serverLabel', width: 20 },
            { header: 'Timestamp', key: 'timestamp', width: 20 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add data rows
        results.forEach(result => {
            worksheet.addRow({
                scrapedUrl: result.scrapedUrl,
                sourceUrls: result.sourceUrls.join('\n'),
                domainIndexUrl: result.domainIndexUrl,
                serverLabel: result.serverLabel || 'Main',
                timestamp: result.timestamp,
                status: result.success ? 'Success' : 'Failed'
            });
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            if (column.header !== 'Source URLs (m3u8)') {
                column.width = Math.max(column.header.length + 5, 15);
            }
        });

        return workbook;
    }

    /**
     * Save results to CSV file
     */
    static async saveToCSV(results, filename = 'scraping-results.csv') {
        const csv = this.resultsToCSV(results);
        const resultsDir = path.join(process.cwd(), 'results');

        try {
            await fs.mkdir(resultsDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }

        const filepath = path.join(resultsDir, filename);
        await fs.writeFile(filepath, csv, 'utf-8');
        return filepath;
    }

    /**
     * Save results to Excel file
     */
    static async saveToExcel(results, filename = 'scraping-results.xlsx') {
        const workbook = await this.createExcelWorkbook(results);
        const resultsDir = path.join(process.cwd(), 'results');

        try {
            await fs.mkdir(resultsDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }

        const filepath = path.join(resultsDir, filename);
        await workbook.xlsx.writeFile(filepath);
        return filepath;
    }

    /**
     * Generate Excel buffer for download (for serverless)
     */
    static async generateExcelBuffer(results) {
        const workbook = await this.createExcelWorkbook(results);
        return await workbook.xlsx.writeBuffer();
    }

    /**
     * Generate CSV buffer for download (for serverless)
     */
    static generateCSVBuffer(results) {
        const csv = this.resultsToCSV(results);
        return Buffer.from(csv, 'utf-8');
    }
}

module.exports = CSVHandler;
