window.Favorites = (function () {
  function loadFavorites(){
    try{
      const raw = localStorage.getItem("market_favorites");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr)
        ? arr.filter(n => Number.isFinite(Number(n))).map(n => Number(n))
        : [];
    }catch{
      return [];
    }
  }

  function saveFavorites(ids){
    const clean = Array.from(new Set((ids || []).map(n => Number(n)).filter(n => Number.isFinite(n))));
    localStorage.setItem("market_favorites", JSON.stringify(clean));
  }

  function isFavorite(id){
    return loadFavorites().includes(Number(id));
  }

  function toggleFavorite(id){
    const ids = loadFavorites();
    const nid = Number(id);
    const has = ids.includes(nid);
    const next = has ? ids.filter(x => x !== nid) : [...ids, nid];
    saveFavorites(next);
    return !has;
  }

  function count(){ return loadFavorites().length; }

  return { loadFavorites, saveFavorites, isFavorite, toggleFavorite, count };
})();