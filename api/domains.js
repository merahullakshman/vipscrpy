const fs = require('fs').promises;
const path = require('path');

const DOMAINS_FILE = path.join(process.cwd(), 'data', 'domains.json');

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
    const dataDir = path.join(process.cwd(), 'data');
    try {
        await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
        // Directory already exists
    }
}

/**
 * Load domains from file
 */
async function loadDomains() {
    try {
        await ensureDataDir();
        const data = await fs.readFile(DOMAINS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // File doesn't exist, return empty array
        return [];
    }
}

/**
 * Save domains to file
 */
async function saveDomains(domains) {
    await ensureDataDir();
    await fs.writeFile(DOMAINS_FILE, JSON.stringify(domains, null, 2), 'utf-8');
}

/**
 * Domain management API endpoint
 */
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET: Get all domains
    if (req.method === 'GET') {
        try {
            const domains = await loadDomains();
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

    // POST: Add domain(s)
    if (req.method === 'POST') {
        const { domain, domains: domainList } = req.body;

        try {
            const existingDomains = await loadDomains();

            if (domain) {
                // Add single domain
                if (!existingDomains.includes(domain)) {
                    existingDomains.push(domain);
                }
            } else if (domainList && Array.isArray(domainList)) {
                // Add multiple domains
                domainList.forEach(d => {
                    if (d && !existingDomains.includes(d)) {
                        existingDomains.push(d);
                    }
                });
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Domain or domains array is required'
                });
            }

            await saveDomains(existingDomains);

            return res.json({
                success: true,
                domains: existingDomains,
                count: existingDomains.length
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // DELETE: Remove domain or clear all
    if (req.method === 'DELETE') {
        const { domain } = req.body;

        try {
            let domains = await loadDomains();

            if (!domain) {
                // Clear all domains if no specific domain provided
                domains = [];
            } else {
                // Remove specific domain
                domains = domains.filter(d => d !== domain);
            }

            await saveDomains(domains);

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

    // PUT: Replace all domains
    if (req.method === 'PUT') {
        const { domains } = req.body;

        if (!domains || !Array.isArray(domains)) {
            return res.status(400).json({
                success: false,
                error: 'Domains array is required'
            });
        }

        try {
            await saveDomains(domains);

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

    return res.status(405).json({ success: false, error: 'Method not allowed' });
};
