const form = document.getElementById("registerForm");
const note = document.getElementById("note");

function setNote(t){ if(note) note.textContent = t || ""; }

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setNote("");

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  const res = await fetch(`${window.API}/api/auth/register", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json().catch(()=>({}));

  if (!res.ok){
    setNote("Ошибка регистрации: " + (data.error || "unknown"));
    return;
  }

  MarketAPI.setToken(data.token);
  localStorage.setItem("market_session", JSON.stringify(data.user || {}));
  location.href = "profile.html";
});
