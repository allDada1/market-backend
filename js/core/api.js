// js/core/api.js
// Fetch wrapper with consistent JSON handling.

(function (global) {
  function getToken() {
    try {
      if (global.Auth && typeof global.Auth.getToken === "function") return global.Auth.getToken() || "";
      if (global.MarketAPI && typeof global.MarketAPI.getToken === "function") return global.MarketAPI.getToken() || "";
    } catch {}
    return (
      localStorage.getItem("market_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token") ||
      ""
    );
  }

  async function request(method, url, body, opts) {
    const options = { ...(opts || {}), method };
    options.headers = options.headers ? { ...options.headers } : {};

    const t = getToken();
    if (t && !options.headers.Authorization) {
      options.headers.Authorization = "Bearer " + t;
    }

    if (body !== undefined) {
      options.headers["Content-Type"] = options.headers["Content-Type"] || "application/json";
      options.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const res = await fetch(url, options);

    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");

    if (!res.ok) {
      const err = new Error((data && data.error) ? data.error : ("HTTP " + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  global.api = {
    get: (url, opts) => request("GET", url, undefined, opts),
    post: (url, body, opts) => request("POST", url, body, opts),
    put: (url, body, opts) => request("PUT", url, body, opts),
    del: (url, opts) => request("DELETE", url, undefined, opts),
    request
  };
})(window);