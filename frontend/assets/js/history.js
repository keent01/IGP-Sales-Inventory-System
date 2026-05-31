/**
 * assets/js/history.js
 * Comprehensive Sales History Management
 */

/**
 * 1. Global State Object
 * Centralizing state makes the application easier to debug and maintain.
 */
const state = {
    sales: [],
    summary: {
        totalSales: 0,
        totalItemsSold: 0,
        mostSoldItem: "N/A"
    },
    filters: {
        search: '',
        program: '',
        category: '',
        start_date: '',
        end_date: ''
    }
};

// State for the Edit Modal
let currentEditSaleId = null;
let editCart = []; 

/**
 * 2. Initialization
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize reusable search/filter module
    SearchFilter.init({
        elements: {
            search: 'histSearch',
            filters: ['filterProgram', 'filterCategory', 'dateFrom', 'dateTo'],
            clearButton: 'clearFiltersBtn'
        },
        onFilter: applyFilters,
        debounceWait: 500
    });
    
    // Initial fetch
    loadHistoryPage();
});

/**
 * 3. Primary Controller
 * Orchestrates fetching data and updating UI.
 */
async function loadHistoryPage() {
    updateTableLoadingState(true);
    
    try {
        const params = new URLSearchParams(Object.fromEntries(
            Object.entries(state.filters).filter(([_, v]) => v)
        ));

        // Concurrent Fetching
        const [summaryData, salesData] = await Promise.all([
            apiFetch(`/api/history-summary?${params}`),
            apiFetch(`/api/sales-history?${params}`)
        ]);

        state.summary = summaryData;
        state.sales = salesData;

        renderSummaryCards();
        renderHistoryTable();
    } catch (error) {
        showResponseModal("Sync Error", "Could not retrieve history data.", "error");
    } finally {
        updateTableLoadingState(false);
    }
}

/**
 * 4. Filter Handlers
 */
function applyFilters() {
    state.filters = SearchFilter.getFilterState({
        search: 'histSearch',
        program: 'filterProgram',
        category: 'filterCategory',
        start_date: 'dateFrom',
        end_date: 'dateTo'
    });
    loadHistoryPage();
}

/**
 * 5. UI Rendering Functions
 */
