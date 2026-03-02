(async function(){
  const token = localStorage.getItem("market_token");
  if (!token){
    window.location.href = "login.html";
    return;
  }

  try{
    const res = await fetch(window.API + "/api/auth/me", { headers:{ Authorization:"Bearer " + token } });
    if (!res.ok){
      localStorage.removeItem("market_token");
      localStorage.removeItem("market_session");
      window.location.href = "login.html";
    }
  }catch{
    window.location.href = "login.html";
  }
})();
