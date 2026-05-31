(function() {
    const token = localStorage.getItem('token');
    const userString = localStorage.getItem('user');
    const currentPage = window.location.pathname.split("/").pop();

    // Don't run the check if we are already on the login page
    if (currentPage === "index.html" || currentPage === "") {
        return;
    }

    // Allow the password reset page for users who have a valid token but haven't yet loaded profile info.
    if (currentPage === 'change-password.html' && token) {
        return;
    }

    let user = null;
    try {
        user = JSON.parse(userString);
    } catch (e) {
        user = null;
    }

    const isLoggedIn = Boolean(token && user && user.isLoggedIn);

    if (!isLoggedIn) {
        console.warn("Unauthorized access. Redirecting to login...");
        // Clear any corrupted data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Force redirect to login
        window.location.href = 'index.html';
    }
})();