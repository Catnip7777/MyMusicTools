const AccountStore = (() => {
  const STORAGE_KEY = "apt-accounts-v1";
  const MAX_NAME_LEN = 24;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { accounts: {}, current: null };
      const data = JSON.parse(raw);
      return {
        accounts: data.accounts ?? {},
        current: data.current ?? null,
      };
    } catch {
      return { accounts: {}, current: null };
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function normalizeName(name) {
    return String(name ?? "").trim();
  }

  function validateName(name) {
    const n = normalizeName(name);
    if (!n) return { ok: false, error: "请输入用户名" };
    if (n.length > MAX_NAME_LEN) return { ok: false, error: `用户名不超过 ${MAX_NAME_LEN} 个字符` };
    if (/[<>"/\\]/.test(n)) return { ok: false, error: "用户名含非法字符" };
    return { ok: true, name: n };
  }

  function defaultStats() {
    return { correct: 0, total: 0, streak: 0 };
  }

  function list() {
    const { accounts } = load();
    return Object.keys(accounts).sort((a, b) =>
      (accounts[b].updatedAt ?? 0) - (accounts[a].updatedAt ?? 0)
    );
  }

  function getCurrent() {
    return load().current;
  }

  function getStats(username) {
    const { accounts } = load();
    const acc = accounts[username];
    if (!acc) return defaultStats();
    return {
      correct: acc.correct ?? 0,
      total: acc.total ?? 0,
      streak: acc.streak ?? 0,
    };
  }

  function setStats(username, stats) {
    const data = load();
    if (!data.accounts[username]) return;
    data.accounts[username] = {
      ...data.accounts[username],
      correct: stats.correct,
      total: stats.total,
      streak: stats.streak,
      updatedAt: Date.now(),
    };
    save(data);
  }

  function createOrLogin(name) {
    const v = validateName(name);
    if (!v.ok) return { ok: false, error: v.error };

    const data = load();
    const now = Date.now();
    const created = !data.accounts[v.name];
    if (created) {
      data.accounts[v.name] = { ...defaultStats(), createdAt: now, updatedAt: now };
    } else {
      data.accounts[v.name].updatedAt = now;
    }
    data.current = v.name;
    save(data);
    return { ok: true, username: v.name, stats: getStats(v.name), created };
  }

  function switchTo(username) {
    const data = load();
    if (!data.accounts[username]) return { ok: false, error: "账号不存在" };
    data.current = username;
    data.accounts[username].updatedAt = Date.now();
    save(data);
    return { ok: true, username, stats: getStats(username) };
  }

  function remove(username) {
    const data = load();
    if (!data.accounts[username]) return { ok: false, error: "账号不存在" };
    delete data.accounts[username];
    if (data.current === username) data.current = null;
    save(data);
    return { ok: true };
  }

  function reset(username) {
    const data = load();
    if (!data.accounts[username]) return { ok: false, error: "账号不存在" };
    data.accounts[username] = {
      ...data.accounts[username],
      ...defaultStats(),
      updatedAt: Date.now(),
    };
    save(data);
    return { ok: true, stats: defaultStats() };
  }

  function logout() {
    const data = load();
    data.current = null;
    save(data);
    return { ok: true };
  }

  return {
    list,
    getCurrent,
    getStats,
    setStats,
    createOrLogin,
    switchTo,
    remove,
    reset,
    logout,
    validateName,
    normalizeName,
  };
})();
