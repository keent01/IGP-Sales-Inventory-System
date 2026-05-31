// assets/js/inventory.js

let inventoryCache = []; 

document.addEventListener('DOMContentLoaded', () => {
    initializeInventoryPage();
});

function initializeInventoryPage() {
    const addButton = document.querySelector('button[onclick="openModal()"]');
    const userRole = JSON.parse(localStorage.getItem('user') || '{}').role || 'Staff';
    if (userRole !== 'Admin' && addButton) {
        addButton.remove();
    }

    // Register both filters so SearchFilter can attach change event listeners automatically
    SearchFilter.init({
        elements: {
            search: 'inventorySearch',
            filters: ['inventoryCategory', 'inventoryStatus'],
            clearButton: 'inventoryClear'
        },
        onFilter: renderFilteredInventory,
        debounceWait: 300
    });

    document.getElementById('exportBtn')?.addEventListener('click', exportInventory);
    fetchInventoryData();
}

async function fetchInventoryData() {
    const grid = document.getElementById('inventoryGrid');
    grid.innerHTML = SearchFilter.getLoadingSpinner();

    try {
        const data = await apiFetch('/api/items/');
        inventoryCache = Array.isArray(data) ? data : [];
        renderFilteredInventory();
    } catch (error) {
        console.error('Inventory fetch error:', error);
        grid.innerHTML = `<div class="col-span-full text-center py-20 text-red-500">Unable to load inventory.</div>`;
    }
}

function renderFilteredInventory() {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    // 1. Correctly grab the filter inputs
    const search = document.getElementById('inventorySearch')?.value || '';
    const category = document.getElementById('inventoryCategory')?.value || '';
    const status = document.getElementById('inventoryStatus')?.value || '';

    const filtered = SearchFilter.filterData(
        inventoryCache, 
        {}, // Keep strict criteria object empty to avoid empty-string match bugs
        {
            searchFields: ['item_name'], 
            searchTerm: search, //  Fixed: Changed from searchTerm to search
            customFilters: [
                // 1. Ensure item is not soft-deleted
                item => !item.is_deleted,
                
                // 2. Dynamic Category filter (ignores if empty)
                item => !category || item.category === category,
                
                // 3. Status computation filter (ignores if empty)
                item => {
                    if (!status) return true;
                    
                    const stock = Number(item.stock_quantity || 0);
                    const threshold = Number(item.low_stock_threshold || 0);
                    
                    if (status === 'out_of_stock') {
                        return stock <= 0;
                    }
                    if (status === 'low_stock') {
                        return stock > 0 && stock <= threshold;
                    }
                    if (status === 'in_stock') {
                        return stock > threshold;
                    }
                    return true;
                }
            ]
        }
    );

    // Make sure this matches the name of your card-rendering function
    renderInventoryCards(filtered);
}

