function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function getStatusClass(status = "") {
  const normalized = String(status).toLowerCase();
  if (normalized.includes("delivered")) return "success";
  if (normalized.includes("approved")) return "success";
  if (normalized.includes("rejected") || normalized.includes("cancel")) return "danger";
  if (normalized.includes("printing") || normalized.includes("delivery")) return "active";
  return "pending";
}

function loginUser() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(err => alert("Login failed: " + err.message));
}

window.loginUser = loginUser;

firebase.auth().onAuthStateChanged(async (user) => {
  const container = document.getElementById("orders-list");

  if (!user) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="12" cy="7" r="4"></circle>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        </svg>
        <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-top: 6px;">Login to View Orders</h3>
        <p style="color: var(--text-muted); font-size: 0.95rem;">Sign in with your Google account to access your purchase history and live print tracking.</p>
        <button onclick="loginUser()" class="add-card-btn" style="max-width: 180px; margin-top: 14px;">Login with Google</button>
      </div>
    `;
    return;
  }

  try {
    const snapshot = await db.collection("orders")
      .where("email", "==", user.email)
      .orderBy("timestamp", "desc")
      .get();

    if (snapshot.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-top: 6px;">No Orders Yet</h3>
          <p style="color: var(--text-muted); max-width: 320px; font-size: 0.95rem;">You haven't placed any custom 3D printed orders yet. Explore our custom catalog today!</p>
          <a href="index.html" class="add-card-btn" style="max-width: 180px; margin-top: 14px; display: inline-flex;">Explore Catalog</a>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    snapshot.forEach(doc => {
      const order = doc.data();
      const idWithoutHash = String(order.order_id || "").replace("#", "");
      const placedOn = order.timestamp ? order.timestamp.toDate().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "-";
      const statusClass = getStatusClass(order.status);
      const itemCount = (order.items || []).length;
      const requestLabel = order.order_type === "bulk_order" ? "Bulk order request" :
        order.order_type === "printing_service" ? "3D printing request" : "";
      
      const card = document.createElement("a");
      card.href = `order-details.html?id=${encodeURIComponent(idWithoutHash)}`;
      card.className = "order-card";
      card.innerHTML = `
        <div class="order-card-info">
          <div class="order-card-header">
            <h3>${requestLabel || "Order"} ${order.order_id || ""}</h3>
            <span class="order-status ${statusClass}">${order.status || "Order Placed"}</span>
          </div>
          <p><strong>${requestLabel ? "Quote" : "Total"}:</strong> ${requestLabel ? "Pending" : formatPrice(order.total)} &bull; <strong>Date:</strong> ${placedOn}</p>
          <p style="font-size: 0.84rem; color: var(--text-muted);">${requestLabel || `${itemCount} product${itemCount === 1 ? '' : 's'}`} &bull; ${order.payment_ref || "Cash on Delivery"}</p>
        </div>
        <div class="arrow">
          <span>View Details</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    container.innerHTML = `
      <div class="empty-state">
        <p style="color: var(--danger);">Failed to load orders. Please refresh and try again.</p>
      </div>
    `;
  }
});
