function goBackOrHome(fallback = "index.html") {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = fallback;
}

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
