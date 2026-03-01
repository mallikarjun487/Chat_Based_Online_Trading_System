let token = localStorage.getItem("auth_token") || "";

function setOutput(id, data) {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

async function api(path, method = "GET", body) {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const data = await response.json();
  if (response.status === 401 && data?.message === "Invalid token") {
    setToken("");
    if (window.location.pathname !== "/login.html") {
      window.location.href = "/login.html";
    }
  }
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatReadableDate(value) {
  if (!value) {
    return "Unknown time";
  }
  const numeric = Number(value);
  const date = Number.isNaN(numeric) ? new Date(value) : new Date(numeric * (String(value).length <= 10 ? 1000 : 1));
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString();
}

function appendChatBubble(role, text, metaLabel = "") {
  const chatOutput = document.getElementById("chatOutput");
  if (!chatOutput) {
    return;
  }
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;

  if (metaLabel) {
    const meta = document.createElement("div");
    meta.className = "chat-meta";
    meta.textContent = metaLabel;
    bubble.appendChild(meta);
  }

  chatOutput.appendChild(bubble);
  chatOutput.scrollTop = chatOutput.scrollHeight;
}

function renderProfile(userOrError) {
  const el = document.getElementById("profileOutput");
  if (!el) return;
  if (typeof userOrError === "string") {
    el.innerHTML = `<div class="portfolio-error">${escapeHtml(userOrError)}</div>`;
    return;
  }
  const user = userOrError;
  if (!user) {
    el.innerHTML = "";
    return;
  }
  const cash = Number(user.cashBalance);
  const cashStr = "₹" + (isNaN(cash) ? "0" : cash.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const holdings = user.holdings && typeof user.holdings === "object" ? user.holdings : {};
  const symbols = Object.keys(holdings);
  let holdingsHtml = "";
  if (symbols.length === 0) {
    holdingsHtml = "<p class=\"muted\">No holdings yet. Place orders from the Trades page.</p>";
  } else {
    holdingsHtml = `
      <table class="holdings-table">
        <thead><tr><th>Symbol</th><th>Quantity</th><th>Avg price</th></tr></thead>
        <tbody>
          ${symbols.map((s) => {
            const h = holdings[s];
            const qty = h && h.quantity != null ? h.quantity : 0;
            const avg = h && h.avgPrice != null ? Number(h.avgPrice).toFixed(2) : "0.00";
            return `<tr><td>${escapeHtml(s)}</td><td>${escapeHtml(String(qty))}</td><td>₹${escapeHtml(avg)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    `;
  }
  el.innerHTML = `
    <div class="profile-summary">
      <div class="profile-item">
        <div class="label">Name</div>
        <div class="value">${escapeHtml(user.name || "—")}</div>
      </div>
      <div class="profile-item">
        <div class="label">Email</div>
        <div class="value">${escapeHtml(user.email || "—")}</div>
      </div>
      <div class="profile-item">
        <div class="label">Role</div>
        <div class="value">${escapeHtml(user.role || "—")}</div>
      </div>
      <div class="profile-item">
        <div class="label">Cash balance</div>
        <div class="value">${cashStr}</div>
      </div>
    </div>
    <div>
      <h3 style="margin:0 0 0.5rem; font-size:0.95rem">Holdings</h3>
      ${holdingsHtml}
    </div>
  `;
}

function renderNewsCards(newsItems) {
  const newsOutput = document.getElementById("newsOutput");
  if (!newsOutput) {
    return;
  }

  if (!Array.isArray(newsItems) || newsItems.length === 0) {
    newsOutput.innerHTML = '<div class="empty-state">No news available right now.</div>';
    return;
  }

  newsOutput.innerHTML = newsItems
    .map((item) => {
      const headline = escapeHtml(item.headline || "Untitled news");
      const source = escapeHtml(item.source || "Unknown source");
      const datetime = escapeHtml(formatReadableDate(item.datetime));
      const url = item.url && item.url !== "#" ? item.url : "";
      const safeUrl = escapeHtml(url);
      const linkHtml = safeUrl
        ? `<a class="news-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Read full article</a>`
        : '<span class="news-link">No external link</span>';

      return `
        <article class="news-card">
          <h3 class="news-headline">${headline}</h3>
          <div class="news-meta">
            <span>${source}</span>
            <span>${datetime}</span>
          </div>
          ${linkHtml}
        </article>
      `;
    })
    .join("");
}

function setToken(value) {
  token = value || "";
  if (token) {
    localStorage.setItem("auth_token", token);
  } else {
    localStorage.removeItem("auth_token");
  }
}

function requiresAuthForPage() {
  const protectedPages = ["/portfolio.html", "/trades.html", "/chat.html", "/admin.html"];
  return protectedPages.includes(window.location.pathname);
}

function ensureAuth() {
  if (requiresAuthForPage() && !token) {
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

ensureAuth();

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const data = await api("/api/auth/register", "POST", {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password")
      });
      setToken(data.token);
      document.getElementById("authStatus").textContent = `Registered and logged in as ${data.user.email}`;
    } catch (error) {
      document.getElementById("authStatus").textContent = error.message;
    }
  });
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const data = await api("/api/auth/login", "POST", {
        email: form.get("email"),
        password: form.get("password")
      });
      setToken(data.token);
      document.getElementById("authStatus").textContent = `Logged in as ${data.user.email} (${data.user.role})`;
    } catch (error) {
      document.getElementById("authStatus").textContent = error.message;
    }
  });
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    setToken("");
    document.getElementById("authStatus").textContent = "Logged out";
  });
}

