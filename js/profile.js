(function(){
  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const nickEl = document.getElementById("profileNick");

  const nameInput = document.getElementById("nameInput");
  const nickInput = document.getElementById("nickInput");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const langSelect = document.getElementById("langSelect");
  const saveBtn = document.getElementById("saveProfileBtn");
  const noteEl = document.getElementById("profileNote");

  const settingsBtn = document.getElementById("settingsBtn");
  const settingsModal = document.getElementById("settingsModal");
  const settingsCloseBtn = document.getElementById("settingsCloseBtn");

  const avatarBox = document.getElementById("avatarBox");
  const avatarImg = document.getElementById("avatarImg");
  const avatarFallback = document.getElementById("avatarFallback");
  const avatarInput = document.getElementById("avatarInput");

  const logoutBtn = document.getElementById("logoutBtn");
  const adminTile = document.getElementById("adminTile");

  function setText(el, t){ if (el) el.textContent = t ?? ""; }
  function setNote(t){ if (noteEl) noteEl.textContent = t || ""; }

  function applyPrefs(user){
    // apply theme/lang locally (and cache in localStorage via utils)
    try{
      if (window.MarketUtils){
        if (user?.theme) MarketUtils.applyTheme(user.theme);
        if (user?.lang) MarketUtils.applyLang(user.lang);
      }
    }catch{}
    if (langSelect) langSelect.value = ["ru","kz","en"].includes(user?.lang) ? user.lang : "ru";

    // sync header switch
    syncThemeSwitch();
  }

  function getCurrentTheme(){
    const t = (document.documentElement.dataset.theme || localStorage.getItem("market_theme") || "dark").toLowerCase();
    return (t === "light") ? "light" : "dark";
  }

  function syncThemeSwitch(){
    if (!themeToggleBtn) return;
    const t = getCurrentTheme();
    themeToggleBtn.setAttribute("aria-checked", t === "light" ? "true" : "false");
  }

  function setAvatar(url){
    const u = String(url || "").trim();
    if (u){
      if (avatarImg){
        avatarImg.src = u;
        avatarImg.hidden = false;
      }
      if (avatarFallback) avatarFallback.hidden = true;
    } else {
      if (avatarImg) avatarImg.hidden = true;
      if (avatarFallback) avatarFallback.hidden = false;
    }
  }

  async function loadMe(){
    const res = await MarketAPI.apiFetch("/api/auth/me");
    if (!res.ok) return null;
    const data = await res.json().catch(()=>null);
    return data?.user || null;
  }

  async function refreshUI(){
    const u = await loadMe();
    if (!u) return;

    setText(nameEl, u.name || "—");
    setText(emailEl, u.email || "—");
    setText(nickEl, u.nickname || "—");

    if (nameInput) nameInput.value = u.name || "";
    if (nickInput) nickInput.value = u.nickname || "";

    if (adminTile) adminTile.style.display = u.is_admin ? "" : "none";

    setAvatar(u.avatar_url || "");
    applyPrefs(u);
  }

  async function saveProfile(){
    setNote("");
    const payload = {
      name: String(nameInput?.value || "").trim(),
      nickname: String(nickInput?.value || "").trim(),
      lang: String(langSelect?.value || "ru"),
    };

    if (payload.name.length < 2){
      setNote("Имя слишком короткое");
      return;
    }
    if (payload.nickname.length > 32){
      setNote("Ник слишком длинный");
      return;
    }

    saveBtn.disabled = true;
    try{
      // PATCH предпочитаем, но если окружение не пропускает PATCH (или сервер старый) —
      // пробуем POST как запасной вариант, чтобы не ловить 404.
      let res = await MarketAPI.apiFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 404){
        res = await MarketAPI.apiFetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok){
        const e = await res.json().catch(()=>({}));
        setNote("Ошибка сохранения: " + (e.error || res.status));
        return;
      }

      const data = await res.json().catch(()=>({}));
      const u = data.user || null;

      if (u){
        setText(nameEl, u.name || "—");
        setText(emailEl, u.email || "—");
        setText(nickEl, u.nickname || "—");
        setAvatar(u.avatar_url || "");
        applyPrefs(u);
      }

      setNote("Сохранено ✅");
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function toggleTheme(){
    setNote("");
    const next = (getCurrentTheme() === "dark") ? "light" : "dark";

    // apply locally immediately
    try { window.MarketUtils?.applyTheme(next); } catch {}
    syncThemeSwitch();

    // persist in DB (если залогинен)
    try{
      const res = await MarketAPI.apiFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ theme: next })
      });
      if (res.ok){
        const data = await res.json().catch(()=>({}));
        if (data?.user) applyPrefs(data.user);
      }
    } catch {}
  }

  async function uploadAvatar(file){
    setNote("");
    if (!file) return;

    const fd = new FormData();
    fd.append("avatar", file);

    saveBtn?.setAttribute("disabled", "true");

    try{
      const res = await MarketAPI.apiFetch("/api/profile/avatar", {
        method: "POST",
        body: fd
      });

      if (!res.ok){
        const e = await res.json().catch(()=>({}));
        setNote("Ошибка загрузки аватара: " + (e.error || res.status));
        return;
      }

      const data = await res.json().catch(()=>({}));
      setAvatar(data.avatar_url || "");
      setNote("Аватар обновлён ✅");
    } finally {
      saveBtn?.removeAttribute("disabled");
    }
  }

  // avatar click => open file
  avatarBox?.addEventListener("click", () => avatarInput?.click());
  avatarInput?.addEventListener("change", () => {
    const f = avatarInput.files && avatarInput.files[0];
    if (f) uploadAvatar(f);
    avatarInput.value = "";
  });

  saveBtn?.addEventListener("click", saveProfile);

  themeToggleBtn?.addEventListener("click", toggleTheme);

  function openSettings(){
    if (!settingsModal) return;
    settingsModal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => nameInput?.focus(), 80);
  }

  function closeSettings(){
    if (!settingsModal) return;
    settingsModal.hidden = true;
    document.body.style.overflow = "";
    settingsBtn?.focus();
  }

  settingsBtn?.addEventListener("click", openSettings);
  settingsCloseBtn?.addEventListener("click", closeSettings);

  // click outside modal closes
  settingsModal?.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && settingsModal && !settingsModal.hidden) closeSettings();
  });

  logoutBtn?.addEventListener("click", async () => {
    try { await MarketAPI.apiFetch("/api/auth/logout", { method:"POST" }); } catch {}
    MarketAPI.setToken("");
    window.location.href = "index.html";
  });

  refreshUI();
})();
