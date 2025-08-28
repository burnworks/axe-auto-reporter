import { mkdir, readFile, writeFile } from 'fs/promises';
import puppeteer from 'puppeteer';
import { loadPage } from '@axe-core/puppeteer';
import AXELOCALES_JA from 'axe-core/locales/ja.json' with { type: 'json' };
import path from 'path';
import config from './config.mjs';

// Viewport settings
const VIEWPORTS = {
    PC: { width: 1024, height: 768 },
    MOBILE: { width: 375, height: 812 }
};

// Configure
const reportConfigure = () => {
    const newConfig = { ...config };
    if (newConfig.locale === 'ja') {
        newConfig.localeData = AXELOCALES_JA;
    }
    if (newConfig.mode === 'pc') {
        newConfig.viewport = VIEWPORTS.PC;
    } else if (newConfig.mode === 'mobile') {
        newConfig.viewport = VIEWPORTS.MOBILE;
    } else {
        console.error('\x1b[31mInvalid mode specified\x1b[0m');
        throw new Error('Invalid mode specified');
    }
    return newConfig;
};

// Global Error Handling
let browser;

const cleanup = async () => {
    if (browser) {
        try {
            await browser.close();
        } catch (error) {
            console.error('\x1b[31mError during browser cleanup:\x1b[0m', error.message);
        }
    }
};

process.on('unhandledRejection', async (reason, promise) => {
    console.error('\x1b[31mUnhandled promise rejection:\x1b[0m');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    
    await cleanup();
    process.exit(1);
});

process.on('uncaughtException', async (error) => {
    console.error('\x1b[31mUncaught exception:\x1b[0m');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    await cleanup();
    process.exit(1);
});

process.on('SIGINT', async () => {
    console.log('\n\x1b[33mReceived SIGINT. Cleaning up...\x1b[0m');
    await cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n\x1b[33mReceived SIGTERM. Cleaning up...\x1b[0m');
    await cleanup();
    process.exit(0);
});

// Folder existence check and creation
const ensureDirectoryExists = async (dir) => {
    await mkdir(dir, { recursive: true });
};

// Input validation helpers
const isValidUrl = (url) => {
    if (typeof url !== 'string' || !url.trim()) return false;
    try {
        new URL(url.trim());
        return true;
    } catch {
        return false;
    }
};

const isValidString = (str) => typeof str === 'string' && str.trim().length > 0;

const isValidNumber = (num, min = 0, max = Infinity) => 
    typeof num === 'number' && !isNaN(num) && num >= min && num <= max;

const validateConfig = (config) => {
    const errors = [];
    
    if (!isValidString(config.urlList)) {
        errors.push('urlList must be a non-empty string');
    }
    
    if (!isValidString(config.locale)) {
        errors.push('locale must be a non-empty string');
    }
    
    if (!Array.isArray(config.tags) || config.tags.length === 0) {
        errors.push('tags must be a non-empty array');
    }
    
    if (!isValidString(config.mode)) {
        errors.push('mode must be a non-empty string');
    }
    
    if (Object.hasOwn(config, 'concurrency') && !isValidNumber(config.concurrency, 1, 10)) {
        errors.push('concurrency must be a number between 1 and 10');
    }
    
    if (Object.hasOwn(config, 'enableConcurrency') && typeof config.enableConcurrency !== 'boolean') {
        errors.push('enableConcurrency must be a boolean');
    }
    
    return errors;
};

// HTML escape
const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') {
        console.warn('escapeHtml received non-string input:', typeof unsafe);
        return String(unsafe);
    }
    
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>');
};

