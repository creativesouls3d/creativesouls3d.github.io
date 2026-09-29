function getOrderId() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  return id ? `#${id.replace(/^#/, "")}` : null;
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
  const normalized = String(status).toLowerCase();
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
    container.innerHTML = `
      <div class="empty-state">
        <h3>Invalid Order ID</h3>
        <p>No valid order ID was specified in the link.</p>
        <a href="orders.html" class="add-card-btn" style="max-width: 180px; margin-top: 14px; display: inline-flex;">View All Orders</a>
      </div>
    `;
    return;
  }

  try {
    const doc = await db.collection("orders").doc(orderId).get();

    if (!doc.exists) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Order Not Found</h3>
          <p>We could not find an order with ID <strong>${escapeHTML(orderId)}</strong>.</p>
          <a href="orders.html" class="add-card-btn" style="max-width: 180px; margin-top: 14px; display: inline-flex;">View All Orders</a>
        </div>
      `;
      return;
    }

    const data = doc.data();

    if (data.email !== user.email) {
      container.innerHTML = `
        <div class="empty-state">
          <p style="color: var(--danger); font-weight: 700;">You are not authorized to view this order.</p>
          <a href="orders.html" class="add-card-btn" style="max-width: 180px; margin-top: 14px; display: inline-flex;">Back to Your Orders</a>
        </div>
      `;
      return;
    }

    const items = data.items || [];
    const cleanId = orderId.replace("#", "");
    const itemsHTML = items.map(item => `
      <div class="order-item-row">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${escapeHTML(String(item.imageUrl || '').split(',').map(url => url.trim()).find(Boolean) || 'logo_creativesouls.jpg')}" alt="${escapeHTML(item.productName || 'Item')}" style="width: 48px; height: 48px; border-radius: var(--radius-sm); object-fit: contain; background: #ffffff; border: 1px solid var(--border); padding: 4px;" />
          <div>
            <strong>${escapeHTML(item.productName || "Untitled product")}</strong>
            ${item.colour ? `<span>Colour: ${escapeHTML(item.colour)}</span>` : ""}
            ${item.size ? `<span>Size: ${escapeHTML(item.size)}</span>` : ""}
            ${item.customization ? `<span>Customization: ${escapeHTML(item.customization)}</span>` : ""}
            <span>Quantity: ${Number(item.quantity || 0)} &times; ${formatPrice(item.price)}</span>
          </div>
        </div>
        <strong>${formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
      </div>
    `).join("");

    const status = data.status || "Order Placed";
    const placedOn = data.timestamp ? data.timestamp.toDate().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }) : "-";
    const invoiceItemsHTML = items.map(item => `
      <tr>
        <td>${escapeHTML(item.productName || "Untitled product")}${item.colour ? `<br><small>Colour: ${escapeHTML(item.colour)}</small>` : ""}${item.size ? `<br><small>Size: ${escapeHTML(item.size)}</small>` : ""}${item.customization ? `<br><small>Customization: ${escapeHTML(item.customization)}</small>` : ""}</td>
        <td>${Number(item.quantity || 0)}</td>
        <td>${formatPrice(item.price)}</td>
        <td>${formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</td>
      </tr>
    `).join("");
    const paymentMode = String(data.payment_ref || "Cash on Delivery").replaceAll("-", " ");
    const isPickup = data.fulfillment_type === "pickup";
    const isServiceRequest = data.order_type === "bulk_order" || data.order_type === "printing_service";
    const serviceRequest = data.service_request || {};
    const requestLabels = {
      description: "Products / design requested",
      quantity: "Quantity",
      reference_url: "Reference link",
      needed_by: "Needed by",
      file_url: "3D file",
      dimensions: "Approximate dimensions",
      material: "Material preference",
      colour: "Color preference",
      notes: "Additional instructions"
    };
    const requestDetailsHTML = Object.entries(serviceRequest).filter(([, value]) => value !== "" && value != null).map(([key, value]) => {
      const label = requestLabels[key] || key;
      if ((key === "file_url" || key === "reference_url") && /^https?:\/\//i.test(String(value))) {
        return `<div><dt>${escapeHTML(label)}</dt><dd><a href="${escapeHTML(value)}" target="_blank" rel="noopener noreferrer">Open link</a></dd></div>`;
      }
      return `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`;
    }).join("");
    if (isServiceRequest) document.getElementById("print-invoice-button").style.display = "none";
    document.getElementById("invoice-print").innerHTML = `
      <header>
        <h1>INVOICE</h1>
        <strong>Creative Souls 3D</strong>
        <div>Personalized 3D Printed Art, Gifts & Keepsakes</div>
      </header>
      <div class="invoice-meta">
        <div><strong>Invoice / Order No.</strong><br>${escapeHTML(data.order_id || orderId)}</div>
        <div><strong>Invoice Date</strong><br>${escapeHTML(placedOn)}</div>
        <div><strong>Payment Mode</strong><br>${escapeHTML(paymentMode)}</div>
      </div>
      <div class="invoice-parties">
        <div><strong>Billed To</strong><br>${escapeHTML(data.name || "-")}<br>${escapeHTML(data.email || "")}<br>${escapeHTML(data.phone || "")}</div>
        <div><strong>${isPickup ? "Pickup Location" : "Delivery Address"}</strong><br>${escapeHTML(data.pickup_location || data.address || "-")}</div>
      </div>
      <h2>Items</h2>
      <table>
        <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
        <tbody>${invoiceItemsHTML || "<tr><td colspan='4'>No items</td></tr>"}</tbody>
      </table>
      <div class="invoice-totals">
        <div><span>Items Subtotal</span><strong>${formatPrice(data.item_total)}</strong></div>
        <div><span>Delivery Charge</span><strong>${formatPrice(data.delivery_charge)}</strong></div>
        ${Number(data.discount || 0) > 0 ? `<div><span>Discount</span><strong>-${formatPrice(data.discount)}</strong></div>` : ""}
        <div class="invoice-grand-total"><span>Total</span><strong>${formatPrice(data.total)}</strong></div>
      </div>
      ${data.order_note ? `<div class="invoice-note"><strong>Customer note:</strong> ${escapeHTML(data.order_note)}</div>` : ""}
      <div class="invoice-note">This is a machine-generated invoice. No signature is required.</div>
    `;
    if (isServiceRequest) document.getElementById("invoice-print").remove();

    container.innerHTML = `
      <div class="order-detail-page">
        <!-- Hero Card -->
        <section class="order-hero-card">
          <div>
            <span class="order-eyebrow">Order Summary</span>
            <h1>Order ${escapeHTML(data.order_id || "")}</h1>
            <p>Placed on ${escapeHTML(placedOn)}</p>
            <div style="margin-top: 14px;">
              <a href="track-order.html?id=${encodeURIComponent(cleanId)}" class="track-link" style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; border-color: rgba(245, 158, 11, 0.5);">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Track Live Progress ➔
              </a>
            </div>
          </div>
          <div class="order-status-block">
            <span class="order-status ${getStatusClass(status)}">${escapeHTML(status)}</span>
            <strong>${isServiceRequest ? "Quote pending" : formatPrice(data.total)}</strong>
          </div>
        </section>

        <!-- 2-Column Info Grid -->
        <section class="order-detail-grid">
          <article class="order-panel">
            <h2>${isServiceRequest ? "Contact & Fulfillment" : "Delivery Details"}</h2>
            <dl class="detail-list">
              <div><dt>Recipient</dt><dd>${escapeHTML(data.name || "-")}</dd></div>
              <div><dt>Email Address</dt><dd>${escapeHTML(data.email || "-")}</dd></div>
              <div><dt>Phone Number</dt><dd>${escapeHTML(data.phone || "-")}</dd></div>
              <div><dt>${isPickup ? "Pickup Location" : "Shipping Address"}</dt><dd>${escapeHTML(data.pickup_location || data.address || "-")}</dd></div>
              <div><dt>${isServiceRequest ? "Next step" : "Expected Delivery"}</dt><dd>${escapeHTML(data.expected_delivery || "-")}</dd></div>
            </dl>
          </article>

          <article class="order-panel">
            <h2>${isServiceRequest ? "Request Status" : "Payment & Invoice"}</h2>
            <dl class="detail-list">
              <div><dt>Payment Mode</dt><dd>${escapeHTML(data.payment_ref || "Cash on Delivery")}</dd></div>
              <div><dt>Fulfillment</dt><dd>${isPickup ? "Store pickup" : "Home delivery"}</dd></div>
              <div><dt>Coupon Applied</dt><dd>${escapeHTML(data.coupon_code || "None")}</dd></div>
              <div><dt>Items Count</dt><dd>${items.length} item${items.length === 1 ? "" : "s"}</dd></div>
              <div><dt>Status</dt><dd>${escapeHTML(status)}</dd></div>
            </dl>
          </article>
        </section>

        ${isServiceRequest ? `
          <section class="order-panel">
            <h2>${data.order_type === "bulk_order" ? "Bulk Order Request" : "3D Printing Service Request"}</h2>
            <dl class="detail-list">${requestDetailsHTML}</dl>
          </section>
        ` : ""}

        ${data.order_note ? `<section class="order-panel"><h2>Order Note</h2><p>${escapeHTML(data.order_note)}</p></section>` : ""}

        <!-- Product Items -->
        <section class="order-panel">
          <h2>${isServiceRequest ? "Request Summary" : `Items in this Order (${items.length})`}</h2>
          <div class="order-items-list">
            ${itemsHTML || "<div class='empty-state'>No items found for this order.</div>"}
          </div>
        </section>

        <!-- Bill Summary -->
        <section class="order-panel total-panel" style="${isServiceRequest ? "display:none;" : ""}">
          <h2>Payment Summary</h2>
          <div class="total-row"><span>Item Total</span><strong>${formatPrice(data.item_total)}</strong></div>
          <div class="total-row"><span>Delivery Charge</span><strong>${formatPrice(data.delivery_charge)}</strong></div>
          ${Number(data.discount || 0) > 0 ? `<div class="total-row" style="color: var(--accent-emerald);"><span>Discount</span><strong>-${formatPrice(data.discount)}</strong></div>` : ""}
          <div class="total-row grand-total"><span>Total Paid</span><strong>${formatPrice(data.total)}</strong></div>
        </section>
      </div>
    `;
  } catch (err) {
    console.error("Failed to fetch order details:", err);
    container.innerHTML = `
      <div class="empty-state">
        <p style="color: var(--danger); font-weight: 700;">Error loading order details. Please try again later.</p>
      </div>
    `;
  }
});