function renderSummaryCards() {
    const { totalSales, totalItemsSold, mostSoldItem } = state.summary;
    
    document.getElementById('statTotalSales').innerText = totalSales;
    document.getElementById('statItemsSold').innerText = totalItemsSold.toLocaleString();
    document.getElementById('statMostSold').innerText = mostSoldItem || "N/A";
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = user.role || 'User';

    if (state.sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-20 text-center text-gray-400 italic">No records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = state.sales.map(sale => {
        const itemsHtml = sale.items_list ? sale.items_list.map(item => `
            <div class="mb-1 last:mb-0">
                <div class="font-medium text-gray-800">${item.item_name}</div>
                <div class="text-[10px] text-gray-400">Size: ${item.size || 'N/A'}</div>
            </div>
        `).join('') : `<div class="text-gray-400 italic">No item data</div>`;

        const qtyHtml = sale.items_list ? sale.items_list.map(item => `
            <div class="mb-1 last:mb-0 text-center">${item.quantity}</div>
        `).join('') : '0';

        return `
            <tr class="hover:bg-gray-50 transition-colors group">
                <td class="px-6 py-4 text-xs text-gray-500">
                    ${new Date(sale.date).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 font-bold text-[#800000]">
                    ${sale.or_number}
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm font-bold text-gray-800">${sale.student_name}</div>
                    <div class="text-[10px] text-gray-400 font-medium">${sale.program}</div>
                </td>
                <td class="px-6 py-4">
                    ${itemsHtml}
                </td>
                <td class="px-6 py-4">
                    ${qtyHtml}
                </td>
                <td class="px-6 py-4 font-black text-gray-900">
                    ₱${parseFloat(sale.total).toLocaleString()}
                </td>
                <td class="px-6 py-4 text-right space-x-1">
                    <button onclick="viewDetails(${sale.sale_id})" class="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all">
                        View
                    </button>
                    ${userRole === 'Admin' ? `
                        <button onclick="editSale(${sale.sale_id})" class="text-amber-600 hover:bg-amber-50 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all">
                            Edit
                        </button>
                        <button onclick="confirmVoid(${sale.sale_id}, '${sale.or_number}')" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-[10px] font-bold uppercase transition-all">
                            Delete
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function updateTableLoadingState(isLoading) {
    const tbody = document.getElementById('historyTableBody');
    if (isLoading) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-20 text-center"><div class="spinner border-[#800000] w-8 h-8 mx-auto"></div></td></tr>`;
    }
}

/**
 * 6. VIEW / RECEIPT MODULE
 */
function viewDetails(saleId) {
    const sale = state.sales.find(s => s.sale_id === saleId);
    if (!sale) return;

    document.getElementById('rcptOrNumber').innerText = sale.or_number;
    document.getElementById('rcptDate').innerText = new Date(sale.date).toLocaleString();
    document.getElementById('rcptStudent').innerText = `${sale.student_name} (${sale.program})`;
    document.getElementById('rcptCashier').innerText = sale.cashier_name || 'Admin';

    const itemsContainer = document.getElementById('rcptItems');
    if (sale.items_list) {
        itemsContainer.innerHTML = sale.items_list.map(item => {
            const itemTotal = item.price ? (item.quantity * item.price) : 0; 
            return `
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-bold">${item.quantity}x ${item.item_name}</div>
                        <div class="text-[10px] text-gray-500">Size: ${item.size || 'N/A'}</div>
                    </div>
                    <div class="font-bold">₱${itemTotal.toLocaleString()}</div>
                </div>
            `;
        }).join('');
    }

    document.getElementById('rcptTotal').innerText = `₱${parseFloat(sale.total).toLocaleString()}`;
    document.getElementById('receiptModal').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeReceiptModal() {
    document.getElementById('receiptModal').classList.add('hidden');
}

/**
 * 7. EDIT SALE MODULE
 */
async function editSale(saleId) {
    const sale = state.sales.find(s => s.sale_id === saleId);
    if (!sale) return;

    currentEditSaleId = saleId;
    
    // Populate Fields
    document.getElementById('editStudentName').value = sale.student_name;
    document.getElementById('editProgram').value = sale.program;
    document.getElementById('editOrNumber').value = sale.or_number;
    document.getElementById('editReason').value = '';
    
    // Date formatting for <input type="datetime-local">
    const saleDate = new Date(sale.date);
    saleDate.setMinutes(saleDate.getTimezoneOffset() * -1 + saleDate.getMinutes());
    document.getElementById('editSaleDate').value = saleDate.toISOString().slice(0, 16);

    // Deep copy items to the edit cart
    editCart = sale.items_list.map(item => ({ ...item }));
    renderEditItems();

    document.getElementById('editSaleModal').classList.remove('hidden');
    document.getElementById('btnSaveEdit').onclick = saveEditSale;
    if (window.lucide) lucide.createIcons();
}

function renderEditItems() {
    const tbody = document.getElementById('editItemsTableBody');
    let total = 0;

    tbody.innerHTML = editCart.map((item, index) => {
        const subtotal = item.quantity * item.price;
        total += subtotal;
        return `
            <tr>
                <td class="px-4 py-3">
                    <div class="font-bold text-gray-800">${item.item_name}</div>
                    <div class="text-[10px] text-gray-400">Size: ${item.size}</div>
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="updateEditQty(${index}, -1)" class="w-6 h-6 rounded border hover:bg-gray-100">-</button>
                        <span class="font-bold w-4">${item.quantity}</span>
                        <button onclick="updateEditQty(${index}, 1)" class="w-6 h-6 rounded border hover:bg-gray-100">+</button>
                    </div>
                </td>
                <td class="px-4 py-3 text-right">₱${item.price.toLocaleString()}</td>
                <td class="px-4 py-3 text-right font-bold">₱${subtotal.toLocaleString()}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('editTotalAmount').innerText = `₱${total.toLocaleString()}`;
}

function updateEditQty(index, delta) {
    const newQty = editCart[index].quantity + delta;
    if (newQty > 0) {
        editCart[index].quantity = newQty;
        renderEditItems();
    }
}

async function saveEditSale() {
    const reason = document.getElementById('editReason').value.trim();
    if (!reason) {
        alert("Please provide a modification reason for the audit log.");
        return;
    }

    const payload = {
        student_name: document.getElementById('editStudentName').value,
        program: document.getElementById('editProgram').value,
        or_number: document.getElementById('editOrNumber').value,
        sale_date: document.getElementById('editSaleDate').value,
        modification_reason: reason,
        items: editCart.map(i => ({ item_id: i.item_id, quantity: i.quantity }))
    };

    try {
        await apiFetch(`/api/sales/${currentEditSaleId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });

        showResponseModal("Update Successful", "Transaction and stock levels updated.", "success");
        closeEditModal();
        loadHistoryPage();
    } catch (error) {
        showResponseModal("Update Failed", error.message, "error");
    }
}

function closeEditModal() {
    document.getElementById('editSaleModal').classList.add('hidden');
}

/**
 * 8. DELETE / VOID MODULE
 */
// --- DELETE / VOID LOGIC ---
let currentVoidSaleId = null;
let currentVoidOrNumber = null;

function confirmVoid(saleId, orNumber) {
    currentVoidSaleId = saleId;
    currentVoidOrNumber = orNumber;

    // Set modal text and clear previous input
    document.getElementById('voidModalSubtitle').innerText = `OR #${orNumber}`;
    document.getElementById('voidReason').value = '';

    // Show modal
    document.getElementById('voidSaleModal').classList.remove('hidden');
    document.getElementById('btnConfirmVoid').onclick = executeVoid;
    
    if (window.lucide) lucide.createIcons();
}

function closeVoidModal() {
    document.getElementById('voidSaleModal').classList.add('hidden');
}

async function executeVoid() {
    const reason = document.getElementById('voidReason').value.trim();
    
    if (!reason) {
        showResponseModal("Reason Required", "Please provide a reason for voiding this transaction to comply with audit policies.", "info");
        return;
    }

    try {
        // We pass the reason to the backend via a query parameter
        await apiFetch(`/api/sales/${currentVoidSaleId}?reason=${encodeURIComponent(reason)}`, {
            method: 'DELETE'
        });

        closeVoidModal();
        showResponseModal(
            "Transaction Voided", 
            `OR #${currentVoidOrNumber} has been successfully cancelled and stock returned.`, 
            "success"
        );
        
        loadHistoryPage(); 
    } catch (error) {
        showResponseModal("Void Failed", error.message, "error");
    }
}