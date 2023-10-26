import puppeteer from 'puppeteer';
import { loadPage } from '@axe-core/puppeteer';
import AXELOCALES_JA from 'axe-core/locales/ja.json' assert { type: 'json' };
import fs from 'fs';
import path from 'path';
import config from './config.mjs';

// Viewport settings
const VIEWPORTS = {
    PC: { width: 1024, height: 768 },
    MOBILE: { width: 375, height: 812 }
};

// Configure
const reportConfigure = () => {
    if (config.locale === 'ja') {
        config.localeData = AXELOCALES_JA;
    }

    if (config.mode === 'pc') {
        config.viewport = VIEWPORTS.PC;
    } else if (config.mode === 'mobile') {
        config.viewport = VIEWPORTS.MOBILE;
    } else {
        console.error("\x1b[31mInvalid mode specified\x1b[0m");
        throw new Error("Invalid mode specified");
    }

    return config;
};

// Folder existence check and creation
const ensureDirectoryExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
};

(async () => {

    // Load configure
    const { urlList, localeData, tags, locale, viewport } = reportConfigure();

    // Puppeteer launch
    const browser = await puppeteer.launch({ headless: 'new', defaultViewport: viewport, });

    // Read URLs from the external file
    const urls = fs.readFileSync(urlList, 'utf-8').split('\n').filter(Boolean);

    // Create a 'results' directory if it doesn't exist
    const resultsFolder = 'results';
    ensureDirectoryExists(resultsFolder);

    // Create a folder inside 'results' based on the current datetime (`yyyy-mm-dd_hh-mm-ss`)
    const now = new Date();
    const dateTimeFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const folderName = path.join(resultsFolder, dateTimeFolder);
    ensureDirectoryExists(folderName);

    // Create subdirectories for JSON and HTML files inside the dateTime folder
    const jsonFolder = path.join(folderName, 'json');
    const htmlFolder = path.join(folderName, 'html');
    ensureDirectoryExists(jsonFolder);
    ensureDirectoryExists(htmlFolder);

    // Set count for progress
    let processedCount = 0;

    // Run Tests
    for (let url of urls) {
        try {
            // Output progress (start)
            console.log(`Processing ${processedCount + 1}/${urls.length}: ${url}`);

            // Load page
            const axeBuilder = await loadPage(browser, url.trim());

            // Get a screenshot of the page in Base64 format
            const page = axeBuilder.page;
            const screenshotBase64 = await page.screenshot({ encoding: 'base64' });

            // Get test results
            const results = await axeBuilder.configure({ locale: localeData }).withTags(tags).analyze();

            // Create file name
            const parsedURL = new URL(url);
            const domain = parsedURL.hostname;
            const pathName = parsedURL.pathname.slice(1).replace(/\/$/g, '').replace(/[^a-zA-Z0-9\-_.]/g, '_');
            const queryString = parsedURL.search.slice(1).replace(/[^a-zA-Z0-9\-_.]/g, '_');
            const baseFilename = `${domain}${pathName ? `_${pathName}` : ''}${queryString ? `_${queryString}` : ''}`;

            // Save results to an external JSON file (eg. example.com_pathname.json)
            const jsonFilename = path.join(jsonFolder, `${baseFilename}.json`);
            fs.writeFileSync(jsonFilename, JSON.stringify(results, null, 2), 'utf-8');

            // Save results to an external HTML file (eg. example.com_pathname.html)
            const htmlFilename = path.join(htmlFolder, `${baseFilename}.html`);
            const htmlContent = generateHtmlReport(url, results, screenshotBase64, locale);
            fs.writeFileSync(htmlFilename, htmlContent, 'utf-8');

            // Output progress (complete)
            processedCount++;
            console.log(`\x1b[32mCompleted!\x1b[0m ${processedCount}/${urls.length}: ${url}`);
        } catch (error) {
            console.log(`\x1b[31mFailed to process URL:\x1b[0m ${url}. Error: ${error.message}`);
            processedCount++;
        }
    }

    await browser.close();
})();

