function goBackOrHome(fallback = "index.html") {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = fallback;
}

// Keep the primary navigation consistent across the storefront.
const primaryNav = document.querySelector("header .cart-link");
if (primaryNav) {
  primaryNav.innerHTML = `
    <div class="account-nav-wrap">
      <button type="button" class="nav-pill account-nav-link" aria-haspopup="true" aria-label="Account menu">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <span class="account-nav-label">Account</span><span class="account-nav-caret" aria-hidden="true"></span>
      </button>
    </div>
    <a href="cart.html" class="nav-pill cart-nav-link">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
      Cart <span class="cart-badge" id="cart-badge">0</span>
    </a>
    <button type="button" class="nav-pill nav-login-btn" style="display:none">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.35 11.1h-9.17v2.73h5.51c-.33 1.94-1.87 3.32-3.84 3.32-2.31 0-4.18-1.87-4.18-4.18s1.87-4.18 4.18-4.18c1.07 0 2.05.41 2.8 1.09l2.06-2.06C17.39 6.55 15.42 5.8 13.18 5.8 9.21 5.8 6 9.01 6 12.98s3.21 7.18 7.18 7.18c4.15 0 6.91-2.92 6.91-7.03 0-.71-.07-1.39-.2-2.03z"/></svg>
      Login
    </button>`;

  const loginButton = primaryNav.querySelector(".nav-login-btn");
  const existingLoginButton = document.getElementById("login-btn");
  if (existingLoginButton) loginButton.remove();
  loginButton.addEventListener("click", () => {
    if (!window.firebase?.auth) return;
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider())
      .catch(error => window.showToast?.(`Login failed: ${error.message}`, "danger"));
  });

  if (window.firebase?.auth) {
    firebase.auth().onAuthStateChanged(user => {
      const accountLink = primaryNav.querySelector(".account-nav-link");
      const accountWrap = primaryNav.querySelector(".account-nav-wrap");
      accountLink.querySelector(".account-nav-label").textContent = user ? "Account" : "Login";
      accountLink.setAttribute("aria-label", user ? "Account and orders" : "Login");
      loginButton.style.display = user ? "none" : "inline-flex";
      accountWrap.style.display = user ? "block" : "none";
    });
    loginButton.style.display = "none";
  } else {
    primaryNav.querySelector(".account-nav-wrap").style.display = "none";
    loginButton.style.display = "inline-flex";
  }
}

const header = document.querySelector("body > header");
let accountPopup = document.getElementById("dropdown-menu");
if (header && !accountPopup) {
  accountPopup = document.createElement("div");
  accountPopup.id = "dropdown-menu";
  accountPopup.className = "dropdown-menu";
  (primaryNav?.querySelector(".account-nav-wrap") || header).appendChild(accountPopup);
} else if (accountPopup && primaryNav?.querySelector(".account-nav-wrap")) {
  primaryNav.querySelector(".account-nav-wrap").appendChild(accountPopup);
}
const accountPopupHome = accountPopup?.parentElement || null;

if (accountPopup) {
  accountPopup.innerHTML = `
    <div class="account-popup-profile">
      <img class="account-popup-avatar" src="https://www.svgrepo.com/show/384674/account-avatar-profile-user-11.svg" alt="" />
      <div><strong class="account-popup-name">Welcome</strong><span class="account-popup-email">Sign in to your account</span></div>
    </div>
    <div class="account-popup-links">
      <a href="account.html"><span class="account-popup-icon" aria-hidden="true">◎</span><span>Your Account</span><span class="account-popup-arrow" aria-hidden="true">›</span></a>
      <a href="orders.html"><span class="account-popup-icon" aria-hidden="true">▤</span><span>My Orders</span><span class="account-popup-arrow" aria-hidden="true">›</span></a>
      <a href="admin.html" class="admin-dashboard-link" hidden><span class="account-popup-icon" aria-hidden="true">⚙</span><span>Admin Dashboard</span><span class="account-popup-arrow" aria-hidden="true">›</span></a>
      <a href="cart.html"><span class="account-popup-icon" aria-hidden="true">▣</span><span>Your Cart</span><span class="account-popup-arrow" aria-hidden="true">›</span></a>
    </div>
    <button type="button" class="popup-logout-btn"><span aria-hidden="true">↪</span> Log out</button>`;
  const popupLogoutButton = accountPopup.querySelector(".popup-logout-btn");
  popupLogoutButton.addEventListener("click", () => {
    if (window.firebase?.auth) firebase.auth().signOut()
      .catch(error => window.showToast?.(`Could not log out: ${error.message}`, "danger"));
  });
  if (window.firebase?.auth) {
    firebase.auth().onAuthStateChanged(user => {
      const adminLink = accountPopup.querySelector(".admin-dashboard-link");
      if (adminLink) adminLink.hidden = String(user?.email || "").trim().toLowerCase() !== "luvs2006@gmail.com";
      popupLogoutButton.style.display = user ? "block" : "none";
      accountPopup.querySelector(".account-popup-name").textContent = user?.displayName || (user ? "Your account" : "Welcome");
      accountPopup.querySelector(".account-popup-email").textContent = user?.email || "Sign in to your account";
      accountPopup.querySelector(".account-popup-avatar").src = user?.photoURL || "https://www.svgrepo.com/show/384674/account-avatar-profile-user-11.svg";
    });
  } else {
    popupLogoutButton.style.display = "none";
  }
}

