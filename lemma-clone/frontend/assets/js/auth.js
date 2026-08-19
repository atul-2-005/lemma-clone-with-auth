/**
 * Lemma Modern Authentication Module (Vanilla JS)
 *
 * Provides seamless modal-based authentication, user profile management,
 * JWT token storage, and history synchronization.
 */
const LemmaAuth = {
    STORAGE_KEY: "lemma_auth_token",
    USER_KEY: "lemma_auth_user",
    apiBase: "",
    _mode: "login",

    init(apiBaseUrl) {
        this.apiBase = apiBaseUrl || window.location.origin;
        this._bindDOM();
        this.updateProfileUI();
    },

    isLoggedIn() {
        return !!localStorage.getItem(this.STORAGE_KEY);
    },

    getToken() {
        return localStorage.getItem(this.STORAGE_KEY);
    },

    getUser() {
        const raw = localStorage.getItem(this.USER_KEY);
        try {
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    authHeader() {
        const token = this.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    },

    _parseErrorDetail(data, fallback) {
        const detail = data && data.detail;
        if (!detail) return fallback;
        if (typeof detail === "string") return detail;
        if (Array.isArray(detail)) {
            return detail.map((e) => e.msg || JSON.stringify(e)).join(" ");
        }
        return fallback;
    },

    async register(email, password, fullName) {
        const res = await fetch(`${this.apiBase}/api/v1/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, full_name: fullName || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(this._parseErrorDetail(data, "Registration failed."));
        this._saveSession(data);
        return data.user;
    },

    async login(email, password) {
        const res = await fetch(`${this.apiBase}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(this._parseErrorDetail(data, "Login failed."));
        this._saveSession(data);
        return data.user;
    },

    logout() {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.USER_KEY);
        this.updateProfileUI();
        this._closeProfileDropdown();
        window.dispatchEvent(new CustomEvent("lemma:auth-changed", { detail: { loggedIn: false } }));
        if (window.showToast) {
            window.showToast("Signed out successfully", "info");
        }
    },

    async fetchHistory() {
        if (!this.isLoggedIn()) return [];
        try {
            const res = await fetch(`${this.apiBase}/api/v1/jobs`, {
                headers: { ...this.authHeader() },
            });
            if (!res.ok) return [];
            const data = await res.json();
            return data.jobs || [];
        } catch {
            return [];
        }
    },

    _saveSession(tokenResponse) {
        localStorage.setItem(this.STORAGE_KEY, tokenResponse.access_token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(tokenResponse.user));
        this.updateProfileUI();
        this.closeAuthModal();
        window.dispatchEvent(new CustomEvent("lemma:auth-changed", { detail: { loggedIn: true, user: tokenResponse.user } }));
        if (window.showToast) {
            window.showToast(`Welcome, ${tokenResponse.user?.full_name || tokenResponse.user?.email}!`, "success");
        }
    },

    openAuthModal(mode = "login") {
        const overlay = document.getElementById("auth-modal-overlay");
        if (!overlay) return;
        this.setMode(mode);
        const errorEl = document.getElementById("auth-modal-error");
        if (errorEl) errorEl.style.display = "none";
        overlay.classList.add("active");
        const emailInput = document.getElementById("auth-input-email");
        if (emailInput) setTimeout(() => emailInput.focus(), 100);
    },

    closeAuthModal() {
        const overlay = document.getElementById("auth-modal-overlay");
        if (overlay) overlay.classList.remove("active");
    },

    setMode(mode) {
        this._mode = mode;
        const tabLogin = document.getElementById("auth-tab-login");
        const tabRegister = document.getElementById("auth-tab-register");
        const nameGroup = document.getElementById("auth-name-group");
        const submitBtnText = document.getElementById("auth-submit-text");
        const titleEl = document.getElementById("auth-modal-title");
        const subtitleEl = document.getElementById("auth-modal-subtitle");

        if (tabLogin) tabLogin.classList.toggle("active", mode === "login");
        if (tabRegister) tabRegister.classList.toggle("active", mode === "register");
        if (nameGroup) nameGroup.style.display = mode === "register" ? "block" : "none";
        if (submitBtnText) submitBtnText.textContent = mode === "login" ? "Sign In to Lemma" : "Create Free Account";
        if (titleEl) titleEl.textContent = mode === "login" ? "Welcome Back" : "Join Lemma Platform";
        if (subtitleEl) subtitleEl.textContent = mode === "login" ? "Access your academic analyses & history" : "Local-first academic plagiarism detection";
    },

    updateProfileUI() {
        const profileBtn = document.getElementById("header-profile-menu");
        const profileAvatar = document.querySelector(".profile-avatar");
        const profileName = document.querySelector(".profile-name");
        const dropdownHeader = document.getElementById("profile-dropdown-header");
        const dropdownGuest = document.getElementById("profile-dropdown-guest");
        const dropdownUser = document.getElementById("profile-dropdown-user");
        const homeGreetingName = document.getElementById("home-greeting-name");

        if (this.isLoggedIn()) {
            const user = this.getUser();
            const displayName = user?.full_name || user?.email?.split("@")[0] || "Researcher";
            const initial = displayName.charAt(0).toUpperCase();

            if (profileAvatar) profileAvatar.textContent = initial;
            if (profileName) profileName.textContent = displayName;
            if (homeGreetingName) homeGreetingName.textContent = displayName;

            if (dropdownHeader) {
                dropdownHeader.innerHTML = `
                    <div class="user-full-name">${user?.full_name || "Researcher"}</div>
                    <span class="user-email">${user?.email || ""}</span>
                `;
            }
            if (dropdownGuest) dropdownGuest.style.display = "none";
            if (dropdownUser) dropdownUser.style.display = "block";
        } else {
            if (profileAvatar) profileAvatar.textContent = "G";
            if (profileName) profileName.textContent = "Sign In";
            if (homeGreetingName) homeGreetingName.textContent = "Researcher";

            if (dropdownHeader) {
                dropdownHeader.innerHTML = `
                    <div class="user-full-name">Guest Mode</div>
                    <span class="user-email">Sign in to save and sync reports</span>
                `;
            }
            if (dropdownGuest) dropdownGuest.style.display = "block";
            if (dropdownUser) dropdownUser.style.display = "none";
        }
    },

    toggleProfileDropdown() {
        const menu = document.getElementById("profile-dropdown-menu");
        if (menu) menu.classList.toggle("active");
    },

    _closeProfileDropdown() {
        const menu = document.getElementById("profile-dropdown-menu");
        if (menu) menu.classList.remove("active");
    },

    _bindDOM() {
        // Auth modal close trigger
        const closeBtn = document.getElementById("auth-close-btn");
        if (closeBtn) closeBtn.onclick = () => this.closeAuthModal();

        const overlay = document.getElementById("auth-modal-overlay");
        if (overlay) {
            overlay.onclick = (e) => {
                if (e.target === overlay) this.closeAuthModal();
            };
        }

        // Tabs
        const tabLogin = document.getElementById("auth-tab-login");
        if (tabLogin) tabLogin.onclick = () => this.setMode("login");

        const tabRegister = document.getElementById("auth-tab-register");
        if (tabRegister) tabRegister.onclick = () => this.setMode("register");

        // Submit form
        const submitBtn = document.getElementById("auth-submit-btn");
        if (submitBtn) {
            submitBtn.onclick = async (e) => {
                e.preventDefault();
                const errorEl = document.getElementById("auth-modal-error");
                const email = document.getElementById("auth-input-email")?.value.trim();
                const password = document.getElementById("auth-input-password")?.value;
                const fullName = document.getElementById("auth-input-name")?.value.trim();

                if (!email || !password) {
                    if (errorEl) {
                        errorEl.textContent = "Please fill in both email and password.";
                        errorEl.style.display = "block";
                    }
                    return;
                }

                if (errorEl) errorEl.style.display = "none";
                submitBtn.disabled = true;
                submitBtn.style.opacity = "0.7";

                try {
                    if (this._mode === "login") {
                        await this.login(email, password);
                    } else {
                        await this.register(email, password, fullName);
                    }
                } catch (err) {
                    if (errorEl) {
                        errorEl.textContent = err.message;
                        errorEl.style.display = "block";
                    }
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = "1";
                }
            };
        }

        // Header profile button click
        const profileBtn = document.getElementById("header-profile-menu");
        if (profileBtn) {
            profileBtn.onclick = (e) => {
                e.stopPropagation();
                if (!this.isLoggedIn()) {
                    this.openAuthModal("login");
                } else {
                    this.toggleProfileDropdown();
                }
            };
        }

        // Close dropdown when clicking outside
        document.addEventListener("click", (e) => {
            const wrapper = document.querySelector(".header-profile-wrapper");
            if (wrapper && !wrapper.contains(e.target)) {
                this._closeProfileDropdown();
            }
        });

        // Dropdown actions
        const btnSignInDropdown = document.getElementById("profile-btn-signin");
        if (btnSignInDropdown) {
            btnSignInDropdown.onclick = () => {
                this._closeProfileDropdown();
                this.openAuthModal("login");
            };
        }

        const btnSignUpDropdown = document.getElementById("profile-btn-signup");
        if (btnSignUpDropdown) {
            btnSignUpDropdown.onclick = () => {
                this._closeProfileDropdown();
                this.openAuthModal("register");
            };
        }

        const btnLogoutDropdown = document.getElementById("profile-btn-logout");
        if (btnLogoutDropdown) {
            btnLogoutDropdown.onclick = () => this.logout();
        }
    },
};
