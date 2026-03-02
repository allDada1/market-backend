// js/core/auth.js
// Single source of truth for auth token + current user.
// Backwards compatible with MarketAPI (js/api.js).

(function (global) {
  const TOKEN_KEY = "market_token";
  const ME_TTL_MS = 15000;
  let meCache = null;
  let meCacheAt = 0;

  function getToken() {
    try {
      if (global.MarketAPI && typeof global.MarketAPI.getToken === "function") {
        return global.MarketAPI.getToken() || "";
      }
    } catch {}

    // fallback (compat)
    return (
      global.localStorage.getItem(TOKEN_KEY) ||
      global.localStorage.getItem("token") ||
      global.localStorage.getItem("auth_token") ||
      global.localStorage.getItem("authToken") ||
      global.localStorage.getItem("marketToken") ||
      ""
    );
  }

  function setToken(token) {
    try {
      if (global.MarketAPI && typeof global.MarketAPI.setToken === "function") {
        global.MarketAPI.setToken(token);
        return;
      }
    } catch {}

    if (!token) global.localStorage.removeItem(TOKEN_KEY);
    else global.localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    setToken("");
    meCache = null;
    meCacheAt = 0;
  }

  async function getMe({ force = false } = {}) {
    const now = Date.now();
    if (!force && meCache && (now - meCacheAt) < ME_TTL_MS) return meCache;

    const t = getToken();
    if (!t) {
      meCache = null;
      meCacheAt = now;
      return null;
    }

    try {
      const r = await fetch(`${window.API}/api/auth/me", {
        headers: { Authorization: "Bearer " + t }
      });
      if (!r.ok) {
        meCache = null;
        meCacheAt = now;
        return null;
      }
      const data = await r.json().catch(() => ({}));
      meCache = data.user || null;
      meCacheAt = now;
      return meCache;
    } catch {
      meCache = null;
      meCacheAt = now;
      return null;
    }
  }

  global.Auth = {
    getToken,
    setToken,
    clearToken,
    getMe
  };
})(window);
