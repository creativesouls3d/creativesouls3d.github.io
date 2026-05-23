function getOrderId() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  return id ? `#${id}` : null;
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStatusClass(status = "") {
  const normalized = status.toLowerCase();
  if (normalized.includes("delivered") || normalized.includes("approved")) return "success";
  if (normalized.includes("rejected") || normalized.includes("cancel")) return "danger";
  if (normalized.includes("printing") || normalized.includes("delivery")) return "active";
  return "pending";
}

firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    alert("Please log in to view your order.");
    window.location.href = "index.html";
    return;
  }

  const orderId = getOrderId();
  const container = document.getElementById("order-info");

  if (!orderId) {
    container.innerHTML = "<div class='empty-state'>Invalid Order ID</div>";
    return;
  }

  try {
    const doc = await db.collection("orders").doc(orderId).get();

    if (!doc.exists) {
      container.innerHTML = "<div class='empty-state'>Order not found.</div>";
      return;
    }

    const data = doc.data();

    if (data.email !== user.email) {
      container.innerHTML = "<div class='empty-state'>You are not authorized to view this order.</div>";
      return;
    }

    const items = data.items || [];
    const itemsHTML = items.map(item => `
      <div class="order-item-row">
        <div>
          <strong>${escapeHTML(item.productName || "Untitled product")}</strong>
          <span>Quantity ${Number(item.quantity || 0)} x ${formatPrice(item.price)}</span>
        </div>
        <strong>${formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
      </div>
    `).join("");
    const status = data.status || "Processing";
    const placedOn = data.timestamp ? data.timestamp.toDate().toLocaleString("en-IN") : "-";

    container.innerHTML = `
      <div class="order-detail-page">
        <section class="order-hero-card">
          <div>
            <span class="order-eyebrow">Order summary</span>
            <h1>Order ${escapeHTML(data.order_id || "")}</h1>
            <p>Placed on ${escapeHTML(placedOn)}</p>
          </div>
          <div class="order-status-block">
            <span class="order-status ${getStatusClass(status)}">${escapeHTML(status)}</span>
            <strong>${formatPrice(data.total)}</strong>
          </div>
        </section>

        <section class="order-detail-grid">
          <article class="order-panel">
            <h2>Delivery Details</h2>
            <dl class="detail-list">
              <div><dt>Name</dt><dd>${escapeHTML(data.name || "-")}</dd></div>
              <div><dt>Email</dt><dd>${escapeHTML(data.email || "-")}</dd></div>
              <div><dt>Phone</dt><dd>${escapeHTML(data.phone || "-")}</dd></div>
              <div><dt>Address</dt><dd>${escapeHTML(data.address || "-")}</dd></div>
            </dl>
          </article>

          <article class="order-panel">
            <h2>Payment</h2>
            <dl class="detail-list">
              <div><dt>Payment Mode</dt><dd>${escapeHTML(data.payment_ref || "-")}</dd></div>
              <div><dt>Coupon Code</dt><dd>${escapeHTML(data.coupon_code || "-")}</dd></div>
              <div><dt>Items</dt><dd>${items.length}</dd></div>
            </dl>
          </article>
        </section>

        <section class="order-panel">
          <h2>Products Ordered</h2>
          <div class="order-items-list">
            ${itemsHTML || "<div class='empty-state'>No items found for this order.</div>"}
          </div>
        </section>

        <section class="order-panel total-panel">
          <h2>Bill Summary</h2>
          <div class="total-row"><span>Item Total</span><strong>${formatPrice(data.item_total)}</strong></div>
          <div class="total-row"><span>Delivery Charge</span><strong>${formatPrice(data.delivery_charge)}</strong></div>
          <div class="total-row"><span>Discount</span><strong>-${formatPrice(data.discount)}</strong></div>
          <div class="total-row grand-total"><span>Total Paid</span><strong>${formatPrice(data.total)}</strong></div>
        </section>
      </div>
    `;
  } catch (err) {
    console.error("Failed to fetch order details:", err);
    container.innerHTML = "<div class='empty-state'>Error loading order. Try again later.</div>";
  }
});