// Generate HTML
const generateHtmlReport = (url, results, screenshotBase64, locale) => {
    const translations = {
        ja: {
            labrlTitle: 'アクセシビリティレポート',
            labrlViolations: '試験結果',
            labrlFailureMessage: '発見された問題点',
            labrlImgAlt: 'ページのスクリーンショット',
            labrlTargetHTML: '対象 HTML',
            labrlHelpPage: '参考情報',
            labrlNoIssues: '問題点は発見されませんでした！',
            labrlImpact: '影響度',
            impactData: {
                minor: '軽度',
                moderate: '中程度',
                serious: '深刻',
                critical: '重大',
            },
        },
        en: {
            labrlTitle: 'Accessibility Report',
            labrlViolations: 'Test Result',
            labrlFailureMessage: 'Failure Message',
            labrlImgAlt: 'Screenshot of the page',
            labrlTargetHTML: 'Target HTML',
            labrlHelpPage: 'More Information',
            labrlNoIssues: 'You have (0) automatic issues, nice!',
            labrlImpact: 'Impact',
            impactData: {
                minor: 'Minor',
                moderate: 'Moderate',
                serious: 'Serious',
                critical: 'Critical',
            },
        }
    };

    const translate = (key, subkey) => {
        if (subkey) {
            return translations[locale][key][subkey];
        }
        return translations[locale][key];
    };

    const template = fs.readFileSync('template/template.html', 'utf-8');

    let violationHtml;
    if (results.violations.length === 0) {
        violationHtml = `
            <div class="violationBody">
                <p class="noIssues">${translate('labrlNoIssues')}</p>
            </div>
        `;
    } else {
        violationHtml = results.violations.map(violation => `
            <div class="violationBody">
                <h3>${escapeHtml(violation.description)}</h3>
                <div class="helpUrl">
                    <dl>
                        <dt>${translate('labrlHelpPage')}</dt>
                        <dd><a href="${violation.helpUrl}" target="_blank" rel="noopener">${escapeHtml(violation.help)}</a></dd>
                    </dl>
                </div>
                <div class="tagList">
                    <ul>${violation.tags.map(tag => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>
                </div>
                <div class="violationItem">
                    <ul>
                        ${violation.nodes.map(node => `
                            <li>
                                <dl>
                                    <div class="failureMessage">
                                        <dt>
                                            ${translate('labrlFailureMessage')}
                                            <span class="impact">${translate('labrlImpact')} 
                                                <span class="impactLabel ${node.impact}">${translate('impactData', node.impact)}</span>
                                            </span>
                                        </dt>
                                        <dd>${escapeHtml(node.any[0].message)}</dd>
                                    </div>
                                    <div class="targetHTML">
                                        <dt>${translate('labrlTargetHTML')}</dt>
                                        <dd><code>${escapeHtml(node.html)}</code></dd>
                                    </div>
                                    <div class="targetDom">
                                        <dt>DOM</dt>
                                        <dd><code>${escapeHtml(node.target[0])}</code></dd>
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
        .replace('{{LOCALE}}', locale)
        .replace('{{PAGE_TITLE}}', translate('labrlTitle'))
        .replace('{{URL}}', escapeHtml(url))
        .replace('{{HEADER}}', `
            <hgroup class="title">
                <h1>${translate('labrlTitle')}</h1>
                <p class="testUrl">
                    <span class="urlLabel">URL:</span>
                    ${escapeHtml(url)}
                </p>
            </hgroup>
        `)
        .replace('{{CONTENT}}', `
            <div class="contents">
                <div class="screenshot">
                    <img src="data:image/png;base64,${screenshotBase64}" alt="${translate('labrlImgAlt')}" />
                </div>
                <div class="violation">
                    <div class="violationHeader">
                        <h2>${translate('labrlViolations')}</h2>
                    </div>
                    ${violationHtml}
                </div>
            </div>
        `);
};

// HTML escape
const escapeHtml = unsafe => {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\n/g, "<br>");
};