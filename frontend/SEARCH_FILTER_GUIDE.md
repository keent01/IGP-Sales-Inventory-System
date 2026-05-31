# Search & Filter Module Guide

## Overview

The **SearchFilter** module (`frontend/assets/js/search-filter.js`) provides reusable, centralized utilities for search and filtering functionality across all pages. This eliminates code duplication and ensures consistent behavior.

## ✅ Pages Refactored

- ✅ **Inventory** - Category filtering + item search
- ✅ **History** - Multi-field filters (program, category, date range) + search
- ✅ **Transactions** - Item search with custom filters
- ✅ **Reports** - Ready for future filter expansion

## 🎯 Core Functions

### `SearchFilter.init(config)`
**Purpose:** Initialize event listeners for search/filter inputs  
**Use Case:** Call once in `DOMContentLoaded` for a page

```javascript
SearchFilter.init({
    elements: {
        search: 'itemSearch',           // Search input ID
        filters: ['category', 'program'],  // Filter dropdown IDs
        clearButton: 'clearBtn',        // Clear button ID
        applyButton: 'applyFiltersBtn'  // Apply button ID (optional)
    },
    onFilter: myRenderFunction,  // Callback when filters change
    debounceWait: 300            // Debounce wait time (ms)
});
```

### `SearchFilter.filterData(data, criteria, options)`
**Purpose:** Generic filtering function with multi-field support  
**Returns:** Filtered array

```javascript
const filtered = SearchFilter.filterData(
    allItems,  // Array to filter
    { category: 'Uniforms' },  // Exact match criteria
    {
        searchFields: ['item_name', 'category'],  // Fields to search
        searchTerm: 'polo',  // Search term
        customFilters: [item => item.stock_quantity > 0]  // Custom filter functions
    }
);
```

### `SearchFilter.buildQuery(filters)`
**Purpose:** Build API query string from filter object  
**Returns:** URL query string

```javascript
const queryString = SearchFilter.buildQuery({
    search: 'john',
    category: 'Uniforms',
    start_date: '2024-01-01'
});
// Returns: "search=john&category=Uniforms&start_date=2024-01-01"

// Use in API call:
const data = await apiFetch(`/api/items?${queryString}`);
```

### `SearchFilter.debounce(func, wait)`
**Purpose:** Debounce function calls (useful for search input)

```javascript
const debouncedSearch = SearchFilter.debounce(mySearchFunction, 500);
inputElement.addEventListener('input', debouncedSearch);
```

### `SearchFilter.getFilterState(elements)`
**Purpose:** Get current values of all filter inputs

```javascript
const state = SearchFilter.getFilterState({
    search: 'histSearch',
    program: 'filterProgram',
    category: 'filterCategory'
});
// Returns: { search: 'value', program: 'value', category: 'value' }
```

### `SearchFilter.clearFilters(elements)`
**Purpose:** Reset all filter inputs to empty

```javascript
SearchFilter.clearFilters({
    search: 'itemSearch',
    filters: ['category', 'program'],
    dateRanges: ['startDate', 'endDate']
});
```

## 🛠️ Utility Functions

### `SearchFilter.formatCurrency(amount)`
Format currency in Philippine Peso (PHP)

```javascript
SearchFilter.formatCurrency(150.50);  // Returns: "₱150.50"
```

### `SearchFilter.formatDate(date)`
Format date to locale string

```javascript
SearchFilter.formatDate('2024-01-15');  // Returns: "1/15/2024"
```

### `SearchFilter.getLoadingSpinner()`
Get HTML for loading spinner

```javascript
element.innerHTML = SearchFilter.getLoadingSpinner();
```

### `SearchFilter.getEmptyState(message)`
Get HTML for empty state

```javascript
element.innerHTML = SearchFilter.getEmptyState('No items found');
```

## 📋 Implementation Examples

