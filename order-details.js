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
  if (normalized.includes("delivered") || normalized.includes("approved") || normalized.includes("picked")) return "success";
  if (normalized.includes("rejected") || normalized.includes("cancel")) return "danger";
  if (normalized.includes("printing") || normalized.includes("delivery") || normalized.includes("dispatch") || normalized.includes("ready") || normalized.includes("pickup")) return "active";
  return "pending";
}

function displayOrderStatus(status = "Order Placed", isPickup = false) {
  const value = String(status).toLowerCase();
  if (isPickup) {
    if (value.includes("picked") || value.includes("collected")) return "Order Picked Up";
    if (value.includes("ready") || value.includes("pickup")) return "Ready for Pickup";
    if (value.includes("delivered")) return "Order Picked Up";
    if (value.includes("delivery") || value.includes("dispatch") || value.includes("shipped")) return "Ready for Pickup";
    if (value.includes("printing") || value.includes("production")) return "Printing Product";
    if (value.includes("approved") || value.includes("confirm")) return "Order Approved";
    if (value.includes("placed") || value.includes("pending") || value.includes("request")) return "Order Placed";
    return status || "Order Placed";
  }
  if (value.includes("delivered")) return "Product Delivered";
  if (value.includes("delivery")) return "Out For Delivery";
  if (value.includes("dispatch") || value.includes("shipped")) return "Order Dispatched";
  if (value.includes("printing") || value.includes("production")) return "Printing Product";
  if (value.includes("approved") || value.includes("confirm")) return "Order Approved";
  if (value.includes("placed") || value.includes("pending") || value.includes("request")) return "Order Placed";
  return status || "Order Placed";
}

function itemImageUrl(item = {}) {
  return String(item.imageUrl || "").split(",").map(url => url.trim()).find(Boolean) || "logo_creativesouls.jpg";
}

let clientLightboxState = { images: [], index: 0, title: "" };

function ensureClientLightboxModal() {
  let dlg = document.getElementById("cs-client-photo-lightbox");
  if (dlg) return dlg;

  dlg = document.createElement("dialog");
  dlg.id = "cs-client-photo-lightbox";
  dlg.className = "cs-photo-lightbox";
  dlg.setAttribute("aria-label", "Image viewer");
  dlg.innerHTML = `
    <div class="cs-lightbox-header">
      <div class="cs-lightbox-info">
        <span class="cs-lightbox-title" id="cs-lightbox-title">Photo</span>
        <span class="cs-lightbox-counter" id="cs-lightbox-counter"></span>
      </div>
      <div class="cs-lightbox-actions">
        <a class="cs-lightbox-external" id="cs-lightbox-external" href="#" target="_blank" rel="noopener noreferrer" title="Open full resolution in new tab">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          <span>Open Full</span>
        </a>
        <button type="button" class="cs-lightbox-close" id="cs-lightbox-close" aria-label="Close photo viewer">✕</button>
      </div>
    </div>
    <div class="cs-lightbox-body" id="cs-lightbox-body">
      <button type="button" class="cs-lightbox-arrow cs-lightbox-prev" id="cs-lightbox-prev" aria-label="Previous image">‹</button>
      <div class="cs-lightbox-media-wrap">
        <img class="cs-lightbox-img" id="cs-lightbox-img" src="" alt="Photo" />
        <div class="cs-lightbox-loading" id="cs-lightbox-loading" hidden>Loading image…</div>
      </div>
      <button type="button" class="cs-lightbox-arrow cs-lightbox-next" id="cs-lightbox-next" aria-label="Next image">›</button>
    </div>
  `;
  document.body.appendChild(dlg);

  const updateView = () => {
    if (!clientLightboxState.images.length) return;
    const total = clientLightboxState.images.length;
    clientLightboxState.index = (clientLightboxState.index + total) % total;
    const cur = clientLightboxState.images[clientLightboxState.index];
    const url = typeof cur === "string" ? cur : (cur.url || cur.thumbnailUrl || "");
    const name = typeof cur === "string" ? (clientLightboxState.title || "Photo") : (cur.name || clientLightboxState.title || "Photo");

    const titleEl = document.getElementById("cs-lightbox-title");
    const counterEl = document.getElementById("cs-lightbox-counter");
    const extLink = document.getElementById("cs-lightbox-external");
    const imgEl = document.getElementById("cs-lightbox-img");
    const loadingEl = document.getElementById("cs-lightbox-loading");
    const prevBtn = document.getElementById("cs-lightbox-prev");
    const nextBtn = document.getElementById("cs-lightbox-next");

    if (titleEl) titleEl.textContent = name;
    if (counterEl) counterEl.textContent = total > 1 ? `${clientLightboxState.index + 1} / ${total}` : "";
    if (extLink) extLink.href = url;

    if (prevBtn) prevBtn.style.display = total > 1 ? "flex" : "none";
    if (nextBtn) nextBtn.style.display = total > 1 ? "flex" : "none";

    if (imgEl) {
      if (loadingEl) loadingEl.hidden = false;
      imgEl.onload = () => { if (loadingEl) loadingEl.hidden = true; };
      imgEl.onerror = () => { if (loadingEl) loadingEl.hidden = true; };
      imgEl.src = url;
      imgEl.alt = name;
    }
  };

  dlg.querySelector("#cs-lightbox-close")?.addEventListener("click", () => dlg.close());
  dlg.querySelector("#cs-lightbox-prev")?.addEventListener("click", () => {
    clientLightboxState.index--;
    updateView();
  });
  dlg.querySelector("#cs-lightbox-next")?.addEventListener("click", () => {
    clientLightboxState.index++;
    updateView();
  });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
  document.addEventListener("keydown", (e) => {
    if (!dlg.open) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      clientLightboxState.index--;
      updateView();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      clientLightboxState.index++;
      updateView();
    }
  });

  const bodyEl = dlg.querySelector("#cs-lightbox-body");
  let touchStartX = 0;
  let touchStartY = 0;
  bodyEl?.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });
  bodyEl?.addEventListener("touchend", (e) => {
    if (!touchStartX) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    touchStartX = 0;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) {
        clientLightboxState.index++;
        updateView();
      } else {
        clientLightboxState.index--;
        updateView();
      }
    }
  }, { passive: true });

  dlg._updateView = updateView;
  return dlg;
}

