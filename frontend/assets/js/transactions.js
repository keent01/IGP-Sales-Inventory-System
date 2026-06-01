// assets/js/transactions.js

const state = {
    allItems: [],
    cart: [],
    searchTerm: ''
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize reusable search module for item search
    SearchFilter.init({
        elements: {
            search: 'itemSearch'
        },
        onFilter: () => {
            state.searchTerm = document.getElementById('itemSearch')?.value || '';
            renderItemGrid();
        },
        debounceWait: 300
    });
    
    initPOS();
    document.getElementById('btnConfirm')?.addEventListener('click', confirmOrder);
});

async function initPOS() {
    try {
        // Using our apiFetch utility
        state.allItems = await apiFetch('/api/items/'); 
        renderItemGrid();
    } catch (error) {
        showResponseModal("Error", "Could not load products", "error");
    }
}

/* items grid */
function renderItemGrid() {
    const grid = document.getElementById('itemGrid');
    if (!grid) return;

    // Use reusable filter function with custom filter for deleted items
    const filtered = SearchFilter.filterData(state.allItems, 
        {},
        {
            searchFields: ['item_name', 'category'],
            searchTerm: state.searchTerm,
            customFilters: [item => item.is_deleted === 0 || item.is_deleted === false]
        }
    );

    grid.innerHTML = filtered.map(item => {
        const isOutOfStock = item.stock_quantity <= 0;
        const isLowStock = item.stock_quantity <= item.low_stock_threshold;

        // Image source logic: prefer `item_photo` returned by the backend
        const imageSrc = item.item_photo || item.item_photo_path || (item.photo_path ? `https://igp-sales-ingisystem-production.up.railway.app${item.photo_path}` : null);

        const formattedPrice = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(item.price || 0));

        return `
            <div onclick="${isOutOfStock ? '' : `addToCart(${item.item_id})`}" 
                 class="group bg-white border border-gray-100 rounded-2xl p-3 transition-all hover:shadow-xl hover:border-[#800000]/30 cursor-pointer relative overflow-hidden ${isOutOfStock ? 'opacity-60 grayscale cursor-not-allowed' : ''}">
                
                <div class="h-32 w-full bg-gray-50 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                    ${imageSrc 
                        ? `<img src="${imageSrc}" class="w-full h-full object-cover transition-transform group-hover:scale-110" />` 
                        : `<i data-lucide="package" class="w-8 h-8 text-gray-200"></i>`
                    }
                </div>

                <div class="space-y-1">
                    <div class="flex justify-between items-start">
                        <p class="text-[9px] font-black text-[#800000] uppercase tracking-widest">${item.category}</p>
                        <span class="text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 uppercase">Size: ${item.size || 'N/A'}</span>
                    </div>
                    <h4 class="text-sm font-bold text-gray-800 leading-tight h-10 line-clamp-2">${item.item_name}</h4>
                    
                    <div class="flex justify-between items-center pt-2 border-t border-gray-50">
                        <span class="text-sm font-black text-gray-900">${formattedPrice}</span>
                        <span class="text-[10px] font-bold ${isLowStock ? 'text-amber-500' : 'text-gray-400'}">
                            ${isOutOfStock ? 'OUT OF STOCK' : `Stock: ${item.stock_quantity}`}
                        </span>
                    </div>
                </div>

                ${!isOutOfStock ? `
                <div class="absolute inset-0 bg-[#800000]/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div class="bg-[#800000] text-white p-2 rounded-full shadow-lg translate-y-4 group-hover:translate-y-0 transition-transform">
                        <i data-lucide="plus" class="w-5 h-5"></i>
                    </div>
                </div>` : ''}
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

/* add to cart */
function addToCart(id) {
    const item = state.allItems.find(i => i.item_id === id);
    const existing = state.cart.find(c => c.item_id === id);

    if (existing) {
        if (existing.quantity < item.stock_quantity) {
            existing.quantity++;
        } else {
            showResponseModal("Stock Limit", "No more units available in stock.", "info");
            return;
        }
    } else {
        state.cart.push({ ...item, quantity: 1 });
    }
    updateCartUI();
}

function updateCartUI() {
    const list = document.getElementById('cartList');
    const totalDisplay = document.getElementById('totalDisplay');
    const countDisplay = document.getElementById('cartCount');
    
    if (state.cart.length === 0) {
        list.innerHTML = `<div class="text-center py-20 text-gray-300 italic text-xs">Empty Cart</div>`;
        totalDisplay.innerText = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(0);
        countDisplay.innerText = "0 Items";
        return;
    }

    let grandTotal = 0;
    list.innerHTML = state.cart.map((item, index) => {
        const priceNum = Number(item.price || 0);
        const subtotal = priceNum * item.quantity;
        grandTotal += subtotal;
        const formattedSubtotal = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(subtotal);
        const formattedItemPrice = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(priceNum);
        return `
            <div class="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <div class="flex-1">
                    <p class="text-xs font-bold text-gray-800">${item.item_name}</p>
                    <p class="text-[10px] text-[#800000] font-bold">${item.size} • ${formattedItemPrice}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="changeQty(${index}, -1)" class="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100">-</button>
                    <span class="text-xs font-bold w-4 text-center">${item.quantity}</span>
                    <button onclick="changeQty(${index}, 1)" class="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100">+</button>
                </div>
                <button onclick="removeFromCart(${index})" class="text-gray-300 hover:text-red-500 transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
                <div class="text-sm font-bold ml-2">${formattedSubtotal}</div>
            </div>
        `;
    }).join('');
    
    totalDisplay.innerText = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(grandTotal);
    countDisplay.innerText = `${state.cart.length} Item${state.cart.length > 1 ? 's' : ''}`;
    if (window.lucide) lucide.createIcons();
}

function changeQty(index, delta) {
    const item = state.cart[index];
    const originalItem = state.allItems.find(i => i.item_id === item.item_id);
    
    const newQty = item.quantity + delta;
    if (newQty > 0 && newQty <= originalItem.stock_quantity) {
        item.quantity = newQty;
        updateCartUI();
    } else if (newQty > originalItem.stock_quantity) {
        showResponseModal("Limited Stock", "Cannot exceed available inventory.", "info");
    }
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    updateCartUI();
}

async function confirmOrder() {
    console.log('confirmOrder called');
    const btn = document.getElementById('btnConfirm');
    const student = document.getElementById('studentName').value.trim();
    const program = document.getElementById('studentProgram').value;
    const orNumber = document.getElementById('orNumber').value.trim();

    // Validation
    if (!student || !program || !orNumber) {
        showResponseModal("Missing Info", "Please fill in all student details and OR number.", "error");
        return;
    }

    if (state.cart.length === 0) {
        showResponseModal("Empty Cart", "Please add at least one item to the transaction.", "info");
        return;
    }

    // Prepare Payload matching backend `SaleCreate` schema
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const payload = {
        user_id: user.user_id || 0,
        or_number: orNumber,
        student_name: student,
        student_program: program,
        total_amount: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        items: state.cart.map(item => ({
            item_id: item.item_id,
            quantity: item.quantity
        }))
    };

    try {
        // UI Feedback
        btn.disabled = true;
        btn.innerHTML = `Processing...`;

        // Send to Backend
        const result = await apiFetch('/api/sales/create', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        // Success: Show Modal and Reset
        showResponseModal(
            "Transaction Complete", 
            `Order ${payload.or_number} recorded. Inventory has been updated.`, 
            "success"
        );
        
        resetTransactionForm();

    } catch (error) {
        showResponseModal("Transaction Failed", error.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i> Confirm Order`;
        if (window.lucide) lucide.createIcons();
    }
}

function resetTransactionForm() {
    state.cart = [];
    document.getElementById('studentName').value = '';
    document.getElementById('orNumber').value = '';
    updateCartUI();
    initPOS(); // Re-fetch items to show updated stock levels in the grid
}

// Fallback: ensure button is bound in case DOMContentLoaded was missed
if (!document.getElementById('btnConfirm')?.onclick) {
    document.getElementById('btnConfirm')?.addEventListener('click', confirmOrder);
}