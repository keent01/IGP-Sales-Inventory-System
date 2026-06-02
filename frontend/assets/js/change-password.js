document.addEventListener('DOMContentLoaded', initChangePassword);

async function initChangePassword() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('index.html');
        return;
    }

    // 1. Check if the backend flagged this as a forced change
    const isFirstLogin = localStorage.getItem('force_password_change') === 'true';

    // 2. Hide the "Current Password" input completely if it is a first-time login
    if (isFirstLogin) {
        const currentPasswordInput = document.getElementById('currentPassword');
        if (currentPasswordInput) {
            currentPasswordInput.removeAttribute('required'); 
            // Hides the parent wrapper div so the label disappears too
            if (currentPasswordInput.parentElement) {
                currentPasswordInput.parentElement.style.display = 'none';
            }
        }
    }

    try {
        if (typeof AuthService !== 'undefined' && AuthService.getCurrentUser) {
            await AuthService.getCurrentUser();
        }
    } catch (error) {
        console.error("AuthService validation failed:", error);
        localStorage.clear();
        window.location.replace('index.html');
        return;
    }

    const form = document.getElementById('changePasswordForm');
    if (form) {
        form.addEventListener('submit', handleChangePassword);
    }
}

async function handleChangePassword(event) {
    event.preventDefault();
    
    const isFirstLogin = localStorage.getItem('force_password_change') === 'true';

    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    // 1. Existing check: Do passwords match?
    if (newPassword !== confirmPassword) {
        showAlert('New passwords do not match.', 'error');
        return;
    }

    // 2. Password Complexity Validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        showAlert('Password must be at least 8 characters, with 1 uppercase, 1 lowercase, 1 number, and 1 special character.', 'error');
        return;
    }

    const changePasswordBtn = document.getElementById('changePasswordBtn');
    try {
        if (changePasswordBtn) changePasswordBtn.disabled = true;

        // 3. Build payload dynamically
        const payload = { new_password: newPassword };
        
        // 4. ONLY attach the current_password if they are doing a normal change
        if (!isFirstLogin) {
            const currentPasswordInput = document.getElementById('currentPassword');
            if (currentPasswordInput) {
                const currentPasswordValue = currentPasswordInput.value.trim();
                if (!currentPasswordValue) {
                    showAlert('Please enter your current password.', 'error');
                    return;
                }
                payload.current_password = currentPasswordValue;
            }
        }

        // 5. Clean fetch call
        const response = await fetch('https://igp-sales-inventory-system-production.up.railway.app/api/users/change-password', {
            method: 'PUT', // Change to 'POST' if your Python backend uses @router.post
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });

        let result = {};
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            result = await response.json();
        } else {
            throw new Error('Server did not return JSON. Verify your FastAPI backend is running properly.');
        }

        if (!response.ok) {
            if (response.status === 422) console.error("Schema Details:", result.detail);
            throw new Error(result.detail || 'Failed to change password');
        }

        showAlert(result.message || "Password updated successfully!", 'success');

        // 6. Clean up tracking flags and redirect
        localStorage.removeItem('force_password_change');
        
        setTimeout(() => {
            window.location.replace('dashboard.html');
        }, 1200);
        
    } catch (error) {
        showAlert(error.message || 'Unable to update password. Please try again.', 'error');
    } finally {
        if (changePasswordBtn) changePasswordBtn.disabled = false;
    }
}

function showAlert(message, type = 'error') {
    const alertDiv = document.getElementById('alertMessage');
    if (!alertDiv) return;

    alertDiv.innerText = message;
    alertDiv.className = `p-3 rounded-lg border text-sm mb-4 transition-all ${
        type === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-green-50 text-green-700 border-green-200'
    }`;
}