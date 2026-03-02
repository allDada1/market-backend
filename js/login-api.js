import { API } from "./utils.js";
const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const btn     = document.getElementById("loginSubmit");
const msg     = document.getElementById("loginMsg");

function setMsg(t){ if (msg) msg.textContent = t || ""; }

btn?.addEventListener("click", async (e) => {
  e.preventDefault();

  const email = String(emailEl?.value || "").trim().toLowerCase();
  const password = String(passEl?.value || "");

  if (!email || !password){
    setMsg("Заполни email и пароль.");
    return;
  }

  const res = await fetch(`${API}/api/login`, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json().catch(()=>({}));

  if (!res.ok){
    setMsg(data.error === "bad_credentials" ? "Неверный email или пароль." : ("Ошибка: " + (data.error || "unknown")));
    return;
  }

  MarketAPI.setToken(data.token);
  localStorage.setItem("market_session", JSON.stringify({ name: data.user.name, email: data.user.email }));

  location.href = "profile.html";
});