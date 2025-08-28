/**
 * @fileoverview Configuration file for axe-auto-reporter
 * @version 2.0.2
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
    /** Path to the file containing URLs to test */
    urlList: 'urls.txt',
    
    /** Locale setting for reports and axe-core ('ja' | 'en') */
    locale: 'ja',
    
    /** 
     * Axe-core Tags setting for accessibility testing
     * @see https://github.com/dequelabs/axe-core/blob/master/doc/API.md#axe-core-tags
     */
    tags: [
        'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice',
    ],
    
    /** Viewport mode for browser emulation ('pc' | 'mobile') */
    mode: 'pc',
    
    // Concurrent processing settings
    /** Number of URLs to process concurrently (1-10) */
    concurrency: 3,
    
    /** Enable/disable concurrent processing */
    enableConcurrency: true,
    
    // Memory optimization settings
    /** Screenshot format - 'jpeg' uses less memory than 'png' */
    screenshotFormat: 'jpeg',
    
    /** Quality for JPEG/WebP screenshots (0-100, ignored for PNG) */
    screenshotQuality: 80,
    
    /** Enable/disable screenshot capture to save memory */
    enableScreenshots: true,
    
    // File and directory paths
    /** Directory for storing results */
    outputDirectory: 'results',
    
    /** Path to HTML template file */
    templatePath: 'template/template.html',
    
    /** Path to CSS styles file */
    stylesPath: 'template/styles.css',
    
    // Output formatting
    /** Number of spaces for JSON pretty printing */
    jsonIndentation: 2,
    
    // Security settings
    /** Navigation timeout in milliseconds */
    navigationTimeout: 30000,
    
    /** Allowed domains for URL testing (empty array allows all) */
    allowedDomains: [],
    
    /** Blocked domains for URL testing */
    blockedDomains: ['localhost', '127.0.0.1', '0.0.0.0', '::1'],
    
    /** Enable browser sandbox for security */
    enableSandbox: true,
    
    /** Maximum page size in bytes (0 = unlimited) */
    maxPageSize: 50 * 1024 * 1024, // 50MB
};