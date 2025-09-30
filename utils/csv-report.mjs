import { createWriteStream } from 'fs';
import { once } from 'events';

const CSV_HEADERS = [
    'url',
    'チェック内容',
    'helpUrl',
    'tag',
    '影響度',
    '発見された問題点',
    '修正提案',
    '対象HTML',
    'DOM'
];

const endStream = (stream) => new Promise((resolve, reject) => {
    stream.end((error) => {
        if (error) {
            reject(error);
        } else {
            resolve();
        }
    });
});

/**
 * Builds a CSV report from axe-core violations.
 */
export class CsvReportBuilder {
    /**
     * @param {Object} options
     * @param {string} options.filePath - Destination CSV file path
     * @param {string} [options.delimiter] - CSV delimiter (default: ",")
     * @param {string} [options.newline] - Line ending (default: "\r\n")
     * @param {(impact: string|null|undefined) => string} [options.impactLabel] - Formatter for impact labels
     * @param {number} [options.highWaterMark] - Write stream buffer size
     */
    constructor(options = {}) {
        const {
            filePath,
            delimiter = ',',
            newline = '\r\n',
            impactLabel = (impact) => impact ?? '',
            highWaterMark = 64 * 1024
        } = options;

        if (!filePath) {
            throw new Error('CsvReportBuilder requires filePath');
        }

        this.delimiter = delimiter;
        this.newline = newline;
        this.impactLabel = impactLabel;
        this.closed = false;
        this.stream = createWriteStream(filePath, {
            encoding: 'utf-8',
            flags: 'w',
            highWaterMark
        });
        this.stream.write(CSV_HEADERS.join(this.delimiter) + this.newline);
    }

    /**
     * Adds violations from an axe-core result set.
     * @param {Object} params
     * @param {string} params.url - URL that was tested
     * @param {Object[]} [params.violations] - Axe-core violations array
     */
    async addViolations({ url, violations }) {
        if (!Array.isArray(violations) || violations.length === 0) {
            return;
        }

        for (const violation of violations) {
            const checkSummary = violation?.description || violation?.help || violation?.id || '';
            const helpUrl = violation?.helpUrl || '';
            const tags = Array.isArray(violation?.tags) ? violation.tags.join(' | ') : '';

            const nodes = Array.isArray(violation?.nodes) ? violation.nodes : [];
            for (const node of nodes) {
                const failureMessages = [];
                if (Array.isArray(node?.any)) {
                    failureMessages.push(...node.any.map(item => item?.message).filter(Boolean));
                }
                if (Array.isArray(node?.none)) {
                    failureMessages.push(...node.none.map(item => item?.message).filter(Boolean));
                }
                if (Array.isArray(node?.all)) {
                    failureMessages.push(...node.all.map(item => item?.message).filter(Boolean));
                }

                const row = {
                    url,
                    'チェック内容': checkSummary,
                    helpUrl,
                    tag: tags,
                    '影響度': this.impactLabel(node?.impact) || '',
                    '発見された問題点': failureMessages.join('\n'),
                    '修正提案': node?.failureSummary || '',
                    '対象HTML': node?.html || '',
                    DOM: Array.isArray(node?.target) ? node.target.join(' | ') : ''
                };

                await this.#writeRow(row);
            }
        }
    }

    async close() {
        if (this.closed) return;
        this.closed = true;
        if (!this.stream.writableEnded) {
            await endStream(this.stream);
        }
    }

    async #writeRow(row) {
        if (this.closed) {
            throw new Error('CsvReportBuilder stream already closed');
        }

        const line = CSV_HEADERS
            .map(key => this.#escapeCell(row?.[key]))
            .join(this.delimiter) + this.newline;

        if (!this.stream.write(line)) {
            await once(this.stream, 'drain');
        }
    }

    #escapeCell(value) {
        if (value === null || value === undefined) {
            return '';
        }

        const stringValue = String(value)
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');

        const needsQuotes = stringValue.includes(this.delimiter)
            || stringValue.includes('"')
            || stringValue.includes('\n');

        const escaped = stringValue.replace(/"/g, '""');
        return needsQuotes ? '"' + escaped + '"' : escaped;
    }
}
