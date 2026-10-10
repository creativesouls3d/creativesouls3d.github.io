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

function itemImageUrl(item = {}) {
  return String(item.imageUrl || "").split(",").map(url => url.trim()).find(Boolean) || "logo_creativesouls.jpg";
}

function generateRandom6Digit() {
  if (window.crypto && window.crypto.getRandomValues) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    return String(100000 + (buffer[0] % 900000));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function generateUniqueTicketId() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const ticketId = `TKT-${generateRandom6Digit()}`;
    try {
      const snap = await db.collection("tickets").doc(ticketId).get();
      if (!snap.exists) return ticketId;
    } catch (err) {
      console.warn("Error checking ticket ID existence:", err);
      return ticketId;
    }
  }
  return `TKT-${Date.now().toString().slice(-8)}`;
}

function productCheckboxHTML(items) {
  if (!items.length) {
    return `<p class="issue-panel-intro">No products were listed on this order. You can still describe the issue below.</p>`;
  }
  return items.map((item, index) => {
    const meta = [
      item.colour ? `Colour: ${escapeHTML(item.colour)}` : "",
      item.size ? `Size: ${escapeHTML(item.size)}` : "",
      `Qty: ${Number(item.quantity || 0)}`
    ].filter(Boolean).join(" · ");
    return `
      <label class="issue-product-option">
        <input type="checkbox" name="issue-product" value="${index}" checked />
        <img src="${escapeHTML(itemImageUrl(item))}" alt="" />
        <span>
          <strong>${escapeHTML(item.productName || "Untitled product")}</strong>
          <small>${meta}</small>
        </span>
      </label>
    `;
  }).join("");
}

function existingTicketsHTML(tickets) {
  if (!tickets.length) return "";
  const rows = tickets.map(ticket => `
    <div class="issue-existing-item">
      <span><strong>${escapeHTML(ticket.ticket_id)}</strong> · ${escapeHTML(ticket.status || "Open")}</span>
      <span>${escapeHTML((ticket.issue || "").slice(0, 80))}${(ticket.issue || "").length > 80 ? "…" : ""}</span>
    </div>
  `).join("");
  return `
    <div class="issue-existing-list">
      <p class="issue-panel-intro" style="margin:0 0 8px;">Tickets already raised for this order:</p>
      ${rows}
    </div>
  `;
}

