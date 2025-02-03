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

// 翻訳データ
const translations = {
    ja: {
        pageTitle: 'アクセシビリティ試験結果サマリー',
        labelImpact: '発見された問題点',
        impactData: {
            minor: '軽度',
            moderate: '中程度',
            serious: '深刻',
            critical: '重大',
        },
    },
    en: {
        pageTitle: 'Accessibility Audit Summary',
        labelImpact: 'Identified Issues',
        impactData: {
            minor: 'Minor',
            moderate: 'Moderate',
            serious: 'Serious',
            critical: 'Critical',
        },
    }
    // 他言語の翻訳が必要な場合は追加
};

// 言語設定を config.locale から取得（デフォルトは 'ja'で、ja / en 以外には未対応）
const LANGUAGE = ['ja', 'en'].includes(config.locale) ? config.locale : 'ja';

// 翻訳関数
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

// コマンドライン引数の解析
export const parseArgs = () => {
    const args = process.argv.slice(2);

    // minimist でパース
    const parsed = minimist(args, {
        string: ['path']
    });

    // --path のみを想定しているので、そこだけ抽出
    return {
        path: parsed.path
    };
};

// HTML escape
const escapeHtml = unsafe => (
    unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>')
);

// メイン関数
const buildSummary = async () => {
    // --path の値を取得
    const { path: basePath } = parseArgs();

    if (!basePath) {
        console.error('Error: --path option is required.');
        process.exit(1);
    }

    const jsonDir = path.join(basePath, 'json');

    // JSON ディレクトリの存在確認
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

    // JSON ファイルの読み込み
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

    // Sanitize file name
    const sanitizeFilenamePart = (str) => str.replace(/[^a-zA-Z0-9\-_.]/g, '_');

    const tableRows = [];

    for (const file of jsonFiles) {
        const filePath = path.join(jsonDir, file);
        let data;
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            data = JSON.parse(content);
        } catch (err) {
            console.error(`Error: Failed to read or parse ${filePath}.`, err);
            continue; // 次のファイルに進む
        }

        const url = data.url || 'URL 不明';
        const violations = data.violations || [];

        // impactCounts の初期化
        const impactCounts = {
            minor: 0,
            moderate: 0,
            serious: 0,
            critical: 0
        };

        for (const violation of violations) {
            for (const node of violation.nodes) {
                if (impactCounts.hasOwnProperty(node.impact)) {
                    impactCounts[node.impact]++;
                }
            }
        }

        // impactListHtml の生成
        const impactListHtml = Object.entries(impactCounts).map(([impact, count]) => `
                <li>
                    <div class="violationFilterBtn" for="filter-${impact}">
                        <span class="violationLabel ${impact}">${translate('impactData', impact)}</span>
                        <span class="violationFilterNum">${count}</span>
                    </div>
                </li>
        `).join('');

        // レポートHTMLへのリンク用に URL からファイル名を生成
        const parsedURL = new URL(url);
        const domain = parsedURL.hostname;
        const pathName = sanitizeFilenamePart(parsedURL.pathname.slice(1).replace(/\/$/g, ''));
        const queryString = sanitizeFilenamePart(parsedURL.search.slice(1));
        const baseFilename = `${domain}${pathName ? `_${pathName}` : ''}${queryString ? `_${queryString}` : ''}`;

        // テーブル行の追加
        tableRows.push(`
        <tr>
            <th scope="row">
                <div class="report-link">
                    <a href="../html/${escapeHtml(baseFilename)}.html" title="「${escapeHtml(url)}」の詳細レポートを開く" aria-label="「${escapeHtml(url)}」の詳細レポートを開く">${escapeHtml(url)}</a>
                    <a class="report-link-ex" href="${escapeHtml(url)}" target="_blank" title="実際のページ（${escapeHtml(url)}）を別窓で開く" aria-label="実際のページ（${escapeHtml(url)}）を別窓で開く">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="report-link-ex-icon" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                    </a>
                </div>
            </th>
            <td>
                <ul class="violation-count-summary">
                    ${impactListHtml}
                </ul>
            </td>
        </tr>
        `);
    }

    // 完成したテーブルの生成
    const tableHtml = `
    <table>
        <thead>
            <tr>
                <th scope="col">URL</th>
                <th scope="col">${translate('labelImpact')}</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows.join('')}
        </tbody>
    </table>
    `;

    // styles.css の読み込み
    let styleContent = '';
    try {
        const stylePath = path.join(process.cwd(), 'template', 'styles.css');
        styleContent = await fs.readFile(stylePath, 'utf-8');
    } catch (error) {
        console.warn('Warning: Could not load styles.css.', error);
        styleContent = `/* Could not load styles.css */`;
    }

    // 完全な HTML の生成
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
                <div class="summary-table">
                    <div class="overflow-table" tabindex="0">
                        ${tableHtml}
                    </div>
                </div>
            </main>
            <footer>
                <div>
                    <a href="https://github.com/burnworks/axe-auto-reporter" target="_blank">axe-auto-reporter</a> by @burnworks
                </div>
            </footer>
        </body>
    </html>
    `;

    // summary ディレクトリの作成
    const summaryDir = path.join(basePath, 'summary');
    try {
        await fs.mkdir(summaryDir, { recursive: true });
    } catch (err) {
        console.error(`Error: Failed to create directory ${summaryDir}.`, err);
        process.exit(1);
    }

    // index.html の書き出し
    const outputPath = path.join(summaryDir, 'index.html');
    try {
        await fs.writeFile(outputPath, fullHtml, 'utf-8');
        console.log(`Summary page generated at ${outputPath}`);
    } catch (err) {
        console.error(`Error: Failed to write file ${outputPath}.`, err);
        process.exit(1);
    }
}

// スクリプトの実行
buildSummary();
