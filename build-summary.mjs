/* ======================================
このスクリプトは開発者プレビューです。
レポート作成処理完了後、
node build-summary.mjs --path ./results/yyyy-mm-dd-hh-mm-ss/
で指定したディレクトリ内にサマリーページを生成します。
====================================== */

import fs from 'fs/promises';
import path from 'path';
import minimist from 'minimist';
import config from './config.mjs';
import { generateBaseFilename } from './utils/filename.mjs';

const translations = {
    ja: {
        pageTitle: 'アクセシビリティ試験結果サマリー',
        labelImpact: '問題発生率',
        globalTotalLabel: '問題総数:',
        globalTotalUnit: '件',
        totalPagesLabel: '試験対象:',
        totalPagesUnit: 'ページ',
        impactDataText: 'のページで発見',
        impactData: {
            minor: '軽度',
            moderate: '中程度',
            serious: '深刻',
            critical: '重大',
            total: '合計',
        },
        sortBy: {
            minor: '軽度の発生件数でソート',
            moderate: '中程度の発生件数でソート',
            serious: '深刻の発生件数でソート',
            critical: '重大の発生件数でソート',
            total: '合計発生件数でソート',
        },
        labelSummaryTable: '試験結果一覧',
        labelAnyIssue: '何らかの問題',
        unknownUrl: 'URL 不明',
        linkToDetailReport: '「{url}」の詳細レポートを開く',
        linkToActualPage: '実際のページ（{url}）を別窓で開く',
    },
    en: {
        pageTitle: 'Accessibility Test Results Summary',
        labelImpact: 'Issue Detection Rate',
        globalTotalLabel: 'Total Issues:',
        globalTotalUnit: 'issues',
        totalPagesLabel: 'Pages Tested:',
        totalPagesUnit: 'pages',
        impactDataText: 'of pages have issues',
        impactData: {
            minor: 'Minor',
            moderate: 'Moderate',
            serious: 'Serious',
            critical: 'Critical',
            total: 'Total',
        },
        sortBy: {
            minor: 'Sort by minor issues',
            moderate: 'Sort by moderate issues',
            serious: 'Sort by serious issues',
            critical: 'Sort by critical issues',
            total: 'Sort by total issues',
        },
        labelSummaryTable: 'Test Results',
        labelAnyIssue: 'Any Issues',
        unknownUrl: 'URL Unknown',
        linkToDetailReport: 'Open detailed report for "{url}"',
        linkToActualPage: 'Open actual page ({url}) in new window',
    }
};

const LANGUAGE = ['ja', 'en'].includes(config.locale) ? config.locale : 'ja';

const translate = (key, subKey) => {
    const keys = translations[LANGUAGE] || translations.ja;

    if (subKey) {
        const val = keys[key]?.[subKey];
        if (!val) {
            console.warn(`Translation missing for key: "${key}", subKey: "${subKey}" in locale: "${LANGUAGE}"`);
            return 'Translation missing';
        }
        return val;
    } else {
        const val = keys[key];
        if (!val) {
            console.warn(`Translation missing for key: "${key}" in locale: "${LANGUAGE}"`);
            return 'Translation missing';
        }
        return val;
    }
};

export const parseArgs = () => {
    const args = process.argv.slice(2);

    const parsed = minimist(args, {
        string: ['path']
    });
    return {
        path: parsed.path
    };
};

const escapeHtml = unsafe => (
    unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>')
);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 1000;