const loadProfileBtn = document.getElementById("loadProfileBtn");
if (loadProfileBtn) {
  loadProfileBtn.addEventListener("click", async () => {
    try {
      const data = await api("/api/profile");
      renderProfile(data.user);
    } catch (error) {
      renderProfile(error.message);
    }
  });
}

const profileForm = document.getElementById("profileForm");
if (profileForm) {
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = {};

    if (form.get("name")) {
      payload.name = form.get("name");
    }
    if (form.get("cashBalance")) {
      payload.cashBalance = Number(form.get("cashBalance"));
    }

    try {
      const data = await api("/api/profile", "PUT", payload);
      renderProfile(data.user);
    } catch (error) {
      renderProfile(error.message);
    }
  });
}

const tradeForm = document.getElementById("tradeForm");
if (tradeForm) {
  tradeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const data = await api("/api/trades", "POST", {
        action: form.get("action"),
        symbol: form.get("symbol"),
        quantity: Number(form.get("quantity"))
      });
      setOutput("tradesOutput", data);
    } catch (error) {
      setOutput("tradesOutput", error.message);
    }
  });
}

const loadTradesBtn = document.getElementById("loadTradesBtn");
if (loadTradesBtn) {
  loadTradesBtn.addEventListener("click", async () => {
    try {
      const data = await api("/api/trades");
      setOutput("tradesOutput", data.transactions);
    } catch (error) {
      setOutput("tradesOutput", error.message);
    }
  });
}

const chatForm = document.getElementById("chatForm");
if (chatForm) {
  const chatOutput = document.getElementById("chatOutput");
  if (chatOutput) {
    chatOutput.innerHTML = "";
    appendChatBubble("bot", "Hi! I can help with stock prices, portfolio value, and market news.");
  }

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const message = String(form.get("message") || "").trim();
    if (!message) {
      return;
    }

    appendChatBubble("user", message, "You");
    event.target.reset();

    try {
      const data = await api("/api/chat", "POST", {
        message
      });
      appendChatBubble("bot", data.reply || "No response from assistant.", "Assistant");
    } catch (error) {
      appendChatBubble("bot", error.message, "Assistant");
    }
  });
}

const loadNewsBtn = document.getElementById("loadNewsBtn");
if (loadNewsBtn) {
  loadNewsBtn.addEventListener("click", async () => {
    try {
      const data = await api("/api/news");
      renderNewsCards(data.news);
    } catch (error) {
      const newsOutput = document.getElementById("newsOutput");
      if (newsOutput) {
        newsOutput.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      }
    }
  });
}

const loadUsersBtn = document.getElementById("loadUsersBtn");
if (loadUsersBtn) {
  loadUsersBtn.addEventListener("click", async () => {
    try {
      const data = await api("/api/admin/users");
      setOutput("adminOutput", data.users);
    } catch (error) {
      setOutput("adminOutput", error.message);
    }
  });
}

const adminUpdateForm = document.getElementById("adminUpdateForm");
if (adminUpdateForm) {
  adminUpdateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const field = form.get("field");
    let value = form.get("value");

    if (field === "isActive") {
      value = value === "true";
    }

    try {
      const data = await api(`/api/admin/users/${form.get("id")}`, "PATCH", {
        [field]: value
      });
      setOutput("adminOutput", data.user);
    } catch (error) {
      setOutput("adminOutput", error.message);
    }
  });
}

if (window.location.pathname === "/news.html" && loadNewsBtn) {
  loadNewsBtn.click();
}

if (window.location.pathname === "/portfolio.html" && loadProfileBtn) {
  loadProfileBtn.click();
}

if (window.location.pathname === "/trades.html" && loadTradesBtn) {
  loadTradesBtn.click();
}

if (window.location.pathname === "/admin.html" && loadUsersBtn) {
  loadUsersBtn.click();
}

if ((window.location.pathname === "/login.html" || window.location.pathname === "/register.html") && token) {
  const authStatus = document.getElementById("authStatus");
  if (authStatus) {
    authStatus.textContent = "You are already logged in. Open the other pages from the menu.";
  }
}
