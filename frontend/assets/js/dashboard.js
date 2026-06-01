// assets/js/dashboard.js
// Run this check immediately to prevent unauthorized cache viewing
(function() {
    function checkAuthentication() {
        const token = localStorage.getItem('token');
        if (!token) {
            // Kick them straight back to login if token is missing
            window.location.replace('index.html');
        }
    }

    // Run on initial load
    checkAuthentication();

    // Run specifically when coming backward or forward out of browser cache
    window.addEventListener('pageshow', function(event) {
        // event.persisted is true if the page was restored from cache
        if (event.persisted || !localStorage.getItem('token')) {
            checkAuthentication();
        }
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    // Set Date once
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDateDisplay').innerText = new Date().toLocaleDateString('en-PH', options);

    initDashboard();
    fetchTodayBestSeller();
});

async function initDashboard() {
    try {
        // Parallel fetching for better performance
        const [stats, sales] = await Promise.all([
            apiFetch('/api/dashboard/stats'),
            apiFetch('/api/dashboard/recent-sales')
        ]);

        renderStats(stats);
        renderRecentSales(sales);
        fetchInventorySummary(sales);
        
    } catch (error) {
        console.error("Dashboard failed to load:", error);
    }
}

function renderStats(data) {
    document.getElementById('todaySales').innerText = data.todaySales;
    document.getElementById('totalItemsSold').innerText = data.totalItemsSold;
    document.getElementById('lowStockCount').innerText = data.lowStock;
    
    if (data.lowStock > 0) {
        document.getElementById('lowStockCount').parentElement.classList.add('bg-red-50/50', 'border-red-100');
    }
}

function renderRecentSales(sales) {
    const table = document.getElementById('recentSalesTable');
    table.innerHTML = sales.map(sale => `
        <tr class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 text-gray-400 text-sm">${new Date(sale.sale_date).toLocaleDateString()}</td>
            <td class="px-6 py-4 font-medium text-gray-800">${sale.or_number}</td>
            <td class="px-6 py-4 font-bold text-gray-900">${sale.total_amount}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">Paid</span>
            </td>
        </tr>
    `).join('');
}

async function fetchInventorySummary() {
    const summaryContainer = document.getElementById('categorySummary');
    try {
        // Use the centralized apiFetch helper
        const items = await apiFetch('/api/dashboard/inventory-summary');

        // Check if there are any items to display
        if (!items || items.length === 0) {
            summaryContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-6 text-center">
                    <div class="p-3 bg-green-50 text-green-600 rounded-full mb-2">
                        <i data-lucide="check-circle" class="w-6 h-6"></i>
                    </div>
                    <p class="text-xs font-medium text-gray-500">All items are sufficiently stocked!</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        summaryContainer.innerHTML = items.map(item => {
            const colors = {
                red: { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' },
                amber: { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-100' }
            };
            const theme = colors[item.color] || colors.amber;

            return `
                <div class="group border-b border-gray-50 pb-3 last:border-0">
                    <div class="flex justify-between items-center mb-2">
                        <div>
                            <p class="text-sm font-semibold text-gray-700">${item.name}</p>
                            <span class="text-[9px] font-black px-2 py-0.5 rounded ${theme.bg} ${theme.text} uppercase tracking-tighter">
                                ${item.status}
                            </span>
                        </div>
                        <p class="text-sm font-bold text-gray-900">${item.quantity}</p>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-1.5">
                        <div class="${theme.bar} h-1.5 rounded-full transition-all duration-700" 
                             style="width: ${item.percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Inventory Summary Error:", error);
        summaryContainer.innerHTML = '<p class="text-xs text-red-500">Failed to load summary.</p>';
    }
}

async function fetchTodayBestSeller() {
    const today = new Date().toISOString().split('T')[0];
    const url = `/api/reports/analytics?start_date=${today}&end_date=${today}`;
    
    try {
        const response = await apiFetch(url); 

        const nameEl = document.getElementById('dashTopItemName');
        const qtyEl = document.getElementById('dashTopItemQty');

        if (response.top_products && response.top_products.length > 0) {
            const bestSeller = response.top_products[0];
            if (nameEl) nameEl.innerText = bestSeller.item_name;
            if (qtyEl)  qtyEl.innerText = `${bestSeller.quantity.toLocaleString()} sold today`;
        } else {
            if (nameEl) nameEl.innerText = "No sales yet";
            if (qtyEl)  qtyEl.innerText = "0 sold today";
        }
    } catch (err) {
        console.error("Failed to load top item:", err);
    }
}