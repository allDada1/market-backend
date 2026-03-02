const MarketAPI = {
  getToken(){
    // основной ключ
    let t = localStorage.getItem("market_token") || "";

    // обратная совместимость со старыми версиями (на случай, если токен
    // сохранялся под другим названием)
    if (!t) {
      t = localStorage.getItem("token") ||
          localStorage.getItem("auth_token") ||
          localStorage.getItem("marketToken") ||
          localStorage.getItem("admin_token") || "";

      // миграция в новый ключ
      if (t) localStorage.setItem("market_token", t);
    }

    return t;
  },
  setToken(t){
    if (!t) localStorage.removeItem("market_token");
    else localStorage.setItem("market_token", t);
  },
  async apiFetch(url, options = {}){
    const opt = { ...options };
    opt.headers = opt.headers ? { ...opt.headers } : {};

    // body json string -> content-type
    if (opt.body && typeof opt.body === "string" && !opt.headers["Content-Type"]) {
      opt.headers["Content-Type"] = "application/json";
    }

    const t = this.getToken();
    if (t && !opt.headers.Authorization) {
      opt.headers.Authorization = "Bearer " + t;
    }

    // prefix backend base for relative API paths
    if (typeof url === "string" && url.startsWith("/api/")) {
      if (window.API) url = window.API + url;
    }

    return fetch(url, opt);
  }
};