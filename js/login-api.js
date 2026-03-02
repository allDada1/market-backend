// js/login-api.js
(function () {
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const btn = document.getElementById("loginSubmit");
  const msg = document.getElementById("loginMsg");

  function setMsg(t) {
    if (msg) msg.textContent = t || "";
  }

  if (!btn) {
    console.error("loginSubmit button not found");
    return;
  }

  btn.type = "button";

  btn.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = String(emailEl?.value || "").trim().toLowerCase();
    const password = String(passEl?.value || "");

    if (!email.includes("@")) return setMsg("Некорректный email");
    if (password.length < 6) return setMsg("Пароль минимум 6 символов");

    setMsg("Вхожу...");

    try {
      const res = await MarketAPI.apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return setMsg("Ошибка входа: " + (data.error || "unknown"));
      }

      if (!data.token) return setMsg("Ошибка: сервер не вернул token");

      MarketAPI.setToken(data.token);
      location.href = "profile.html";
    } catch (err) {
      console.error(err);
      setMsg("Ошибка сети/сервера");
    }
  });
})();