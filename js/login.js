// login.js — сохраняет token строго в market_token
const form = document.getElementById("loginForm");
const note = document.getElementById("note");

function setNote(t){ if(note) note.textContent = t || ""; }

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setNote("");

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  const res = await fetch(`${window.API}/api/auth/login", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json().catch(()=>({}));

  if (!res.ok){
    setNote("Ошибка входа: " + (data.error || "unknown"));
    return;
  }

  MarketAPI.setToken(data.token);          // 🔥 ключевой момент
  localStorage.setItem("market_session", JSON.stringify(data.user || {}));

  location.href = "profile.html";
});