function renderInventoryCards(items) {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    if (!items.length) {
        grid.innerHTML = SearchFilter.getEmptyState('No products found matching your filters.');
        return;
    }

    const userRole = JSON.parse(localStorage.getItem('user') || '{}').role || 'Staff';
    grid.innerHTML = items.map(item => {
        const isLowStock = item.stock_quantity <= item.low_stock_threshold && item.stock_quantity > 0;
        const isOutOfStock = item.stock_quantity === 0;
        const status = isOutOfStock ? { label: 'Out of Stock', color: 'bg-gray-100 text-gray-700' } :
                       isLowStock ? { label: 'Low Stock', color: 'bg-red-100 text-red-700' } :
                                    { label: 'In Stock', color: 'bg-green-100 text-green-700' };

        const imageMarkup = item.item_photo
            ? `<img src="${item.item_photo}" alt="${item.item_name}" class="object-cover w-full h-full" onerror="this.onerror=null; this.src='https://dummyimage.com/280x160/f3f4f6/800000.png?text=No+Image'" />`
            : `<i data-lucide="package" class="w-12 h-12 text-gray-300 group-hover:text-[#800000] transition-colors"></i>`;

        return `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                <div class="h-40 bg-gray-50 flex items-center justify-center relative overflow-hidden">
                    ${imageMarkup}
                    <span class="absolute top-3 right-3 ${status.color} text-[10px] font-bold px-2 py-1 rounded-md uppercase">${status.label}</span>
                </div>
                <div class="p-5">
                    <p class="text-[10px] font-bold text-red-700 uppercase mb-1">${item.category}</p>
                    <div class="flex justify-between items-end mb-4">
                        <h3 class="font-semibold text-gray-800 truncate mr-4">${item.item_name}</h3>
                        <div class="flex flex-col items-end whitespace-nowrap">
                            <span class="text-[9px] font-bold uppercase tracking-wider text-gray-400 leading-none mb-0.5">Size</span>
                            <span class="text-sm font-semibold text-gray-700 leading-none">${item.size || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="flex justify-between items-end">
                        <div>
                            <p class="text-xs text-gray-400">Price</p>
                            <p class="text-lg font-bold text-gray-900">${item.price}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs text-gray-400">In Stock</p>
                            <p class="font-semibold ${isLowStock ? 'text-red-600' : 'text-gray-700'}">${item.stock_quantity}</p>
                        </div>
                    </div>
                    <div class="mt-5 pt-4 border-t border-gray-50 flex gap-2">
                        ${userRole === 'Admin' ? `
                        <button onclick="editItem(${item.item_id})" class="flex-1 text-xs font-semibold py-2 px-3 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center gap-1.5 hover:bg-blue-100 transition">
                            <i data-lucide="edit-2" class="w-4 h-4"></i> Edit
                        </button>
                        <button onclick="deleteItem(${item.item_id})" class="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-100 bg-red-50 text-red-700 hover:bg-red-100 transition">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// --- NEW EXPLICIT MODALS THAT REQUIRE A CLICK ---
function showSuccessModal(title, message) {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div class="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden text-center p-8">
                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="check-circle" class="w-8 h-8 text-green-600"></i>
                </div>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">${title}</h2>
                <p class="text-gray-500 mb-8">${message}</p>
                <button onclick="closeInventoryModal()" class="w-full bg-[#800000] text-white py-3 rounded-xl font-bold hover:bg-[#600000] transition-all active:scale-95">
                    Continue
                </button>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function showErrorModal(title, message) {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
        <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div class="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden text-center p-8">
                <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="alert-circle" class="w-8 h-8 text-red-600"></i>
                </div>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">${title}</h2>
                <p class="text-gray-500 mb-8">${message}</p>
                <button onclick="closeInventoryModal()" class="w-full bg-gray-100 text-gray-800 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-95">
                    Close
                </button>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}
// ------------------------------------------------

async function submitNewInventoryItem(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const btn = event.submitter;
    const formData = new FormData(form);

    formData.set('item_name', formData.get('name'));
    formData.set('stock_quantity', formData.get('stock'));
    formData.set('low_stock_threshold', formData.get('threshold'));
    formData.delete('name');
    formData.delete('stock');
    formData.delete('threshold');

    // FIX: Remove photo if empty to avoid sending corrupted data
    const photo = formData.get('photo');
    if (photo && photo.size === 0) formData.delete('photo');

    try {
        btn.disabled = true;
        btn.innerHTML = 'Saving...';

        const result = await apiFetch('/api/items/', {
            method: 'POST',
            body: formData
        });
        
        if (result.detail) {
            const errorMsg = typeof result.detail === 'string' ? result.detail : 'Validation Error: Check your inputs.';
            throw new Error(errorMsg);
        }

        await fetchInventoryData(); // Refresh grid in background
        showSuccessModal('Success!', 'Item added successfully.');
    } catch (error) {
        showErrorModal('Error', error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Add Item';
    }
}

function openModal() {
    const container = document.getElementById('modal-container');
    if (!container) return;

    container.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div class="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between px-8 py-6 border-b border-gray-100">
                    <div>
                        <h2 class="text-xl font-bold text-gray-900 tracking-tight">Add New Product</h2>
                        <p class="text-sm text-gray-500">Enter the details for the new inventory item.</p>
                    </div>
                    <button onclick="closeInventoryModal()" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <i data-lucide="x" class="w-6 h-6 text-gray-400"></i>
                    </button>
                </div>
                <form id="inventoryModalForm" class="p-8 space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="md:col-span-2">
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Item Name</label>
                            <input name="name" type="text" required placeholder="e.g. Men's Polo Barong" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10 outline-none transition-all" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Category</label>
                            <select name="category" required class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#800000]">
                                <option value="Uniforms">Uniforms</option>
                                <option value="PE Uniforms">PE Uniforms</option>
                                <option value="Accessories">Accessories</option>
                                <option value="Merchandise">Merchandise</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Size</label>
                            <select name="size" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#800000]">
                                <option value="N/A">Not Applicable</option>
                                <option value="XS">Extra Small</option>
                                <option value="S">Small</option>
                                <option value="M">Medium</option>
                                <option value="L">Large</option>
                                <option value="XL">Extra Large</option>
                                <option value="2XL">Double XL</option>
                                <option value="3XL">Triple XL</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Price (₱)</label>
                            <input name="price" type="number" step="0.01" required placeholder="0.00" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#800000]" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Initial Quantity</label>
                            <input name="stock" type="number" required placeholder="0" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#800000]" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Alert Threshold</label>
                            <input name="threshold" type="number" required value="10" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#800000]" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Product Photo</label>
                            <input name="photo" type="file" accept="image/*" class="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#800000]/10 file:text-[#800000] hover:file:bg-[#800000]/20 cursor-pointer" />
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                        <button type="button" onclick="closeInventoryModal()" class="px-6 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                        <button type="submit" class="bg-[#800000] text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-[#600000] shadow-lg shadow-[#800000]/20 transition-all active:scale-95">Add Item</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
    document.getElementById('inventoryModalForm').addEventListener('submit', submitNewInventoryItem);
}

function openEditModal(itemId) {
    const item = inventoryCache.find(i => i.item_id === itemId);
    if (!item) return showErrorModal('Error', 'Inventory item not found.');

    const container = document.getElementById('modal-container');
    if (!container) return;

    container.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div class="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-center justify-between px-8 py-6 border-b border-gray-100">
                    <div>
                        <h2 class="text-xl font-bold text-gray-900 tracking-tight">Edit Item</h2>
                        <p class="text-sm text-gray-500">Update the product details below.</p>
                    </div>
                    <button onclick="closeInventoryModal()" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <i data-lucide="x" class="w-6 h-6 text-gray-400"></i>
                    </button>
                </div>
                <form id="inventoryEditForm" class="p-8 space-y-6">
                    <input type="hidden" name="item_id" value="${item.item_id}" />
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="md:col-span-2">
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Item Name</label>
                            <input name="item_name" type="text" required value="${item.item_name}" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10 outline-none" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Category</label>
                            <select name="category" required class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#800000]">
                                <option value="Uniforms" ${item.category === 'Uniforms' ? 'selected' : ''}>Uniforms</option>
                                <option value="PE Uniforms" ${item.category === 'PE Uniforms' ? 'selected' : ''}>PE Uniforms</option>
                                <option value="Accessories" ${item.category === 'Accessories' ? 'selected' : ''}>Accessories</option>
                                <option value="Merchandise" ${item.category === 'Merchandise' ? 'selected' : ''}>Merchandise</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Size</label>
                            <select name="size" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#800000]">
                                ${['N/A','XS','S','M','L','XL','2XL','3XL'].map(size => `<option value="${size}" ${item.size === size ? 'selected' : ''}>${size}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Price (₱)</label>
                            <input name="price" type="number" step="0.01" required value="${item.price}" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#800000]" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Quantity</label>
                            <input name="stock_quantity" type="number" required value="${item.stock_quantity}" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#800000]" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Alert Threshold</label>
                            <input name="low_stock_threshold" type="number" required value="${item.low_stock_threshold}" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#800000]" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Update Photo (Leave blank to keep current)</label>
                            <input name="photo" type="file" accept="image/*" class="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#800000]/10 file:text-[#800000] hover:file:bg-[#800000]/20 cursor-pointer" />
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                        <button type="button" onclick="closeInventoryModal()" class="px-6 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all">Cancel</button>
                        <button type="submit" class="bg-[#800000] text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-[#600000] shadow-lg shadow-[#800000]/20 transition-all active:scale-95">Update Item</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
    document.getElementById('inventoryEditForm').addEventListener('submit', submitEditInventoryItem);
}

function editItem(itemId) {
    openEditModal(itemId);
}

async function submitEditInventoryItem(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const btn = event.submitter;
    const formData = new FormData(form);
    const itemId = formData.get('item_id');
    formData.delete('item_id');

    // FIX: THE EDIT IMAGE BUG
    // If the user didn't pick an image, the file size is 0. 
    // We completely delete 'photo' from formData so the backend doesn't overwrite it.
    const photoFile = formData.get('photo');
    if (photoFile && photoFile.size === 0) {
        formData.delete('photo');
    }

    try {
        btn.disabled = true;
        btn.innerHTML = 'Updating...';

        const result = await apiFetch(`/api/items/${itemId}`, {
            method: 'PUT',
            body: formData
        });
        
        if (result.detail) {
            const errorMsg = typeof result.detail === 'string' ? result.detail : 'Failed to update item';
            throw new Error(errorMsg);
        }

        await fetchInventoryData(); // Refresh grid in background
        showSuccessModal('Updated', 'Item details have been saved.');
    } catch (error) {
        showErrorModal('Error', error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Update Item';
    }
}

function deleteItem(itemId) {
    const container = document.getElementById('modal-container');
    if (!container) return;

    container.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div class="p-8 text-center">
                    <i data-lucide="trash-2" class="w-12 h-12 mx-auto text-red-600 mb-4"></i>
                    <h2 class="text-xl font-bold text-gray-900 mb-2">Delete Item?</h2>
                    <p class="text-sm text-gray-500 mb-6">This will remove the item from inventory permanently.</p>
                    <div class="flex gap-3 justify-center">
                        <button onclick="closeInventoryModal()" class="px-5 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                        <button onclick="confirmDeleteItem(${itemId})" class="px-5 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

async function confirmDeleteItem(itemId) {
    try {
        const result = await apiFetch(`/api/items/${itemId}`, { method: 'DELETE' });
        
        if (result.detail) {
            throw new Error(typeof result.detail === 'string' ? result.detail : 'Failed to delete item');
        }

        await fetchInventoryData(); // Refresh grid in background
        showSuccessModal('Deleted', 'Item removed from inventory.');
    } catch (error) {
        showErrorModal('Error', error.message);
    }
}

function closeInventoryModal() {
    document.getElementById('modal-container').innerHTML = '';
}