function toggleAccountPopup(forceOpen) {
  if (!accountPopup) return;
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : accountPopup.style.display !== "flex";
  const phonePopup = window.matchMedia("(max-width: 640px)").matches;
  if (phonePopup && shouldOpen && accountPopup.parentElement !== document.documentElement) {
    document.documentElement.appendChild(accountPopup);
  } else if (phonePopup && !shouldOpen && accountPopup.parentElement !== accountPopupHome) {
    accountPopupHome?.appendChild(accountPopup);
  }
  accountPopup.style.display = shouldOpen ? "flex" : "none";
  document.documentElement.classList.toggle("account-popup-open", phonePopup && shouldOpen);
}
window.toggleAccountPopup = toggleAccountPopup;

const accountNavWrap = primaryNav?.querySelector(".account-nav-wrap");
primaryNav?.querySelector(".account-nav-link")?.addEventListener("click", event => {
  event.preventDefault();
  toggleAccountPopup();
});
accountNavWrap?.addEventListener("focusout", event => {
  if (!accountNavWrap.contains(event.relatedTarget)) toggleAccountPopup(false);
});

// Touch browsers can synthesize hover and focus before click. Keep hover
// behavior for mouse/trackpad users without letting those events cancel a tap.
if (accountNavWrap && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  accountNavWrap.addEventListener("mouseenter", () => toggleAccountPopup(true));
  accountNavWrap.addEventListener("mouseleave", () => toggleAccountPopup(false));
}

document.addEventListener("click", event => {
  if (!accountPopup || accountPopup.style.display !== "flex") return;
  const accountTrigger = event.target.closest(".account-nav-link");
  const profileTrigger = event.target.closest("#user-photo");
  if (!accountPopup.contains(event.target) && !accountTrigger && !profileTrigger) toggleAccountPopup(false);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-back]");
  if (!button) return;

  goBackOrHome(button.dataset.fallback || "index.html");
});

const serviceMenuBar = document.getElementById("service-menu-bar");
if (serviceMenuBar) {
  let scrollUpdateQueued = false;
  const updateServiceMenuVisibility = () => {
    const hide = window.scrollY > 12;
    serviceMenuBar.classList.toggle("is-hidden", hide);
    serviceMenuBar.setAttribute("aria-hidden", hide ? "true" : "false");
    serviceMenuBar.inert = hide;
    scrollUpdateQueued = false;
  };

  updateServiceMenuVisibility();
  window.addEventListener("scroll", () => {
    if (scrollUpdateQueued) return;
    scrollUpdateQueued = true;
    window.requestAnimationFrame(updateServiceMenuVisibility);
  }, { passive: true });
}

// Cart Count Synchronizer
function getCartItemCount() {
  try {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    return cart.reduce((total, item) => total + Number(item.quantity || 0), 0);
  } catch {
    return 0;
  }
}

function updateHeaderCartCount() {
  const count = getCartItemCount();
  const badges = document.querySelectorAll(".cart-badge, #cart-badge");
  
  badges.forEach(badge => {
    badge.textContent = count;
    if (count > 0) {
      badge.style.display = "inline-flex";
      badge.classList.add("bump");
      setTimeout(() => badge.classList.remove("bump"), 300);
    } else {
      badge.style.display = "none";
    }
  });
}

// Global Toast System
function showToast(message, type = "success", actionText = "", actionUrl = "") {
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.className = `toast-item toast-${type}`;
  
  const iconSvg = type === "success" 
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`
    : type === "danger"
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

  let actionHtml = "";
  if (actionText && actionUrl) {
    actionHtml = `<a href="${actionUrl}" class="toast-action">${actionText}</a>`;
  }

  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${iconSvg}</span>
      <span class="toast-message">${message}</span>
    </div>
    ${actionHtml}
    <button class="toast-close" aria-label="Close notification">&times;</button>
  `;

  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.classList.add("toast-hiding");
    setTimeout(() => toast.remove(), 250);
  });

  toastContainer.appendChild(toast);

  // Auto remove after 3.8s
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add("toast-hiding");
      setTimeout(() => toast.remove(), 250);
    }
  }, 3800);
}

window.updateHeaderCartCount = updateHeaderCartCount;
window.showToast = showToast;
window.getCartItemCount = getCartItemCount;

window.addEventListener("DOMContentLoaded", () => {
  updateHeaderCartCount();
});

window.addEventListener("storage", (e) => {
  if (e.key === "cart") {
    updateHeaderCartCount();
  }
});
