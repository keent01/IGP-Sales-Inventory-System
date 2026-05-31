document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'Admin') {
        window.location.href = 'transactions.html';
        return;
    }
    loadUsers();
});

async function loadUsers() {
    updateTableLoadingState(true);
    
    try {
        const users = await apiFetch('/api/users/');
        loadedUsers = users; // Store them globally for instant editing
        renderUserTable(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        const tbody = document.getElementById('userTableBody');
        tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-red-500 font-bold">Failed to load users. Please try again.</td></tr>`;
    } finally {
        updateTableLoadingState(false);
    }
}

function renderUserTable(users) {
    const tbody = document.getElementById('userTableBody');

    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-20 text-center text-gray-400 italic">No users found in the system.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr class="hover:bg-gray-50 border-b border-gray-50 transition-colors group">
            <td class="px-8 py-5">
                <div class="font-bold text-gray-800">${user.full_name}</div>
            </td>
            <td class="px-8 py-5 text-gray-500">
                ${user.email}
            </td>
            <td class="px-8 py-5">
                <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                    user.role === 'Admin' 
                    ? 'bg-red-50 text-[#800000] border border-red-100' 
                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                }">
                    ${user.role}
                </span>
            </td>
            <td class="px-8 py-5 text-center">
                <div class="flex items-center justify-center gap-2">
                    <span class="w-2 h-2 rounded-full ${user.is_deleted ? 'bg-red-300' : 'bg-green-500'}"></span>
                    <span class="text-xs font-medium ${user.is_deleted ? 'text-red-400' : 'text-green-700'}">
                        ${user.is_deleted ? 'Inactive' : 'Active'}
                    </span>
                </div>
            </td>
            <td class="px-8 py-5 text-right space-x-2">
                <button onclick="editUser(${user.user_id})" class="text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-all" title="Edit User">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                <button onclick="deleteUser(${user.user_id}, '${user.full_name}')" class="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all" title="Delete/Deactivate">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

function updateTableLoadingState(isLoading) {
    const tbody = document.getElementById('userTableBody');
    if (isLoading) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-20 text-center">
                    <div class="flex flex-col items-center gap-3">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[#800000]"></div>
                        <span class="text-xs text-gray-400 font-medium">Fetching accounts...</span>
                    </div>
                </td>
            </tr>`;
    }
}


document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const email = document.getElementById('userEmail').value.trim();

    // Only check email formatting if we are adding a new user
    if (!currentEditUserId && (!email.toLowerCase().endsWith('@evsu.edu.ph'))) {
        showResponseModal("Invalid Email", "Please use an @evsu.edu.ph email address.", "error");
        return;
    }

    const payload = {
        full_name: document.getElementById('userName').value,
        email: email,
        role: document.getElementById('userRole').value
    };

    try {
        submitBtn.disabled = true;
        
        if (currentEditUserId) {
            // EDIT EXISTING USER
            await apiFetch(`/api/users/${currentEditUserId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            showResponseModal("Success", "User account updated.", "success");
            closeUserModal();
        } else {
            // ADD NEW USER
            const result = await apiFetch('/api/users/register', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            document.getElementById('otpSuccess').classList.remove('hidden');
            document.getElementById('otpNote').innerText = result.email_sent
                ? 'A temporary password has been emailed to the new user.'
                : 'Email delivery is not configured. Notify the user to request a password reset.';
            document.getElementById('userForm').classList.add('opacity-50', 'pointer-events-none');
        }

        loadUsers(); 
    } catch (err) {
        showResponseModal("Error", err.message, "error");
    } finally {
        submitBtn.disabled = false;
    }
});

let currentEditUserId = null; // Tracks if we are editing or adding

function openUserModal(isEdit = false) {
    document.getElementById('userModal').classList.remove('hidden');
    document.getElementById('otpSuccess').classList.add('hidden');
    document.getElementById('userForm').classList.remove('opacity-50', 'pointer-events-none');
    
    const modalTitle = document.querySelector('#userModal h3');
    const submitBtn = document.getElementById('submitBtn');
    const emailInput = document.getElementById('userEmail');

    if (!isEdit) {
        // ADD MODE
        currentEditUserId = null;
        document.getElementById('userForm').reset();
        modalTitle.innerText = "Add New User";
        submitBtn.innerText = "Save Account";
        emailInput.disabled = false; // Email can be typed
        emailInput.classList.remove('bg-gray-200', 'text-gray-500');
    } else {
        // EDIT MODE
        modalTitle.innerText = "Edit User";
        submitBtn.innerText = "Update Account";
        emailInput.disabled = true; // Prevent changing email to avoid login issues
        emailInput.classList.add('bg-gray-200', 'text-gray-500');
    }
}

function closeUserModal() {
    document.getElementById('userModal').classList.add('hidden');
    currentEditUserId = null;
}

// --- EDIT LOGIC ---
function editUser(userId) {
    // 2. Fetch directly from memory instead of the API
    const user = loadedUsers.find(u => u.user_id === userId);
    
    if (!user) {
        showResponseModal("Error", "Could not load user details.", "error");
        return;
    }

    currentEditUserId = userId;
    document.getElementById('userName').value = user.full_name;
    document.getElementById('userEmail').value = user.email;
    document.getElementById('userRole').value = user.role;

    openUserModal(true); 
}

// --- DELETE LOGIC ---
function deleteUser(userId, userName) {
    userToDeleteId = userId;
    
    // Set text and show modal
    document.getElementById('deleteModalSubtitle').innerText = userName;
    document.getElementById('deleteUserModal').classList.remove('hidden');
    
    // Attach event to the confirm button
    document.getElementById('btnConfirmDelete').onclick = executeDelete;
    
    if (window.lucide) lucide.createIcons();
}

function closeDeleteModal() {
    document.getElementById('deleteUserModal').classList.add('hidden');
    userToDeleteId = null;
}

async function executeDelete() {
    try {
        await apiFetch(`/api/users/${userToDeleteId}`, { method: 'DELETE' });
        
        closeDeleteModal();
        showResponseModal("User Deactivated", "Account has been successfully removed.", "success");
        loadUsers();
    } catch (error) {
        closeDeleteModal();
        showResponseModal("Action Failed", error.message, "error");
    }
}