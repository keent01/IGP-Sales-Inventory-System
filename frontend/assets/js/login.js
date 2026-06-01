// assets/js/login.js

/**
 * ====================================================================
 * STANDARD LOGIN FLOW
 * ====================================================================
 */

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        setLoading(true);

        const data = await AuthService.login(email, password);
        const userData = await AuthService.getCurrentUser();
        userData.isLoggedIn = true;
        localStorage.setItem('user', JSON.stringify(userData));

        if (data.force_password_change) {
            localStorage.setItem('force_password_change', 'true');
            window.location.href = 'change-password.html';
            return;
        }

        showAlert("Login Successful! Redirecting...", 'success');

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);

    } catch (error) {
        const message = error?.message || "Invalid Username or Password";
        const normalizedMessage = message.toLowerCase();

        if (normalizedMessage.includes('incorrect email') || normalizedMessage.includes('invalid username') || normalizedMessage.includes('invalid password')) {
            showAlert('Invalid Username or Password');
        } else if (normalizedMessage.includes('account locked')) {
            showAlert(message);
        } else if (normalizedMessage.includes('unable to reach server') || normalizedMessage.includes('network')) {
            showAlert('Server unavailable. Please try again later.');
        } else {
            showAlert(message);
        }

        setLoading(false);
    }
});

function setLoading(isLoading) {
    const loginBtn = document.getElementById('loginBtn');
    const btnText = document.getElementById('btnText');
    if (!loginBtn) return;

    loginBtn.disabled = isLoading;
    btnText.innerText = isLoading ? "Authenticating..." : "Log In";
}

// Global Alert helper for standard login
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

/**
 * Auto-Redirect if already logged in
 */
(function checkAuth() {
    if (localStorage.getItem('token') && localStorage.getItem('user')) {
        window.location.href = 'dashboard.html';
    }
})();


/**
 * ====================================================================
 * FORGOT PASSWORD / ONE-TIME PASSWORD (OTP) 2-STEP WIZARD FLOW
 * ====================================================================
 */

const modal = document.getElementById('forgotPasswordModal');
const step1 = document.getElementById('step1Container');
const step2 = document.getElementById('step2Container');
const alertBox = document.getElementById('modalAlert');
let userEmailForReset = "";

// --- Open the Modal ---
document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (modal) modal.classList.remove('hidden');
    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');
    
    hideModalAlert();
    
    // Reset inputs
    if (document.getElementById('recoveryEmail')) document.getElementById('recoveryEmail').value = '';
    if (document.getElementById('recoveryOtp')) document.getElementById('recoveryOtp').value = '';
    if (document.getElementById('recoveryNewPassword')) document.getElementById('recoveryNewPassword').value = '';
    if (document.getElementById('recoveryConfirmPassword')) document.getElementById('recoveryConfirmPassword').value = '';
});

// --- Close the Modal ---
document.getElementById('closeModalBtn')?.addEventListener('click', () => {
    if (modal) modal.classList.add('hidden');
});

// --- STEP 1: Send OTP Request ---
document.getElementById('sendOtpBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('recoveryEmail').value.trim();
    const btn = document.getElementById('sendOtpBtn');
    
    if (!email) {
        showModalAlert("Please enter a valid email address.", "error");
        return;
    }

    try {
        btn.disabled = true;
        btn.innerText = "Sending...";
        hideModalAlert();

        // FIX: Explicitly target Port 8000 to prevent 405 Method Not Allowed
        const response = await fetch('https://igp-sales-inventory-system-production.up.railway.app/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Failed to send OTP.");

        // Success! Move to Step 2
        userEmailForReset = email; // Save for step 2
        showModalAlert(result.message, "success");
        
        if (step1) step1.classList.add('hidden');
        if (step2) step2.classList.remove('hidden');

    } catch (err) {
        showModalAlert(err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Send OTP";
    }
});

// --- STEP 2: Validate OTP & Change Password ---
// Note: We check for either 'submitRecoveryBtn' or 'resetPasswordBtn' to match your HTML
// --- STEP 2: Validate OTP & Change Password ---
const submitRecoveryBtn = document.getElementById('submitRecoveryBtn') || document.getElementById('resetPasswordBtn');

submitRecoveryBtn?.addEventListener('click', async () => {
    const otp = document.getElementById('recoveryOtp').value.trim();
    const newPassword = document.getElementById('recoveryNewPassword').value.trim();
    const confirmPasswordEl = document.getElementById('recoveryConfirmPassword');
    
    if (!otp || !newPassword) {
        showModalAlert("Please fill in all required fields.", "error");
        return;
    }

    if (confirmPasswordEl && newPassword !== confirmPasswordEl.value.trim()) {
        showModalAlert("Passwords do not match.", "error");
        return;
    }

    // Strict Frontend Password Complexity Check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        showModalAlert("Password must be at least 8 characters, with 1 uppercase, 1 lowercase, and 1 special character.", "error");
        return;
    }

    try {
        hideModalAlert();
        submitRecoveryBtn.disabled = true;
        submitRecoveryBtn.innerText = "Saving changes...";

        const response = await fetch('https://igp-sales-inventory-system-production.up.railway.app/api/auth/reset-password-with-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: userEmailForReset, 
                otp: otp, 
                new_password: newPassword 
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Verification failed.");

        // Success message!
        showModalAlert("Password changed successfully! Returning to login...", "success");

        // Wait 1.5 seconds so they can read the success message, then refresh the page
        // to give them a completely clean standard login screen!
        setTimeout(() => {
            window.location.reload(); 
        }, 1500);

    } catch (err) {
        showModalAlert(err.message, "error");
    } finally {
        submitRecoveryBtn.disabled = false;
        submitRecoveryBtn.innerText = "Save & Log In";
    }
});

// --- Modal Alert UI Helpers ---
function showModalAlert(msg, type = "error") {
    if (!alertBox) return;
    alertBox.innerText = msg;
    
    // Clear old classes
    alertBox.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200', 'bg-green-50', 'text-green-700', 'border-green-200');
    
    // Add new classes
    if (type === "error") {
        alertBox.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
    } else {
        alertBox.classList.add('bg-green-50', 'text-green-700', 'border-green-200');
    }
}

function hideModalAlert() {
    if (alertBox) {
        alertBox.classList.add('hidden');
        alertBox.innerText = '';
    }
}