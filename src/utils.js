import { ERROR_MESSAGES } from './constants.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique ID for card identification
 * @returns {string} Unique alphanumeric ID
 */
export function generateUniqueId() {
    return `shadow-card-${uuidv4()}`;
}

/**
 * Input validation utility for ensuring type safety and valid values
 */
export const Validator = {
    /**
     * Validates that a container is a valid HTML element
     * @param {*} container - Value to validate
     * @throws {Error} Throws error if validation fails
     */
    validateContainer(container) {
        if (!(container instanceof HTMLElement)) {
            throw new Error(ERROR_MESSAGES.INVALID_CONTAINER);
        }
    },

    /**
     * Validates that HTML content is a string
     * @param {*} html - Value to validate
     * @throws {Error} Throws error if validation fails
     */
    validateHtml(html) {
        if (typeof html !== 'string') {
            throw new Error(ERROR_MESSAGES.INVALID_HTML);
        }
    },

    /**
     * Validates that CSS content is a string
     * @param {*} css - Value to validate
     * @throws {Error} Throws error if validation fails
     */
    validateCss(css) {
        if (typeof css !== 'string') {
            throw new Error(ERROR_MESSAGES.INVALID_CSS);
        }
    },

    /**
     * Validates that data is a valid object
     * @param {*} data - Value to validate
     * @throws {Error} Throws error if validation fails
     */
    validateData(data) {
        if (data !== null && typeof data !== 'object') {
            throw new Error(ERROR_MESSAGES.INVALID_DATA);
        }
    },

    /**
     * Validates that target width is a positive number
     * @param {*} width - Value to validate
     * @throws {Error} Throws error if validation fails
     */
    validateTargetWidth(width) {
        if (typeof width !== 'number' || width <= 0 || isNaN(width)) {
            throw new Error(ERROR_MESSAGES.INVALID_TARGET_WIDTH);
        }
    },

    /**
     * Validates that a card instance hasn't been destroyed
     * @param {Object} instance - Card instance to check
     * @throws {Error} Throws error if instance is destroyed
     */
    validateNotDestroyed(instance) {
        if (instance.isDestroyed) {
            throw new Error(ERROR_MESSAGES.ELEMENT_DESTROYED);
        }
    }
};