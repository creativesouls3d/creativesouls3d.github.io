// ── DOM refs ──────────────────────────────────────────────────
const nameInput          = document.getElementById("name");
const addressInput       = document.getElementById("address");
const phoneInput         = document.getElementById("phone");
const profileForm        = document.getElementById("profile-form");
const statusMsg          = document.getElementById("status");
const profilePhoto       = document.getElementById("profile-photo");
const profileDisplayName = document.getElementById("profile-display-name");
const profileEmailEl     = document.getElementById("profile-email");
const profileMemberSince = document.getElementById("profile-member-since");
const saveBtn            = document.getElementById("save-btn");

const loginWall       = document.getElementById("login-wall");
const accountContent  = document.getElementById("account-content");

let currentUser     = null;
let walletUnsubscribe = null;

// ── Auth State ─────────────────────────────────────────────────
firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    // Show login wall, hide account content
    if (loginWall)      loginWall.style.display      = "flex";
    if (accountContent) accountContent.style.display = "none";
    return;
  }

  currentUser = user;

  // Show account content, hide login wall
  if (loginWall)      loginWall.style.display      = "none";
  if (accountContent) accountContent.style.display = "block";

  // Populate hero
  if (profilePhoto && user.photoURL) profilePhoto.src = user.photoURL;
  if (profileDisplayName) profileDisplayName.textContent = user.displayName || "Customer";
  if (profileEmailEl)     profileEmailEl.textContent     = user.email || "—";

  // Member-since badge (from Firebase metadata)
  if (profileMemberSince && user.metadata?.creationTime) {
    const d = new Date(user.metadata.creationTime);
    const formatted = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    profileMemberSince.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Member since ${formatted}
    `;
  }

  loadProfile(user.email);
  loadWallet(user.email);
});

// ── Logout ─────────────────────────────────────────────────────
function doLogout() {
  if (walletUnsubscribe) {
    walletUnsubscribe();
    walletUnsubscribe = null;
  }
  firebase.auth().signOut().then(() => {
    window.location.href = "index.html";
  }).catch(err => {
    console.error("Logout error:", err);
    if (typeof window.showToast === "function") {
      window.showToast("Logout failed. Please try again.", "error");
    }
  });
}

document.getElementById("logout-btn-hero")?.addEventListener("click", doLogout);
document.getElementById("logout-btn-main")?.addEventListener("click", doLogout);

// ── Wallet ─────────────────────────────────────────────────────
function loadWallet(email) {
  const balanceDisplay = document.getElementById("wallet-balance-display");
  const pointsDisplay  = document.getElementById("wallet-points-display");
  if (!balanceDisplay || !email) return;

  if (walletUnsubscribe) {
    walletUnsubscribe();
    walletUnsubscribe = null;
  }

  const userRef = db.collection("users").doc(email);

  walletUnsubscribe = userRef.onSnapshot(doc => {
    let balance = 0;
    let points  = 0;
    if (doc.exists) {
      const data = doc.data();
      balance = Number(data.wallet_balance || 0);
      points  = Number(data.walletPoints   || 0);
    }
    balanceDisplay.textContent = `₹${balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (pointsDisplay) pointsDisplay.textContent = `${points} pts`;
  }, err => {
    console.warn("Wallet snapshot listener error:", err);
  });

  loadWalletHistory(userRef);
}

