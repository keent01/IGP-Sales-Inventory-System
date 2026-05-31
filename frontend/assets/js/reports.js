// assets/js/reports.js
let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    // Set Print Date
    const printDateEl = document.getElementById('printDate');
    if (printDateEl) printDateEl.innerText = new Date().toLocaleString();

    // Grab the new elements from your HTML
    const presetSelect = document.getElementById('reportDatePreset');
    const fromInput = document.getElementById('reportDateFrom');
    const toInput = document.getElementById('reportDateTo');
    const generateBtn = document.getElementById('generateReportBtn');

    if (presetSelect) {
        // Auto-calculate dates based on the dropdown
        updateDateInputsFromPreset();
        
        // Listen to changes instantly
        presetSelect.addEventListener('change', () => {
            updateDateInputsFromPreset();
            loadAnalytics();
        });
    }

    if (fromInput) fromInput.addEventListener('change', loadAnalytics);
    if (toInput) toInput.addEventListener('change', loadAnalytics);

    // Make Generate Button trigger PDF Print dialog
    if (generateBtn) {
        generateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.print();
        });
    }

    // Auto-fetch data on load
    loadAnalytics();
});

// Helper function to format dates as YYYY-MM-DD
function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Automatically fills the date inputs based on the selected Preset
function updateDateInputsFromPreset() {
    const presetSelect = document.getElementById('reportDatePreset');
    const fromInput = document.getElementById('reportDateFrom');
    const toInput = document.getElementById('reportDateTo');

    if (!presetSelect || !fromInput || !toInput) return;

    const preset = presetSelect.value;
    const now = new Date();

    if (preset === 'custom') {
        fromInput.readOnly = false;
        toInput.readOnly = false;
        fromInput.classList.remove('opacity-60', 'cursor-not-allowed');
        toInput.classList.remove('opacity-60', 'cursor-not-allowed');
        return;
    }

    fromInput.readOnly = true;
    toInput.readOnly = true;
    fromInput.classList.add('opacity-60', 'cursor-not-allowed');
    toInput.classList.add('opacity-60', 'cursor-not-allowed');

    let startDate, endDate;

    if (preset === 'all_time') {
        fromInput.value = '';
        toInput.value = '';
        return;
    } else if (preset === 'today') {
        startDate = now;
        endDate = now;
    } else if (preset === 'this_week') {
        const currentDay = now.getDay();
        const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - distanceToMonday);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        startDate = monday;
        endDate = sunday;
    } else if (preset === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    fromInput.value = formatDate(startDate);
    toInput.value = formatDate(endDate);
}

async function loadAnalytics() {
    const fromInput = document.getElementById('reportDateFrom');
    const toInput = document.getElementById('reportDateTo');

    const start_date = fromInput ? fromInput.value : '';
    const end_date = toInput ? toInput.value : '';

    let url = '/api/reports/analytics';
    if (start_date && end_date) {
        url += `?start_date=${start_date}&end_date=${end_date}`;
    }
    
    try {
        const data = await apiFetch(url);
        
        let divisor = 30; 
        if (start_date && end_date) {
            const d1 = new Date(start_date);
            const d2 = new Date(end_date);
            const diffTime = Math.abs(d2 - d1);
            divisor = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        } else if (data.daily_breakdown && data.daily_breakdown.length > 0) {
            divisor = data.daily_breakdown.length;
        }
        
        const totalRevEl = document.getElementById('totalRev');
        const itemsSoldEl = document.getElementById('itemsSold');
        const dailyAvgEl = document.getElementById('dailyAvg');

        if (totalRevEl) totalRevEl.innerText = `₱${data.gross_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        if (itemsSoldEl) itemsSoldEl.innerText = data.items_sold;
        
        const topItemNameEl = document.getElementById('topItemName');
        const topItemQtyEl = document.getElementById('topItemQty');
        const topItemRevEl = document.getElementById('topItemRev');

        if (data.top_products && data.top_products.length > 0) {
            const bestSeller = data.top_products[0];
            
            if (topItemNameEl) topItemNameEl.innerText = bestSeller.item_name;
            if (topItemQtyEl)  topItemQtyEl.innerText = `${bestSeller.quantity.toLocaleString()} sold`;
            if (topItemRevEl)  topItemRevEl.innerText = `₱${bestSeller.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
        } else {
            // Clean Fallback States
            if (topItemNameEl) topItemNameEl.innerText = "---";
            if (topItemQtyEl)  topItemQtyEl.innerText = "0 sold";
            if (topItemRevEl)  topItemRevEl.innerText = "₱0.00";
        }
        
        const dailyAvg = data.items_sold > 0 ? data.gross_revenue / divisor : 0;
        if (dailyAvgEl) dailyAvgEl.innerText = `₱${dailyAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        
        renderCharts(data);
        renderProductTable(data.top_products || []);
        renderDailySalesTable(data.daily_breakdown || []);

    } catch (err) {
        console.error("Failed to load analytics data:", err);
        const pTable = document.getElementById('topProductsTable');
        const sTable = document.getElementById('dailySalesTable');
        if (pTable) pTable.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-500">Failed to load data</td></tr>';
        if (sTable) sTable.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-500">Failed to load data</td></tr>';
    }
}

function renderProductTable(products) {
    const tbody = document.getElementById('topProductsTable');
    if (!tbody) return;
    
    if (!products || products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">No data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(p => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-8 py-4 font-bold text-gray-800">${p.item_name}</td>
            <td class="px-8 py-4 text-gray-500">${p.category}</td>
            <td class="px-8 py-4 text-center font-bold">${p.quantity}</td>
            <td class="px-8 py-4 text-right font-black text-[#800000]">₱${p.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
        </tr>
    `).join('');
}

function renderDailySalesTable(dailyData) {
    const tbody = document.getElementById('dailySalesTable');
    if (!tbody) return;
    
    if (!dailyData || dailyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">No data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = dailyData.map(day => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-8 py-4 font-bold text-gray-800">${new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            <td class="px-8 py-4 text-center font-bold">${day.orders}</td>
            <td class="px-8 py-4 text-center font-bold">${day.items_sold}</td>
            <td class="px-8 py-4 text-right font-black text-[#800000]">₱${day.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
        </tr>
    `).join('');
}

function renderCharts(data) {
    const chartEl = document.getElementById('categoryChart');
    if (!chartEl) return;

    if (charts.dist) charts.dist.destroy();
    
    const distLabels = Object.keys(data.distribution || {});
    const distValues = Object.values(data.distribution || {});
    const colors = ['#800000', '#2D3748', '#4A5568', '#718096', '#A0AEC0', '#CBD5E0'];
    
    charts.dist = new Chart(chartEl, {
        type: 'doughnut',
        data: {
            labels: distLabels,
            datasets: [{
                data: distValues,
                backgroundColor: colors.slice(0, distLabels.length),
                borderWidth: 0
            }]
        },
        options: {
            cutout: '70%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
    
    renderCategoryLegend(distLabels, colors);
    if (window.lucide) window.lucide.createIcons();
}

function renderCategoryLegend(labels, colors) {
    const legendDiv = document.getElementById('categoryLegend');
    if (!legendDiv) return;
    
    legendDiv.innerHTML = labels.map((label, idx) => `
        <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full" style="background-color: ${colors[idx]}"></div>
            <span class="text-sm text-gray-700">${label}</span>
        </div>
    `).join('');
}