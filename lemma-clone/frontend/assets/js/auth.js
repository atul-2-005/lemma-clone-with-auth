/**
 * Lemma Auth Module (Vanilla JS)
 *
 * Handles register/login/logout, stores the JWT, and exposes a small API
 * that app.js can use to attach the Authorization header to requests and
 * render a "My History" panel.
 *
 * Usage from app.js:
 *   LemmaAuth.init(API_BASE_URL);
 *   const headers = LemmaAuth.authHeader(); // {} or {Authorization: 'Bearer ...'}
 *   const jobs = await LemmaAuth.fetchHistory();
 *
 * Storage note: the token is kept in localStorage for simplicity so a page
 * refresh doesn't force a re-login. This trades a little XSS exposure for
 * convenience — for production hardening, prefer an httpOnly cookie issued
 * by the backend instead.
 */
const LemmaAuth = {
    STORAGE_KEY: "lemma_auth_token",
    USER_KEY: "lemma_auth_user",
    apiBase: "",

    init(apiBaseUrl) {
        this.apiBase = apiBaseUrl;
        this._renderAuthUI();
    },

    isLoggedIn() {
        return !!localStorage.getItem(this.STORAGE_KEY);
    },

    getToken() {
        return localStorage.getItem(this.STORAGE_KEY);
    },

    getUser() {
        const raw = localStorage.getItem(this.USER_KEY);
        return raw ? JSON.parse(raw) : null;
    },

    authHeader() {
        const token = this.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    },

    async register(email, password, fullName) {
        const res = await fetch(`${this.apiBase}/api/v1/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, full_name: fullName || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Registration failed.");
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
        if (!res.ok) throw new Error(data.detail || "Login failed.");
        this._saveSession(data);
        return data.user;
    },

    logout() {
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.USER_KEY);
        this._renderAuthUI();
    },

    async fetchHistory() {
        if (!this.isLoggedIn()) return [];
        const res = await fetch(`${this.apiBase}/api/v1/jobs`, {
            headers: { ...this.authHeader() },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.jobs || [];
    },

    _saveSession(tokenResponse) {
        localStorage.setItem(this.STORAGE_KEY, tokenResponse.access_token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(tokenResponse.user));
        this._renderAuthUI();
    },

    // Minimal built-in UI: a corner widget with login/register forms.
    // Delete this method (and its call in init) if you'd rather build your
    // own UI against the methods above.
    _renderAuthUI() {
        let container = document.getElementById("lemma-auth-widget");
        if (!container) {
            container = document.createElement("div");
            container.id = "lemma-auth-widget";
            container.style.cssText =
                "position:fixed;top:12px;right:12px;z-index:9999;font-family:inherit;";
            document.body.appendChild(container);
        }

        if (this.isLoggedIn()) {
            const user = this.getUser();
            container.innerHTML = `
                <div style="background:#111;color:#eee;border:1px solid #333;border-radius:8px;padding:8px 12px;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:13px;">${user?.email ?? "Signed in"}</span>
                    <button id="lemma-auth-logout" style="background:#222;color:#eee;border:1px solid #444;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;">Log out</button>
                </div>`;
            document.getElementById("lemma-auth-logout").onclick = () => this.logout();
            return;
        }

        container.innerHTML = `
            <div style="background:#111;color:#eee;border:1px solid #333;border-radius:8px;padding:10px;width:220px;">
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <button id="lemma-auth-tab-login" style="flex:1;background:#222;color:#eee;border:1px solid #444;border-radius:6px;padding:4px;cursor:pointer;font-size:12px;">Log in</button>
                    <button id="lemma-auth-tab-register" style="flex:1;background:#000;color:#888;border:1px solid #333;border-radius:6px;padding:4px;cursor:pointer;font-size:12px;">Sign up</button>
                </div>
                <input id="lemma-auth-email" type="email" placeholder="Email" style="width:100%;margin-bottom:6px;padding:6px;background:#000;color:#eee;border:1px solid #333;border-radius:4px;box-sizing:border-box;font-size:12px;" />
                <input id="lemma-auth-password" type="password" placeholder="Password" style="width:100%;margin-bottom:6px;padding:6px;background:#000;color:#eee;border:1px solid #333;border-radius:4px;box-sizing:border-box;font-size:12px;" />
                <button id="lemma-auth-submit" style="width:100%;background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:6px;cursor:pointer;font-size:12px;">Log in</button>
                <div id="lemma-auth-error" style="color:#f87171;font-size:11px;margin-top:6px;display:none;"></div>
            </div>`;

        let mode = "login";
        const errorEl = document.getElementById("lemma-auth-error");
        const submitBtn = document.getElementById("lemma-auth-submit");
        const setMode = (m) => {
            mode = m;
            submitBtn.textContent = m === "login" ? "Log in" : "Sign up";
            document.getElementById("lemma-auth-tab-login").style.color = m === "login" ? "#eee" : "#888";
            document.getElementById("lemma-auth-tab-register").style.color = m === "register" ? "#eee" : "#888";
        };
        document.getElementById("lemma-auth-tab-login").onclick = () => setMode("login");
        document.getElementById("lemma-auth-tab-register").onclick = () => setMode("register");

        submitBtn.onclick = async () => {
            errorEl.style.display = "none";
            const email = document.getElementById("lemma-auth-email").value.trim();
            const password = document.getElementById("lemma-auth-password").value;
            try {
                if (mode === "login") {
                    await this.login(email, password);
                } else {
                    await this.register(email, password);
                }
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.style.display = "block";
            }
        };
    },
};
