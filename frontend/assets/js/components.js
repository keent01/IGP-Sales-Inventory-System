function loadSidebar() {
    // Get current page filename (e.g., "dashboard.html")
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

   const sidebarHTML = `
    <div class="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 flex-shrink-0 flex flex-col font-['Inter',_'Poppins',_sans-serif]">
        <div class="p-6 flex items-center gap-3 mb-4">
            <div class="p-1.5 bg-gray-50 rounded-lg border border-gray-100">
                <img src="./assets/images/evsulogo.png" alt="Logo" class="w-8 h-8 object-contain">
            </div>
            <div class="flex flex-col">
                <h1 class="text-xl font-bold text-gray-900 tracking-tight">EVSU-OC</h1>
                <span class="text-sm text-gray-500">IGP Management System</span>
            </div>
        </div>

        <nav id="nav-menu" class="flex-1 px-4 space-y-1"> 
            <p class="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Main Menu</p>
            ${createNavLink('dashboard.html', 'layout-dashboard', 'Dashboard', currentPage)}
            ${createNavLink('inventory.html', 'package', 'Inventory', currentPage)}
            ${createNavLink('transactions.html', 'receipt', 'Transactions', currentPage)}
            ${createNavLink('history.html', 'history', 'History', currentPage)}
            ${createNavLink('reports.html', 'bar-chart-3', 'Reports', currentPage)}
            
            ${userIsAdmin() ? `
            <div class="pt-4 mt-4 border-t border-gray-100">
                <p class="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Administration</p>
                ${createNavLink('users.html', 'users', 'User Management', currentPage)}
                ${createNavLink('audit-logs.html', 'logs', 'Audit Logs', currentPage)}
            </div>
            ` : ''}
        </nav>
    </div>`;

    function createNavLink(href, icon, label, currentPage) {
    const isActive = currentPage === href;
    
    // Active: Maroon background, White text
    // Inactive: White background, Maroon text, Maroon hover
    const baseClasses = "flex items-center px-4 py-2.5 rounded-xl transition-all duration-200 group font-medium";
    const activeClasses = "bg-[#800000] text-white shadow-md";
    const inactiveClasses = "text-[#800000] hover:bg-[#800000]/10";

    return `
        <a href="${href}" class="${baseClasses} ${isActive ? activeClasses : inactiveClasses}">
            <i data-lucide="${icon}" class="w-5 h-5 mr-3"></i>
            <span>${label}</span>
        </a>
    `;
}

    const container = document.getElementById('sidebar-container');
    if (container) {
        container.innerHTML = sidebarHTML;
        // Re-initialize Lucide icons after inserting HTML
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

// assets/js/components.js
// assets/js/components.js

async function loadHeader() {
    const container = document.getElementById('header-container');
    if (!container) return;

    try {
        const response = await fetch('components/header.html');
        const html = await response.text();
        container.innerHTML = html;

        // 1. Fill user details (from your existing api.js sync logic)
        syncUserHeader();

        // 2. Dropdown Toggle Logic
        const btn = document.getElementById('profileDropdownBtn');
        const menu = document.getElementById('profileDropdown');

        if (btn && menu) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('hidden');
            });

            // Close dropdown if clicking anywhere else
            document.addEventListener('click', () => {
                menu.classList.add('hidden');
            });
        }

        if (window.lucide) lucide.createIcons();
    } catch (error) {
        console.error("Header failed to load", error);
    }
}

// Call it on page load
loadHeader();
loadSidebar();

function handleLogout() {
    // 1. Clear all session items
    localStorage.clear(); 
    sessionStorage.clear();

    // 2. Overwrite history entry so back button fails
    window.location.replace('index.html');
}