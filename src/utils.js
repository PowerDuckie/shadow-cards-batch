import { ERROR_MESSAGES, ALLOWED_TAGS_MARKDOWN, ALLOWED_ATTRS_MARKDOWN } from './constants.js';

import { v4 as uuidv4 } from 'uuid';
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML with allowed tags and attributes
 * @param {string} html
 * @param {string[]} allowedTags
 * @param {string[]} allowedAttrs
 */
export const sanitizeHtml = (html = '', allowedTags = ALLOWED_TAGS_MARKDOWN || [], allowedAttrs = ALLOWED_ATTRS_MARKDOWN || []) => {
    if (!html || typeof html !== 'string') return '';
    try {
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: allowedTags,
            ALLOWED_ATTR: allowedAttrs,
            KEEP_CONTENT: true,
            RETURN_TRUSTED_TYPE: false,
            USE_PROFILES: { html: true }
        });
    } catch (err) {
        return escapeHtml(html);
    }
}

/**
 * Escape plain text to HTML
 * @param {string} str
 */
export const escapeHtml = (str = '') => {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


/**
 * Generates a unique ID for card identification
 * @returns {string} Unique alphanumeric ID
 */
export const generateUniqueId = () => {
    return `shadow-card-${uuidv4()}`;
}

/**
 * Input validation utility for ensuring type safety and valid values
 */
export const Validator = {
    validateContainer(container) {
        if (!(container instanceof HTMLElement)) {
            throw new Error(ERROR_MESSAGES.INVALID_CONTAINER);
        }
    },
    validateHtml(html) {
        if (typeof html !== 'string') {
            throw new Error(ERROR_MESSAGES.INVALID_HTML);
        }
    },
    validateCss(css) {
        if (typeof css !== 'string') {
            throw new Error(ERROR_MESSAGES.INVALID_CSS);
        }
    },
    validateData(data) {
        if (data !== null && typeof data !== 'object') {
            throw new Error(ERROR_MESSAGES.INVALID_DATA);
        }
    },
    validateTargetWidth(width) {
        if (typeof width !== 'number' || width <= 0 || isNaN(width)) {
            throw new Error(ERROR_MESSAGES.INVALID_TARGET_WIDTH);
        }
    },
    validateNotDestroyed(instance) {
        if (instance.isDestroyed) {
            throw new Error(ERROR_MESSAGES.ELEMENT_DESTROYED);
        }
    }
};
