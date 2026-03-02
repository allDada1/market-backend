const nameEl  = document.getElementById("name");
const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const btn     = document.getElementById("registerSubmit");
const msg     = document.getElementById("registerMsg");

function setMsg(t){ if (msg) msg.textContent = t || ""; }

btn?.addEventListener("click", async (e) => {
  e.preventDefault();

  const name = String(nameEl?.value || "").trim();
  const email = String(emailEl?.value || "").trim().toLowerCase();
  const password = String(passEl?.value || "");

  if (name.length < 2){ setMsg("Имя слишком короткое."); return; }
  if (!email.includes("@")){ setMsg("Email некорректный."); return; }
  if (password.length < 6){ setMsg("Пароль минимум 6 символов."); return; }

  const res = await fetch(window.API + "/api/auth/register", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json().catch(()=>({}));

  if (!res.ok){
    setMsg(data.error === "email_taken" ? "Этот email уже занят." : ("Ошибка: " + (data.error || "unknown")));
    return;
  }

  MarketAPI.setToken(data.token);
  localStorage.setItem("market_session", JSON.stringify({ name: data.user.name, email: data.user.email }));

  location.href = "profile.html";
});