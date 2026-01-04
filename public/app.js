// Streaming Link Scraper - Frontend Application

// API Base URL (change for production)
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

// State Management
const state = {
    domains: [],
    results: [],
    scrapingInProgress: false,
    googleSheetId: localStorage.getItem('googleSheetId') || '',
};

// DOM Elements
const elements = {
    domainInput: document.getElementById('domainInput'),
    addDomainBtn: document.getElementById('addDomainBtn'),
    domainList: document.getElementById('domainList'),
    domainCount: document.getElementById('domainCount'),

    // Bulk input elements
    toggleInputModeBtn: document.getElementById('toggleInputModeBtn'),
    singleInputMode: document.getElementById('singleInputMode'),
    bulkInputMode: document.getElementById('bulkInputMode'),
    bulkDomainInput: document.getElementById('bulkDomainInput'),
    addBulkDomainsBtn: document.getElementById('addBulkDomainsBtn'),
    clearBulkInputBtn: document.getElementById('clearBulkInputBtn'),

    // Match input elements
    matchInput: document.getElementById('matchInput'),
    generateKeywordsBtn: document.getElementById('generateKeywordsBtn'),

    keywordsInput: document.getElementById('keywordsInput'),
    startScrapingBtn: document.getElementById('startScrapingBtn'),
    stopScrapingBtn: document.getElementById('stopScrapingBtn'),

    progressContainer: document.getElementById('progressContainer'),
    progressText: document.getElementById('progressText'),
    progressPercent: document.getElementById('progressPercent'),
    progressFill: document.getElementById('progressFill'),
    progressDetails: document.getElementById('progressDetails'),

    resultsContainer: document.getElementById('resultsContainer'),
    resultsCount: document.getElementById('resultsCount'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    exportExcelBtn: document.getElementById('exportExcelBtn'),
    syncSheetsBtn: document.getElementById('syncSheetsBtn'),

    googleSheetsBtn: document.getElementById('googleSheetsBtn'),
    googleSheetsModal: document.getElementById('googleSheetsModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    sheetIdInput: document.getElementById('sheetIdInput'),
    sheetRangeInput: document.getElementById('sheetRangeInput'),
    loadSheetsBtn: document.getElementById('loadSheetsBtn'),

    syncSheetsModal: document.getElementById('syncSheetsModal'),
    closeSyncModalBtn: document.getElementById('closeSyncModalBtn'),
    cancelSyncModalBtn: document.getElementById('cancelSyncModalBtn'),
    syncSheetIdInput: document.getElementById('syncSheetIdInput'),
    syncSheetNameInput: document.getElementById('syncSheetNameInput'),
    confirmSyncBtn: document.getElementById('confirmSyncBtn'),
};

// Initialize Application
async function init() {
    setupEventListeners();
    await loadDomains();
    updateUI();

    // Restore Google Sheet ID if saved
    if (state.googleSheetId) {
        elements.sheetIdInput.value = state.googleSheetId;
        elements.syncSheetIdInput.value = state.googleSheetId;
    }
}

// Event Listeners
function setupEventListeners() {
    // Domain Management
    elements.addDomainBtn.addEventListener('click', addDomain);
    elements.domainInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addDomain();
    });

    // Bulk input toggle and handlers
    elements.toggleInputModeBtn.addEventListener('click', toggleInputMode);
    elements.addBulkDomainsBtn.addEventListener('click', addBulkDomains);
    elements.clearBulkInputBtn.addEventListener('click', () => {
        elements.bulkDomainInput.value = '';
    });

    // Match input handler
    elements.generateKeywordsBtn.addEventListener('click', generateKeywordsFromMatches);

    // Scraping Controls
    elements.startScrapingBtn.addEventListener('click', startScraping);
    elements.stopScrapingBtn.addEventListener('click', stopScraping);

    // Export Controls
    elements.exportCsvBtn.addEventListener('click', exportCSV);
    elements.exportExcelBtn.addEventListener('click', exportExcel);
    elements.syncSheetsBtn.addEventListener('click', () => openModal('syncSheetsModal'));

    // Google Sheets Modal
    elements.googleSheetsBtn.addEventListener('click', () => openModal('googleSheetsModal'));
    elements.closeModalBtn.addEventListener('click', () => closeModal('googleSheetsModal'));
    elements.cancelModalBtn.addEventListener('click', () => closeModal('googleSheetsModal'));
    elements.loadSheetsBtn.addEventListener('click', loadDomainsFromSheets);

    // Sync Modal
    elements.closeSyncModalBtn.addEventListener('click', () => closeModal('syncSheetsModal'));
    elements.cancelSyncModalBtn.addEventListener('click', () => closeModal('syncSheetsModal'));
    elements.confirmSyncBtn.addEventListener('click', syncToGoogleSheets);

    // Close modals on background click
    elements.googleSheetsModal.addEventListener('click', (e) => {
        if (e.target === elements.googleSheetsModal) closeModal('googleSheetsModal');
    });
    elements.syncSheetsModal.addEventListener('click', (e) => {
        if (e.target === elements.syncSheetsModal) closeModal('syncSheetsModal');
    });
}