try {

    // Load and validate configure
    const config = reportConfigure();
    const configErrors = validateConfig(config);
    
    if (configErrors.length > 0) {
        console.error('\x1b[31mConfiguration validation errors:\x1b[0m');
        configErrors.forEach(error => console.error(`  - ${error}`));
        throw new Error('Invalid configuration');
    }
    
    const { urlList, localeData, tags, locale, viewport, concurrency, enableConcurrency } = config;

    // Puppeteer launch
    browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: viewport,
    });

    // Read and validate URLs from the external file
    const urlsContent = await readFile(urlList, 'utf-8');
    const rawUrls = urlsContent.split('\n').filter(Boolean);
    
    // Validate URLs
    const urls = [];
    const invalidUrls = [];
    
    for (const rawUrl of rawUrls) {
        const trimmedUrl = rawUrl.trim();
        if (isValidUrl(trimmedUrl)) {
            urls.push(trimmedUrl);
        } else if (trimmedUrl) {
            invalidUrls.push(trimmedUrl);
        }
    }
    
    if (invalidUrls.length > 0) {
        console.warn('\x1b[33mInvalid URLs found and will be skipped:\x1b[0m');
        invalidUrls.forEach(url => console.warn(`  - ${url}`));
    }
    
    if (urls.length === 0) {
        throw new Error('No valid URLs found in the URL list file');
    }
    
    console.log(`\x1b[36mFound ${urls.length} valid URLs to process\x1b[0m`);

    // Create a 'results' directory if it doesn't exist
    const resultsFolder = 'results';
    await ensureDirectoryExists(resultsFolder);

    // Create a folder inside 'results' based on the current datetime (`yyyy-mm-dd_hh-mm-ss`)
    const now = new Date();
    const dateTimeFolder = now.toISOString()
        .slice(0, 19)
        .replace('T', '_')
        .replace(/:/g, '-');
    const folderName = path.join(resultsFolder, dateTimeFolder);
    await ensureDirectoryExists(folderName);

    // Create subdirectories for JSON and HTML files inside the dateTime folder
    const jsonFolder = path.join(folderName, 'json');
    const htmlFolder = path.join(folderName, 'html');
    await Promise.all([
        ensureDirectoryExists(jsonFolder),
        ensureDirectoryExists(htmlFolder)
    ]);

    // Sanitize file name
    const sanitizeFilenamePart = (str) => str.replace(/[^a-zA-Z0-9\-_.]/g, '_');

    // Process single URL with axe testing
    const processUrl = async (url, index, total) => {
        // Validate input parameters
        if (!isValidUrl(url)) {
            return { url, success: false, error: 'Invalid URL format' };
        }
        
        if (!isValidNumber(index, 1) || !isValidNumber(total, 1)) {
            return { url, success: false, error: 'Invalid index or total parameters' };
        }
        
        let page;
        try {
            // Output progress (start)
            console.log(`Processing ${index}/${total}: ${url}`);

            // Load page
            const axeBuilder = await loadPage(browser, url.trim());
            page = axeBuilder.page;

            // Get a screenshot of the page in Base64 format
            const screenshotBase64 = await page.screenshot({ encoding: 'base64' });

            // Get test results
            const results = await axeBuilder.configure({ locale: localeData }).withTags(tags).analyze();

            // Validate axe results
            if (!results || typeof results !== 'object') {
                throw new Error('Invalid axe test results received');
            }

            // Create file name with validation
            const parsedURL = new URL(url);
            const domain = parsedURL.hostname;
            
            if (!isValidString(domain)) {
                throw new Error('Invalid domain extracted from URL');
            }
            
            const pathName = sanitizeFilenamePart(parsedURL.pathname.slice(1).replace(/\/$/g, ''));
            const queryString = sanitizeFilenamePart(parsedURL.search.slice(1));
            const baseFilename = `${domain}${pathName ? `_${pathName}` : ''}${queryString ? `_${queryString}` : ''}`;
            
            if (!isValidString(baseFilename)) {
                throw new Error('Failed to generate valid filename');
            }

            // Save results to an external JSON file (eg. example.com_pathname.json)
            const jsonFilename = path.join(jsonFolder, `${baseFilename}.json`);
            await writeFile(jsonFilename, JSON.stringify(results, null, 2), 'utf-8');

            // Save results to an external HTML file (eg. example.com_pathname.html)
            const htmlFilename = path.join(htmlFolder, `${baseFilename}.html`);
            const htmlContent = await generateHtmlReport(url, results, screenshotBase64, locale);
            
            if (!isValidString(htmlContent)) {
                throw new Error('Failed to generate valid HTML content');
            }
            
            await writeFile(htmlFilename, htmlContent, 'utf-8');

            // Output progress (complete)
            console.log(`\x1b[32mCompleted!\x1b[0m ${index}/${total}: ${url}`);
            return { url, success: true };
        } catch (error) {
            const errorInfo = {
                url,
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
                type: error.constructor.name
            };
            
            console.error(`\x1b[31mFailed to process URL:\x1b[0m ${url}`);
            console.error('Error details:', errorInfo);
            
            return { url, success: false, error: errorInfo };
        } finally {
            if (page && !page.isClosed()) {
                await page.close();
            }
        }
    };

    // Run Tests with concurrency control
    console.log(`\x1b[36mProcessing ${urls.length} URLs${enableConcurrency ? ` with concurrency: ${concurrency}` : ' sequentially'}\x1b[0m`);
    
    let results;
    if (enableConcurrency && urls.length > 1) {
        // Process URLs concurrently in batches
        const allResults = [];
        
        for (let i = 0; i < urls.length; i += concurrency) {
            const batch = urls.slice(i, i + concurrency);
            const batchPromises = batch.map((url, batchIndex) => 
                processUrl(url, i + batchIndex + 1, urls.length)
            );
            
            const batchResults = await Promise.allSettled(batchPromises);
            allResults.push(...batchResults);
        }
        
        results = allResults;
    } else {
        // Process URLs sequentially
        const allResults = [];
        for (let i = 0; i < urls.length; i++) {
            const result = await processUrl(urls[i], i + 1, urls.length);
            allResults.push({ status: 'fulfilled', value: result });
        }
        results = allResults;
    }
    
    // Report processing results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;
    
    console.log(`\x1b[32mProcessing completed!\x1b[0m`);
    console.log(`✅ Successful: ${successful}`);
    if (failed > 0) {
        console.log(`❌ Failed: ${failed}`);
    }

    await cleanup();
    console.log('\x1b[32mAll URLs processed successfully!\x1b[0m');
} catch (error) {
    console.error('\x1b[31mFatal error occurred:\x1b[0m');
    console.error('Error type:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('Stack trace:', error.stack);
    
    await cleanup();
    process.exit(1);
}

// Generate HTML
async function generateHtmlReport(url, results, screenshotBase64, locale) {
    // Validate input parameters
    if (!isValidUrl(url)) {
        throw new Error('Invalid URL provided to generateHtmlReport');
    }
    
    if (!results || typeof results !== 'object') {
        throw new Error('Invalid results object provided to generateHtmlReport');
    }
    
    if (typeof screenshotBase64 !== 'string') {
        throw new Error('Invalid screenshot data provided to generateHtmlReport');
    }
    
    if (!isValidString(locale)) {
        throw new Error('Invalid locale provided to generateHtmlReport');
    }
    const translations = {
        ja: {
            labelTitle: 'アクセシビリティレポート',
            labelViolations: '試験結果',
            labelFailureMessage: '発見された問題点',
            labelFailureSummaly: '修正提案',
            labelImgAlt: 'ページのスクリーンショット',
            labelTargetHTML: '対象 HTML',
            labelHelpPage: '参考情報',
            labelNoIssues: '問題点は発見されませんでした！',
            labelImpact: '影響度',
            impactData: {
                minor: '軽度',
                moderate: '中程度',
                serious: '深刻',
                critical: '重大',
            },
            labelViolationFilter: '影響度フィルター',
            labelViolationFilterNote: '（チェックを外すと該当する影響度の問題点が非表示になります）',
            labelViolationFilterReset: 'フィルターをリセット',
            labelViolationFilterResetAriaLabel: '影響度フィルターをリセットしてすべての問題点を表示',
        },
        en: {
            labelTitle: 'Accessibility Report',
            labelViolations: 'Test Result',
            labelFailureMessage: 'Failure Message',
            labelFailureSummaly: 'Failure Summary',
            labelImgAlt: 'Screenshot of the page',
            labelTargetHTML: 'Target HTML',
            labelHelpPage: 'More Information',
            labelNoIssues: 'You have (0) automatic issues, nice!',
            labelImpact: 'Impact',
            impactData: {
                minor: 'Minor',
                moderate: 'Moderate',
                serious: 'Serious',
                critical: 'Critical',
            },
            labelViolationFilter: 'Impact Filter',
            labelViolationFilterNote: '(Uncheck to hide failures of the corresponding impact level)',
            labelViolationFilterReset: 'Reset Filter',
            labelViolationFilterResetAriaLabel: 'Reset the impact filter to display all failures.',
        },
        // Add translations for other languages as necessary.
    };

    const translate = (key, subkey) => {
        const keys = Object.hasOwn(translations, locale) ? translations[locale] : translations.ja;
        if (subkey) {
            return (Object.hasOwn(keys, key) && Object.hasOwn(keys[key], subkey)) 
                ? keys[key][subkey] 
                : (Object.hasOwn(keys, key) ? keys[key] : 'Translation missing');
        }
        return Object.hasOwn(keys, key) ? keys[key] : 'Translation missing';
    };

    const template = await readFile('template/template.html', 'utf-8');
    const cssContent = await readFile('template/styles.css', 'utf-8');

    let impactListHtml;
    let violationHtml;

    if (!results?.violations?.length) {
        violationHtml = `
            <div class="violationBody">
                <p class="noIssues">
                    <span class="icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                    </span>
                ${translate('labelNoIssues')}
                </p>
            </div>
        `;
    } else {
        const impactCounts = {
            minor: 0,
            moderate: 0,
            serious: 0,
            critical: 0
        };

        for (const violation of results.violations) {
            for (const node of violation.nodes) {
                if (Object.hasOwn(impactCounts, node.impact)) {
                    impactCounts[node.impact]++;
                }
            }
        }

        impactListHtml = Object.entries(impactCounts).map(([impact, count]) => `
            <li>
                <span class="sr-only">
                    <input type="checkbox" name="filter-${impact}" id="filter-${impact}" checked>
                </span>
                <label class="violationFilterBtn" for="filter-${impact}">
                    <span class="violationLabel ${impact}">${translate('impactData', impact)}</span>
                    <span class="violationFilterNum">${count}</span>
                </label>
            </li>
        `).join('');

        violationHtml = results.violations.map(violation => `
            <div class="violationBody">
                <div class="violationBodyHeader">
                    <h3>${escapeHtml(violation.description)}</h3>
                    <div class="helpUrl">
                        <dl>
                            <dt>${translate('labelHelpPage')}</dt>
                            <dd><a href="${violation.helpUrl}" target="_blank" rel="noopener">${escapeHtml(violation.help)}</a></dd>
                        </dl>
                    </div>
                    <div class="tagList">
                        <ul>${violation.tags.map(tag => `<li><span>${escapeHtml(tag)}</span></li>`).join('')}</ul>
                    </div>
                </div>
                <div class="violationItem">
                    <ul>
                        ${violation.nodes.map(node => `
                            <li data-impact="${node.impact}">
                                <dl>
                                    <div class="failureMessage">
                                        <dt>
                                            ${translate('labelFailureMessage')}
                                            <span class="impact">${translate('labelImpact')} 
                                                <span class="impactLabel ${node.impact}">${translate('impactData', node.impact)}</span>
                                            </span>
                                        </dt>
                                        <dd class="failureList">
                                            <ul>
                                                ${Object.hasOwn(node, 'any') && node.any.length ? node.any.map(anyMessage => `
                                                    <li>
                                                        <span class="failureListIcon" aria-hidden="true">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                                            </svg>
                                                        </span>
                                                    ${escapeHtml(anyMessage.message)}</li>
                                                `).join('') : ''}
                                                ${Object.hasOwn(node, 'none') && node.none.length ? node.none.map(noneMessage => `
                                                <li>
                                                    <span class="failureListIcon" aria-hidden="true">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                                        </svg>
                                                    </span>
                                                ${escapeHtml(noneMessage.message)}</li>
                                                `).join('') : ''}
                                            </ul>
                                        </dd>
                                    </div>
                                    <div class="failureSummaly">
                                        <dt>${translate('labelFailureSummaly')}</dt>
                                        <dd>${escapeHtml(node.failureSummary)}</dd>
                                    </div>
                                    <div class="targetHTML">
                                        <dt>${translate('labelTargetHTML')}</dt>
                                        <dd><code tabindex="0">${escapeHtml(node.html)}</code></dd>
                                    </div>
                                    <div class="targetDom">
                                        <dt>DOM</dt>
                                        <dd><code tabindex="0">${escapeHtml(node.target[0])}</code></dd>
                                    </div>
                                </dl>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `).join('');
    }

    return template
        .replace('{{STYLE}}', `<style>${cssContent}</style>`)
        .replace('{{LOCALE}}', locale)
        .replace('{{PAGE_TITLE}}', translate('labelTitle'))
        .replace('{{URL}}', escapeHtml(url))
        .replace('{{HEADER}}', `
            <hgroup class="title">
                <h1>${translate('labelTitle')}</h1>
                <p class="testUrl">
                    <span class="urlLabel">URL:</span>
                    ${escapeHtml(url)}
                </p>
            </hgroup>
        `)
        .replace('{{CONTENT}}', `
            <div class="main-contents">
                <div class="screenshot">
                    <img src="data:image/png;base64,${screenshotBase64}" alt="${translate('labelImgAlt')}">
                </div>
                <div class="violation">
                    <div class="violationHeader">
                        <h2>${translate('labelViolations')}</h2>
                    </div>
                    ${impactListHtml ? `
                        <div class="violationSummary">
                            <dl class="violationFilter">
                                <dt>
                                    ${translate('labelViolationFilter')}
                                    <span class="sr-only">${translate('labelViolationFilterNote')}</span>
                                </dt>
                                <dd>
                                    <ul>
                                        ${impactListHtml}
                                        <li class="violationFilterReset">
                                            <button class="violationFilterResetBtn" id="filter-reset" aria-label="${translate('labelViolationFilterResetAriaLabel')}">
                                                ${translate('labelViolationFilterReset')}
                                            </button>
                                        </li>
                                    </ul>
                                </dd>
                            </dl>
                        </div>
                    ` : ''}
                    ${violationHtml}
                </div>
            </div>
        `);
};