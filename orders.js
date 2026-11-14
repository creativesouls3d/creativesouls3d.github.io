function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
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

function loginUser() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(err => alert("Login failed: " + err.message));
}

window.loginUser = loginUser;

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
      const isPickup = order.fulfillment_type === "pickup";
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
            <span class="order-status ${statusClass}">${displayOrderStatus(order.status, isPickup)}</span>
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
      const allFinalImages = Array.isArray(order.final_product_images)
        ? order.final_product_images.filter(image => image && /^https:\/\//i.test(String(image.url || "")))
        : [];
      if (allFinalImages.length) {
        const preview = document.createElement("div");
        preview.className = "order-card-final-images";
        preview.setAttribute("aria-label", "Final product photos are available");
        const label = document.createElement("span");
        label.textContent = "Finished product photos";
        preview.append(label);
        const row = document.createElement("div");
        row.className = "order-card-final-images-row";
        allFinalImages.slice(0, 3).forEach((image, imgIdx) => {
          const thumbBtn = document.createElement("button");
          thumbBtn.type = "button";
          thumbBtn.className = "order-card-final-thumb-btn";
          thumbBtn.title = "Click to view finished photos";
          thumbBtn.setAttribute("aria-label", `View finished product photo: ${image.name || "Photo"}`);
          const img = document.createElement("img");
          img.src = image.thumbnailUrl || image.url;
          img.alt = image.name || "Finished product photo";
          img.loading = "lazy";
          thumbBtn.append(img);
          thumbBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openClientPhotoLightbox(allFinalImages, imgIdx, "Finished Product Photo");
          });
          row.append(thumbBtn);
        });
        preview.append(row);
        card.querySelector(".order-card-info")?.append(preview);
      }
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
