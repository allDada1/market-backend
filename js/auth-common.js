// Общая логика для login.html и register.html
// + персонажи (слежение за курсором, curious, password, nope)
// + localStorage users/session

const MODE = window.AUTH_PAGE_MODE || "login";

const el = {
  stage: document.getElementById("stage"),
  statusLine: document.getElementById("statusLine"),
  dudeA: document.getElementById("dudeA"),
  dudeB: document.getElementById("dudeB"),

  loginForm: document.getElementById("loginForm"),
  loginId: document.getElementById("loginId"),
  loginPass: document.getElementById("loginPass"),
  loginMsg: document.getElementById("loginMsg"),
  fakeForgot: document.getElementById("fakeForgot"),

  registerForm: document.getElementById("registerForm"),
  regName: document.getElementById("regName"),
  regEmail: document.getElementById("regEmail"),
  regPass: document.getElementById("regPass"),
  regMsg: document.getElementById("regMsg"),
};

const dudes = [el.dudeA, el.dudeB].filter(Boolean);

function setStatus(text){
  if (!el.statusLine) return;
  const t = el.statusLine.querySelector("span:last-child");
  if (t) t.textContent = text;
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function setPupilsByPointer(clientX, clientY){
  if (!el.stage) return;

  const rect = el.stage.getBoundingClientRect();
  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;

  const dx = clamp((nx - 0.5) * 16, -10, 10);
  const dy = clamp((ny - 0.5) * 16, -10, 10);

  dudes.forEach(d => {
    d.querySelectorAll(".pupil").forEach(p => {
      p.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
    });

    const head = d.querySelector(".dude__head");
    const tilt = clamp((nx - 0.5) * 6, -4, 4);
    head.style.transform = `rotate(${tilt}deg)`;
  });
}

function setPasswordMode(on){
  if (!el.stage) return;
  el.stage.classList.toggle("is-password", on);
  setStatus(on ? "Тсс... пароль." : "Ожидание...");
}

function setCuriousMode(on){
  if (!el.stage) return;
  el.stage.classList.toggle("is-curious", on);
  if (on) setStatus("О, вводишь данные...");
}

function nope(){
  dudes.forEach(d => {
    d.classList.remove("is-nope");
    void d.offsetWidth;
    d.classList.add("is-nope");
  });
  setStatus("Не-е. Что-то не так.");
}

// stage events
if (el.stage){
  el.stage.addEventListener("mousemove", (e) => setPupilsByPointer(e.clientX, e.clientY));
  el.stage.addEventListener("mouseleave", () => {
    dudes.forEach(d => d.querySelectorAll(".pupil").forEach(p => p.style.transform = `translate(-50%, -50%)`));
    setCuriousMode(false);
    setPasswordMode(false);
    setStatus("Ожидание...");
  });
}

// focus bindings (если элементы есть)
function bindFocusCurious(inputEl){
  if (!inputEl) return;
  inputEl.addEventListener("focus", () => setCuriousMode(true));
  inputEl.addEventListener("blur", () => setCuriousMode(false));
}
function bindPassword(inputEl){
  if (!inputEl) return;
  inputEl.addEventListener("focus", () => setPasswordMode(true));
  inputEl.addEventListener("blur", () => setPasswordMode(false));
}

// login inputs
bindFocusCurious(el.loginId);
bindPassword(el.loginPass);

// register inputs
bindFocusCurious(el.regName);
bindFocusCurious(el.regEmail);
bindPassword(el.regPass);

// -------- localStorage auth --------
function loadUsers(){
  try{ return JSON.parse(localStorage.getItem("market_users") || "[]"); }
  catch{ return []; }
}
function saveUsers(users){
  localStorage.setItem("market_users", JSON.stringify(users));
}
function setSession(user){
  localStorage.setItem("market_session", JSON.stringify({ email: user.email, name: user.name }));
}

// submit register
if (el.registerForm){
  el.registerForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = (el.regName?.value || "").trim();
    const email = (el.regEmail?.value || "").trim().toLowerCase();
    const pass = el.regPass?.value || "";

    if (!name || !email || !pass){
      el.regMsg.textContent = "Заполни все поля.";
      nope();
      return;
    }
    if (pass.length < 6){
      el.regMsg.textContent = "Пароль слишком короткий (минимум 6).";
      nope();
      return;
    }

    const users = loadUsers();
    if (users.some(u => u.email === email)){
      el.regMsg.textContent = "Такой email уже зарегистрирован.";
      nope();
      return;
    }

    const user = { name, email, pass };
    users.push(user);
    saveUsers(users);
    setSession(user);

    el.regMsg.textContent = "Аккаунт создан. Перекидываю на главную…";
    setStatus("Новый пользователь обнаружен.");
    setTimeout(() => window.location.href = "index.html", 650);
  });
}

// submit login
if (el.loginForm){
  el.loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const loginId = (el.loginId?.value || "").trim().toLowerCase();
    const pass = el.loginPass?.value || "";

    if (!loginId || !pass){
      el.loginMsg.textContent = "Заполни логин и пароль.";
      nope();
      return;
    }

    const users = loadUsers();
    const user = users.find(u => u.email === loginId || u.name.toLowerCase() === loginId);

    if (!user || user.pass !== pass){
      el.loginMsg.textContent = "Неверный логин или пароль.";
      nope();
      return;
    }

    setSession(user);
    el.loginMsg.textContent = `Добро пожаловать, ${user.name}. Перекидываю на главную…`;
    setStatus("Окей. Проходи.");
    setTimeout(() => window.location.href = "index.html", 650);
  });
}

if (el.fakeForgot){
  el.fakeForgot.addEventListener("click", () => {
    setStatus("Потом добавим восстановление. Сейчас — просто грусть.");
  });
}

// init status
setStatus(MODE === "register" ? "Режим: Регистрация" : "Режим: Вход");