// Domain Management Functions
async function loadDomains() {
    try {
        const response = await fetch(`${API_BASE}/domains`);
        const data = await response.json();

        if (data.success) {
            state.domains = data.domains;
            renderDomainList();
        }
    } catch (error) {
        console.error('Error loading domains:', error);
        showNotification('Failed to load domains', 'error');
    }
}

async function addDomain() {
    const domain = elements.domainInput.value.trim();

    if (!domain) {
        showNotification('Please enter a domain', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/domains`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain }),
        });

        const data = await response.json();

        if (data.success) {
            state.domains = data.domains;
            elements.domainInput.value = '';
            renderDomainList();
            showNotification('Domain added successfully', 'success');
        } else {
            showNotification(data.error || 'Failed to add domain', 'error');
        }
    } catch (error) {
        console.error('Error adding domain:', error);
        showNotification('Failed to add domain', 'error');
    }
}

async function removeDomain(domain) {
    try {
        const response = await fetch(`${API_BASE}/domains`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain }),
        });

        const data = await response.json();

        if (data.success) {
            state.domains = data.domains;
            renderDomainList();
            showNotification('Domain removed', 'success');
        }
    } catch (error) {
        console.error('Error removing domain:', error);
        showNotification('Failed to remove domain', 'error');
    }
}

// Toggle between single and bulk input modes
function toggleInputMode() {
    const isBulkMode = elements.bulkInputMode.style.display !== 'none';

    if (isBulkMode) {
        // Switch to single input mode
        elements.singleInputMode.style.display = 'flex';
        elements.bulkInputMode.style.display = 'none';
        elements.toggleInputModeBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Bulk Input
        `;
    } else {
        // Switch to bulk input mode
        elements.singleInputMode.style.display = 'none';
        elements.bulkInputMode.style.display = 'block';
        elements.toggleInputModeBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Single Input
        `;
    }
}

// Add multiple domains from bulk textarea
async function addBulkDomains() {
    const bulkText = elements.bulkDomainInput.value.trim();

    if (!bulkText) {
        showNotification('Please enter at least one domain', 'error');
        return;
    }

    // Split by newlines and filter out empty lines
    const domains = bulkText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (domains.length === 0) {
        showNotification('No valid domains found', 'error');
        return;
    }

    try {
        // Add domains one by one
        let successCount = 0;
        let failCount = 0;

        for (const domain of domains) {
            try {
                const response = await fetch(`${API_BASE}/domains`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domain }),
                });

                const data = await response.json();

                if (data.success) {
                    state.domains = data.domains;
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
            }
        }

        renderDomainList();
        elements.bulkDomainInput.value = '';

        if (successCount > 0) {
            showNotification(`Added ${successCount} domain(s)${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
        } else {
            showNotification('Failed to add domains', 'error');
        }
    } catch (error) {
        console.error('Error adding bulk domains:', error);
        showNotification('Failed to add domains', 'error');
    }
}


// Generate keywords from match names
function generateKeywordsFromMatches() {
    const matchText = elements.matchInput.value.trim();

    if (!matchText) {
        showNotification('Please enter at least one match name', 'error');
        return;
    }

    // Split by newlines and filter out empty lines
    const matches = matchText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (matches.length === 0) {
        showNotification('No valid matches found', 'error');
        return;
    }

    const allKeywords = new Set();

    // Parse each match and generate keywords
    matches.forEach(match => {
        // Split by "vs" or "v" (case insensitive)
        const teams = match.split(/\s+(?:vs?\.?|versus)\s+/i);

        if (teams.length === 2) {
            const team1 = teams[0].trim();
            const team2 = teams[1].trim();

            // Add individual team names
            allKeywords.add(team1);
            allKeywords.add(team2);

            // Add both teams together
            allKeywords.add(`${team1} ${team2}`);

            // Add full match name
            allKeywords.add(match);
        } else {
            // If not in "Team A vs Team B" format, just add the whole line
            allKeywords.add(match);
        }
    });

    // Convert to comma-separated string and set in keywords input
    const keywordsString = Array.from(allKeywords).join(', ');
    elements.keywordsInput.value = keywordsString;

    showNotification(`Generated ${allKeywords.size} keywords from ${matches.length} match(es)`, 'success');
}


function renderDomainList() {
    if (state.domains.length === 0) {
        elements.domainList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" opacity="0.3"/>
          <path d="M24 14v20M14 24h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p>No domains added yet</p>
        <small>Add domains manually or load from Google Sheets</small>
      </div>
    `;
    } else {
        elements.domainList.innerHTML = state.domains.map(domain => `
      <div class="domain-item">
        <span class="domain-url">${escapeHtml(domain)}</span>
        <button class="domain-remove" onclick="removeDomain('${escapeHtml(domain)}')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    `).join('');
    }

    elements.domainCount.textContent = state.domains.length;
}

// Google Sheets Functions
async function loadDomainsFromSheets() {
    const sheetId = elements.sheetIdInput.value.trim();
    const range = elements.sheetRangeInput.value.trim() || 'Sheet1!A:A';

    if (!sheetId) {
        showNotification('Please enter a Google Sheet ID', 'error');
        return;
    }

    elements.loadSheetsBtn.disabled = true;
    elements.loadSheetsBtn.textContent = 'Loading...';

    try {
        const response = await fetch(`${API_BASE}/sheets?action=read-domains&sheetId=${encodeURIComponent(sheetId)}&range=${encodeURIComponent(range)}`);
        const data = await response.json();

        if (data.success) {
            // Save sheet ID for future use
            state.googleSheetId = sheetId;
            localStorage.setItem('googleSheetId', sheetId);
            elements.syncSheetIdInput.value = sheetId;

            // Update domains
            const updateResponse = await fetch(`${API_BASE}/domains`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domains: data.domains }),
            });

            const updateData = await updateResponse.json();

            if (updateData.success) {
                state.domains = updateData.domains;
                renderDomainList();
                closeModal('googleSheetsModal');
                showNotification(`Loaded ${data.count} domains from Google Sheets`, 'success');
            }
        } else {
            showNotification(data.error || 'Failed to load from Google Sheets', 'error');
        }
    } catch (error) {
        console.error('Error loading from Google Sheets:', error);
        showNotification('Failed to load from Google Sheets. Check your credentials.', 'error');
    } finally {
        elements.loadSheetsBtn.disabled = false;
        elements.loadSheetsBtn.textContent = 'Load Domains';
    }
}

