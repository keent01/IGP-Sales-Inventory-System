// This is your existing fetch call to the backend
const response = await apiFetch('/api/users/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
});

const result = await response.json();

if (response.ok) {
    // BACKEND SUCCESS! Now trigger the email via EmailJS
    emailjs.send("service_yd9wo1u", "template_r2ozgi6", {
        to_email: payload.email,
        to_name: payload.full_name,
        temporary_password: result.temporary_password // Make sure your backend returns this!
    })
    .then(() => {
        console.log("Welcome email sent successfully!");
        alert("User created and password emailed successfully!");
        // Close modal and refresh table here
    })
    .catch((error) => {
        console.error("EmailJS Failed:", error);
        alert("User created, but failed to send email.");
    });
} else {
    // Handle backend errors (e.g., email already exists)
    alert(result.detail || "Failed to create user.");
}

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'Admin') {
        window.location.href = 'transactions.html';
        return;
    }
    loadUsers();
});

let loadedUsers = []; // Store them globally for instant editing
let userToDeleteId = null; // Tracks user ID for deletion

async function loadUsers() {
    updateTableLoadingState(true);
    
    try {
        const users = await apiFetch('/api/users/');
        loadedUsers = users; 
        renderUserTable(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        const tbody = document.getElementById('userTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-10 text-center text-red-500 font-bold">Failed to load users. Please try again.</td></tr>`;
        }
    } finally {
        updateTableLoadingState(false);
    }
}

function renderUserTable(users) {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

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
    if (!tbody) return;
    
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
            
            const otpSuccessEl = document.getElementById('otpSuccess');
            const otpNoteEl = document.getElementById('otpNote');
            
            if (otpSuccessEl) otpSuccessEl.classList.remove('hidden');
            if (otpNoteEl) {
                // --- THIS IS THE NEW PART THAT SHOWS THE PASSWORD ON SCREEN ---
                otpNoteEl.innerHTML = `
                    <div class="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 font-medium">
                        User account created successfully!<br>
                        <span class="text-xs text-gray-500 font-normal">Temporary Password:</span> 
                        <strong class="text-sm font-mono tracking-wider text-red-700 bg-white px-2 py-0.5 rounded border border-gray-200 select-all">${result.temporary_password}</strong>
                    </div>
                `;
            }
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
    
    const otpSuccessEl = document.getElementById('otpSuccess');
    if (otpSuccessEl) otpSuccessEl.classList.add('hidden');
    
    document.getElementById('userForm').classList.remove('opacity-50', 'pointer-events-none');
    
    // Smart selector fallback to find your exact heading tag
    const modalTitle = document.querySelector('#userModal h3') || 
                       document.querySelector('#userModal h2') || 
                       document.querySelector('#userModal h1') || 
                       document.querySelector('#userModal .modal-title') || 
                       document.getElementById('modalTitle');
                       
    const submitBtn = document.getElementById('submitBtn');
    const emailInput = document.getElementById('userEmail');

    if (!isEdit) {
        // ADD MODE
        currentEditUserId = null;
        document.getElementById('userForm').reset();
        if (modalTitle) modalTitle.innerText = "Add New User";
        if (submitBtn) submitBtn.innerText = "Save Account";
        if (emailInput) {
            emailInput.disabled = false;
            emailInput.classList.remove('bg-gray-200', 'text-gray-500');
        }

        const resetContainer = document.getElementById('resetPasswordContainer');
        if (resetContainer) resetContainer.classList.add('hidden');

    }  else {
        // EDIT MODE
        if (modalTitle) modalTitle.innerText = "Edit User";
        if (submitBtn) submitBtn.innerText = "Update Account";
        if (emailInput) {
            emailInput.disabled = true;
            emailInput.classList.add('bg-gray-200', 'text-gray-500');
        }
        // Show the reset password button when editing a user
        const resetContainer = document.getElementById('resetPasswordContainer');
        if (resetContainer) resetContainer.classList.remove('hidden');
    }
}


function closeUserModal() {
    document.getElementById('userModal').classList.add('hidden');
    currentEditUserId = null;
}

// --- EDIT LOGIC ---
function editUser(userId) {
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
    
    const subtitleEl = document.getElementById('deleteModalSubtitle');
    if (subtitleEl) subtitleEl.innerText = userName;
    
    document.getElementById('deleteUserModal').classList.remove('hidden');
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

// --- ADMIN RESET PASSWORD LOGIC ---
const adminResetPwdBtn = document.getElementById('adminResetPwdBtn');
if (adminResetPwdBtn) {
    adminResetPwdBtn.addEventListener('click', async () => {
        if (!currentEditUserId) return;
        
        // Optional: Confirm before resetting
        if (!confirm("Are you sure you want to generate a new password for this user? Their old password will immediately stop working.")) return;

        try {
            adminResetPwdBtn.disabled = true;
            adminResetPwdBtn.innerHTML = `<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-700"></div> Generating...`;

            const result = await apiFetch(`/api/users/${currentEditUserId}/reset-password`, {
                method: 'POST'
            });
            
            // Show the generated password on the modal
            const otpSuccessEl = document.getElementById('otpSuccess');
            const otpNoteEl = document.getElementById('otpNote');
            
            if (otpSuccessEl) otpSuccessEl.classList.remove('hidden');
            if (otpNoteEl) {
                otpNoteEl.innerHTML = `
                    <div class="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 font-medium">
                        Password Reset Successfully!<br>
                        <span class="text-xs text-gray-500 font-normal">New Temporary Password:</span> 
                        <strong class="text-sm font-mono tracking-wider text-red-700 bg-white px-2 py-0.5 rounded border border-gray-200 select-all">${result.temporary_password}</strong>
                    </div>
                `;
            }
            
            // Re-initialize lucide icons for the button
            if (window.lucide) lucide.createIcons();
            
        } catch (err) {
            showResponseModal("Error", err.message, "error");
        } finally {
            adminResetPwdBtn.disabled = false;
            adminResetPwdBtn.innerHTML = `<i data-lucide="key" class="w-4 h-4"></i> Generate New Password`;
            if (window.lucide) lucide.createIcons();
        }
    });
}