/**
 * assets/js/utils.js
 */
function showResponseModal(title, message, type = 'success') {
    const container = document.getElementById('modal-container');
    if (!container) {
        alert(`${title}\n\n${message}`); // Safe fallback
        return;
    }

    const themes = {
        success: { icon: 'check-circle', color: 'text-green-500', bg: 'bg-green-50', btn: 'bg-green-600' },
        error: { icon: 'alert-circle', color: 'text-red-500', bg: 'bg-red-50', btn: 'bg-red-600' },
        info: { icon: 'info', color: 'text-blue-500', bg: 'bg-blue-50', btn: 'bg-[#800000]' }
    };

    const theme = themes[type] || themes.info;

    // Inject the HTML
    container.innerHTML = `
        <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div class="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden transform animate-in zoom-in-95 duration-200">
                <div class="p-8 text-center">
                    <div class="mx-auto w-16 h-16 ${theme.bg} ${theme.color} rounded-full flex items-center justify-center mb-4">
                        <i data-lucide="${theme.icon}" class="w-10 h-10"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 mb-2">${title}</h3>
                    <p class="text-sm text-gray-500 mb-6">${message}</p>
                    
                    <button id="closeResponseBtn" class="w-full py-3 ${theme.btn} text-white rounded-xl font-bold hover:opacity-90 transition-all active:scale-95">
                        Continue
                    </button>

                </div>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();

    // Safely attach the click event
    const closeBtn = document.getElementById('closeResponseBtn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            container.innerHTML = ''; // Clear modal to close it
            
            // Auto-refresh data if successful
            if (type === 'success') {
                if (typeof loadHistoryPage === 'function') loadHistoryPage();
                if (typeof fetchInventoryData === 'function') fetchInventoryData();
            }
        };
    } else {
        console.error("Button 'closeResponseBtn' was not rendered!");
    }
}