### Example 1: Inventory Page (inventory.js)
```javascript
// Initialize with search and category filter
SearchFilter.init({
    elements: {
        search: 'inventorySearch',
        filters: ['inventoryCategory'],
        clearButton: 'inventoryClear'
    },
    onFilter: renderFilteredInventory
});

// In render function, use the filter utility
function renderFilteredInventory() {
    const search = document.getElementById('inventorySearch')?.value || '';
    const category = document.getElementById('inventoryCategory')?.value || '';
    
    const filtered = SearchFilter.filterData(inventoryCache, 
        { category: category },
        {
            searchFields: ['item_name', 'category'],
            searchTerm: search
        }
    );
    
    renderInventoryCards(filtered);
}
```

### Example 2: History Page (history.js)
```javascript
// Initialize with multiple filters and apply button
SearchFilter.init({
    elements: {
        search: 'histSearch',
        filters: ['filterProgram', 'filterCategory', 'dateFrom', 'dateTo'],
        applyButton: 'applyFiltersBtn'
    },
    onFilter: applyFilters
});

// Get filter state and build API query
function applyFilters() {
    state.filters = SearchFilter.getFilterState({
        search: 'histSearch',
        program: 'filterProgram',
        category: 'filterCategory',
        start_date: 'dateFrom',
        end_date: 'dateTo'
    });
    
    // Build query string and fetch
    const params = SearchFilter.buildQuery(state.filters);
    loadHistoryData(`/api/sales-history?${params}`);
}
```

### Example 3: Transactions Page (transactions.js)
```javascript
// Initialize with just search (no category filter for POS)
SearchFilter.init({
    elements: {
        search: 'itemSearch'
    },
    onFilter: () => {
        state.searchTerm = document.getElementById('itemSearch')?.value || '';
        renderItemGrid();
    }
});

// Filter with custom filter function
function renderItemGrid() {
    const filtered = SearchFilter.filterData(state.allItems, 
        {},
        {
            searchFields: ['item_name', 'category'],
            searchTerm: state.searchTerm,
            customFilters: [item => item.is_deleted === 0]
        }
    );
    
    renderItems(filtered);
}
```

## 🔄 Adding Filters to a New Page

1. **Include the script** in your HTML:
   ```html
   <script src="../assets/js/search-filter.js"></script>
   ```

2. **Initialize in your JS file:**
   ```javascript
   document.addEventListener('DOMContentLoaded', () => {
       SearchFilter.init({
           elements: {
               search: 'mySearchId',
               filters: ['filter1', 'filter2'],
               clearButton: 'clearBtnId'
           },
           onFilter: myRenderFunction
       });
   });
   ```

3. **Use in your render function:**
   ```javascript
   function myRenderFunction() {
       const filters = SearchFilter.getFilterState({
           search: 'mySearchId',
           status: 'filterStatus'
       });
       
       const filtered = SearchFilter.filterData(myData, filters);
       renderUI(filtered);
   }
   ```

## 📝 Best Practices

✅ **DO:**
- Use `SearchFilter.init()` to bind all filter inputs at once
- Use `SearchFilter.filterData()` instead of manual filter loops
- Call `renderUI()` inside the `onFilter` callback
- Use custom filters for complex conditions

❌ **DON'T:**
- Duplicate filter logic across multiple pages
- Manually bind each input element
- Use `innerHTML` with unescaped user data
- Hardcode element IDs in shared functions

## 🐛 Troubleshooting

**Filters not triggering?**
- Ensure element IDs match exactly in HTML and `SearchFilter.init()`
- Check that `onFilter` callback is defined

**Search not finding items?**
- Verify `searchFields` contain the correct property names
- Check that data is loaded before filtering

**Button not working?**
- Ensure button ID is set in `elements.clearButton` or `elements.applyButton`
- Check console for errors

---

**Created:** May 28, 2026  
**Updated:** Latest refactor session  
**Status:** Active across Inventory, History, Transactions, Reports pages
