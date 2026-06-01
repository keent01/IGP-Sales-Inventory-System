// assets/js/api.js
const API_URL = 'https://igp-sales-inventory-system-production.up.railway.app';

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const defaultHeaders = {
        'Content-Type': 'application/json'
    };

    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    // If we are sending FormData (like a Photo), browser sets Content-Type automatically
    if (options.body instanceof FormData) {
        delete defaultHeaders['Content-Type'];
    }

    let response;
    try {
        response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        });
    } catch (error) {
        throw new Error('Unable to reach server. Please check your network connection.');
    }

    const text = await response.text();
    let data = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            data = { detail: text };
        }
    }

    if (response.status === 401) {
        if (endpoint !== '/api/token') {
            // Token expired or invalid -> force logout and redirect to index
            localStorage.clear();
            window.location.href = 'index.html';
            return;
        }
        throw new Error(data.detail || 'Invalid Username or Password');
    }

    if (!response.ok) throw new Error(data.detail || 'Request failed');
    return data;
}

const AuthService = {
    async login(email, password) {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const data = await apiFetch('/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        localStorage.setItem('token', data.access_token);
        return data;
    },

    async getCurrentUser() {
        return await apiFetch('/api/users/me');
    },

    logout() {
        localStorage.clear();
        window.location.href = 'index.html';
    }
};

function getUserRole() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role || 'Staff';
}

function userIsAdmin() {
    return getUserRole() === 'Admin';
}

// assets/js/api.js (Add this at the bottom)

const DataService = {
    /**
     * Reusable Client-Side Filter
     * @param {Array} data - The raw array from the API
     * @param {Object} criteria - { search: 'text', category: 'Uniform', program: 'BSIT' }
     * @returns {Array} - The filtered results
     */
    filterLocal(data, criteria) {
        return data.filter(item => {
            const matchesSearch = !criteria.search || 
                Object.values(item).some(val => 
                    String(val).toLowerCase().includes(criteria.search.toLowerCase())
                );
            
            const matchesCategory = !criteria.category || item.category === criteria.category;
            const matchesProgram = !criteria.program || item.program === criteria.program;
            
            // For Inventory: don't show deleted items
            const isNotDeleted = item.is_deleted !== 1;

            return matchesSearch && matchesCategory && matchesProgram && isNotDeleted;
        });
    },

    /**
     * Reusable Server-Side Filter Helper
     * Converts a filter object into a URL Query String
     */
    buildQuery(filters) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });
        return params.toString();
    }
};

function syncUserHeader() {
    const userData = localStorage.getItem('user');
    const isLoginPage = window.location.pathname.includes('index.html') || window.location.pathname === '/';
    
    // If no user is found AND we are NOT already on the login page, then redirect
    if (!userData) {
        if (!isLoginPage) {
            window.location.href = 'index.html';
        }
        return;
    }

    // If we reach here, we have a user
    const user = JSON.parse(userData);

    // If a logged-in user tries to go to the login page, send them to dashboard
    if (isLoginPage) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Update UI elements
    const nameEl = document.getElementById('navUserName');
    if (nameEl) nameEl.innerText = user.full_name || user.username || "User";

    const roleEl = document.getElementById('navUserRole');
    if (roleEl) {
        roleEl.innerText = user.role;
        roleEl.className = user.role === 'Admin' 
            ? "text-[10px] font-black bg-red-100 text-[#800000] px-2 py-0.5 rounded-full uppercase"
            : "text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase";
    }

    // Update Initials Avatar
    const initialEl = document.getElementById('userInitials');
    if (initialEl && user.full_name) {
        initialEl.innerText = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
}