function openClientPhotoLightbox(images, startIndex = 0, title = "Finished product photo") {
  if (!images || !images.length) return;
  const dlg = ensureClientLightboxModal();
  clientLightboxState = {
    images,
    index: Math.max(0, Math.min(images.length - 1, startIndex)),
    title
  };
  dlg._updateView();
  if (!dlg.open) {
    dlg.showModal();
  }
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
  const rows = tickets.map((ticket, tktIdx) => {
    const rawAttachments = Array.isArray(ticket.attachments) ? ticket.attachments.filter(att => att && (att.url || att.thumbnailUrl)) : [];
    const imageAttachments = rawAttachments.filter(file => !String(file.fileType || "").toLowerCase().includes("video") && !/\.(mp4|webm|mov|m4v|avi|mkv)(?:[?#]|$)/i.test(file.url || ""));
    const attachmentsHTML = imageAttachments.length ? `
      <div class="issue-ticket-attachments">
        <span class="issue-attachments-label">Photos attached (${imageAttachments.length}):</span>
        <div class="issue-attachments-grid">
          ${imageAttachments.map((img, imgIdx) => `
            <button type="button" class="issue-ticket-thumb-btn" data-tkt-idx="${tktIdx}" data-img-idx="${imgIdx}" title="Click to view photo" aria-label="View photo ${imgIdx + 1}: ${escapeHTML(img.name || "Ticket photo")}">
              <img src="${escapeHTML(img.thumbnailUrl || img.url)}" alt="${escapeHTML(img.name || "Ticket photo")}" loading="lazy" />
            </button>
          `).join("")}
        </div>
      </div>
    ` : "";
    return `
      <div class="issue-existing-item">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span><strong>${escapeHTML(ticket.ticket_id)}</strong> · ${escapeHTML(ticket.status || "Open")}</span>
          <span style="font-size:0.75rem;color:var(--text-muted);">${ticket.created_at?.toDate ? ticket.created_at.toDate().toLocaleString("en-IN", { dateStyle: "short" }) : ""}</span>
        </div>
        <p style="margin:4px 0 0;font-size:0.86rem;color:var(--text-muted);">${escapeHTML((ticket.issue || "").slice(0, 120))}${(ticket.issue || "").length > 120 ? "…" : ""}</p>
        ${attachmentsHTML}
      </div>
    `;
  }).join("");
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

  let stagedIssueFiles = [];

  const renderIssuePreviews = () => {
    preview.replaceChildren();
    if (!stagedIssueFiles.length) return;
    const grid = document.createElement("div");
    grid.className = "issue-staged-grid";
    stagedIssueFiles.forEach((file, index) => {
      const card = document.createElement("figure");
      card.className = "issue-staged-card";
      const isVideo = file.type.startsWith("video/");
      const visual = document.createElement(isVideo ? "video" : "img");
      visual.src = URL.createObjectURL(file);
      if (isVideo) { visual.muted = true; }
      else { visual.alt = file.name; }
      const name = document.createElement("span");
      name.className = "issue-staged-name";
      name.textContent = file.name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "issue-staged-remove";
      remove.textContent = "✕";
      remove.setAttribute("aria-label", `Remove ${file.name}`);
      remove.addEventListener("click", () => {
        stagedIssueFiles.splice(index, 1);
        renderIssuePreviews();
      });
      card.append(visual, name, remove);
      grid.append(card);
    });
    preview.append(grid);
  };

  fileInput.addEventListener("change", () => {
    const selected = [...(fileInput.files || [])];
    selected.forEach(file => {
      const isDup = stagedIssueFiles.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified);
      if (!isDup) stagedIssueFiles.push(file);
    });
    fileInput.value = "";
    renderIssuePreviews();
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

    const files = [...stagedIssueFiles];
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
        attachments.push(await uploadFileToImageKit(files[i], `${IMAGEKIT_FOLDER}/${String(data.order_id || orderId).replace("#", "")}`, orderId));
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
      stagedIssueFiles = [];
      renderIssuePreviews();
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
    const finalProductImages = Array.isArray(data.final_product_images) ? data.final_product_images.filter(image => image && /^https:\/\//i.test(String(image.url || ""))) : [];
    const finalProductImagesHTML = finalProductImages.map((image, idx) => `
      <button type="button" class="final-product-image-link" data-final-idx="${idx}" title="Click to view full photo" aria-label="View photo ${idx + 1}: ${escapeHTML(image.name || "Finished product photo")}">
        <img src="${escapeHTML(image.thumbnailUrl || image.url)}" alt="${escapeHTML(image.name || "Finished product photo")}" loading="lazy" />
        <span>${escapeHTML(image.name || "Finished product photo")}</span>
      </button>
    `).join("");

    const isPickup = data.fulfillment_type === "pickup";
    const status = displayOrderStatus(data.status || "Order Placed", isPickup);
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
              <div><dt>${isServiceRequest ? "Next step" : isPickup ? "Pickup Availability" : "Expected Delivery"}</dt><dd>${escapeHTML(data.expected_delivery || (isPickup ? "Will notify when ready for pickup" : "-"))}</dd></div>
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

        ${finalProductImages.length ? `
          <section class="order-panel final-product-images-panel">
            <h2>Photos of your finished product</h2>
            <p>Your order is ready. Here are the final product photos from our team.</p>
            <div class="final-product-images-grid">${finalProductImagesHTML}</div>
          </section>
        ` : ""}

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

    // Lightbox for final product photos
    container.querySelectorAll(".final-product-images-grid .final-product-image-link").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.finalIdx || 0);
        openClientPhotoLightbox(finalProductImages, idx, "Finished Product Photo");
      });
    });

    // Lightbox for existing ticket attachments
    container.querySelectorAll(".issue-ticket-thumb-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tktIdx = Number(btn.dataset.tktIdx || 0);
        const imgIdx = Number(btn.dataset.imgIdx || 0);
        const ticket = existingTickets[tktIdx];
        if (!ticket) return;
        const raw = Array.isArray(ticket.attachments) ? ticket.attachments.filter(att => att && (att.url || att.thumbnailUrl)) : [];
        const images = raw.filter(file => !String(file.fileType || "").toLowerCase().includes("video") && !/\.(mp4|webm|mov|m4v|avi|mkv)(?:[?#]|$)/i.test(file.url || ""));
        openClientPhotoLightbox(images, imgIdx, `Ticket ${ticket.ticket_id || ""} Photo`);
      });
    });
  } catch (err) {
    console.error("Failed to fetch order details:", err);
    container.innerHTML = `
      <div class="empty-state">
        <p style="color: var(--danger); font-weight: 700;">Error loading order details. Please try again later.</p>
      </div>
    `;
  }
});
