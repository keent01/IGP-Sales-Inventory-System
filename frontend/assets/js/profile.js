document.addEventListener('DOMContentLoaded', () => {
    loadHeader();
    loadSidebar();
    loadProfileData();
    if (window.lucide) lucide.createIcons();
});

function loadProfileData() {
    // 1. Pull data from browser storage
    const userStr = localStorage.getItem('user');
    console.log("Profile Data Found:", userStr); // Check your browser console (F12) to see this!

    if (!userStr) {
        // Not logged in! Redirect to login page
        window.location.href = 'index.html'; 
        return;
    }

    const user = JSON.parse(userStr);

    // 2. Populate the input fields
    // We check both full_name and name just to be safe
    const nameField = document.getElementById('profileName');
    const emailField = document.getElementById('profileEmail');
    const roleField = document.getElementById('profileRole');

    if (nameField) nameField.value = user.full_name || user.name || '';
    if (emailField) emailField.value = user.email || '';
    if (roleField) roleField.value = user.role || '';

    // 3. Update the "Last Login" text (Optional, just makes it look alive)
    const lastLoginDisplay = document.getElementById('lastLoginDisplay');
    if (lastLoginDisplay) {
        // If you don't track this yet, it just shows today's date
        lastLoginDisplay.innerText = new Date().toLocaleString();
    }
}

// --- HANDLE PROFILE NAME UPDATE ---
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSaveProfile');
    const newName = document.getElementById('profileName').value.trim();

    try {
        btn.disabled = true;
        btn.innerText = "Updating...";

        // Call the API to update the database
        await apiFetch('/api/users/me', {
            method: 'PUT',
            body: JSON.stringify({ full_name: newName })
        });

        // Update local storage so the UI knows about the new name immediately
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.full_name = newName;
        localStorage.setItem('user', JSON.stringify(user));

        showResponseModal("Success", "Your profile name has been updated.", "success");
        
        // Refresh the page after 1.5 seconds to update the header
        setTimeout(() => window.location.reload(), 1500);
        
    } catch (error) {
        showResponseModal("Update Failed", error.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Update Name";
    }
});

// --- HANDLE PASSWORD CHANGE ---
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSavePassword');
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Strict Password Validation (Section 6.2)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!passwordRegex.test(newPassword)) {
        showResponseModal(
            "Weak Password", 
            "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.", 
            "error"
        );
        return;
    }

    if (newPassword !== confirmPassword) {
        showResponseModal("Passwords Mismatch", "Your new password and confirmation do not match.", "error");
        return;
    }

    try {
        btn.disabled = true;
        btn.innerText = "Updating...";

        await apiFetch('/api/users/change-password', {
            method: 'POST',
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        showResponseModal("Password Updated", "Your password has been changed successfully. Please use it next time you log in.", "success");
        document.getElementById('passwordForm').reset();
        
    } catch (error) {
        showResponseModal("Update Failed", error.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Update Password";
    }
});