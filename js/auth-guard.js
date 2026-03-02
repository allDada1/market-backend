// js/auth-guard.js
(async function () {
  // какие страницы охраняем
  const protectedPages = ["profile.html", "admin.html", "orders.html"];
  const current = (location.pathname.split("/").pop() || "").toLowerCase();

  if (!protectedPages.includes(current)) return;

  // 1) токен есть?
  const token = (window.MarketAPI?.getToken?.() || localStorage.getItem("market_token") || "").trim();
  if (!token) {
    location.href = "login.html";
    return;
  }

  // 2) проверка токена на сервере
  try {
    const res = await MarketAPI.apiFetch("/api/auth/me", { method: "GET" });

    if (!res.ok) {
      // токен просрочен/невалиден
      MarketAPI.setToken("");
      location.href = "login.html";
      return;
    }

    const me = await res.json().catch(() => ({}));
    // можно сохранить профиль (не обязательно)
    localStorage.setItem("market_me", JSON.stringify(me));
  } catch (e) {
    // если сеть/сервер временно недоступны — не выкидываем сразу
    console.warn("auth guard: network error", e);
  }
})();