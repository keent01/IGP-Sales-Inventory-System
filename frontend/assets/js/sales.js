const API_URL = 'http://127.0.0.1:8000/api';
let cart = [];
let allItems = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    
    document.getElementById('itemSearch').addEventListener('input', (e) => {
        renderProducts(e.target.value);
    });

    document.getElementById('confirmBtn').addEventListener('click', submitTransaction);
});

async function fetchProducts() {
    try {
        const response = await fetch(`${API_URL}/items`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        allItems = await response.json();
        renderProducts();
    } catch (error) {
        console.error("Failed to fetch products");
    }
}

function renderProducts(search = '') {
    const grid = document.getElementById('productGrid');
    const filtered = allItems.filter(item => 
        item.item_name.toLowerCase().includes(search.toLowerCase()) && !item.is_deleted
    );

    grid.innerHTML = filtered.map(item => `
        <div onclick="addToCart(${item.item_id})" class="bg-white border border-gray-100 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-[#800000]/30 transition-all cursor-pointer group">
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1">${item.category || 'IGP Item'}</p>
            <h4 class="text-sm font-bold text-gray-800 mb-2 group-hover:text-[#800000]">${item.item_name}</h4>
            <div class="flex justify-between items-end">
                <span class="text-lg font-black text-gray-900">₱${item.unit_price}</span>
                <span class="text-[10px] ${item.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'} font-bold">
                    Stock: ${item.stock_quantity}
                </span>
            </div>
        </div>
    `).join('');
}

function addToCart(itemId) {
    const product = allItems.find(p => p.item_id === itemId);
    const existing = cart.find(c => c.item_id === itemId);

    if (product.stock_quantity <= 0) return alert("Item out of stock!");

    if (existing) {
        if (existing.quantity < product.stock_quantity) {
            existing.quantity++;
        } else {
            alert("Maximum stock reached");
        }
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
}

function updateCartUI() {
    const cartDiv = document.getElementById('cartItems');
    const totalSpan = document.getElementById('totalAmount');
    const subtotalSpan = document.getElementById('subtotalAmount');
    
    if (cart.length === 0) {
        cartDiv.innerHTML = `<div class="text-center py-10 text-gray-400"><p class="text-sm">Cart is empty</p></div>`;
        totalSpan.innerText = "₱0.00";
        subtotalSpan.innerText = "₱0.00";
        return;
    }

    let total = 0;
    cartDiv.innerHTML = cart.map((item, index) => {
        total += item.unit_price * item.quantity;
        return `
            <div class="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <div class="flex-1">
                    <p class="text-xs font-bold text-gray-800">${item.item_name}</p>
                    <p class="text-[10px] text-gray-500">₱${item.unit_price} x ${item.quantity}</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="font-bold text-sm text-[#800000]">₱${(item.unit_price * item.quantity).toFixed(2)}</span>
                    <button onclick="removeFromCart(${index})" class="text-gray-300 hover:text-red-600 transition-colors">
                        <i data-lucide="x-circle" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    totalSpan.innerText = `₱${total.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    subtotalSpan.innerText = `₱${total.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    if (window.lucide) lucide.createIcons();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

async function submitTransaction() {
    const orNumber = document.getElementById('orNumber').value;
    const customerName = document.getElementById('customerName').value;

    if (!orNumber || cart.length === 0) return alert("Please enter OR Number and add items.");

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const payload = {
        user_id: user.user_id || 0,
        or_number: orNumber,
        student_name: customerName,
        student_program: '',
        items: cart.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
        total_amount: cart.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0)
    };

    try {
        const res = await apiFetch('/api/sales/create', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        // If apiFetch did not throw, assume success
        alert("Transaction Successful!");
        window.location.href = 'transactions.html';
    } catch (e) {
        alert(e.message || "Transaction failed");
    }
}