async function syncToGoogleSheets() {
    const sheetId = elements.syncSheetIdInput.value.trim();
    const sheetName = elements.syncSheetNameInput.value.trim() || 'Scraping Results';

    if (!sheetId) {
        showNotification('Please enter a Google Sheet ID', 'error');
        return;
    }

    if (state.results.length === 0) {
        showNotification('No results to sync', 'error');
        return;
    }

    elements.confirmSyncBtn.disabled = true;
    elements.confirmSyncBtn.textContent = 'Syncing...';

    try {
        const response = await fetch(`${API_BASE}/sheets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'write-results',
                sheetId,
                sheetName,
                results: state.results,
            }),
        });

        const data = await response.json();

        if (data.success) {
            closeModal('syncSheetsModal');
            showNotification(`Synced ${data.rowsWritten} results to Google Sheets`, 'success');
        } else {
            showNotification(data.error || 'Failed to sync to Google Sheets', 'error');
        }
    } catch (error) {
        console.error('Error syncing to Google Sheets:', error);
        showNotification('Failed to sync to Google Sheets', 'error');
    } finally {
        elements.confirmSyncBtn.disabled = false;
        elements.confirmSyncBtn.textContent = 'Sync Results';
    }
}

// Scraping Functions
async function startScraping() {
    if (state.domains.length === 0) {
        showNotification('Please add at least one domain', 'error');
        return;
    }

    const keywordsText = elements.keywordsInput.value.trim();
    const keywords = keywordsText ? keywordsText.split(',').map(k => k.trim()).filter(k => k) : [];

    try {
        const response = await fetch(`${API_BASE}/scraper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'start',
                domains: state.domains,
                keywords,
            }),
        });

        const data = await response.json();

        if (data.success) {
            state.scrapingInProgress = true;
            updateUI();
            showNotification('Scraping started', 'success');
            startProgressPolling();
        } else {
            showNotification(data.error || 'Failed to start scraping', 'error');
        }
    } catch (error) {
        console.error('Error starting scraping:', error);
        showNotification('Failed to start scraping', 'error');
    }
}

