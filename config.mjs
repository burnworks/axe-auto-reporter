/**
 * @fileoverview Configuration file for axe-auto-reporter
 * @version 3.0.0
 */

/**
 * @typedef {'ja' | 'en'} SupportedLocale
 * Supported locales for the accessibility reports
 */

/**
 * @typedef {'pc' | 'mobile'} ViewportMode
 * Viewport modes for browser emulation
 */

/**
 * @typedef {'png' | 'jpeg' | 'webp'} ScreenshotFormat
 * Supported screenshot formats
 */

/**
 * @typedef {string[]} AxeTags
 * Array of axe-core tags for accessibility testing
 * @see {@link https://github.com/dequelabs/axe-core/blob/master/doc/API.md#axe-core-tags}
 */

/**
 * @typedef {Object} ReporterConfiguration
 * @property {string} urlList - Path to the file containing URLs to test
 * @property {SupportedLocale} locale - Locale setting for reports and axe-core
 * @property {AxeTags} tags - Array of axe-core tags to include in testing
 * @property {ViewportMode} mode - Viewport mode for browser emulation
 * @property {number} concurrency - Number of URLs to process concurrently (1-10)
 * @property {boolean} enableConcurrency - Enable/disable concurrent processing
 * @property {number} maxConcurrentPerDomain - Maximum concurrent requests per domain (1-3)
 * @property {number} delayBetweenRequests - Delay between requests to same domain in milliseconds
 * @property {ScreenshotFormat} screenshotFormat - Format for screenshots
 * @property {number} screenshotQuality - Quality for JPEG/WebP screenshots (0-100)
 * @property {boolean} enableScreenshots - Enable/disable screenshot capture
 * @property {string} outputDirectory - Directory for storing results
 * @property {string} templatePath - Path to HTML template file
 * @property {string} stylesPath - Path to CSS styles file
 * @property {number} jsonIndentation - Number of spaces for JSON pretty printing
 * @property {number} navigationTimeout - Navigation timeout in milliseconds
 * @property {string[]} allowedDomains - Allowed domains for URL testing (empty array allows all)
 * @property {string[]} blockedDomains - Blocked domains for URL testing
 * @property {boolean} enableSandbox - Enable browser sandbox for security
 * @property {number} maxPageSize - Maximum page size in bytes (0 = unlimited)
 */

/**
 * Default configuration for axe-auto-reporter
 * @type {ReporterConfiguration}
 */
export default {
    urlList: 'urls.txt',
    locale: 'ja',
    tags: [
        'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice',
    ],
    mode: 'pc',
    concurrency: 3,
    enableConcurrency: true,
    maxConcurrentPerDomain: 1,
    delayBetweenRequests: 3000,
    screenshotFormat: 'jpeg',
    screenshotQuality: 80,
    enableScreenshots: true,
    outputDirectory: 'results',
    templatePath: 'template/template.html',
    stylesPath: 'template/styles.css',
    jsonIndentation: 2,
    navigationTimeout: 30000,
    allowedDomains: [],
    blockedDomains: [
        'localhost', '127.0.0.1', '0.0.0.0', '::1',
        '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16',
        'metadata.google.internal', 'instance-data',
        'link-local', 'automatic'
    ],
    enableSandbox: true,
    maxPageSize: 50 * 1024 * 1024
};