const buildSummary = async () => {
    const { path: basePath } = parseArgs();

    if (!basePath) {
        console.error('Error: --path option is required.');
        process.exit(1);
    }

    const normalizedBasePath = path.resolve(basePath);
    const allowedDir = path.resolve(process.cwd());
    
    if (!normalizedBasePath.startsWith(allowedDir)) {
        console.error('Error: Specified path is outside the allowed directory.');
        process.exit(1);
    }

    const jsonDir = path.join(normalizedBasePath, 'json');

    try {
        const stat = await fs.stat(jsonDir);
        if (!stat.isDirectory()) {
            console.error(`Error: ${jsonDir} is not a directory.`);
            process.exit(1);
        }
    } catch (err) {
        console.error(`Error: Cannot access directory ${jsonDir}.`, err);
        process.exit(1);
    }

    let files;
    try {
        files = await fs.readdir(jsonDir);
    } catch (err) {
        console.error(`Error: Failed to read directory ${jsonDir}.`, err);
        process.exit(1);
    }

    const jsonFiles = files.filter(file => file.endsWith('.json'));

    if (jsonFiles.length === 0) {
        console.warn(`Warning: No JSON files found in ${jsonDir}.`);
    }
    
    if (jsonFiles.length > MAX_FILES) {
        console.warn(`Warning: Processing ${jsonFiles.length} files exceeds recommended limit (${MAX_FILES}). Performance may be affected.`);
    }


    const tableRows = [];
    const globalStats = {
        minor: 0,
        moderate: 0,
        serious: 0,
        critical: 0
    };
    const pageStats = [];

    for (const file of jsonFiles) {
        const filePath = path.join(jsonDir, file);
        let data;
        try {
            const stats = await fs.stat(filePath);
            if (stats.size > MAX_FILE_SIZE) {
                console.warn(`Warning: File ${file} is too large (${stats.size} bytes). Maximum allowed: ${MAX_FILE_SIZE} bytes.`);
                continue;
            }
            
            const content = await fs.readFile(filePath, 'utf-8');
            data = JSON.parse(content);
        } catch (err) {
            console.error(`Error: Failed to read or parse ${filePath}.`, err);
            continue;
        }

        const url = data.url || translate('unknownUrl');
        const violations = data.violations || [];

        const impactCounts = {
            minor: 0,
            moderate: 0,
            serious: 0,
            critical: 0
        };

        for (const violation of violations) {
            for (const node of violation.nodes) {
                if (Object.hasOwn(impactCounts, node.impact)) {
                    impactCounts[node.impact]++;
                }
            }
        }


        let baseFilename;
        try {
            baseFilename = generateBaseFilename(url);
        } catch (error) {
            console.warn(`Failed to generate filename for URL: ${url}`, error);
            try {
                baseFilename = 'invalid_url_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
            } catch (randomError) {
                baseFilename = 'invalid_url_' + Date.now() + '_fallback';
            }
        }

        Object.keys(impactCounts).forEach(impact => {
            globalStats[impact] += impactCounts[impact];
        });

        const totalIssues = Object.values(impactCounts).reduce((a, b) => a + b, 0);
        pageStats.push({
            url,
            baseFilename,
            ...impactCounts,
            total: totalIssues
        });

        tableRows.push(`
        <tr data-minor="${impactCounts.minor}" data-moderate="${impactCounts.moderate}" data-serious="${impactCounts.serious}" data-critical="${impactCounts.critical}" data-total="${totalIssues}">
            <th scope="row">
                <div class="report-link">
                    <a href="../html/${escapeHtml(baseFilename)}.html" title="${translate('linkToDetailReport').replace('{url}', escapeHtml(url))}" aria-label="${translate('linkToDetailReport').replace('{url}', escapeHtml(url))}">${escapeHtml(url)}</a>
                    <a class="report-link-ex" href="${escapeHtml(url)}" target="_blank" title="${translate('linkToActualPage').replace('{url}', escapeHtml(url))}" aria-label="${translate('linkToActualPage').replace('{url}', escapeHtml(url))}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="report-link-ex-icon" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                    </a>
                </div>
            </th>
            <td class="impact-cell minor">${impactCounts.minor}</td>
            <td class="impact-cell moderate">${impactCounts.moderate}</td>
            <td class="impact-cell serious">${impactCounts.serious}</td>
            <td class="impact-cell critical">${impactCounts.critical}</td>
            <td class="total-cell">${totalIssues}</td>
        </tr>
        `);
    }

    const totalPages = pageStats.length;
    const globalTotal = Object.values(globalStats).reduce((a, b) => a + b, 0);

    const issueOccurrenceRates = {
        minor: 0,
        moderate: 0,
        serious: 0,
        critical: 0,
        any: 0
    };

    if (totalPages > 0) {
        let pagesWithMinor = 0;
        let pagesWithModerate = 0;
        let pagesWithSerious = 0;
        let pagesWithCritical = 0;
        let pagesWithAnyIssue = 0;

        pageStats.forEach(page => {
            if (page.minor > 0) pagesWithMinor++;
            if (page.moderate > 0) pagesWithModerate++;
            if (page.serious > 0) pagesWithSerious++;
            if (page.critical > 0) pagesWithCritical++;
            if (page.total > 0) pagesWithAnyIssue++;
        });

        issueOccurrenceRates.minor = Math.round((pagesWithMinor / totalPages) * 100);
        issueOccurrenceRates.moderate = Math.round((pagesWithModerate / totalPages) * 100);
        issueOccurrenceRates.serious = Math.round((pagesWithSerious / totalPages) * 100);
        issueOccurrenceRates.critical = Math.round((pagesWithCritical / totalPages) * 100);
        issueOccurrenceRates.any = Math.round((pagesWithAnyIssue / totalPages) * 100);
    }


    const tableHtml = `
    <table id="resultsTable">
        <thead>
            <tr>
                <th scope="col">URL</th>
                <th scope="col" class="sortable" data-sort="minor">
                    ${translate('impactData', 'minor')}
                    <button class="sort-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" role="img" aria-label="${translate('sortBy', 'minor')}">
                            <title>${translate('sortBy', 'minor')}</title>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                        </svg>
                    </button>
                </th>
                <th scope="col" class="sortable" data-sort="moderate">
                    ${translate('impactData', 'moderate')}
                    <button class="sort-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" role="img" aria-label="${translate('sortBy', 'moderate')}">
                            <title>${translate('sortBy', 'moderate')}</title>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                        </svg>
                    </button>
                </th>
                <th scope="col" class="sortable" data-sort="serious">
                    ${translate('impactData', 'serious')}
                    <button class="sort-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" role="img" aria-label="${translate('sortBy', 'serious')}">
                            <title>${translate('sortBy', 'serious')}</title>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                        </svg>
                    </button>
                </th>
                <th scope="col" class="sortable" data-sort="critical">
                    ${translate('impactData', 'critical')}
                    <button class="sort-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" role="img" aria-label="${translate('sortBy', 'critical')}">
                            <title>${translate('sortBy', 'critical')}</title>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                        </svg>
                    </button>
                </th>
                <th scope="col" class="sortable" data-sort="total">
                    ${translate('impactData', 'total')}
                    <button class="sort-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" role="img" aria-label="${translate('sortBy', 'total')}">
                            <title>${translate('sortBy', 'total')}</title>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                        </svg>
                    </button>
                </th>
            </tr>
        </thead>
        <tbody>
            ${tableRows.join('')}
        </tbody>
    </table>
    `;

    let styleContent = '';
    try {
        const templateDir = path.join(process.cwd(), 'template');
        const stylePath = path.join(templateDir, 'styles.css');
        const normalizedStylePath = path.resolve(stylePath);
        const allowedTemplateDir = path.resolve(templateDir);
        
        if (!normalizedStylePath.startsWith(allowedTemplateDir)) {
            throw new Error('Style path is outside allowed template directory');
        }
        
        styleContent = await fs.readFile(normalizedStylePath, 'utf-8');
    } catch (error) {
        console.warn('Warning: Could not load styles.css.', error);
        styleContent = `/* Could not load styles.css */`;
    }

    const fullHtml = `
    <!DOCTYPE html>
    <html lang="${LANGUAGE}">
        <head>
            <meta charset="UTF-8">
            <title>${translate('pageTitle')}</title>
            <meta name="viewport" content="width=device-width">
            <style>
            ${styleContent}
            </style>
        </head>
        <body>
            <header>
                <h1>${translate('pageTitle')}</h1>
            </header>
            <main>
                <section class="stats-summary">
                    <h2 class="stats-summary-header">${translate('labelImpact')} <span>（${translate('globalTotalLabel')} ${globalTotal} ${translate('globalTotalUnit')} / ${translate('totalPagesLabel')} ${totalPages} ${translate('totalPagesUnit')}）</span></h2>
                    <div class="stats-cards">
                        <div class="stat-card critical">
                            <h3>${translate('impactData', 'critical')}</h3>
                            <div class="stat-number">${issueOccurrenceRates.critical}<span>%</span></div>
                            <div class="stat-label">${translate('impactDataText')}</div>
                        </div>
                        <div class="stat-card serious">
                            <h3>${translate('impactData', 'serious')}</h3>
                            <div class="stat-number">${issueOccurrenceRates.serious}<span>%</span></div>
                            <div class="stat-label">${translate('impactDataText')}</div>
                        </div>
                        <div class="stat-card moderate">
                            <h3>${translate('impactData', 'moderate')}</h3>
                            <div class="stat-number">${issueOccurrenceRates.moderate}<span>%</span></div>
                            <div class="stat-label">${translate('impactDataText')}</div>
                        </div>
                        <div class="stat-card minor">
                            <h3>${translate('impactData', 'minor')}</h3>
                            <div class="stat-number">${issueOccurrenceRates.minor}<span>%</span></div>
                            <div class="stat-label">${translate('impactDataText')}</div>
                        </div>
                        <div class="stat-card any">
                            <h3>${translate('labelAnyIssue')}</h3>
                            <div class="stat-number">${issueOccurrenceRates.any}<span>%</span></div>
                            <div class="stat-label">${translate('impactDataText')}</div>
                        </div>
                    </div>
                </section>
                
                <section class="results-section">
                    <div class="summary-table">
                    <h2 class="results-section-header">${translate('labelSummaryTable')}</h2>
                        <div class="overflow-table" tabindex="0">
                            ${tableHtml}
                        </div>
                    </div>
                </section>
            </main>
            <footer>
                <div>
                    <a href="https://github.com/burnworks/axe-auto-reporter" target="_blank">axe-auto-reporter</a> by @burnworks
                </div>
            </footer>
            
            <script>
            
            let currentSort = { column: null, direction: 'asc' };
            
            function sortTable(column) {
                const table = document.getElementById('resultsTable');
                const tbody = table.querySelector('tbody');
                const rows = Array.from(tbody.querySelectorAll('tr'));
                
                if (currentSort.column === column) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.column = column;
                    currentSort.direction = 'desc';
                }
                
                rows.sort((a, b) => {
                    const aVal = parseInt(a.getAttribute('data-' + column)) || 0;
                    const bVal = parseInt(b.getAttribute('data-' + column)) || 0;
                    
                    if (currentSort.direction === 'asc') {
                        return aVal - bVal;
                    } else {
                        return bVal - aVal;
                    }
                });
                
                if (tbody.replaceChildren) {
                    tbody.replaceChildren(...rows);
                } else {
                    const fragment = document.createDocumentFragment();
                    rows.forEach(row => fragment.appendChild(row));
                    tbody.innerHTML = '';
                    tbody.appendChild(fragment);
                }
                
                document.querySelectorAll('.sortable').forEach(th => {
                    th.classList.remove('asc', 'desc');
                });
                
                const activeHeader = document.querySelector('[data-sort="' + column + '"]');
                activeHeader.classList.add(currentSort.direction);
            }
            
            document.querySelectorAll('.sortable .sort-icon').forEach(button => {
                button.addEventListener('click', () => {
                    const th = button.closest('.sortable');
                    const column = th.getAttribute('data-sort');
                    sortTable(column);
                });
                
                button.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const th = button.closest('.sortable');
                        const column = th.getAttribute('data-sort');
                        sortTable(column);
                    }
                });
            });
            </script>
        </body>
    </html>
    `;

    const summaryDir = path.join(normalizedBasePath, 'summary');
    const normalizedSummaryDir = path.resolve(summaryDir);
    
    if (!normalizedSummaryDir.startsWith(allowedDir)) {
        console.error('Error: Summary directory path is outside allowed directory.');
        process.exit(1);
    }
    
    try {
        await fs.mkdir(normalizedSummaryDir, { recursive: true });
    } catch (err) {
        console.error(`Error: Failed to create directory ${normalizedSummaryDir}.`, err);
        process.exit(1);
    }

    const outputPath = path.join(normalizedSummaryDir, 'index.html');
    try {
        await fs.writeFile(outputPath, fullHtml, 'utf-8');
        console.log(`Summary page generated at ${outputPath}`);
    } catch (err) {
        console.error(`Error: Failed to write file ${outputPath}.`, err);
        process.exit(1);
    }
}

buildSummary();
