// ==========================================
// FORGOT PASSWORD LOGIC
// ==========================================

let recoveryEmail = "";
let systemGeneratedOtp = "";

function openForgotModal() {
    recoveryEmail = "";
    systemGeneratedOtp = "";
    document.getElementById('forgotEmail').value = "";
    document.getElementById('inputOtp').value = "";
    document.getElementById('forgotNewPassword').value = "";
    document.getElementById('forgotConfirmPassword').value = "";
    
    switchForgotStep(1);
    document.getElementById('forgotPasswordModal').classList.remove('hidden');
}

function closeForgotModal() {
    document.getElementById('forgotPasswordModal').classList.add('hidden');
}

function switchForgotStep(stepNumber) {
    document.getElementById('forgotStep1').classList.toggle('hidden', stepNumber !== 1);
    document.getElementById('forgotStep2').classList.toggle('hidden', stepNumber !== 2);
    document.getElementById('forgotStep3').classList.toggle('hidden', stepNumber !== 3);
}

// --- UI Alert Helper (Uses the modal built into your index.html) ---
function showForgotAlert(title, message, type = "error") {
    const modal = document.getElementById('forgotAlertModal');
    const titleEl = document.getElementById('forgotAlertTitle');
    const messageEl = document.getElementById('forgotAlertMessage');
    const iconEl = document.getElementById('forgotAlertIcon');

    if (!modal) {
        alert(`${title}\n\n${message}`);
        return;
    }

    titleEl.innerText = title;
    messageEl.innerText = message;

    if (type === 'success') {
        iconEl.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-3 bg-green-100 text-green-600';
        iconEl.innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    } else {
        iconEl.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-3 bg-red-100 text-red-600';
        iconEl.innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    }

    modal.classList.remove('hidden');
}

function closeForgotAlert() {
    const modal = document.getElementById('forgotAlertModal');
    if (modal) modal.classList.add('hidden');
}

// --- STEP 1: Request OTP ---
async function handleRequestOtp() {
    const emailInput = document.getElementById('forgotEmail').value.trim();
    const btnSendOtp = document.getElementById('btnSendOtp');

    if (!emailInput.toLowerCase().endsWith('@evsu.edu.ph')) {
        showForgotAlert("Invalid Domain", "Please input an official @evsu.edu.ph account.", "error");
        return;
    }

    try {
        btnSendOtp.disabled = true;
        btnSendOtp.innerText = "Processing...";

        // Target your Auth router specifically
        const response = await fetch('https://igp-sales-inventory-system-production.up.railway.app/api/auth/forgot-password-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailInput })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "Account verification failed.");
        }

        // Lock in the state globally
        recoveryEmail = emailInput;
        systemGeneratedOtp = String(result.otp); // Explicit string casting to satisfy Pydantic

        // Trigger EmailJS using your exact keys
        await emailjs.send("service_yd9wo1u", "template_acxqtxm", {
            to_email: recoveryEmail,
            to_name: result.full_name || "User",
            otp_code: systemGeneratedOtp
        });

        switchForgotStep(2);

    } catch (err) {
        showForgotAlert("Recovery Blocked", err.message, "error");
    } finally {
        btnSendOtp.disabled = false;
        btnSendOtp.innerText = "Send OTP";
    }
}

// --- STEP 2: Verify OTP ---
function handleVerifyOtp() {
    const userInputOtp = document.getElementById('inputOtp').value.trim();
    if (userInputOtp === systemGeneratedOtp && systemGeneratedOtp !== "") {
        switchForgotStep(3);
    } else {
        showForgotAlert("Validation Error", "The code typed does not match our records. Please verify and try again.", "error");
    }
}

// --- STEP 3: Confirm Backend Schema Requirements ---
async function handleUpdatePassword() {
    const newPassword = document.getElementById('forgotNewPassword').value;
    const confirmPassword = document.getElementById('forgotConfirmPassword').value;
    const btnResetPassword = document.getElementById('btnResetPassword');

    // Matches Python rules exactly: 8 chars, 1 Lower, 1 Upper, 1 Number, 1 Special
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?`~]).{8,}$/;
    
    if (!passwordRegex.test(newPassword)) {
        showForgotAlert("Weak Password", "Password must be at least 8 characters, with 1 uppercase, 1 lowercase, 1 number, and 1 special character.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        showForgotAlert("Mismatch", "Passwords do not match.", "error");
        return;
    }

    try {
        btnResetPassword.disabled = true;
        btnResetPassword.innerText = "Updating...";

        const response = await fetch('https://igp-sales-inventory-system-production.up.railway.app/api/auth/forgot-password-confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: recoveryEmail,
                otp: systemGeneratedOtp,
                new_password: newPassword
            })
        });

        const result = await response.json();

        if (!response.ok) {
            // Check specifically for Pydantic Schema crashes
            if (response.status === 422) {
                console.error("Schema Rejection:", result.detail);
                throw new Error("Form data mismatch. Please close the modal and try the recovery process again.");
            }
            throw new Error(result.detail || "Failed to update database profile.");
        }

        showForgotAlert("Success", "Your password has been changed successfully. You can now log in.", "success");
        closeForgotModal();

    } catch (err) {
        showForgotAlert("Submission Failed", err.message, "error");
    } finally {
        btnResetPassword.disabled = false;
        btnResetPassword.innerText = "Update Password";
    }
}