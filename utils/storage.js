/* ===============================
   SHARED UTILITIES
================================ */

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Use this whenever rendering user-supplied data via innerHTML.
 */
export function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Validates and clamps a string to a max length.
 */
export function sanitizeInput(str, maxLength = 100) {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, maxLength);
}

/**
 * Clamps a numeric value between min and max.
 */
export function clampNumber(value, min, max) {
    const num = Number(value);
    if (isNaN(num)) return min;
    return Math.max(min, Math.min(max, num));
}