async function loadWalletHistory(userRef) {
  const historyList  = document.getElementById("wallet-history-list");
  const historyCount = document.getElementById("wallet-history-count");
  if (!historyList) return;

  historyList.innerHTML = `<p class="wallet-history-loading">Fetching wallet activity…</p>`;

  try {
    const snap = await userRef.collection("wallet_history")
      .orderBy("createdAt", "desc").limit(20).get();

    if (snap.empty) {
      if (historyCount) historyCount.textContent = "0 transactions";
      historyList.innerHTML = `
        <div class="wallet-history-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>No wallet activity yet.</p>
          <span>Refunds, credits, and order deductions will appear here.</span>
        </div>`;
      return;
    }

    if (historyCount) historyCount.textContent = `${snap.size} record${snap.size === 1 ? "" : "s"}`;
    historyList.innerHTML = "";

    snap.docs.forEach(docSnap => {
      const tx       = docSnap.data();
      const isCredit = (tx.type || "credit").toLowerCase() === "credit";
      const amount   = Number(tx.amount || 0);
      const title    = tx.title || (isCredit ? "Wallet Refund / Credit" : "Order Payment");
      const orderTag = tx.orderId
        ? `<span class="wallet-tx-order">Order #${String(tx.orderId).replace(/^#/, "")}</span>`
        : "";

      let dateStr = "Recent";
      if (tx.createdAt) {
        const d = tx.createdAt.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
          });
        }
      }

      const row = document.createElement("div");
      row.className = `wallet-tx-item ${isCredit ? "tx-credit" : "tx-debit"}`;
      row.innerHTML = `
        <div class="wallet-tx-left">
          <div class="wallet-tx-icon">${isCredit ? "↓" : "↑"}</div>
          <div class="wallet-tx-meta">
            <strong class="wallet-tx-title">${escapeHTML(title)}</strong>
            <div class="wallet-tx-sub">
              <span>${dateStr}</span>
              ${orderTag}
            </div>
          </div>
        </div>
        <div class="wallet-tx-amount ${isCredit ? "amount-credit" : "amount-debit"}">
          ${isCredit ? "+" : "-"}₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>`;
      historyList.appendChild(row);
    });
  } catch (err) {
    console.error("Failed to load wallet history:", err);
    historyList.innerHTML = `<p style="color:var(--danger);font-size:0.85rem;padding:12px;text-align:center;">Could not load transaction history.</p>`;
  }
}

document.getElementById("wallet-refresh-btn")?.addEventListener("click", () => {
  if (!currentUser?.email) return;
  const btn = document.getElementById("wallet-refresh-btn");
  btn.classList.add("spinning");
  setTimeout(() => btn.classList.remove("spinning"), 650);
  loadWallet(currentUser.email);
});

// ── Profile ────────────────────────────────────────────────────
function loadProfile(email) {
  db.collection("users").doc(email).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      nameInput.value    = data.name    || currentUser.displayName || "";
      addressInput.value = data.address || "";
      phoneInput.value   = data.phone   || "";
    } else {
      nameInput.value = currentUser.displayName || "";
    }
  }).catch(err => {
    console.error("Failed to load profile:", err);
    statusMsg.textContent  = "Failed to load profile.";
    statusMsg.style.color  = "var(--danger)";
  });
}

profileForm?.addEventListener("submit", e => {
  e.preventDefault();

  const name    = nameInput.value.trim();
  const address = addressInput.value.trim();
  const phone   = phoneInput.value.trim();

  if (!name || !address || !phone) {
    statusMsg.textContent = "Please fill in all fields.";
    statusMsg.style.color = "var(--danger)";
    return;
  }

  saveBtn.disabled = true;
  saveBtn.innerHTML = `
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 1s linear infinite;">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/>
    </svg>
    Saving…`;

  db.collection("users").doc(currentUser.email).set(
    { name, address, phone, email: currentUser.email },
    { merge: true }
  ).then(() => {
    statusMsg.textContent = "✓ Profile updated successfully!";
    statusMsg.style.color = "var(--accent-emerald-text, #15803d)";
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
      </svg>
      Save Profile Details`;
    if (typeof window.showToast === "function") {
      window.showToast("Profile details saved successfully!", "success");
    }
  }).catch(err => {
    console.error("Error saving profile:", err);
    statusMsg.textContent = "Failed to update profile. Please try again.";
    statusMsg.style.color = "var(--danger)";
    saveBtn.disabled = false;
    saveBtn.innerHTML = `Save Profile Details`;
  });
});

// ── Helpers ────────────────────────────────────────────────────
function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}
