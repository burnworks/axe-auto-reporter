/**
 * @fileoverview Shared filename generation utilities for axe-auto-reporter
 * @version 1.0.0
 */

/**
 * Sanitizes a string to be safe for use as part of a filename
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string safe for filenames
 */
export const sanitizeFilenamePart = (str) => {
    if (!str || typeof str !== 'string') return '';
    
    return str
        .normalize('NFC')
        .replace(/\.\./g, '')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, '_reserved_')
        .replace(/[^a-zA-Z0-9\-_.]/g, '_')
        .replace(/_{2,}/g, '_')
        .substring(0, 100);
};

/**
 * Generates a base filename from a URL with proper sanitization and length limits
 * @param {string} url - URL to generate filename from
 * @returns {string} Generated filename (without extension)
 * @throws {Error} When URL is invalid or empty
 */
export const generateBaseFilename = (url) => {
    if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL provided');
    }

    let baseFilename;
    try {
        const parsedURL = new URL(url);
        
        const domain = parsedURL.hostname ? 
            sanitizeFilenamePart(parsedURL.hostname) : 'unknown_host';
        
        let pathName = parsedURL.pathname || '';
        pathName = pathName.slice(1).replace(/\/$/g, '');
        pathName = pathName.replace(/\.\./g, '');
        pathName = sanitizeFilenamePart(pathName);
        
        let queryString = parsedURL.search ? parsedURL.search.slice(1) : '';
        queryString = sanitizeFilenamePart(queryString);
        
        baseFilename = domain + 
            (pathName ? '_' + pathName : '') + 
            (queryString ? '_' + queryString : '');
        
        if (baseFilename.length > 200) {
            baseFilename = baseFilename.substring(0, 200) + '_truncated';
        }
        
    } catch (urlError) {
        console.warn(`Invalid URL encountered: ${url}`, urlError);
        try {
            baseFilename = 'invalid_url_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        } catch (randomError) {
            baseFilename = 'invalid_url_' + Date.now() + '_fallback';
        }
    }

    return baseFilename;
};

/**
 * Validates if a string is safe to use as a filename
 * @param {string} filename - Filename to validate
 * @returns {boolean} True if filename is safe, false otherwise
 */
export const isValidFilename = (filename) => {
    if (!filename || typeof filename !== 'string') return false;
    
    // Unicode正規化
    const normalizedFilename = filename.normalize('NFC');
    
    // Check for path traversal attempts
    if (normalizedFilename.includes('..') || normalizedFilename.includes('/') || normalizedFilename.includes('\\')) {
        return false;
    }
    
    // Check for Windows reserved names
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reservedNames.test(normalizedFilename)) {
        return false;
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(normalizedFilename)) {
        return false;
    }
    
    // Check length
    if (normalizedFilename.length === 0 || normalizedFilename.length > 255) {
        return false;
    }
    
    return true;
};