function bindIssueForm({ user, orderId, data, items }) {
  const toggle = document.getElementById("raise-issue-toggle");
  const form = document.getElementById("raise-issue-form");
  const message = document.getElementById("issue-form-message");
  const fileInput = document.getElementById("issue-media");
  const preview = document.getElementById("issue-file-preview");
  if (!toggle || !form) return;

  toggle.addEventListener("click", () => {
    const open = form.hidden;
    form.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.textContent = open ? "Hide issue form" : "Have any issues with the order? Raise an issue";
  });

  fileInput.addEventListener("change", () => {
    preview.innerHTML = "";
    [...fileInput.files].forEach(file => {
      const figure = document.createElement("figure");
      const caption = document.createElement("figcaption");
      caption.textContent = file.name;
      if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.muted = true;
        figure.append(video, caption);
      } else {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        figure.append(img, caption);
      }
      preview.append(figure);
    });
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const selectedIndexes = [...form.querySelectorAll('input[name="issue-product"]:checked')]
      .map(input => Number(input.value));
    const selectedProducts = selectedIndexes
      .map(index => items[index])
      .filter(Boolean)
      .map(item => ({
        productName: item.productName || "",
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        colour: item.colour || "",
        size: item.size || "",
        customization: item.customization || "",
        imageUrl: itemImageUrl(item)
      }));

    if (items.length && !selectedProducts.length) {
      message.textContent = "Select at least one product related to the issue.";
      message.style.color = "var(--danger)";
      return;
    }

    const issue = document.getElementById("issue-description").value.trim();
    if (!issue) {
      message.textContent = "Please describe the issue.";
      message.style.color = "var(--danger)";
      return;
    }

    const files = [...fileInput.files];
    const oversized = files.find(file => file.size > IMAGEKIT_MAX_FILE_BYTES);
    if (oversized) {
      message.textContent = `${oversized.name} is larger than 25 MB. Please choose a smaller photo or video.`;
      message.style.color = "var(--danger)";
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = files.length ? "Uploading media…" : "Submitting ticket…";
    message.textContent = "";

    try {
      const attachments = [];
      for (let i = 0; i < files.length; i++) {
        button.textContent = `Uploading media ${i + 1} of ${files.length}…`;
        attachments.push(await uploadFileToImageKit(files[i], `${IMAGEKIT_FOLDER}/${String(data.order_id || orderId).replace("#", "")}`));
      }

      button.textContent = "Saving ticket…";
      const ticketId = await generateUniqueTicketId();
      const ticket = {
        ticket_id: ticketId,
        order_id: data.order_id || orderId,
        order_doc_id: orderId,
        email: data.email || user.email || "",
        name: data.name || user.displayName || "",
        phone: data.phone || "",
        address: data.pickup_location || data.address || "",
        fulfillment_type: data.fulfillment_type || "",
        products: selectedProducts,
        issue,
        attachments,
        status: "Open",
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        user_uid: user.uid || ""
      };

      await db.collection("tickets").doc(ticketId).set(ticket);
      message.innerHTML = `Issue submitted. Ticket ID <strong>${escapeHTML(ticketId)}</strong>. We’ll review it shortly.`;
      message.style.color = "var(--accent-emerald-text)";
      button.textContent = "Ticket submitted";
      form.querySelectorAll("input:not([readonly]), textarea").forEach(field => { field.disabled = true; });
    } catch (err) {
      console.error("Could not submit issue ticket:", err);
      message.textContent = err.message || "Could not submit the issue. Please try again.";
      message.style.color = "var(--danger)";
      button.disabled = false;
      button.textContent = "Submit issue";
    }
  });
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
    let doc = await db.collection("orders").doc(orderId).get();
    if (!doc.exists) {
      const cleanId = orderId.replace(/^#/, "");
      doc = await db.collection("orders").doc(cleanId).get();
    }

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
    let existingTickets = [];
    try {
      const ticketsSnap = await db.collection("tickets")
        .where("email", "==", user.email)
        .where("order_id", "==", data.order_id || orderId)
        .get();
      existingTickets = ticketsSnap.docs.map(ticketDoc => ticketDoc.data());
    } catch (ticketErr) {
      try {
        const fallbackSnap = await db.collection("tickets").where("email", "==", user.email).get();
        existingTickets = fallbackSnap.docs
          .map(ticketDoc => ticketDoc.data())
          .filter(ticket => ticket.order_id === (data.order_id || orderId) || ticket.order_doc_id === orderId);
      } catch (fallbackErr) {
        console.warn("Could not load existing tickets:", fallbackErr || ticketErr);
      }
    }
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

        <section class="order-panel issue-panel">
          <h2>Have any issues with the order?</h2>
          <p class="issue-panel-intro">Raise an issue if something is wrong with this order. Your details are filled in from the order.</p>
          ${existingTicketsHTML(existingTickets)}
          <button type="button" class="issue-toggle" id="raise-issue-toggle" aria-expanded="false" aria-controls="raise-issue-form">Have any issues with the order? Raise an issue</button>
          <form id="raise-issue-form" class="service-request-form issue-form" hidden>
            <label>Order ID<input id="issue-order-id" value="${escapeHTML(data.order_id || orderId)}" readonly></label>
            <label>Name<input id="issue-name" value="${escapeHTML(data.name || user.displayName || "")}" readonly></label>
            <label>Email<input id="issue-email" type="email" value="${escapeHTML(data.email || user.email || "")}" readonly></label>
            <label>Phone<input id="issue-phone" value="${escapeHTML(data.phone || "")}" readonly></label>
            <label class="full-width">${isPickup ? "Pickup location" : "Address"}<textarea id="issue-address" rows="2" readonly>${escapeHTML(data.pickup_location || data.address || "")}</textarea></label>
            <fieldset class="full-width service-fields">
              <legend>Products in this order</legend>
              <div class="issue-product-list">${productCheckboxHTML(items)}</div>
            </fieldset>
            <label class="full-width">What is the issue?<textarea id="issue-description" rows="4" required placeholder="Describe what went wrong, missing items, damage, or anything else we should know."></textarea></label>
            <label class="full-width">Upload photos/videos
              <input id="issue-media" class="issue-file-input" type="file" accept="image/*,video/*" multiple>
            </label>
            <div id="issue-file-preview" class="issue-file-preview full-width"></div>
            <button type="submit">Submit issue</button>
          </form>
          <p id="issue-form-message" class="service-request-message" role="status" aria-live="polite"></p>
        </section>
      </div>
    `;
    bindIssueForm({ user, orderId, data, items });
  } catch (err) {
    console.error("Failed to fetch order details:", err);
    container.innerHTML = `
      <div class="empty-state">
        <p style="color: var(--danger); font-weight: 700;">Error loading order details. Please try again later.</p>
      </div>
    `;
  }
});