async function stopScraping() {
    try {
        const response = await fetch(`${API_BASE}/scraper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stop' }),
        });

        const data = await response.json();

        if (data.success) {
            state.scrapingInProgress = false;
            updateUI();
            showNotification('Scraping stopped', 'success');
            await loadResults();
        }
    } catch (error) {
        console.error('Error stopping scraping:', error);
        showNotification('Failed to stop scraping', 'error');
    }
}

let progressInterval = null;

function startProgressPolling() {
    if (progressInterval) clearInterval(progressInterval);

    progressInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/scraper?action=status`);
            const data = await response.json();

            if (!data.inProgress) {
                clearInterval(progressInterval);
                state.scrapingInProgress = false;
                updateUI();
                await loadResults();
                showNotification('Scraping completed', 'success');
                return;
            }

            updateProgress(data.progress);
        } catch (error) {
            console.error('Error polling progress:', error);
        }
    }, 1000);
}

function updateProgress(progress) {
    const percent = progress.total > 0
        ? Math.round((progress.processed / progress.total) * 100)
        : 0;

    elements.progressPercent.textContent = `${percent}%`;
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = `Processing domains... (${progress.processed}/${progress.total})`;

    if (progress.currentDomain) {
        elements.progressDetails.innerHTML = `
      <div><strong>Current Domain:</strong> ${escapeHtml(progress.currentDomain)}</div>
      ${progress.currentPage ? `<div><strong>Current Page:</strong> ${escapeHtml(progress.currentPage)}</div>` : ''}
      ${progress.found !== undefined ? `<div><strong>M3U8 URLs Found:</strong> ${progress.found}</div>` : ''}
    `;
    }
}

async function loadResults() {
    try {
        const response = await fetch(`${API_BASE}/scraper?action=results`);
        const data = await response.json();

        if (data.success) {
            state.results = data.results;
            renderResults();
        }
    } catch (error) {
        console.error('Error loading results:', error);
        showNotification('Failed to load results', 'error');
    }
}

function renderResults() {
    if (state.results.length === 0) {
        elements.resultsContainer.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="12" width="32" height="24" rx="2" stroke="currentColor" stroke-width="2" opacity="0.3"/>
          <path d="M12 18h24M12 24h24M12 30h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
        </svg>
        <p>No results yet</p>
        <small>Start scraping to see results here</small>
      </div>
    `;
    } else {
        elements.resultsContainer.innerHTML = `
      <table class="results-table">
        <thead>
          <tr>
            <th>Scraped URL</th>
            <th>Source URLs (M3U8)</th>
            <th>Domain Index URL</th>
            <th>Server/Label</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${state.results.map(result => `
            <tr>
              <td><a href="${escapeHtml(result.scrapedUrl)}" target="_blank" class="m3u8-link">${escapeHtml(result.scrapedUrl)}</a></td>
              <td>
                <div class="m3u8-list">
                  ${result.sourceUrls.length > 0
                ? result.sourceUrls.map(url => `<a href="${escapeHtml(url)}" target="_blank" class="m3u8-link">${escapeHtml(url)}</a>`).join('')
                : '<span style="color: var(--text-muted);">No M3U8 found</span>'
            }
                </div>
              </td>
              <td><a href="${escapeHtml(result.domainIndexUrl)}" target="_blank" class="m3u8-link">${escapeHtml(result.domainIndexUrl)}</a></td>
              <td><span class="server-label">${escapeHtml(result.serverLabel || 'Main')}</span></td>
              <td>
                <span class="status-badge ${result.success ? 'status-success' : 'status-failed'}">
                  ${result.success ? 'Success' : 'Failed'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    }

    elements.resultsCount.textContent = state.results.length;
    elements.exportCsvBtn.disabled = state.results.length === 0;
    elements.exportExcelBtn.disabled = state.results.length === 0;
    elements.syncSheetsBtn.disabled = state.results.length === 0;
}

// Export Functions
async function exportCSV() {
    try {
        const response = await fetch(`${API_BASE}/scraper?action=export-csv`);
        const blob = await response.blob();
        downloadFile(blob, 'scraping-results.csv', 'text/csv');
        showNotification('CSV exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showNotification('Failed to export CSV', 'error');
    }
}

async function exportExcel() {
    try {
        const response = await fetch(`${API_BASE}/scraper?action=export-excel`);
        const blob = await response.blob();
        downloadFile(blob, 'scraping-results.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        showNotification('Excel exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting Excel:', error);
        showNotification('Failed to export Excel', 'error');
    }
}

// Utility Functions
function downloadFile(blob, filename, mimeType) {
    const url = window.URL.createObjectURL(new Blob([blob], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
}

function updateUI() {
    elements.startScrapingBtn.disabled = state.scrapingInProgress;
    elements.stopScrapingBtn.disabled = !state.scrapingInProgress;
    elements.progressContainer.style.display = state.scrapingInProgress ? 'block' : 'none';

    if (!state.scrapingInProgress && progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    // Simple notification system
    const notification = document.createElement('div');
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' :
            type === 'error' ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' :
                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.3s ease;
  `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Make functions globally available
window.removeDomain = removeDomain;

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
