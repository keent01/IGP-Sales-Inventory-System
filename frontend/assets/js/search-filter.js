/**
 * Reusable Search & Filter Module
 * Centralized utility for filtering and searching across pages
 * Eliminates code duplication and provides consistent filtering behavior
 */

const SearchFilter = {
    /**
     * Generic debounce function for search inputs
     * @param {Function} func - Function to debounce
     * @param {Number} wait - Milliseconds to wait
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    /**
     * Build query string from filter object
     * Removes empty values and formats for API consumption
     * @param {Object} filters - Object with filter key-value pairs
     * @returns {String} Query string (e.g., "search=test&category=Uniforms")
     */
    buildQuery(filters) {
        const params = Object.entries(filters)
            .filter(([_, value]) => value && value.toString().trim() !== '')
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        return params;
    },

    /**
     * Generic filter function - filters array based on multiple criteria
     * @param {Array} data - Array of objects to filter
     * @param {Object} criteria - Object with field names and filter functions or values
     * @param {Object} options - { searchFields: [], searchTerm: '', customFilters: [] }
     * @returns {Array} Filtered data
     */
    filterData(data, criteria = {}, options = {}) {
        const { searchFields = [], searchTerm = '', customFilters = [] } = options;

        return data.filter(item => {
            // Search term filtering across specified fields
            if (searchTerm && searchFields.length > 0) {
                const matchesSearch = searchFields.some(field => {
                    const fieldValue = this.getNestedProperty(item, field);
                    return fieldValue && fieldValue.toString().toLowerCase().includes(searchTerm.toLowerCase());
                });
                if (!matchesSearch) return false;
            }

            // Exact match criteria filtering
            for (const [field, value] of Object.entries(criteria)) {
                if (value && value.toString().trim() !== '') {
                    const fieldValue = this.getNestedProperty(item, field);
                    if (fieldValue !== value && fieldValue.toString() !== value) return false;
                }
            }

            // Custom filter functions
            for (const filterFn of customFilters) {
                if (!filterFn(item)) return false;
            }

            return true;
        });
    },

    /**
     * Helper to get nested object properties (e.g., "user.name")
     * @param {Object} obj - Object to search
     * @param {String} path - Dot-notation path (e.g., "user.profile.name")
     * @returns {*} Property value or undefined
     */
    getNestedProperty(obj, path) {
        return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
    },

    /**
     * Initialize event listeners for a page's filter inputs
     * @param {Object} config - Configuration object
     * @param {Object} config.elements - { search: '', filters: [], etc }
     * @param {Function} config.onFilter - Callback when filter changes
     * @param {Number} config.debounceWait - Debounce milliseconds (default: 500)
     */
    init(config) {
        const { elements = {}, onFilter = () => {}, debounceWait = 500 } = config;

        // Setup search input with debounce
        if (elements.search) {
            const searchInput = document.getElementById(elements.search);
            if (searchInput) {
                searchInput.addEventListener('input', this.debounce(() => onFilter(), debounceWait));
            }
        }

        // Setup filter dropdowns/inputs with immediate trigger
        if (elements.filters && Array.isArray(elements.filters)) {
            elements.filters.forEach(filterId => {
                const element = document.getElementById(filterId);
                if (element) {
                    element.addEventListener('change', () => onFilter());
                    element.addEventListener('input', () => onFilter());
                }
            });
        }

        // Setup clear button
        if (elements.clearButton) {
            const clearBtn = document.getElementById(elements.clearButton);
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    this.clearFilters(elements);
                    onFilter();
                });
            }
        }

        // Setup apply button (for forms with explicit apply action)
        if (elements.applyButton) {
            const applyBtn = document.getElementById(elements.applyButton);
            if (applyBtn) {
                applyBtn.addEventListener('click', onFilter);
            }
        }
    },

    /**
     * Clear all filter input values
     * @param {Object} elements - Elements object with IDs of inputs to clear
     */
    clearFilters(elements) {
        const { search = '', filters = [], dateRanges = [] } = elements;

        // Clear search
        if (search) {
            const input = document.getElementById(search);
            if (input) input.value = '';
        }

        // Clear filter selects/inputs
        [...filters, ...dateRanges].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
    },

    /**
     * Get current filter state from DOM elements
     * @param {Object} elements - Object mapping field names to element IDs
     * @returns {Object} Current filter values
     */
    getFilterState(elements) {
        const state = {};
        for (const [key, elementId] of Object.entries(elements)) {
            if (key.startsWith('_')) continue; // Skip internal keys
            const element = document.getElementById(elementId);
            if (element) {
                state[key] = element.value;
            }
        }
        return state;
    },

    /**
     * Format currency for Philippine Peso
     * @param {Number} amount - Amount to format
     * @returns {String} Formatted currency string
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-PH', { 
            style: 'currency', 
            currency: 'PHP' 
        }).format(Number(amount || 0));
    },

    /**
     * Format date to locale string
     * @param {String|Date} date - Date to format
     * @returns {String} Formatted date
     */
    formatDate(date) {
        if (!date) return '';
        return new Date(date).toLocaleDateString();
    },

    /**
     * Create a loading spinner HTML
     * @returns {String} HTML string for spinner
     */
    getLoadingSpinner() {
        return `<div class="col-span-full py-20 text-center">
                    <div class="spinner border-[#800000] w-8 h-8 mx-auto mb-4"></div>
                    <p class="text-gray-500 text-sm">Loading...</p>
                </div>`;
    },

    /**
     * Create empty state HTML
     * @param {String} message - Message to display
     * @returns {String} HTML string for empty state
     */
    getEmptyState(message = 'No results found.') {
        return `<div class="col-span-full text-center py-20 text-gray-400 italic">${message}</div>`;
    }
};

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchFilter;
}
