(() => {
  function initQuickStatusFilters() {
    const filterWrap = byId("orders-quick-filters");
    if (!filterWrap) return;
    const QUICK_FILTER_PILLS = [
      { label: "All Orders", status: "all", active: true },
      { label: "⚠️ Needs Action", status: "action" },
      { label: "Order Placed", status: "Order Placed" },
      { label: "Order Approved", status: "Order Approved" },
      { label: "Printing Product", status: "Printing Product" },
      { label: "Ready for Pickup", status: "Ready for Pickup" },
      { label: "Order Picked Up", status: "Order Picked Up" },
      { label: "Order Dispatched", status: "Order Dispatched" },
      { label: "Out For Delivery", status: "Out For Delivery" },
      { label: "Product Delivered", status: "Product Delivered" }
    ];
    filterWrap.replaceChildren(...QUICK_FILTER_PILLS.map(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-filter-pill" + (item.active ? " active" : "");
      button.dataset.quickStatus = item.status;
      button.textContent = item.label;
      return button;
    }));
    filterWrap.querySelectorAll("button[data-quick-status]").forEach(btn => {
      btn.addEventListener("click", () => {
        filterWrap.querySelectorAll("button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const target = btn.dataset.quickStatus;
        const optionsContainer = byId("order-status-options");
        if (!optionsContainer) return;
        const checkboxes = optionsContainer.querySelectorAll("input[type='checkbox']");
        if (target === "all") {
          checkboxes.forEach(cb => { cb.checked = false; });
        } else if (target === "action") {
          const actionSet = new Set(["Order Placed", "Order Approved", "Printing Product", "Ready for Pickup", "Order Dispatched", "Out For Delivery"]);
          checkboxes.forEach(cb => { cb.checked = actionSet.has(cb.value); });
        } else {
          checkboxes.forEach(cb => { cb.checked = cb.value.toLowerCase() === target.toLowerCase(); });
        }
        updateStatusFilterLabel();
        currentOrdersPage = 1;
        refreshVisibleOrders();
      });
    });
  }
  function renderRecentDashboardOrders(docs) {
    const container = byId("dashboard-recent-orders");
    if (!container) return;
    container.replaceChildren();
    const cleanDocs = (docs || []).filter(doc => !isCustomerIgnored(doc.data(), doc.id));
    if (!cleanDocs.length) {
      container.innerHTML = '<p class="admin-helper" style="padding:16px 0; color:var(--text-3); text-align:center;">No recent customer orders found.</p>';
      return;
    }
    const recent = cleanDocs.slice(0, 5);
    const table = document.createElement("table");
    table.className = "admin-recent-orders-table";
    table.innerHTML = "<thead><tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Status</th><th>Total</th><th style='text-align:right;'>Action</th></tr></thead><tbody></tbody>";
    const tbody = table.querySelector("tbody");
    recent.forEach(doc => {
      const order = doc.data();
      const tr = document.createElement("tr");
      const orderId = order.order_id || doc.id;
      const canonical = canonicalOrderStatus(order.status, order.fulfillment_type);
      const statusSlug = canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(order.total || 0));
      tr.innerHTML = "<td><button type='button' class='admin-order-id'>" + orderId + "</button></td>" +
        "<td><strong>" + (order.name || "Customer") + "</strong></td>" +
        "<td style='color:var(--text-3); font-size:0.75rem;'>" + orderDate(order.timestamp) + "</td>" +
        "<td><span class='admin-order-status status-" + statusSlug + "'>" + canonical + "</span></td>" +
        "<td><strong>" + amount + "</strong></td>" +
        "<td style='text-align:right;'><button type='button' class='btn-table-action btn-secondary' style='height:28px!important; padding:0 10px!important;'>Manage</button></td>";
      tr.querySelector(".admin-order-id").addEventListener("click", () => showOrderDetails(doc.id, order));
      tr.querySelector("button.btn-table-action").addEventListener("click", () => showOrderDetails(doc.id, order));
      tbody.append(tr);
    });
    container.append(table);
  }

  const ADMIN_EMAIL = "luvs2006@gmail.com";
const ALLOWED_ADMINS = [ADMIN_EMAIL, "hello.creative.souls3d@gmail.com"]; // permitted admin emails
  const NOTIFY_EMAIL = "hello.creative.souls3d@gmail.com"; // Always the sender for order & support emails
  const byId = id => document.getElementById(id);
  window.byId = byId;
  const identity = byId("admin-identity");
  const status = byId("admin-status");
  const tools = byId("admin-tools");
  const login = byId("admin-login");
  const dialog = byId("document-editor");
  const jsonInput = byId("document-json");
  let activeDocument = null;
  let originalDocumentData = null;
  let timestampExplicitlyEdited = false;
  let editorModel = {};
  let advancedEditorUsed = false;
  let adminProducts = [];
  let orderItemsDraft = [];
  let customerRecords = [];
  let productColourDraft = [];
  let productSizeDraft = [];
  let productImageUrls = [];
  let productGifUrl = "";
  var productImageItems = [];
  const productMediaUploads = new WeakMap();
  let orderDocuments = [];
  let ticketDocuments = [];
  let activeTicket = null;
  let ticketFilter = "open";
  const selectedOrderIds = new Set();
  const reservedProductIds = new Set();
  let currentOrdersPage = 1;
  let ordersPageSize = 25;
  let orderSort = { field: "timestamp", direction: "desc" };
  let chartSelection = null;
  const IGNORED_CUSTOMERS_STORAGE_KEY = "creativeSoulsAdminIgnoredCustomers";
  const ignoredCustomers = (() => {
    try {
      const stored = JSON.parse(localStorage.getItem(IGNORED_CUSTOMERS_STORAGE_KEY) || "[]");
      return new Map(Array.isArray(stored) ? stored.filter(entry => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string") : []);
    } catch { return new Map(); }
  })();
  const ORDER_WORKFLOW_STATUSES = ["Order Placed", "Order Approved", "Printing Product", "Order Dispatched", "Out For Delivery", "Product Delivered"];
  const ORDER_PICKUP_WORKFLOW_STATUSES = ["Order Placed", "Order Approved", "Printing Product", "Ready for Pickup", "Order Picked Up"];
  const ORDER_STATUS_CATEGORIES = ["Order Placed", "Order Approved", "Printing Product", "Ready for Pickup", "Order Picked Up", "Order Dispatched", "Out For Delivery", "Product Delivered", "Cancelled", "Rejected", "Other"];
  const orderStatusOptions = (current, fulfillmentType = "delivery") => {
    const isPickup = String(fulfillmentType || "").trim().toLowerCase() === "pickup";
    const workflow = isPickup ? ORDER_PICKUP_WORKFLOW_STATUSES : ORDER_WORKFLOW_STATUSES;
    const baseList = [...workflow, "Cancelled", "Rejected"];
    if (current && !baseList.includes(current)) {
      baseList.push(current);
    }
    return baseList.map(item => `<option value="${item}"${item === current ? " selected" : ""}>${item}</option>`).join("");
  };
  const PRODUCT_CATEGORIES = ["Keychains", "Home Decor", "Idols", "Desk Accessories", "Gifts", "Car Accessories", "Custom Products", "Other"];
  const PRODUCT_BEST_FOR = ["Gifts", "Return Gifts", "Home Decor", "Desk/Office", "Car", "Pooja/Festival"];
  const PRODUCT_AVAILABILITY = ["In Stock", "Made to Order", "Out of Stock"];

  function errorText(error) {
    if (error?.code === "permission-denied") return "Firestore denied this action. Update Security Rules to authorize this administrator and preserve required customer access.";
    return error?.message || "The database request failed.";
  }
  function reportError(error) {
    status.textContent = errorText(error);
    window.showAdminToast?.(errorText(error), "danger");
    console.error(error);
  }
  function validCollectionPath(path) {
    const parts = path.split("/");
    return parts.length % 2 === 1 && parts.every(part => part.trim() && part !== "." && part !== "..");
  }
  function parseOrderDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value.toDate === "function") {
      try {
        const d = value.toDate();
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
      } catch {}
    }
    if (typeof value === "object") {
      if (value.__firestoreType === "timestamp" && value.value) {
        const d = new Date(value.value);
        if (!Number.isNaN(d.getTime())) return d;
      }
      if (typeof value.seconds === "number") {
        const d = new Date(value.seconds * 1000 + (value.nanoseconds ? Math.floor(value.nanoseconds / 1e6) : 0));
        if (!Number.isNaN(d.getTime())) return d;
      }
      if (typeof value._seconds === "number") {
        const d = new Date(value._seconds * 1000 + (value._nanoseconds ? Math.floor(value._nanoseconds / 1e6) : 0));
        if (!Number.isNaN(d.getTime())) return d;
      }
      if (value.value) {
        const d = new Date(value.value);
        if (!Number.isNaN(d.getTime())) return d;
      }
    }
    if (typeof value === "number") {
      const d = value < 1e11 ? new Date(value * 1000) : new Date(value);
      if (!Number.isNaN(d.getTime())) return d;
    }
    if (typeof value === "string") {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }
  function plainData(data) {
    function convert(value) {
      if (value && typeof value.toDate === "function") return { __firestoreType: "timestamp", value: value.toDate().toISOString() };
      if (value && typeof value === "object" && (typeof value.seconds === "number" || typeof value._seconds === "number")) {
        const parsed = parseOrderDate(value);
        if (parsed) return { __firestoreType: "timestamp", value: parsed.toISOString() };
      }
      if (value instanceof firebase.firestore.GeoPoint) return { __firestoreType: "geopoint", latitude: value.latitude, longitude: value.longitude };
      if (value instanceof firebase.firestore.DocumentReference) return { __firestoreType: "reference", path: value.path };
      if (firebase.firestore.Blob && value instanceof firebase.firestore.Blob) return { __firestoreType: "blob", value: value.toBase64() };
      if (Array.isArray(value)) return value.map(convert);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, convert(item)]));
      return value;
    }
    return JSON.stringify(convert(data), null, 2);
  }
  function restoreTypes(value) {
    if (Array.isArray(value)) return value.map(restoreTypes);
    if (!value || typeof value !== "object") return value;
    if (value.__firestoreType === "timestamp") return firebase.firestore.Timestamp.fromDate(new Date(value.value));
    if (value.__firestoreType === "geopoint") return new firebase.firestore.GeoPoint(Number(value.latitude), Number(value.longitude));
    if (value.__firestoreType === "reference") return db.doc(value.path);
    if (value.__firestoreType === "blob") return firebase.firestore.Blob.fromBase64String(value.value);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restoreTypes(item)]));
  }
  async function openEditor({ collection, id, data, creating, kind }) {
    if (collection === "orders" && !creating && id) {
      try {
        const snap = await db.collection("orders").doc(id).get();
        if (snap.exists) {
          data = { ...(data || {}), ...snap.data() };
        }
      } catch (err) {
        console.warn("Could not fetch current order data from Firestore:", err);
      }
    }
    activeDocument = { collection, id, creating, kind: kind || (collection === "products" ? "product" : collection === "orders" ? "order" : "record") };
    const isOrder = activeDocument.kind === "order";
    const isProduct = activeDocument.kind === "product";
    const noun = isOrder ? "order" : isProduct ? "product" : collection === "orders" ? "order" : "record";
    byId("editor-title").textContent = creating ? `Create ${noun}` : `Edit ${noun}`;
    byId("editor-eyebrow").textContent = isOrder ? "ORDER MANAGEMENT" : isProduct ? "PRODUCT CATALOG" : "RECORD DETAILS";
    byId("editor-location").textContent = `${collection}/${id}`;
    byId("editor-intro").textContent = isOrder
      ? "Update customer, delivery, payment, and status details. Save your changes when finished."
      : isProduct
        ? "Fill in the catalog details for this product. Colour and size variants plus advanced data are available below."
        : "Update the labeled fields below. Changes are saved to this Firestore document.";
    byId("advanced-editor-summary").textContent = isOrder ? "Order items and advanced data" : isProduct ? "Advanced: edit full product data" : "Advanced: edit full document data";
    byId("advanced-editor-help").textContent = isOrder
      ? "Edit line items or less common order fields here. Keep the JSON valid before saving."
      : isProduct
        ? "Edit nested values such as colour/size option maps or extra product fields. Keep the JSON valid before saving."
        : "Use this for nested data such as order items or complex product options.";
    byId("new-field-name").placeholder = isOrder ? "Add an order field" : isProduct ? "Add a product field" : "New field (e.g. productName)";
    byId("editor-error").textContent = "";
    originalDocumentData = data ? JSON.parse(plainData(data)) : null;
    timestampExplicitlyEdited = false;
    editorModel = JSON.parse(plainData(data));
    if (isOrder) editorModel = { status_info: "", ...editorModel };
    if (isProduct) {
      editorModel = { productId: id, productName: "", price: 0, imageUrl: "", gifUrl: "", description: "", customizable: true, category: "", stock: 0, tags: "", color: "", ...editorModel };
      editorModel.color = data.color ?? data.colour ?? "";
      delete editorModel.colour;
      editorModel.stock = Number.isFinite(Number(data.stock)) ? Number(data.stock) : 0;
      productImageUrls = (Array.isArray(data.imageUrl) ? data.imageUrl : String(data.imageUrl || data.image_url || data.image || "").split(",")).map(url => String(url).trim()).filter(Boolean);
      productGifUrl = String(data.gifUrl || "");
      byId("product-image-files").value = "";
      byId("product-gif-file").value = "";
      byId("product-image-selection").replaceChildren();
      const urlBar = byId("product-url-input-bar");
      if (urlBar) urlBar.hidden = true;
      const urlInput = byId("product-url-input");
      if (urlInput) urlInput.value = "";
      initProductImageItems(productImageUrls);
      renderProductMedia();
    }
    byId("product-media-builder").hidden = !isProduct;
    if (isOrder) {
      const orderDateVal = parseOrderDate(data?.timestamp || data?.createdAt || data?.created_at || data?.date || editorModel.timestamp) || new Date();
      editorModel.timestamp = { __firestoreType: "timestamp", value: orderDateVal.toISOString() };
      if (originalDocumentData) {
        originalDocumentData.timestamp = { __firestoreType: "timestamp", value: orderDateVal.toISOString() };
      }
      if (!editorModel.order_id) {
        editorModel.order_id = id;
      }
    }
    advancedEditorUsed = false;
    byId("advanced-editor").open = false;
    jsonInput.value = plainData(data);
    byId("order-item-builder").hidden = !(isOrder && creating);
    byId("order-customer-record-picker").hidden = !(isOrder && creating);
    orderItemsDraft = Array.isArray(data.items) ? data.items.map(item => ({ ...item })) : [];
    byId("product-variant-builder").hidden = !isProduct;
    productColourDraft = isProduct ? readColourVariantSource(data) : [];
    productSizeDraft = isProduct ? readSizeVariantSource(data) : [];
    if (isOrder && creating) {
      renderOrderItemRows();
      populateOrderProductSelect();
      byId("customer-record-selector").hidden = true;
      byId("customer-record-search").value = "";
      byId("customer-record-select").value = "";
      populateCustomerRecordSelect();
      updateOrderProductVariantPicker();
    }
    if (isProduct) renderProductVariantRows();
    renderEditorFields();
    const dupBtn = byId("editor-duplicate");
    if (dupBtn) {
      if (!creating && (isOrder || isProduct)) {
        dupBtn.hidden = false;
        dupBtn.textContent = isOrder ? "Duplicate Order" : "Duplicate Product";
        dupBtn.onclick = () => {
          let sourceData = data;
          try {
            sourceData = restoreTypes(advancedEditorUsed ? JSON.parse(jsonInput.value) : readEditorFields()) || data;
          } catch { sourceData = data; }
          dialog.close();
          if (isOrder) duplicateAdminOrder(sourceData, id);
          else duplicateAdminProduct(sourceData, id);
        };
      } else {
        dupBtn.hidden = true;
      }
    }
    dialog.showModal();
  }

  function firstProductImage(value) {
    return (Array.isArray(value) ? value : String(value || "").split(","))
      .map(url => String(url || "").trim()).find(Boolean) || "logo_creativesouls.jpg";
  }

  // ── Product variant helpers (colour & size options) ────────────────────
  function renderProductMedia() {
    if (typeof productImageItems === "undefined") {
      productImageItems = [];
    }
    if (productImageItems.length === 0 && Array.isArray(productImageUrls) && productImageUrls.length > 0) {
      productImageItems = productImageUrls.map((url, index) => ({
        id: "img_" + index + "_" + Math.random().toString(36).slice(2, 8),
        type: "url",
        url: String(url).trim(),
        previewUrl: String(url).trim(),
        name: (String(url).split("/").pop() || `Image ${index + 1}`).split("?")[0],
        size: 0
      }));
    }

    const preview = typeof byId === "function" ? byId("product-image-preview") : null;
    if (!preview || typeof document === "undefined") return;
    preview.replaceChildren();

    const countBadge = byId("product-image-count-badge");
    if (countBadge) {
      countBadge.textContent = `${productImageItems.length} image${productImageItems.length === 1 ? "" : "s"}`;
    }

    const selection = byId("product-image-selection");
    if (selection) {
      const pendingFiles = productImageItems.filter(item => item.type === "file");
      if (pendingFiles.length > 0) {
        selection.textContent = `${productImageItems.length} total image${productImageItems.length === 1 ? "" : "s"} (${pendingFiles.length} new upload${pendingFiles.length === 1 ? "" : "s"} pending on save). Image 1 is the cover.`;
      } else if (productImageItems.length > 0) {
        selection.textContent = `${productImageItems.length} image${productImageItems.length === 1 ? "" : "s"} configured. Image 1 is the cover.`;
      } else {
        selection.textContent = "No images added yet.";
      }
    }

    if (productImageItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "product-gallery-empty";
      empty.innerHTML = `
        <div class="product-gallery-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <h4>No product images yet</h4>
        <p>Add at least one photo for this product. You can reorder, set the cover photo, and delete images anytime.</p>
      `;
      const btnGroup = document.createElement("div");
      btnGroup.className = "product-gallery-empty-actions";
      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "btn-secondary";
      upBtn.innerHTML = `<span>+ Upload Images</span>`;
      upBtn.addEventListener("click", () => byId("product-image-files")?.click());
      const urlBtn = document.createElement("button");
      urlBtn.type = "button";
      urlBtn.className = "btn-secondary";
      urlBtn.innerHTML = `<span>+ Add by URL</span>`;
      urlBtn.addEventListener("click", () => {
        const bar = byId("product-url-input-bar");
        if (bar) {
          bar.hidden = false;
          byId("product-url-input")?.focus();
        }
      });
      btnGroup.append(upBtn, urlBtn);
      empty.append(btnGroup);
      preview.append(empty);
    } else {
      productImageItems.forEach((item, index) => {
        const isCover = index === 0;
        const card = document.createElement("div");
        card.className = `product-img-card ${isCover ? "is-cover" : ""}`;
        card.setAttribute("draggable", "true");
        card.dataset.index = String(index);
        card.setAttribute("aria-label", `Product image ${index + 1}${isCover ? ", cover image" : ""}. Use the arrow buttons to change its position.`);

        const header = document.createElement("div");
        header.className = "product-img-card-header";

        const badge = document.createElement("span");
        badge.className = `product-img-badge ${isCover ? "badge-cover" : "badge-index"}`;
        badge.innerHTML = isCover
          ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Cover`
          : `#${index + 1}`;
        header.append(badge);

        if (item.isEdited) {
          const editBadge = document.createElement("span");
          editBadge.className = "product-img-pending-badge badge-edited";
          editBadge.textContent = "Edited";
          header.append(editBadge);
        } else if (item.type === "file") {
          const newBadge = document.createElement("span");
          newBadge.className = "product-img-pending-badge";
          newBadge.textContent = "New";
          header.append(newBadge);
        }

        const dragHandle = document.createElement("div");
        dragHandle.className = "product-img-drag-handle";
        dragHandle.title = "Drag to reorder";
        dragHandle.setAttribute("aria-hidden", "true");
        dragHandle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="2"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/></svg>`;
        header.append(dragHandle);

        const thumbWrap = document.createElement("div");
        thumbWrap.className = "product-img-thumb-wrap";
        const img = document.createElement("img");
        img.src = item.previewUrl || item.url || "logo_creativesouls.jpg";
        img.alt = `Product image ${index + 1}`;
        img.loading = "lazy";
        img.onerror = () => { img.src = "logo_creativesouls.jpg"; };
        thumbWrap.append(img);

        const editThumbBtn = document.createElement("button");
        editThumbBtn.type = "button";
        editThumbBtn.className = "btn-thumb-edit";
        editThumbBtn.title = "Edit picture (crop, rotate, adjust)";
        editThumbBtn.setAttribute("aria-label", `Edit image ${index + 1}`);
        editThumbBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><span>Edit</span>`;
        editThumbBtn.addEventListener("click", e => {
          e.stopPropagation();
          openProductImageEditor(index);
        });
        thumbWrap.append(editThumbBtn);

        const info = document.createElement("div");
        info.className = "product-img-card-info";
        info.title = item.name || `Image ${index + 1}`;
        const nameSpan = document.createElement("span");
        nameSpan.className = "product-img-name";
        nameSpan.textContent = item.name || `Image ${index + 1}`;
        info.append(nameSpan);
        if (item.size) {
          const sizeSpan = document.createElement("span");
          sizeSpan.className = "product-img-size";
          sizeSpan.textContent = formatMediaBytes(item.size);
          info.append(sizeSpan);
        }

        const actions = document.createElement("div");
        actions.className = "product-img-card-actions";

        const reorderGroup = document.createElement("div");
        reorderGroup.className = "product-img-reorder-group";

        const leftBtn = document.createElement("button");
        leftBtn.type = "button";
        leftBtn.className = "btn-card-action btn-move-left";
        leftBtn.title = "Move image left";
        leftBtn.setAttribute("aria-label", `Move image ${index + 1} left`);
        leftBtn.disabled = index === 0;
        leftBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
        leftBtn.addEventListener("click", e => {
          e.stopPropagation();
          moveProductImage(index, -1);
        });
        reorderGroup.append(leftBtn);

        const rightBtn = document.createElement("button");
        rightBtn.type = "button";
        rightBtn.className = "btn-card-action btn-move-right";
        rightBtn.title = "Move image right";
        rightBtn.setAttribute("aria-label", `Move image ${index + 1} right`);
        rightBtn.disabled = index === productImageItems.length - 1;
        rightBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        rightBtn.addEventListener("click", e => {
          e.stopPropagation();
          moveProductImage(index, 1);
        });
        reorderGroup.append(rightBtn);

        const editCardBtn = document.createElement("button");
        editCardBtn.type = "button";
        editCardBtn.className = "btn-card-action btn-edit-img";
        editCardBtn.title = "Edit picture (crop, rotate, adjust)";
        editCardBtn.setAttribute("aria-label", `Edit image ${index + 1}`);
        editCardBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
        editCardBtn.addEventListener("click", e => {
          e.stopPropagation();
          openProductImageEditor(index);
        });
        reorderGroup.append(editCardBtn);

        if (!isCover) {
          const coverBtn = document.createElement("button");
          coverBtn.type = "button";
          coverBtn.className = "btn-card-action btn-make-cover";
          coverBtn.title = "Set as primary cover image";
          coverBtn.setAttribute("aria-label", `Set image ${index + 1} as cover image`);
          coverBtn.innerHTML = `<span>★ Cover</span>`;
          coverBtn.addEventListener("click", e => {
            e.stopPropagation();
            setProductCoverImage(index);
          });
          reorderGroup.append(coverBtn);
        }

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn-card-action btn-delete-img";
        delBtn.title = "Delete image";
        delBtn.setAttribute("aria-label", `Delete image ${index + 1}`);
        delBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        delBtn.addEventListener("click", e => {
          e.stopPropagation();
          deleteProductImage(index);
        });

        actions.append(reorderGroup, delBtn);

        card.addEventListener("dragstart", e => {
          card.classList.add("dragging");
          e.dataTransfer.setData("text/plain", String(index));
          e.dataTransfer.effectAllowed = "move";
        });
        card.addEventListener("dragend", () => {
          card.classList.remove("dragging");
          preview.querySelectorAll(".product-img-card").forEach(c => c.classList.remove("drop-target-before", "drop-target-after"));
        });
        card.addEventListener("dragover", e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const rect = card.getBoundingClientRect();
          const midX = rect.left + rect.width / 2;
          if (e.clientX < midX) {
            card.classList.add("drop-target-before");
            card.classList.remove("drop-target-after");
          } else {
            card.classList.add("drop-target-after");
            card.classList.remove("drop-target-before");
          }
        });
        card.addEventListener("dragleave", () => {
          card.classList.remove("drop-target-before", "drop-target-after");
        });
        card.addEventListener("drop", e => {
          e.preventDefault();
          card.classList.remove("drop-target-before", "drop-target-after");
          const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
          if (!Number.isNaN(fromIndex) && fromIndex !== index) {
            const rect = card.getBoundingClientRect();
            const midX = rect.left + rect.width / 2;
            let targetIndex = e.clientX < midX ? index : index + 1;
            if (fromIndex < targetIndex) targetIndex--;
            reorderProductImage(fromIndex, targetIndex);
          }
        });

        card.append(header, thumbWrap, info, actions);
        preview.append(card);
      });
    }

    renderProductGifPreview();
  }

  function formatMediaBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function initProductImageItems(urls) {
    cleanupProductImageItemPreviews();
    productImageItems = (urls || []).map((url, index) => ({
      id: "img_" + index + "_" + Math.random().toString(36).slice(2, 8),
      type: "url",
      url: String(url).trim(),
      previewUrl: String(url).trim(),
      name: (String(url).split("/").pop() || `Image ${index + 1}`).split("?")[0],
      size: 0
    }));
    syncProductImageUrls();
  }

  function cleanupProductImageItemPreviews() {
    if (typeof productImageItems === "undefined" || !Array.isArray(productImageItems)) return;
    productImageItems.forEach(item => {
      if (item && item.type === "file" && item.previewUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        try { URL.revokeObjectURL(item.previewUrl); } catch (_) {}
      }
    });
  }

  function syncProductImageUrls() {
    if (typeof productImageItems === "undefined" || !Array.isArray(productImageItems)) return;
    productImageUrls = productImageItems
      .filter(item => item && item.type === "url" && item.url)
      .map(item => String(item.url).trim());
  }

  function moveProductImage(fromIndex, direction) {
    if (typeof productImageItems === "undefined" || !Array.isArray(productImageItems)) return;
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= productImageItems.length) return;
    const [moved] = productImageItems.splice(fromIndex, 1);
    productImageItems.splice(toIndex, 0, moved);
    syncProductImageUrls();
    renderProductMedia();
  }

  function setProductCoverImage(index) {
    if (typeof productImageItems === "undefined" || !Array.isArray(productImageItems)) return;
    if (index <= 0 || index >= productImageItems.length) return;
    const [item] = productImageItems.splice(index, 1);
    productImageItems.unshift(item);
    syncProductImageUrls();
    renderProductMedia();
    if (typeof showAdminToast === "function") showAdminToast("Cover image set.", "success");
  }

  function reorderProductImage(fromIndex, toIndex) {
    if (typeof productImageItems === "undefined" || !Array.isArray(productImageItems)) return;
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= productImageItems.length || toIndex < 0 || toIndex >= productImageItems.length) return;
    const [item] = productImageItems.splice(fromIndex, 1);
    productImageItems.splice(toIndex, 0, item);
    syncProductImageUrls();
    renderProductMedia();
  }

  function deleteProductImage(index) {
    if (typeof productImageItems === "undefined" || !Array.isArray(productImageItems)) return;
    if (index < 0 || index >= productImageItems.length) return;
    const item = productImageItems[index];
    if (item && item.type === "file" && item.previewUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      try { URL.revokeObjectURL(item.previewUrl); } catch (_) {}
    }
    productImageItems.splice(index, 1);
    syncProductImageUrls();
    renderProductMedia();
    if (typeof showAdminToast === "function") showAdminToast("Image removed.", "info");
  }

  function addProductImageFiles(files) {
    const fileList = [...(files || [])];
    if (!fileList.length) return;
    try {
      validateProductMedia(fileList);
    } catch (err) {
      if (typeof showAdminToast === "function") showAdminToast(err.message, "error");
      else alert(err.message);
      return;
    }
    if (typeof productImageItems === "undefined" || !Array.isArray(productImageItems)) {
      productImageItems = [];
    }
    fileList.forEach(file => {
      let previewUrl = "";
      if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        try { previewUrl = URL.createObjectURL(file); } catch (_) {}
      }
      productImageItems.push({
        id: "file_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        type: "file",
        file,
        previewUrl,
        name: file.name,
        size: file.size
      });
    });
    const input = typeof byId === "function" ? byId("product-image-files") : null;
    if (input) input.value = "";
    syncProductImageUrls();
    renderProductMedia();
    if (typeof showAdminToast === "function") {
      showAdminToast(`${fileList.length} image${fileList.length === 1 ? "" : "s"} added.`, "success");
    }
  }

  function addProductImageUrl(url) {
    const trimmed = String(url || "").trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("/")) {
      if (typeof showAdminToast === "function") showAdminToast("Please enter a valid image URL (e.g. https://...)", "error");
      else alert("Please enter a valid image URL.");
      return;
    }
    if (typeof productImageItems === "undefined" || !Array.isArray(productImageItems)) {
      productImageItems = [];
    }
    const normalizedUrl = trimmed.toLowerCase();
    if (productImageItems.some(item => item?.type === "url" && String(item.url || "").trim().toLowerCase() === normalizedUrl)) {
      if (typeof showAdminToast === "function") showAdminToast("That image is already in this product gallery.", "info");
      return;
    }
    productImageItems.push({
      id: "url_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      type: "url",
      url: trimmed,
      previewUrl: trimmed,
      name: (trimmed.split("/").pop() || "Custom URL Image").split("?")[0],
      size: 0
    });
    syncProductImageUrls();
    renderProductMedia();
    if (typeof showAdminToast === "function") showAdminToast("Image URL added.", "success");
  }

  function renderProductGifPreview() {
    const gifBox = typeof byId === "function" ? byId("product-gif-preview-box") : null;
    const removeBtn = typeof byId === "function" ? byId("product-remove-gif") : null;
    const gifSelection = typeof byId === "function" ? byId("product-gif-selection") : null;
    const gifInput = typeof byId === "function" ? byId("product-gif-file") : null;
    const gifFile = gifInput?.files?.[0];

    const currentGifUrl = gifFile && typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(gifFile)
      : productGifUrl;

    if (currentGifUrl) {
      if (gifBox && typeof document !== "undefined") {
        gifBox.hidden = false;
        gifBox.innerHTML = `
          <div class="product-gif-card">
            <img src="${currentGifUrl}" alt="Product GIF animation" />
            <span class="product-gif-tag">GIF Active</span>
          </div>
        `;
      }
      if (removeBtn) removeBtn.hidden = false;
      if (gifSelection) {
        gifSelection.textContent = gifFile
          ? `New GIF selected: ${gifFile.name} (${formatMediaBytes(gifFile.size)}). Will upload on save.`
          : "Saved animated GIF active for this product.";
      }
    } else {
      if (gifBox) {
        gifBox.hidden = true;
        gifBox.replaceChildren();
      }
      if (removeBtn) removeBtn.hidden = true;
      if (gifSelection) {
        gifSelection.textContent = "No animated GIF selected.";
      }
    }
  }

  // ── Image Studio / Picture Editor State & Engine ───────────────────────
  let activeEditingImageIndex = -1;
  let imageEditorLoadToken = 0;
  let imageEditorSourceImg = null;
  let imageEditorState = {
    rotation: 0,
    flipH: false,
    flipV: false,
    brightness: 100,
    contrast: 100,
    saturate: 100,
    aspectRatio: "free",
    crop: null
  };
  let imageEditorScale = 1;
  let imageEditorOffset = { x: 0, y: 0 };
  let imageEditorOrientedDim = { width: 0, height: 0 };

  function openProductImageEditor(index) {
    if (typeof productImageItems === "undefined" || !productImageItems[index]) return;
    const loadToken = ++imageEditorLoadToken;
    activeEditingImageIndex = index;
    const item = productImageItems[index];

    imageEditorState = {
      rotation: 0,
      flipH: false,
      flipV: false,
      brightness: 100,
      contrast: 100,
      saturate: 100,
      aspectRatio: "free",
      crop: null
    };

    const brSlider = typeof byId === "function" ? byId("pie-brightness") : null; if (brSlider) brSlider.value = 100;
    const ctSlider = typeof byId === "function" ? byId("pie-contrast") : null; if (ctSlider) ctSlider.value = 100;
    const saSlider = typeof byId === "function" ? byId("pie-saturation") : null; if (saSlider) saSlider.value = 100;
    const brVal = typeof byId === "function" ? byId("pie-val-brightness") : null; if (brVal) brVal.textContent = "100%";
    const ctVal = typeof byId === "function" ? byId("pie-val-contrast") : null; if (ctVal) ctVal.textContent = "100%";
    const saVal = typeof byId === "function" ? byId("pie-val-saturation") : null; if (saVal) saVal.textContent = "100%";

    if (typeof document !== "undefined") {
      document.querySelectorAll(".pie-aspect-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.aspect === "free");
      });
    }

    const dialog = typeof byId === "function" ? byId("product-image-editor-dialog") : null;
    if (!dialog || typeof Image === "undefined") return;

    const showLoadedImage = loadedImage => {
      if (loadToken !== imageEditorLoadToken || productImageItems[index] !== item) return;
      imageEditorSourceImg = loadedImage;
      initCropFromAspect("free");
      if (!dialog.open) dialog.showModal();
      // Measure only after the dialog has entered layout. Measuring while hidden
      // produces a fallback-sized canvas and a crop frame that appears offset.
      requestAnimationFrame(() => {
        if (loadToken === imageEditorLoadToken && dialog.open) renderEditorCanvas();
      });
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => showLoadedImage(img);
    img.onerror = () => {
      const fallbackImg = new Image();
      fallbackImg.onload = () => showLoadedImage(fallbackImg);
      fallbackImg.onerror = () => {
        if (typeof showAdminToast === "function") showAdminToast("Unable to load picture for editing.", "error");
      };
      fallbackImg.src = item.previewUrl || item.url;
    };
    img.src = item.previewUrl || item.url;
  }

  function getOrientedDimensions() {
    if (!imageEditorSourceImg) return { width: 0, height: 0 };
    const is90or270 = imageEditorState.rotation === 90 || imageEditorState.rotation === 270;
    const width = is90or270
      ? (imageEditorSourceImg.naturalHeight || imageEditorSourceImg.height || 600)
      : (imageEditorSourceImg.naturalWidth || imageEditorSourceImg.width || 600);
    const height = is90or270
      ? (imageEditorSourceImg.naturalWidth || imageEditorSourceImg.width || 600)
      : (imageEditorSourceImg.naturalHeight || imageEditorSourceImg.height || 600);
    return { width, height };
  }

  function initCropFromAspect(aspect) {
    const dim = getOrientedDimensions();
    imageEditorOrientedDim = dim;
    if (dim.width <= 0 || dim.height <= 0) return;

    imageEditorState.aspectRatio = aspect || "free";

    let targetRatio = null;
    if (aspect === "1:1") targetRatio = 1;
    else if (aspect === "4:3") targetRatio = 4 / 3;
    else if (aspect === "16:9") targetRatio = 16 / 9;

    if (!targetRatio || aspect === "free" || aspect === "full") {
      imageEditorState.crop = {
        x: 0,
        y: 0,
        width: dim.width,
        height: dim.height
      };
    } else {
      let cropW, cropH;
      const imgRatio = dim.width / dim.height;
      if (imgRatio > targetRatio) {
        cropH = dim.height * 0.9;
        cropW = cropH * targetRatio;
      } else {
        cropW = dim.width * 0.9;
        cropH = cropW / targetRatio;
      }
      imageEditorState.crop = {
        x: Math.max(0, (dim.width - cropW) / 2),
        y: Math.max(0, (dim.height - cropH) / 2),
        width: Math.min(dim.width, cropW),
        height: Math.min(dim.height, cropH)
      };
    }
  }

  function renderEditorCanvas() {
    const canvas = typeof byId === "function" ? byId("pie-canvas") : null;
    const viewport = typeof byId === "function" ? byId("pie-canvas-viewport") : null;
    const cropBox = typeof byId === "function" ? byId("pie-crop-box") : null;
    if (!canvas || !viewport || !imageEditorSourceImg) return;

    const dim = getOrientedDimensions();
    imageEditorOrientedDim = dim;
    if (dim.width <= 0 || dim.height <= 0) return;

    const viewW = viewport.clientWidth || 540;
    const viewH = viewport.clientHeight || 400;

    const padding = 24;
    const maxDrawW = Math.max(100, viewW - padding * 2);
    const maxDrawH = Math.max(100, viewH - padding * 2);

    const scale = Math.min(maxDrawW / dim.width, maxDrawH / dim.height);
    imageEditorScale = scale;

    const canvasW = Math.round(dim.width * scale);
    const canvasH = Math.round(dim.height * scale);
    canvas.width = canvasW;
    canvas.height = canvasH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasW, canvasH);

    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate((imageEditorState.rotation * Math.PI) / 180);
    ctx.scale(imageEditorState.flipH ? -1 : 1, imageEditorState.flipV ? -1 : 1);
    ctx.filter = `brightness(${imageEditorState.brightness}%) contrast(${imageEditorState.contrast}%) saturate(${imageEditorState.saturate}%)`;

    const natW = imageEditorSourceImg.naturalWidth || imageEditorSourceImg.width || canvasW;
    const natH = imageEditorSourceImg.naturalHeight || imageEditorSourceImg.height || canvasH;

    const drawW = natW * scale;
    const drawH = natH * scale;

    ctx.drawImage(imageEditorSourceImg, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const canvasLeft = (viewW - canvasW) / 2;
    const canvasTop = (viewH - canvasH) / 2;
    imageEditorOffset = { x: canvasLeft, y: canvasTop };

    if (cropBox && imageEditorState.crop) {
      const crop = imageEditorState.crop;
      const boxLeft = Math.round(canvasLeft + crop.x * scale);
      const boxTop = Math.round(canvasTop + crop.y * scale);
      const boxW = Math.round(crop.width * scale);
      const boxH = Math.round(crop.height * scale);

      cropBox.style.left = `${boxLeft}px`;
      cropBox.style.top = `${boxTop}px`;
      cropBox.style.width = `${boxW}px`;
      cropBox.style.height = `${boxH}px`;

      const dimBadge = typeof byId === "function" ? byId("pie-crop-dim") : null;
      if (dimBadge) {
        dimBadge.textContent = `${Math.round(crop.width)} × ${Math.round(crop.height)}`;
      }
    }

    const info = typeof byId === "function" ? byId("pie-dimensions-info") : null;
    if (info && imageEditorState.crop) {
      info.textContent = `Crop: ${Math.round(imageEditorState.crop.width)} × ${Math.round(imageEditorState.crop.height)} px`;
    }
  }

  function applyCurrentProductImageEdit() {
    if (activeEditingImageIndex < 0 || !imageEditorSourceImg || !imageEditorState.crop) return;
    const item = productImageItems[activeEditingImageIndex];
    if (!item) return;
    const editingIndex = activeEditingImageIndex;
    const applyToken = imageEditorLoadToken;
    const applyButton = byId("pie-apply");
    if (applyButton?.disabled) return;
    if (applyButton) applyButton.disabled = true;

    const crop = imageEditorState.crop;
    const targetW = Math.max(1, Math.round(crop.width));
    const targetH = Math.max(1, Math.round(crop.height));

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = targetW;
    exportCanvas.height = targetH;
    const expCtx = exportCanvas.getContext("2d");
    if (!expCtx) {
      if (applyButton) applyButton.disabled = false;
      if (typeof showAdminToast === "function") showAdminToast("Your browser could not start the picture editor. Please try again.", "error");
      return;
    }

    expCtx.save();
    expCtx.translate(-crop.x, -crop.y);

    const dim = imageEditorOrientedDim;
    expCtx.translate(dim.width / 2, dim.height / 2);
    expCtx.rotate((imageEditorState.rotation * Math.PI) / 180);
    expCtx.scale(imageEditorState.flipH ? -1 : 1, imageEditorState.flipV ? -1 : 1);
    expCtx.filter = `brightness(${imageEditorState.brightness}%) contrast(${imageEditorState.contrast}%) saturate(${imageEditorState.saturate}%)`;

    const natW = imageEditorSourceImg.naturalWidth || imageEditorSourceImg.width;
    const natH = imageEditorSourceImg.naturalHeight || imageEditorSourceImg.height;
    expCtx.drawImage(imageEditorSourceImg, -natW / 2, -natH / 2);
    expCtx.restore();

    try {
      exportCanvas.toBlob(blob => {
        try {
          if (!blob) throw new Error("The browser could not process this image.");
          if (applyToken !== imageEditorLoadToken) return;
          if (productImageItems[editingIndex] !== item) throw new Error("This gallery image changed while it was being edited. Reopen the editor and try again.");
          const rawName = item.name || "product-image.jpg";
          const cleanBase = rawName.replace(/\.[^/.]+$/, "").replace(/-edited(-\d+)?$/, "");
          const newFileName = `${cleanBase}-edited.jpg`;
          const editedFile = new File([blob], newFileName, { type: "image/jpeg" });
          const previewUrl = typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
            ? URL.createObjectURL(blob)
            : "";

          if (item.type === "file" && item.previewUrl && typeof URL !== "undefined") {
            try { URL.revokeObjectURL(item.previewUrl); } catch (_) {}
          }

          productImageItems[editingIndex] = {
            id: "edited_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
            type: "file",
            file: editedFile,
            previewUrl,
            name: newFileName,
            size: blob.size,
            isEdited: true
          };

          syncProductImageUrls();
          renderProductMedia();
          byId("product-image-editor-dialog")?.close();
          if (typeof showAdminToast === "function") showAdminToast("Picture edits applied. Save the product to publish them.", "success");
        } catch (error) {
          if (applyToken === imageEditorLoadToken && typeof showAdminToast === "function") showAdminToast(`${error.message || "Could not process this image."} If it is hosted elsewhere, the image host may block editing.`, "error");
        } finally {
          if (applyButton) applyButton.disabled = false;
        }
      }, "image/jpeg", 0.92);
    } catch (error) {
      if (applyButton) applyButton.disabled = false;
      if (typeof showAdminToast === "function") showAdminToast("This image cannot be edited because its host does not allow image processing.", "error");
    }
  }

  function applyProductImageEdit(index, newFileOrBlob, newName) {
    if (typeof productImageItems === "undefined" || !productImageItems[index]) return;
    const item = productImageItems[index];
    const fileName = newName || (newFileOrBlob.name ? newFileOrBlob.name : `${item.name || "product"}-edited.jpg`);
    const file = (typeof File !== "undefined" && newFileOrBlob instanceof File)
      ? newFileOrBlob
      : (typeof File !== "undefined"
          ? new File([newFileOrBlob], fileName, { type: newFileOrBlob.type || "image/jpeg" })
          : Object.assign(newFileOrBlob, { name: fileName }));

    const previewUrl = typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(file)
      : "";

    if (item.type === "file" && item.previewUrl && typeof URL !== "undefined") {
      try { URL.revokeObjectURL(item.previewUrl); } catch (_) {}
    }

    productImageItems[index] = {
      id: "edited_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      type: "file",
      file,
      previewUrl,
      name: fileName,
      size: file.size,
      isEdited: true
    };
    syncProductImageUrls();
    renderProductMedia();
  }

  function setupImageEditorCropInteraction() {
    const cropBox = typeof byId === "function" ? byId("pie-crop-box") : null;
    const viewport = typeof byId === "function" ? byId("pie-canvas-viewport") : null;
    if (!cropBox || !viewport) return;

    let isDragging = false;
    let dragMode = "move";
    let startX = 0, startY = 0;
    let startCrop = null;

    const onPointerDown = e => {
      if (!imageEditorState.crop) return;
      e.preventDefault();
      const handle = e.target.dataset.handle;
      dragMode = handle ? handle : "move";
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startCrop = { ...imageEditorState.crop };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    };

    const onPointerMove = e => {
      if (!isDragging || !startCrop || imageEditorScale <= 0) return;
      const dx = (e.clientX - startX) / imageEditorScale;
      const dy = (e.clientY - startY) / imageEditorScale;
      const dim = imageEditorOrientedDim;
      const aspect = imageEditorState.aspectRatio;
      let targetRatio = null;
      if (aspect === "1:1") targetRatio = 1;
      else if (aspect === "4:3") targetRatio = 4 / 3;
      else if (aspect === "16:9") targetRatio = 16 / 9;

      const crop = { ...startCrop };

      if (dragMode === "move") {
        crop.x = Math.max(0, Math.min(dim.width - crop.width, startCrop.x + dx));
        crop.y = Math.max(0, Math.min(dim.height - crop.height, startCrop.y + dy));
      } else {
        if (dragMode === "se") {
          crop.width = Math.max(40, Math.min(dim.width - startCrop.x, startCrop.width + dx));
          crop.height = targetRatio ? crop.width / targetRatio : Math.max(40, Math.min(dim.height - startCrop.y, startCrop.height + dy));
        } else if (dragMode === "sw") {
          const maxLeftShift = startCrop.x + startCrop.width - 40;
          const shift = Math.min(maxLeftShift, Math.max(-startCrop.x, -dx));
          crop.x = startCrop.x - shift;
          crop.width = startCrop.width + shift;
          crop.height = targetRatio ? crop.width / targetRatio : Math.max(40, Math.min(dim.height - startCrop.y, startCrop.height + dy));
        } else if (dragMode === "ne") {
          crop.width = Math.max(40, Math.min(dim.width - startCrop.x, startCrop.width + dx));
          if (targetRatio) {
            crop.height = crop.width / targetRatio;
            crop.y = startCrop.y + startCrop.height - crop.height;
          } else {
            const shiftY = Math.min(startCrop.y + startCrop.height - 40, Math.max(-startCrop.y, -dy));
            crop.y = startCrop.y - shiftY;
            crop.height = startCrop.height + shiftY;
          }
        } else if (dragMode === "nw") {
          const shiftX = Math.min(startCrop.x + startCrop.width - 40, Math.max(-startCrop.x, -dx));
          crop.x = startCrop.x - shiftX;
          crop.width = startCrop.width + shiftX;
          if (targetRatio) {
            crop.height = crop.width / targetRatio;
            crop.y = startCrop.y + startCrop.height - crop.height;
          } else {
            const shiftY = Math.min(startCrop.y + startCrop.height - 40, Math.max(-startCrop.y, -dy));
            crop.y = startCrop.y - shiftY;
            crop.height = startCrop.height + shiftY;
          }
        }

        if (crop.x < 0) { crop.width += crop.x; crop.x = 0; }
        if (crop.y < 0) { crop.height += crop.y; crop.y = 0; }
        if (crop.x + crop.width > dim.width) crop.width = dim.width - crop.x;
        if (crop.y + crop.height > dim.height) crop.height = dim.height - crop.y;
      }

      imageEditorState.crop = crop;
      renderEditorCanvas();
    };

    const onPointerUp = () => {
      isDragging = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    cropBox.addEventListener("pointerdown", onPointerDown);
  }

  function validateProductMedia(files, gif = false) {
    for (const file of files) {
      if (gif ? file.type !== "image/gif" : !file.type.startsWith("image/")) throw new Error(`${file.name}: choose ${gif ? "a GIF" : "an image"} file.`);
      if (file.size > IMAGEKIT_MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
    }
  }

  async function saveProductMedia(data, button) {
    const directFiles = [...(typeof byId === "function" ? byId("product-image-files")?.files || [] : [])];
    const gifs = [...(typeof byId === "function" ? byId("product-gif-file")?.files || [] : [])];

    if (typeof productImageItems === "undefined") {
      productImageItems = [];
    }

    // Ensure any existing URLs from productImageUrls are represented
    if (productImageUrls && productImageUrls.length > 0) {
      const knownUrls = new Set(productImageItems.filter(item => item && item.type === "url").map(item => item.url));
      productImageUrls.forEach((url, i) => {
        const u = String(url).trim();
        if (u && !knownUrls.has(u)) {
          productImageItems.push({
            id: "url_" + i,
            type: "url",
            url: u,
            previewUrl: u,
            name: (u.split("/").pop() || `Image ${i + 1}`).split("?")[0],
            size: 0
          });
        }
      });
    }

    // Sync any direct files from file input not yet represented in productImageItems
    if (directFiles.length > 0) {
      const knownFiles = new Set(productImageItems.filter(item => item && item.type === "file").map(item => item.file));
      directFiles.forEach(file => {
        if (!knownFiles.has(file)) {
          productImageItems.push({
            id: "direct_" + Math.random().toString(36).slice(2, 8),
            type: "file",
            file,
            previewUrl: "",
            name: file.name,
            size: file.size
          });
        }
      });
    }

    const filesToValidate = productImageItems.filter(item => item && item.type === "file").map(item => item.file);
    validateProductMedia(filesToValidate);
    validateProductMedia(gifs, true);

    const upload = async file => {
      if (!productMediaUploads.has(file)) {
        const result = await uploadFileToImageKit(file, "/Product");
        if (!result.url) throw new Error("ImageKit did not return an image URL. Please retry.");
        productMediaUploads.set(file, result.url);
      }
      return productMediaUploads.get(file);
    };

    const finalUrls = [];
    const filesToUpload = productImageItems.filter(item => item && item.type === "file");
    let uploadCount = 0;

    for (let i = 0; i < productImageItems.length; i++) {
      const item = productImageItems[i];
      if (!item) continue;
      if (item.type === "url") {
        if (item.url && String(item.url).trim()) finalUrls.push(String(item.url).trim());
      } else if (item.type === "file") {
        uploadCount++;
        if (button) button.textContent = `Uploading image ${uploadCount} of ${filesToUpload.length}…`;
        const uploadedUrl = await upload(item.file);
        item.type = "url";
        item.url = uploadedUrl;
        finalUrls.push(uploadedUrl);
      }
    }

    data.imageUrl = finalUrls.join(", ");
    if (button) button.textContent = gifs.length ? "Uploading GIF…" : "Saving product…";
    data.gifUrl = gifs.length ? await upload(gifs[0]) : productGifUrl;
    delete data.image_url;
    delete data.image;

    productImageUrls = [...finalUrls];
  }
  function readColourVariantSource(data) {
    const map = data.colourPrices || data.colorPrices || data.colour_prices || data.color_prices || data.pricesByColour || data.pricesByColor;
    const raw = data.colourOptions ?? data.colorOptions ?? data.colours ?? data.colors ?? data.colour ?? data.color;
    const entries = [];
    if (Array.isArray(raw)) {
      raw.forEach(entry => {
        if (entry && typeof entry === "object") {
          const label = String(entry.colour ?? entry.color ?? entry.label ?? entry.name ?? "").trim();
          const price = Number(entry.additionalPrice ?? entry.additional_price ?? entry.price ?? entry.amount ?? map?.[label]);
          if (label) entries.push({ label, price: Number.isFinite(price) && price > 0 ? price : 0 });
        } else {
          const label = String(entry ?? "").trim();
          if (label) entries.push({ label, price: Number(map?.[label]) || 0 });
        }
      });
    } else if (raw && typeof raw === "object") {
      Object.entries(raw).sort((a, b) => Number(a[1]?.order ?? 0) - Number(b[1]?.order ?? 0)).forEach(([label, value]) => {
        const mapped = map?.[label];
        const price = Number((value && typeof value === "object" ? value.additionalPrice ?? value.additional_price ?? value.price ?? value.amount : value) ?? (mapped && typeof mapped === "object" ? mapped.additionalPrice ?? mapped.price ?? mapped.amount : mapped));
        if (String(label).trim()) entries.push({ label: String(label).trim(), price: Number.isFinite(price) && price > 0 ? price : 0 });
      });
    } else if (typeof raw === "string" && raw.trim()) {
      raw.split(",").map(label => label.trim()).filter(Boolean).forEach(label => {
        const mapped = Number(map && typeof map === "object" ? (map[label] && typeof map[label] === "object" ? map[label].price ?? map[label].additionalPrice ?? map[label].amount : map[label]) : NaN);
        entries.push({ label, price: Number.isFinite(mapped) && mapped > 0 ? mapped : 0 });
      });
    }
    return entries;
  }

  function readSizeVariantSource(data) {
    const prices = data.sizePrices || data.size_prices || data.pricesBySize || data.prices_by_size;
    const raw = data.sizes ?? data.sizeOptions ?? data.size_options ?? data.availableSizes ?? data.available_sizes;
    const entries = [];
    if (Array.isArray(raw)) {
      raw.forEach(entry => {
        if (entry && typeof entry === "object") {
          const label = String(entry.size ?? entry.label ?? entry.name ?? "").trim();
          const price = Number(entry.price ?? entry.amount ?? prices?.[label]);
          if (label) entries.push({ label, price: Number.isFinite(price) && price > 0 ? price : 0 });
        } else {
          const label = String(entry ?? "").trim();
          if (label) entries.push({ label, price: Number(prices?.[label]) || 0 });
        }
      });
    } else if (raw && typeof raw === "object") {
      Object.entries(raw).sort((a, b) => Number(a[1]?.order ?? 0) - Number(b[1]?.order ?? 0)).forEach(([label, value]) => {
        const mapped = prices?.[label];
        const price = Number((value && typeof value === "object" ? value.price ?? value.amount : value) ?? (mapped && typeof mapped === "object" ? mapped.price ?? mapped.amount : mapped));
        if (String(label).trim()) entries.push({ label: String(label).trim(), price: Number.isFinite(price) && price > 0 ? price : 0 });
      });
    } else if (typeof raw === "string" && raw.trim()) {
      raw.split(",").map(label => label.trim()).filter(Boolean).forEach(label => {
        const mapped = Number(prices && typeof prices === "object" ? (prices[label] && typeof prices[label] === "object" ? prices[label].price ?? prices[label].amount : prices[label]) : NaN);
        entries.push({ label, price: Number.isFinite(mapped) && mapped > 0 ? mapped : 0 });
      });
    }
    return entries;
  }

  function renderVariantRows(containerId, draft, labelPlaceholder, removeLabel) {
    const container = byId(containerId);
    container.replaceChildren();
    draft.forEach((entry, index) => {
      const row = document.createElement("div"); row.className = "product-variant-row";
      const label = document.createElement("input"); label.type = "text"; label.value = entry.label || ""; label.placeholder = labelPlaceholder; label.dataset.variantLabel = "true"; label.setAttribute("aria-label", labelPlaceholder);
      const priceLabel = containerId === "product-size-rows" ? "Full size price (INR)" : "Colour extra charge (INR)";
      const price = document.createElement("input"); price.type = "number"; price.min = "0"; price.step = "any"; price.value = Number(entry.price) || 0; price.dataset.variantPrice = "true"; price.setAttribute("aria-label", priceLabel); price.placeholder = priceLabel;
      const priceField = document.createElement("label"); priceField.textContent = priceLabel; priceField.append(price);
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "order-item-remove"; remove.textContent = "Remove"; remove.setAttribute("aria-label", `${removeLabel} ${entry.label || index + 1}`);
      remove.addEventListener("click", () => { const rows = readProductVariantRows(containerId, false); rows.splice(index, 1); if (containerId === "product-colour-rows") productColourDraft = rows; else productSizeDraft = rows; renderVariantRows(containerId, rows, labelPlaceholder, removeLabel); });
      row.append(label, priceField, remove);
      container.append(row);
    });
  }

  function readProductVariantRows(containerId, validate = true) {
    return [...byId(containerId).querySelectorAll(".product-variant-row")].map(row => {
      const label = row.querySelector("[data-variant-label]").value.trim();
      const value = row.querySelector("[data-variant-price]").value;
      const price = Number(value);
      if (validate && (!label || value === "" || !Number.isFinite(price) || price < 0)) throw new Error("Each variant needs a name and a valid non-negative price. Remove unused rows.");
      return { label, price };
    });
  }

  function renderProductVariantRows() {
    renderVariantRows("product-colour-rows", productColourDraft, "Colour (e.g. Black)", "Remove colour");
    renderVariantRows("product-size-rows", productSizeDraft, "Size (e.g. Small)", "Remove size");
  }

  function applyProductVariants(data) {
    const colours = readProductVariantRows("product-colour-rows");
    const sizes = readProductVariantRows("product-size-rows");
    const duplicates = list => list.some((entry, index) => list.findIndex(item => item.label.toLowerCase() === entry.label.toLowerCase()) !== index);
    if (duplicates(colours)) throw new Error("Colour option names must be unique.");
    if (duplicates(sizes)) throw new Error("Size option names must be unique.");

    delete data.colourOptions; delete data.colorOptions; delete data.colours; delete data.colors;
    delete data.colourPrices; delete data.colorPrices; delete data.colour_prices; delete data.color_prices;
    delete data.pricesByColour; delete data.pricesByColor;
    delete data.sizes; delete data.sizeOptions; delete data.size_options; delete data.availableSizes; delete data.available_sizes;
    delete data.sizePrices; delete data.size_prices; delete data.pricesBySize; delete data.prices_by_size;

    const objProto = (data && typeof data === "object" ? Object.getPrototypeOf(data) : null) || Object.prototype;
    const createMap = () => Object.create(objProto);

    data.colourOptions = createMap();
    data.colourPrices = createMap();
    data.sizes = createMap();
    data.sizePrices = createMap();
    data.color = String(data.color ?? data.colour ?? "").trim() || colours.map(entry => entry.label).join(", ");
    delete data.colour;
    if (colours.length) {
      const colourOptions = createMap(); const colourPrices = createMap();
      colours.forEach(({ label, price }) => { colourOptions[label] = Object.assign(createMap(), { order: Object.keys(colourOptions).length }); colourPrices[label] = price; });
      data.colourOptions = colourOptions;
      data.colourPrices = colourPrices;
    }
    if (sizes.length) {
      const sizeOptions = createMap(); const sizePrices = createMap();
      sizes.forEach(({ label, price }) => { sizeOptions[label] = Object.assign(createMap(), { order: Object.keys(sizeOptions).length }); sizePrices[label] = price; });
      data.sizes = sizeOptions;
      data.sizePrices = sizePrices;
    }
  }

  function populateOrderProductSelect() {
    const select = byId("order-product-select");
    select.replaceChildren(new Option("Choose a product", ""));
    adminProducts.forEach(product => {
      const option = new Option(`${product.productName || "Untitled product"} — ${formatMoney(product.price)}`, product.id);
      select.append(option);
    });
  }

  function buildCustomerRecordsFromOrders(docs) {
    const records = new Map();
    docs.forEach(doc => {
      const order = typeof doc.data === "function" ? doc.data() : doc;
      const readCustomerValue = value => {
        const text = String(value || "").trim();
        return text.toLowerCase() === "null" ? "" : text;
      };
      const name = readCustomerValue(order.name);
      const email = readCustomerValue(order.email);
      const phone = readCustomerValue(order.phone);
      if (!name && !email && !phone) return;
      const normalizedEmail = email.toLowerCase();
      const normalizedPhone = phone.replace(/\D/g, "");
      const key = normalizedEmail ? `email:${normalizedEmail}` : normalizedPhone ? `phone:${normalizedPhone}` : `order:${doc.id || name.toLowerCase()}`;
      const current = records.get(key);
      const next = {
        name,
        email,
        phone,
        address: String(order.address || "").trim(),
        pickup_location: String(order.pickup_location || "").trim(),
        fulfillment_type: String(order.fulfillment_type || "delivery").trim().toLowerCase() === "pickup" ? "pickup" : "delivery"
      };
      if (!current) records.set(key, next);
      else Object.keys(next).forEach(field => {
        if (!current[field] && next[field]) current[field] = next[field];
      });
    });
    return [...records.values()].sort((a, b) => (a.name || a.email || a.phone).localeCompare(b.name || b.email || b.phone));
  }

  function populateCustomerRecordSelect(search = "") {
    const select = byId("customer-record-select");
    if (!select) return;
    const query = String(search || "").trim().toLowerCase();
    const matches = customerRecords.filter(record => [record.name, record.email, record.phone, record.address, record.pickup_location]
      .some(value => String(value || "").toLowerCase().includes(query)));
    select.replaceChildren(new Option(matches.length ? "Choose a customer record…" : "No matching customer records", ""));
    matches.forEach((record, index) => {
      const label = [record.name || "Customer", record.email || record.phone].filter(Boolean).join(" · ");
      const option = new Option(label, String(customerRecords.indexOf(record)));
      select.append(option);
    });
    const count = byId("customer-record-count");
    if (count) count.textContent = customerRecords.length
      ? `${matches.length} of ${customerRecords.length} customer record${customerRecords.length === 1 ? "" : "s"} from previous orders.`
      : "No customer details are available from previous orders yet.";
  }

  function applyCustomerRecord(index) {
    const record = customerRecords[Number(index)];
    if (!record) return;
    const fields = {
      name: record.name,
      email: record.email,
      phone: record.phone,
      address: record.address,
      pickup_location: record.pickup_location,
      fulfillment_type: record.fulfillment_type
    };
    Object.entries(fields).forEach(([key, value]) => {
      const control = byId("editor-fields")?.querySelector(`[data-field="${key}"]`);
      if (!control || value === undefined) return;
      control.value = value ?? "";
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
    window.showAdminToast?.(`Filled order details for ${record.name || record.email || record.phone}. Review them before saving.`, "success");
  }

  function selectedOrderProduct() {
    return adminProducts.find(product => product.id === byId("order-product-select")?.value) || null;
  }

  function updateOrderProductVariantPicker() {
    const product = selectedOrderProduct();
    const colourField = byId("order-product-colour-field");
    const sizeField = byId("order-product-size-field");
    const colourSelect = byId("order-product-colour-select");
    const sizeSelect = byId("order-product-size-select");
    const pricePreview = byId("order-product-price-preview");
    const colours = product ? readColourVariantSource(product) : [];
    const sizes = product ? readSizeVariantSource(product).sort((a, b) => {
      const priceA = Number(a.price) > 0 ? Number(a.price) : Number(product.price) || 0;
      const priceB = Number(b.price) > 0 ? Number(b.price) : Number(product.price) || 0;
      return priceA - priceB;
    }) : [];

    colourSelect.replaceChildren(new Option(colours.length ? "Choose a colour…" : "No colour options", ""));
    colours.forEach(option => colourSelect.append(new Option(
      option.price > 0 ? `${option.label} (+${formatMoney(option.price)})` : option.label,
      option.label
    )));
    sizeSelect.replaceChildren(new Option(sizes.length ? "Choose a size…" : "No size options", ""));
    sizes.forEach(option => sizeSelect.append(new Option(
      option.price > 0 ? `${option.label} (${formatMoney(option.price)})` : `${option.label} (base price)`,
      option.label
    )));
    colourField.hidden = !colours.length;
    sizeField.hidden = !sizes.length;
    if (colours.length) colourSelect.value = colours[0].label;
    if (sizes.length) sizeSelect.value = sizes[0].label;
    if (product) {
      const price = getOrderProductPrice(product, colourSelect.value, sizeSelect.value);
      pricePreview.textContent = `Unit price: ${formatMoney(price)}`;
    } else {
      pricePreview.textContent = "";
    }
  }

  function getOrderProductPrice(product, colour, size) {
    const selectedSize = readSizeVariantSource(product).find(option => option.label === size);
    const selectedColour = readColourVariantSource(product).find(option => option.label === colour);
    const sizePrice = Number(selectedSize?.price) > 0 ? Number(selectedSize.price) : Number(product.price) || 0;
    return Math.max(0, sizePrice + (Number(selectedColour?.price) || 0));
  }

  function readOrderItemRows() {
    return [...byId("order-item-rows").querySelectorAll(".order-item-row-editor")].map(row => ({
      id: row.dataset.productId,
      productName: row.dataset.productName,
      imageUrl: row.dataset.imageUrl,
      price: Math.max(0, Number(row.querySelector("[data-item-price]").value) || 0),
      quantity: Math.max(1, Math.floor(Number(row.querySelector("[data-item-quantity]").value) || 1)),
      colour: row.dataset.colour || "",
      size: row.dataset.size || "",
      customizable: row.dataset.customizable === "true",
      customization: row.dataset.customization || ""
    }));
  }

  function renderOrderItemRows() {
    const container = byId("order-item-rows");
    container.replaceChildren();
    orderItemsDraft.forEach((item, index) => {
      const row = document.createElement("div"); row.className = "order-item-row-editor";
      row.dataset.productId = String(item.id || item.productId || "");
      row.dataset.productName = String(item.productName || item.name || "Untitled product");
      row.dataset.imageUrl = firstProductImage(item.imageUrl || item.image_url || item.image);
      row.dataset.colour = String(item.colour || item.color || "");
      row.dataset.size = String(item.size || "");
      row.dataset.customizable = String(item.customizable === true);
      row.dataset.customization = String(item.customization || "");
      const name = document.createElement("strong"); name.textContent = row.dataset.productName;
      const variantSummary = [row.dataset.colour && `Colour: ${row.dataset.colour}`, row.dataset.size && `Size: ${row.dataset.size}`].filter(Boolean).join(" · ");
      row.append(name);
      if (variantSummary) { const summary = document.createElement("small"); summary.className = "order-item-variant-summary"; summary.textContent = variantSummary; row.append(summary); }
      const fields = document.createElement("div"); fields.className = "order-item-row-fields";
      const quantityLabel = document.createElement("label"); quantityLabel.textContent = "Qty";
      const quantity = document.createElement("input"); quantity.type = "number"; quantity.min = "1"; quantity.step = "1"; quantity.value = Math.max(1, Number(item.quantity) || 1); quantity.dataset.itemQuantity = "true"; quantityLabel.append(quantity);
      const priceLabel = document.createElement("label"); priceLabel.textContent = "Unit price (INR)";
      const price = document.createElement("input"); price.type = "number"; price.min = "0"; price.step = "1"; price.value = Math.max(0, Number(item.price) || 0); price.dataset.itemPrice = "true"; priceLabel.append(price);
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "order-item-remove"; remove.textContent = "Remove"; remove.setAttribute("aria-label", `Remove ${row.dataset.productName}`);
      remove.addEventListener("click", () => { orderItemsDraft = readOrderItemRows(); orderItemsDraft.splice(index, 1); renderOrderItemRows(); });
      fields.append(quantityLabel, priceLabel, remove); row.append(fields); container.append(row);
    });
    updateOrderItemPreview();
  }

  function updateOrderItemPreview() {
    const items = readOrderItemRows();
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const preview = byId("order-item-subtotal");
    if (preview) preview.textContent = `Items subtotal: ${formatMoney(subtotal)}`;
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
  }
  function humanize(key) {
    return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^\w/, character => character.toUpperCase());
  }
  function productSelect(key, options, value, placeholder) {
    const select = document.createElement("select"); select.dataset.field = key;
    const placeholderOption = document.createElement("option"); placeholderOption.value = ""; placeholderOption.textContent = placeholder; select.append(placeholderOption);
    const entries = options.map(entry => Array.isArray(entry) ? entry : [entry, entry]);
    if (value && !entries.some(([optionValue]) => String(optionValue) === String(value))) entries.push([value, value]);
    entries.forEach(([optionValue, text]) => { const option = document.createElement("option"); option.value = optionValue; option.textContent = text; select.append(option); });
    if (value) select.value = String(value);
    return select;
  }
  function toDatetimeLocalString(date) {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fromDatetimeLocalString(str) {
    if (!str) return null;
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  async function generateProductMarketing(mode, button) {
    const fields = byId("editor-fields");
    const fieldValue = name => fields.querySelector(`[data-field="${name}"]`)?.value || "";
    const descriptionEditor = fields.querySelector('[data-field="description"][contenteditable="true"]');
    const tagsField = fields.querySelector('[data-field="tags"]');
    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = mode === "description" ? "Generating description…" : "Generating tags…";
    try {
      const workerUrl = window.PRODUCT_MARKETING_WORKER_URL;
      if (!workerUrl) throw new Error("Set the Cloudflare Worker URL in cloudflare-worker-config.js, then reload this page.");
      const user = auth.currentUser;
      if (!user) throw new Error("Sign in as an administrator, then try again.");
      const token = await user.getIdToken();
      const response = await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          mode,
          productName: fieldValue("productName"),
          category: fieldValue("category"),
          bestFor: fieldValue("bestFor") || fieldValue("best_for"),
          colour: fieldValue("colour") || fieldValue("color"),
          price: fieldValue("price"),
          description: descriptionEditor?.innerText || "",
          searchKeywords: tagsField?.value || ""
        })
      });
      const generated = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(generated.error || `Copy generation failed (HTTP ${response.status}).`);

      if (mode === "description") {
        if (!generated.description) throw new Error("The AI did not return a description. Please try again.");
        if (descriptionEditor) {
          descriptionEditor.innerHTML = window.sanitizeProductDescription(generated.description);
          descriptionEditor.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } else {
        if (!Array.isArray(generated.tags) || !generated.tags.length) throw new Error("The AI did not return SEO tags. Please try again.");
        if (tagsField) {
          tagsField.value = generated.tags.join(", ");
          tagsField.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }

      if (advancedEditorUsed) {
        const advanced = JSON.parse(jsonInput.value);
        if (mode === "description") advanced.description = window.sanitizeProductDescription(generated.description);
        else advanced.tags = generated.tags.join(", ");
        jsonInput.value = plainData(advanced);
      }
      window.showAdminToast?.(mode === "description"
        ? "AI product description generated. Review it, then save the product."
        : "AI SEO tags generated. Review them, then save the product.", "success");
    } catch (error) {
      console.error(`Could not generate product ${mode}:`, error);
      window.showAdminToast?.(error?.message || "Could not generate copy. Check the Worker and Gemini setup, then try again.", "error");
    } finally {
      button.disabled = false;
      button.textContent = previousText;
    }
  }

  function displayField(key, value) {
    const wrapper = document.createElement("div"); wrapper.className = "admin-field";
    const labelRow = document.createElement("div"); labelRow.className = "admin-field-label";
    const label = document.createElement("label");
    label.textContent = key === "timestamp" && activeDocument?.collection === "orders" ? "Placed Date & Time" : humanize(key);
    if (activeDocument?.collection === "products" && key === "price") label.textContent = "Base price (INR)";
    if (activeDocument?.collection === "products" && key === "color") label.textContent = "Display colours (comma-separated)";
    label.htmlFor = `field-${key}`;
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Remove field";
    remove.addEventListener("click", () => {
      editorModel = readEditorFields(); delete editorModel[key];
      advancedEditorUsed = false; jsonInput.value = plainData(editorModel); renderEditorFields();
    });
    if (activeDocument?.collection === "orders" && ["order_id", "timestamp"].includes(key)) {
      remove.style.display = "none";
    }
    if (activeDocument?.collection === "products" && ["productId", "productName", "price", "stock", "customizable"].includes(key)) remove.hidden = true;
    labelRow.append(label, remove); wrapper.append(labelRow);

    if (key === "timestamp" && activeDocument?.collection === "orders") {
      const dateObj = parseOrderDate(value) || new Date();
      const formattedDate = dateObj.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

      if (!activeDocument.creating) {
        const infoRow = document.createElement("div");
        infoRow.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm);";

        const textSpan = document.createElement("span");
        textSpan.style.cssText = "font-weight: 600; font-size: 0.88rem; color: var(--text-1);";
        textSpan.innerHTML = `📅 ${formattedDate} <span style="font-size: 0.74rem; font-weight: 500; color: var(--text-3); margin-left: 4px;">(Original placed time preserved)</span>`;

        const changeBtn = document.createElement("button");
        changeBtn.type = "button";
        changeBtn.className = "btn-secondary";
        changeBtn.style.cssText = "height: 28px !important; min-height: 28px !important; padding: 0 8px !important; font-size: 0.75rem !important;";
        changeBtn.textContent = "Change";
        changeBtn.title = "Manually change order placement date & time";

        const editWrap = document.createElement("div");
        editWrap.style.display = "none";
        editWrap.style.marginTop = "6px";

        const input = document.createElement("input");
        input.type = "datetime-local";
        input.dataset.field = key;
        input.value = toDatetimeLocalString(dateObj);
        input.style.width = "100%";

        const nowBtn = document.createElement("button");
        nowBtn.type = "button";
        nowBtn.className = "btn-secondary";
        nowBtn.style.cssText = "height: 28px !important; min-height: 28px !important; padding: 0 8px !important; font-size: 0.75rem !important; margin-top: 6px;";
        nowBtn.textContent = "Use Current Date & Time";
        nowBtn.title = "Set placed date & time to right now";
        nowBtn.addEventListener("click", () => {
          timestampExplicitlyEdited = true;
          input.value = toDatetimeLocalString(new Date());
        });

        editWrap.append(input, nowBtn);

        changeBtn.addEventListener("click", () => {
          timestampExplicitlyEdited = true;
          infoRow.style.display = "none";
          editWrap.style.display = "block";
          input.focus();
        });

        infoRow.append(textSpan, changeBtn);
        wrapper.append(infoRow, editWrap);
      } else {
        const input = document.createElement("input");
        input.type = "datetime-local";
        input.dataset.field = key;
        input.value = toDatetimeLocalString(dateObj);
        wrapper.append(input);
      }
    } else if (value && typeof value === "object" && value.__firestoreType === "timestamp") {
      const input = document.createElement("input"); input.type = "datetime-local"; input.dataset.field = key;
      input.value = toDatetimeLocalString(new Date(value.value));
      wrapper.append(input);
    } else if (typeof value === "boolean") {
      const select = document.createElement("select"); select.dataset.field = key;
      [["true", "Yes"], ["false", "No"]].forEach(([val, text]) => { const option = document.createElement("option"); option.value = val; option.textContent = text; select.append(option); });
      select.value = String(value); wrapper.append(select);
    } else if (typeof value === "number") {
      const input = document.createElement("input"); input.type = "number"; input.step = "any"; input.dataset.field = key; input.value = value; wrapper.append(input);
    } else if (typeof value === "string" || value === null) {
      const input = document.createElement("input"); input.type = "text"; input.dataset.field = key; input.value = value ?? "";
      if (/email/i.test(key)) input.type = "email";
      else if (/phone|mobile/i.test(key)) input.type = "tel";
      if (key === "status_info" && activeDocument.collection === "orders") {
        wrapper.classList.add("admin-field-full");
        const textarea = document.createElement("textarea");
        textarea.dataset.field = key;
        textarea.value = value ?? "";
        textarea.rows = 3;
        textarea.placeholder = "Add information about the current order status";
        wrapper.append(textarea);
      } else if (key === "payment_status" && activeDocument.collection === "orders") {
        const select = document.createElement("select"); select.dataset.field = key;
        ["Pending", "Partial", "Paid"].forEach(optionValue => {
          const option = document.createElement("option"); option.value = optionValue; option.textContent = optionValue; select.append(option);
        });
        select.value = canonicalPaymentStatus(value);
        wrapper.append(select);
      } else if (/status/i.test(key) && activeDocument.collection === "orders") {
        const select = document.createElement("select"); select.dataset.field = key;
        select.innerHTML = orderStatusOptions(canonicalOrderStatus(value, activeDocument.data?.fulfillment_type), activeDocument.data?.fulfillment_type);
        wrapper.append(select);
      } else if (key === "fulfillment_type" && activeDocument.collection === "orders") {
        const select = document.createElement("select"); select.dataset.field = key;
        [["delivery", "Delivery"], ["pickup", "Pickup"]].forEach(([optionValue, text]) => {
          const option = document.createElement("option"); option.value = optionValue; option.textContent = text; select.append(option);
        });
        if (value) select.value = String(value).toLowerCase();
        wrapper.append(select);
      } else if (/address|note|expected.?delivery/i.test(key)) {
        wrapper.classList.add("admin-field-full");
        const textarea = document.createElement("textarea");
        textarea.dataset.field = key;
        textarea.value = value ?? "";
        textarea.rows = 3;
        wrapper.append(textarea);
      } else if (activeDocument.collection === "products" && key === "category") {
        wrapper.append(productSelect(key, PRODUCT_CATEGORIES, value, "Select a category"));
      } else if (activeDocument.collection === "products" && key === "availability") {
        wrapper.append(productSelect(key, PRODUCT_AVAILABILITY, value, "Select availability"));
      } else if (activeDocument.collection === "products" && (key === "bestFor" || key === "best_for")) {
        wrapper.append(productSelect(key, PRODUCT_BEST_FOR, value, "Select an audience"));
      } else if (activeDocument.collection === "products" && key === "description") {
        wrapper.classList.add("admin-field-full", "admin-description-field");
        const toolbar = document.createElement("div");
        toolbar.className = "description-toolbar";
        toolbar.setAttribute("role", "toolbar");
        toolbar.setAttribute("aria-label", "Description formatting");
        const editor = document.createElement("div");
        editor.className = "description-editor";
        editor.contentEditable = "true";
        editor.dataset.field = key;
        editor.setAttribute("role", "textbox");
        editor.setAttribute("aria-label", "Product description");
        editor.setAttribute("aria-multiline", "true");
        editor.spellcheck = true;
        editor.innerHTML = window.sanitizeProductDescription(String(value ?? ""));
        let savedRange = null;
        let requestedLineSpacing = null;
        const rememberSelection = () => {
          const selection = window.getSelection();
          if (selection?.rangeCount && editor.contains(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange();
        };
        ["keyup", "mouseup", "input", "focus"].forEach(type => editor.addEventListener(type, rememberSelection));
        const restoreSelection = () => {
          editor.focus();
          if (!savedRange) return;
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(savedRange);
        };
        const applyInlineStyle = (property, value) => {
          restoreSelection();
          if (!savedRange || savedRange.collapsed) return;
          const span = document.createElement("span");
          span.style[property] = value;
          const fragment = savedRange.extractContents();
          span.append(fragment);
          savedRange.insertNode(span);
          const selection = window.getSelection();
          selection.removeAllRanges();
          const nextRange = document.createRange();
          nextRange.selectNodeContents(span);
          selection.addRange(nextRange);
          savedRange = nextRange.cloneRange();
        };
        const button = (label, command, title) => {
          const control = document.createElement("button");
          control.type = "button";
          control.className = "description-tool-btn";
          control.textContent = label;
          control.title = title;
          control.setAttribute("aria-label", title);
          control.addEventListener("mousedown", event => event.preventDefault());
          control.addEventListener("click", () => {
            restoreSelection();
            document.execCommand(command, false);
            rememberSelection();
            editor.dispatchEvent(new Event("input", { bubbles: true }));
          });
          toolbar.append(control);
        };
        button("B", "bold", "Bold");
        button("I", "italic", "Italic");
        button("U", "underline", "Underline");
        button("S", "strikeThrough", "Strikethrough");
        button("• List", "insertUnorderedList", "Bulleted list");
        button("1. List", "insertOrderedList", "Numbered list");
        const block = document.createElement("select");
        block.className = "description-tool-select";
        block.setAttribute("aria-label", "Paragraph style");
        [["P", "Paragraph"], ["H2", "Heading"], ["H3", "Subheading"], ["BLOCKQUOTE", "Quote"]].forEach(([v, label]) => {
          const option = document.createElement("option"); option.value = v; option.textContent = label; block.append(option);
        });
        block.addEventListener("change", () => {
          restoreSelection(); document.execCommand("formatBlock", false, block.value);
          editor.dispatchEvent(new Event("input", { bubbles: true }));
        });
        toolbar.append(block);
        const fontSize = document.createElement("select");
        fontSize.className = "description-tool-select description-font-size";
        fontSize.setAttribute("aria-label", "Font size");
        [["12", "12 px"], ["14", "14 px"], ["16", "16 px"], ["18", "18 px"], ["24", "24 px"], ["32", "32 px"]].forEach(([v, label]) => {
          const option = document.createElement("option"); option.value = v; option.textContent = label; fontSize.append(option);
        });
        fontSize.value = "16";
        fontSize.addEventListener("change", () => {
          applyInlineStyle("fontSize", `${fontSize.value}px`);
          editor.dispatchEvent(new Event("input", { bubbles: true }));
        });
        toolbar.append(fontSize);
        const spacing = document.createElement("select");
        spacing.className = "description-tool-select description-line-spacing";
        spacing.setAttribute("aria-label", "Line spacing");
        spacing.title = "Line spacing";
        [["1", "Line: 1.0"], ["1.15", "Line: 1.15"], ["1.5", "Line: 1.5"], ["2", "Line: 2.0"], ["2.5", "Line: 2.5"]].forEach(([v, label]) => {
          const option = document.createElement("option"); option.value = v; option.textContent = label; spacing.append(option);
        });
        spacing.value = "1.5";
        spacing.addEventListener("change", () => {
          requestedLineSpacing = spacing.value;
          restoreSelection();
          const selection = window.getSelection();
          const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
          const blocks = [...editor.querySelectorAll("p, div, h2, h3, li, blockquote")];
          const targets = range && !range.collapsed
            ? blocks.filter(node => { try { return range.intersectsNode(node); } catch (_) { return false; } })
            : [selection?.anchorNode?.parentElement?.closest("p, div, h2, h3, li, blockquote")].filter(node => node && editor.contains(node));
          (targets.length ? targets : [editor]).forEach(node => { node.style.lineHeight = spacing.value; });
          editor.dispatchEvent(new Event("input", { bubbles: true }));
        });
        toolbar.append(spacing);
        const colorLabel = document.createElement("label");
        colorLabel.className = "description-color-tool";
        colorLabel.textContent = "Text colour";
        const color = document.createElement("input"); color.type = "color"; color.value = "#263244";
        color.setAttribute("aria-label", "Text colour");
        color.addEventListener("change", () => {
          applyInlineStyle("color", color.value);
          editor.dispatchEvent(new Event("input", { bubbles: true }));
        });
        colorLabel.append(color); toolbar.append(colorLabel);
        button("Clear", "removeFormat", "Clear formatting");
        const generateDescriptionButton = document.createElement("button");
        generateDescriptionButton.type = "button";
        generateDescriptionButton.className = "description-tool-btn description-ai-btn";
        generateDescriptionButton.textContent = "✦ Generate description";
        generateDescriptionButton.title = "Generate a formatted product description with AI";
        generateDescriptionButton.addEventListener("mousedown", event => event.preventDefault());
        generateDescriptionButton.addEventListener("click", () => generateProductMarketing("description", generateDescriptionButton));
        toolbar.append(generateDescriptionButton);
        editor.addEventListener("paste", event => {
          event.preventDefault();
          const html = event.clipboardData?.getData("text/html");
          const plain = event.clipboardData?.getData("text/plain") || "";
          const plainHtml = plain.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r\n?/g, "\n").replace(/\n/g, "<br>");
          const safeHtml = html ? window.sanitizeProductDescription(html) : plainHtml;
          if (requestedLineSpacing) {
            const pasted = document.createElement("template");
            pasted.innerHTML = safeHtml;
            let blocks = [...pasted.content.querySelectorAll("p, div, h2, h3, li, blockquote")];
            if (!blocks.length) {
              const paragraph = document.createElement("p");
              paragraph.append(pasted.content);
              pasted.content.append(paragraph);
              blocks = [paragraph];
            }
            blocks.forEach(block => { block.style.lineHeight = requestedLineSpacing; });
            document.execCommand("insertHTML", false, pasted.innerHTML);
          } else {
            document.execCommand("insertHTML", false, safeHtml);
          }
          rememberSelection();
        });
        const hint = document.createElement("small");
        hint.className = "description-editor-hint";
        hint.textContent = "AI copy uses storefront-safe headings, bold text, lists, spacing, and restrained styling. You can also paste formatted text from Word or Google Docs.";
        wrapper.append(toolbar, editor, hint);
      } else if (activeDocument.collection === "products" && key === "tags") {
        wrapper.classList.add("admin-field-full");
        const textarea = document.createElement("textarea");
        textarea.dataset.field = key;
        textarea.value = value ?? "";
        textarea.rows = key === "description" ? 4 : 3;
        if (key === "tags") textarea.placeholder = "Comma-separated tags";
        wrapper.append(textarea);
        if (activeDocument.collection === "products" && key === "tags") {
          const generateTagsButton = document.createElement("button");
          generateTagsButton.type = "button";
          generateTagsButton.className = "description-tool-btn description-ai-btn";
          generateTagsButton.textContent = "✦ Generate SEO tags";
          generateTagsButton.title = "Generate search tags for this product with AI";
          generateTagsButton.style.marginTop = "8px";
          generateTagsButton.addEventListener("mousedown", event => event.preventDefault());
          generateTagsButton.addEventListener("click", () => generateProductMarketing("tags", generateTagsButton));
          wrapper.append(generateTagsButton);
        }
      } else {
        if (key === "order_id" && activeDocument?.collection === "orders" && !activeDocument.creating) {
          input.readOnly = true;
          input.style.backgroundColor = "var(--surface-2)";
          input.title = "Order ID cannot be modified once placed";
        }
        wrapper.append(input);
      }
    } else {
      const note = document.createElement("span"); note.className = "admin-field-help"; note.textContent = "Complex value. Edit it in the Advanced section below."; wrapper.append(note);
    }
    const control = wrapper.querySelector("input, select, textarea, [contenteditable='true']");
    if (control) { control.id = `field-${key}`; control.name = key; }
    if (activeDocument?.collection === "products" && key === "productId" && control) control.readOnly = true;
    if (activeDocument?.collection === "products" && ["price", "stock"].includes(key) && control) {
      control.min = "0";
      control.step = key === "stock" ? "1" : "any";
    }
    return wrapper;
  }
  function renderEditorFields() {
    const fields = byId("editor-fields"); fields.replaceChildren();
    const collection = activeDocument?.collection;
    const isOrder = collection === "orders";
    const isProduct = collection === "products";
    const variantKeys = new Set(["colourOptions", "colorOptions", "colours", "colors", "colourPrices", "colorPrices", "colour_prices", "color_prices", "pricesByColour", "pricesByColor", "sizes", "sizeOptions", "size_options", "availableSizes", "available_sizes", "sizePrices", "size_prices", "pricesBySize", "prices_by_size"]);
    const mediaKeys = new Set(["imageUrl", "image_url", "image", "gifUrl"]);
    const entries = Object.entries(editorModel).filter(([key]) => !(isOrder && key === "items") && !(isProduct && (variantKeys.has(key) || mediaKeys.has(key))));
    if (!isOrder && !isProduct) {
      entries.forEach(([key, value]) => fields.append(displayField(key, value)));
      return;
    }

    const groups = isProduct ? [
      { title: "Product basics", description: "Name, base price (used without a size price), category, and the storefront description.", keys: ["productId", "productName", "price", "originalPrice", "category", "description", "bestFor", "best_for", "useCase", "use_case"] },
      { title: "Customization", description: "Can customers request personalization?", keys: ["customizable", "isCustomizable", "is_customizable"] },
      { title: "Availability and stock", description: "Enter stock as a whole-number quantity, not a stock note.", keys: ["availability", "stockStatus", "stock_status", "stock"] },
      { title: "Discovery and tags", description: "Colour label, search tags, and the best-for audience used by catalog filters.", keys: ["colour", "color", "tags"] }
    ] : [
      { title: "Order status", description: "Order reference, current status, status update information, and placement time.", keys: ["order_id", "status", "status_info", "timestamp", "expected_delivery"] },
      { title: "Customer", description: "Contact details for this order.", keys: ["name", "email", "phone"] },
      { title: "Delivery or pickup", description: "Choose how the customer receives the order and update the address or pickup details.", keys: ["fulfillment_type", "address", "pickup_location"] },
      { title: "Payment and totals", description: "Payment verification and the amounts recorded for this order.", keys: ["payment_status", "payment_ref", "mop", "upi_id", "item_total", "delivery_charge", "discount", "coupon_code", "total"] },
      { title: "Customer note", description: "Special instructions included with the order.", keys: ["order_note"] }
    ];
    const remaining = new Map(entries);
    groups.forEach(group => {
      const sectionEntries = group.keys.filter(key => remaining.has(key)).map(key => [key, remaining.get(key)]);
      if (!sectionEntries.length) return;
      sectionEntries.forEach(([key]) => remaining.delete(key));
      const section = document.createElement("section");
      section.className = "admin-editor-section";
      const heading = document.createElement("div");
      heading.className = "admin-editor-section-heading";
      const title = document.createElement("h3"); title.textContent = group.title;
      const description = document.createElement("p"); description.textContent = group.description;
      heading.append(title, description);
      const grid = document.createElement("div"); grid.className = "admin-field-grid admin-editor-section-fields";
      sectionEntries.forEach(([key, value]) => grid.append(displayField(key, value)));
      section.append(heading, grid); fields.append(section);
    });
    if (remaining.size) {
      const section = document.createElement("section");
      section.className = "admin-editor-section";
      const heading = document.createElement("div");
      heading.className = "admin-editor-section-heading";
      const title = document.createElement("h3"); title.textContent = isProduct ? "Other product details" : "Other order details";
      const description = document.createElement("p"); description.textContent = isProduct
        ? "Less common product fields. Use the advanced section below for nested values such as variant maps."
        : "Less common fields. Use the advanced section for nested values such as line items.";
      heading.append(title, description);
      const grid = document.createElement("div"); grid.className = "admin-field-grid admin-editor-section-fields";
      remaining.forEach((value, key) => grid.append(displayField(key, value)));
      section.append(heading, grid); fields.append(section);
    }
  }
  function readEditorFields() {
    const updated = JSON.parse(JSON.stringify(editorModel));
    byId("editor-fields").querySelectorAll("[data-field]").forEach(control => {
      const key = control.dataset.field;
      const oldValue = editorModel[key];
      if (oldValue && typeof oldValue === "object" && oldValue.__firestoreType === "timestamp") {
        if (activeDocument?.collection === "orders" && !activeDocument.creating && !timestampExplicitlyEdited) {
          updated[key] = oldValue;
        } else {
          const iso = fromDatetimeLocalString(control.value);
          updated[key] = iso ? { __firestoreType: "timestamp", value: iso } : (oldValue || { __firestoreType: "timestamp", value: new Date().toISOString() });
        }
      } else if (typeof oldValue === "boolean") updated[key] = control.value === "true";
      else if (typeof oldValue === "number") updated[key] = control.value === "" ? 0 : Number(control.value);
      else if (control.isContentEditable && activeDocument?.collection === "products" && key === "description") updated[key] = window.sanitizeProductDescription(control.innerHTML);
      else updated[key] = control.value;
    });
    if (activeDocument?.collection === "orders" && activeDocument.creating) updated.items = readOrderItemRows();
    return updated;
  }
  byId("add-editor-field").addEventListener("click", () => {
    const nameInput = byId("new-field-name");
    const name = nameInput.value.trim();
    if (!name || name.includes(".") || name.includes("/")) { byId("editor-error").textContent = "Enter a field name without dots or slashes."; return; }
    editorModel = readEditorFields();
    if (Object.hasOwn(editorModel, name)) { byId("editor-error").textContent = "That field already exists."; return; }
    const type = byId("new-field-type").value;
    editorModel[name] = type === "number" ? 0 : type === "boolean" ? false : "";
    nameInput.value = ""; byId("editor-error").textContent = ""; advancedEditorUsed = false; jsonInput.value = plainData(editorModel); renderEditorFields();
  });
  async function saveEditor() {
    const saveButton = byId("editor-save");
    if (saveButton.disabled) return;
    const buttonText = saveButton.textContent;
    try {
      const data = restoreTypes(advancedEditorUsed ? JSON.parse(jsonInput.value) : readEditorFields());
      if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("Document data must be a JSON object.");
      if (activeDocument.collection === "orders") data.payment_status = canonicalPaymentStatus(data.payment_status);
      if (activeDocument.collection === "orders" && activeDocument.creating) {
        data.items = readOrderItemRows();
        const email = String(data.email || "").trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid customer email before creating the order.");
        if (!data.items.length) throw new Error("Add at least one product to the order.");
        data.item_total = data.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
        data.total = Math.max(0, data.item_total + Number(data.delivery_charge || 0) - Number(data.discount || 0));
      }
      if (activeDocument.collection === "orders" && !activeDocument.creating) {
        if (originalDocumentData && originalDocumentData.timestamp !== undefined && !timestampExplicitlyEdited && !advancedEditorUsed) {
          data.timestamp = restoreTypes(originalDocumentData.timestamp);
        }
        if (originalDocumentData && originalDocumentData.order_id && !advancedEditorUsed) {
          data.order_id = originalDocumentData.order_id;
        }
      }
      if (activeDocument.collection === "products") {
        if (typeof data.description === "string") data.description = window.sanitizeProductDescription(data.description);
        const productName = String(data.productName || "").trim();
        if (!productName) throw new Error("Enter a product name before saving.");
        const price = Number(data.price);
        if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid product price before saving.");
        data.productName = productName;
        data.price = price;
        if (data.originalPrice !== undefined && data.originalPrice !== null && data.originalPrice !== "") data.originalPrice = Math.max(0, Number(data.originalPrice) || 0);
        if (data.rating !== undefined) data.rating = Math.max(0, Math.min(5, Number(data.rating) || 0));
        if (data.reviewCount !== undefined) data.reviewCount = Math.max(0, Math.floor(Number(data.reviewCount) || 0));
        const stock = Number(data.stock);
        if (!Number.isInteger(stock) || stock < 0) throw new Error("Stock must be a non-negative whole number.");
        data.stock = stock;
        data.productId = String(activeDocument.id);
        if (!advancedEditorUsed) applyProductVariants(data);
        saveButton.disabled = true;
        byId("product-image-files").disabled = true;
        byId("product-gif-file").disabled = true;
        await saveProductMedia(data, saveButton);
      }
      const ref = db.collection(activeDocument.collection).doc(activeDocument.id);
      await ref.set(data);
      dialog.close();
      status.textContent = "Document saved.";
      const wasCreatingOrder = activeDocument.collection === "orders" && activeDocument.creating;
      window.showAdminToast?.(activeDocument.collection === "products" && activeDocument.creating ? "Product created successfully." : "Document saved successfully.", "success");
      if (activeDocument.collection === "orders") await loadOrders();
      if (activeDocument.collection === "products") await loadCatalogProducts();
      if (activeDocument.collection === byId("collection-name").value.trim()) await loadCollection();
      // Auto-send order confirmation email when a new order is created
      if (wasCreatingOrder && String(data.email || "").includes("@")) {
        window.setTimeout(async () => {
          try {
            await sendOrderNotificationEmail({ ...data, _docId: activeDocument.id });
            window.showAdminToast?.("Order confirmation email sent to customer via Gmail.", "success");
          } catch (err) {
            console.warn("Could not auto-send order confirmation email:", err);
          }
        }, 800);
      }
    } catch (error) {
      byId("editor-error").textContent = error instanceof SyntaxError ? "The JSON is invalid. Check commas, quotes, and braces." : errorText(error);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = buttonText;
      byId("product-image-files").disabled = false;
      byId("product-gif-file").disabled = false;
    }
  }
  jsonInput.addEventListener("input", () => { advancedEditorUsed = true; });
  function renderDocuments(container, collection, docs) {
    container.replaceChildren();
    if (!docs.length) { container.textContent = "No documents found in this collection."; return; }
    docs.forEach(doc => {
      const data = doc.data();
      const row = document.createElement("div"); row.className = "admin-row";
      const main = document.createElement("div"); main.className = "admin-row-main";
      const heading = document.createElement("strong"); heading.textContent = data.order_id || data.productName || doc.id;
      const detail = document.createElement("small"); detail.textContent = `${doc.id} · ${data.email || data.status || "Document"}`;
      main.append(heading, detail);
      const actions = document.createElement("div"); actions.className = "admin-actions";
      const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit";
      edit.addEventListener("click", () => openEditor({ collection, id: doc.id, data, creating: false }));
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Delete"; remove.className = "danger";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Delete ${collection}/${doc.id}? This cannot be undone.`)) return;
        try { await db.collection(collection).doc(doc.id).delete(); status.textContent = "Document deleted."; collection === "orders" ? await loadOrders() : await loadCollection(); }
        catch (error) { reportError(error); }
      });
      if (collection === "products") {
        const dup = document.createElement("button"); dup.type = "button"; dup.textContent = "Duplicate"; dup.className = "btn-secondary";
        dup.addEventListener("click", () => duplicateAdminProduct(data, doc.id));
        actions.append(edit, dup, remove);
      } else if (collection === "orders") {
        const dup = document.createElement("button"); dup.type = "button"; dup.textContent = "Duplicate"; dup.className = "btn-secondary";
        dup.addEventListener("click", () => duplicateAdminOrder(data, doc.id));
        actions.append(edit, dup, remove);
      } else {
        actions.append(edit, remove);
      }
      row.append(main, actions); container.append(row);
    });
  }
  function orderDate(value) {
    const date = parseOrderDate(value);
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  }
  function downloadInvoice(order) {
    const esc = value => String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

    const fmt = value => new Intl.NumberFormat("en-IN", {
      style: "currency", currency: "INR", maximumFractionDigits: 0
    }).format(Number(value || 0));

    const items = Array.isArray(order.items) ? order.items : [];
    const placedOn = orderDate(order.timestamp);
    const isPickup = order.fulfillment_type === "pickup";
    const paymentMode = String(order.payment_ref || order.mop || "Cash on Delivery").replaceAll("-", " ");
    const itemsSubtotal = Number(order.item_total) || items.reduce((sum, item) =>
      sum + (Number(item.price) || 0) * Math.max(1, Number(item.quantity) || 1), 0);
    const total = Number(order.total) || itemsSubtotal + Number(order.delivery_charge || 0) - Number(order.discount || 0);

    const invoiceItemsHTML = items.length
      ? items.map(item => `
          <tr>
            <td>${esc(item.productName || "Untitled product")}${item.colour ? `<br><small>Colour: ${esc(item.colour)}</small>` : ""}${item.size ? `<br><small>Size: ${esc(item.size)}</small>` : ""}${item.customization ? `<br><small>Customization: ${esc(item.customization)}</small>` : ""}</td>
            <td>${Math.max(1, Number(item.quantity) || 1)}</td>
            <td>${fmt(item.price)}</td>
            <td>${fmt((Number(item.price) || 0) * Math.max(1, Number(item.quantity) || 1))}</td>
          </tr>`).join("")
      : `<tr><td colspan="4">No items</td></tr>`;

    const discountRow = Number(order.discount || 0) > 0
      ? `<div><span>Discount</span><strong>-${fmt(order.discount)}</strong></div>` : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${esc(order.order_id || "")}</title>
  <style>
    @page { margin: 16mm; }
    body { background:#fff; color:#111; font:12px Arial,sans-serif; margin:0; }
    h1 { margin:0 0 4px; font-size:26px; }
    h2 { margin:22px 0 8px; font-size:15px; }
    .invoice-meta, .invoice-parties { display:flex; justify-content:space-between; gap:24px; }
    .invoice-meta { margin:18px 0; padding:12px 0; border-top:1px solid #bbb; border-bottom:1px solid #bbb; }
    table { width:100%; border-collapse:collapse; margin-top:8px; }
    th, td { padding:9px 6px; border-bottom:1px solid #ddd; text-align:left; }
    th:last-child, td:last-child { text-align:right; }
    .invoice-totals { width:280px; margin:18px 0 0 auto; }
    .invoice-totals div { display:flex; justify-content:space-between; padding:5px 0; }
    .invoice-grand-total { margin-top:5px; padding-top:10px !important; border-top:1px solid #111; font-size:15px; font-weight:700; }
    .invoice-note { margin-top:36px; padding-top:12px; border-top:1px solid #bbb; text-align:center; font-size:11px; }
  </style>
</head>
<body>
  <header>
    <h1>INVOICE</h1>
    <strong>Creative Souls 3D</strong>
    <div>Personalized 3D Printed Art, Gifts &amp; Keepsakes</div>
  </header>
  <div class="invoice-meta">
    <div><strong>Invoice / Order No.</strong><br>${esc(order.order_id || "")}</div>
    <div><strong>Invoice Date</strong><br>${esc(placedOn)}</div>
    <div><strong>Payment Mode</strong><br>${esc(paymentMode)}</div>
  </div>
  <div class="invoice-parties">
    <div><strong>Billed To</strong><br>${esc(order.name || "-")}<br>${esc(order.email || "")}<br>${esc(order.phone || "")}</div>
    <div><strong>${isPickup ? "Pickup Location" : "Delivery Address"}</strong><br>${esc(order.pickup_location || order.address || "-")}</div>
  </div>
  <h2>Items</h2>
  <table>
    <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
    <tbody>${invoiceItemsHTML}</tbody>
  </table>
  <div class="invoice-totals">
    <div><span>Items Subtotal</span><strong>${fmt(itemsSubtotal)}</strong></div>
    <div><span>Delivery Charge</span><strong>${fmt(order.delivery_charge)}</strong></div>
    ${discountRow}
    <div class="invoice-grand-total"><span>Total</span><strong>${fmt(total)}</strong></div>
  </div>
  ${order.order_note ? `<div class="invoice-note"><strong>Customer note:</strong> ${esc(order.order_note)}</div>` : ""}
  <div class="invoice-note">This is a machine-generated invoice. No signature is required.</div>
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;";
    document.body.append(iframe);
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open(); iframeDoc.write(html); iframeDoc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    window.setTimeout(() => iframe.remove(), 2000);
  }
  function appendDetailValue(parent, label, value) {
    if (value && typeof value.toDate === "function") value = { __firestoreType: "timestamp", value: value.toDate().toISOString() };
    const item = document.createElement("div"); item.className = "admin-detail-item";
    if (Array.isArray(value)) {
      item.classList.add("admin-detail-full");
      const heading = document.createElement("strong"); heading.textContent = `${humanize(label)} (${value.length})`; item.append(heading);
      if (!value.length) { const empty = document.createElement("div"); empty.textContent = "No entries"; empty.className = "admin-helper"; item.append(empty); }
      const cardsGrid = document.createElement("div");
      cardsGrid.className = "admin-detail-cards-grid";
      value.forEach((entry, index) => {
        const card = document.createElement("div"); card.className = "admin-detail-card-item";
        if (entry && typeof entry === "object") {
          const imgUrl = entry.imageUrl || entry.image_url || entry.image || entry.photo;
          if (imgUrl && typeof imgUrl === "string" && (imgUrl.startsWith("http://") || imgUrl.startsWith("https://"))) {
            const thumb = document.createElement("img");
            thumb.className = "admin-item-thumbnail";
            thumb.src = imgUrl;
            thumb.alt = entry.name || entry.productName || "Product image";
            thumb.loading = "lazy";
            card.append(thumb);
          }
          const infoWrap = document.createElement("div");
          infoWrap.className = "admin-item-info";
          const title = document.createElement("div");
          title.className = "admin-item-name";
          title.textContent = entry.name || entry.productName || entry.title || `Item #${index + 1}`;
          infoWrap.append(title);

          const specsGrid = document.createElement("div");
          specsGrid.className = "admin-item-specs";
          Object.entries(entry).forEach(([key, child]) => {
            if (["name", "productName", "title", "image", "imageUrl", "image_url", "photo"].includes(key)) return;
            appendDetailValue(specsGrid, key, child);
          });
          infoWrap.append(specsGrid);
          card.append(infoWrap);
        } else {
          card.textContent = String(entry ?? "—");
        }
        cardsGrid.append(card);
      });
      item.append(cardsGrid);
    } else if (value && typeof value === "object" && value.__firestoreType === "timestamp") {
      item.className = "admin-detail-value"; const name = document.createElement("strong"); name.textContent = humanize(label);
      item.append(name, document.createTextNode(orderDate(value.value)));
    } else if (value && typeof value === "object" && value.__firestoreType === "geopoint") {
      item.className = "admin-detail-value"; const name = document.createElement("strong"); name.textContent = humanize(label);
      item.append(name, document.createTextNode(`${value.latitude}, ${value.longitude}`));
    } else if (value && typeof value === "object" && value.__firestoreType === "reference") {
      item.className = "admin-detail-value"; const name = document.createElement("strong"); name.textContent = humanize(label);
      item.append(name, document.createTextNode(value.path));
    } else if (value && typeof value === "object" && value.__firestoreType === "blob") {
      item.className = "admin-detail-value"; const name = document.createElement("strong"); name.textContent = humanize(label);
      item.append(name, document.createTextNode("Stored file data"));
    } else if (value && typeof value === "object") {
      item.classList.add("admin-detail-full");
      const heading = document.createElement("strong"); heading.textContent = humanize(label); item.append(heading);
      const innerGrid = document.createElement("div"); innerGrid.className = "admin-detail-grid";
      Object.entries(value).forEach(([key, child]) => appendDetailValue(innerGrid, key, child));
      item.append(innerGrid);
    } else {
      item.className = "admin-detail-value";
      const strVal = value === null || value === "" || value === undefined ? "—" : String(value);
      if (strVal.length > 50 || label.includes("address") || label.includes("note") || label.includes("description") || label.includes("request")) {
        item.classList.add("admin-detail-full");
      }
      const name = document.createElement("strong"); name.textContent = humanize(label);
      item.append(name);
      if (typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))) {
        const link = document.createElement("a");
        link.href = value;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = value.length > 55 ? value.substring(0, 52) + "…" : value;
        link.className = "admin-detail-link";
        item.append(link);
      } else if (["price", "total", "item_total", "delivery_charge", "discount"].includes(label) && (typeof value === "number" || (!isNaN(Number(value)) && value !== "" && value !== null))) {
        item.append(document.createTextNode(formatOrderMoney(value)));
      } else {
        item.append(document.createTextNode(strVal));
      }
    }
    parent.append(item);
  }
  async function showOrderDetails(id, order) {
    if (id) {
      try {
        const snap = await db.collection("orders").doc(id).get();
        if (snap.exists) {
          order = { ...(order || {}), ...snap.data() };
        }
      } catch (err) {
        console.warn("Could not fetch current order data:", err);
      }
    }
    order = JSON.parse(plainData(order));
    byId("order-detail-title").textContent = order.order_id || id;
    const content = byId("order-detail-content"); content.replaceChildren();

    // Quick Status Bar in Order Detail Modal
    const statusRow = document.createElement("div");
    statusRow.className = "admin-order-status-bar";
    const curStatus = order.status || "Order Placed";
    const canonical = canonicalOrderStatus(curStatus, order.fulfillment_type);
    const statusSlug = canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const formattedTotal = order.total !== undefined && order.total !== null ? formatOrderMoney(order.total) : "";
    statusRow.innerHTML = `
      <div class="admin-order-status-bar-info">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-2); text-transform: uppercase;">Status:</span>
          <span class="admin-order-status status-${statusSlug}">${escapeHtml(canonical)}</span>
        </div>
        ${formattedTotal ? `<span style="font-weight: 800; color: var(--accent-dark); font-size: 0.92rem; padding-left: 10px; border-left: 2px solid var(--border);">Total: ${formattedTotal}</span>` : ""}
        ${order.name ? `<span style="color: var(--text-2); font-size: 0.82rem; font-weight: 600; padding-left: 10px; border-left: 2px solid var(--border);">Customer: ${escapeHtml(order.name)}</span>` : ""}
      </div>
      <div class="admin-order-status-bar-action">
        <input type="text" id="modal-quick-status" aria-label="Change order status" value="${curStatus}" placeholder="Type new status…" style="height: 34px; padding: 0 10px; border-radius: 6px; border: 1px solid var(--border); font-size: 0.82rem; background: #fff; color: #0f172a; min-width: 170px;" />
        <button type="button" id="modal-apply-status" class="btn-primary" style="height: 34px!important; padding: 0 14px!important; font-size: 0.8rem!important;">Update</button>
      </div>
    `;
    const applyBtn = statusRow.querySelector("#modal-apply-status");
    const statusInput = document.createElement("select");
    statusInput.id = "modal-quick-status";
    statusInput.setAttribute("aria-label", "Change order status");
    statusInput.innerHTML = orderStatusOptions(canonical, order.fulfillment_type);
    Object.assign(statusInput.style, { height: "34px", padding: "0 10px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "0.82rem", background: "#fff", color: "#0f172a", minWidth: "170px" });
    statusRow.querySelector("#modal-quick-status").replaceWith(statusInput);
    const statusInfoField = document.createElement("label");
    statusInfoField.className = "admin-order-status-info-field";
    statusInfoField.innerHTML = `<span>Additional status info</span><textarea id="modal-status-info" rows="2" placeholder="Add an update related to this order status…">${escapeHtml(order.status_info || "")}</textarea>`;
    statusRow.querySelector(".admin-order-status-bar-action").append(statusInfoField);
    const statusInfoInput = statusInfoField.querySelector("textarea");
    applyBtn.addEventListener("click", async () => {
      const nextStatus = statusInput.value.trim();
      const nextStatusInfo = statusInfoInput.value.trim();
      if (!nextStatus || (nextStatus === order.status && nextStatusInfo === String(order.status_info || "").trim())) return;
      applyBtn.disabled = true;
      applyBtn.textContent = "Saving…";
      try {
        await db.collection("orders").doc(id).update({ status: nextStatus, status_info: nextStatusInfo });
        order.status = nextStatus;
        order.status_info = nextStatusInfo;
        window.showAdminToast?.("Order status updated to " + nextStatus, "success");
        await loadOrders();
        showOrderDetails(id, order);
      } catch (err) {
        reportError(err);
        applyBtn.disabled = false;
        applyBtn.textContent = "Update";
      }
    });
    content.append(statusRow);

    const invoiceBtn = byId("order-detail-invoice");
    if (invoiceBtn) {
      invoiceBtn.onclick = () => downloadInvoice(order);
    }
    const refundBtn = byId("order-detail-refund");
    if (refundBtn) {
      refundBtn.onclick = () => openWalletRefundModal(id, order);
    }
    const notifyBtn = byId("order-detail-notify");
    if (notifyBtn) {
      notifyBtn.onclick = async () => {
        const quickStatusInput = byId("modal-quick-status");
        const nextStatus = quickStatusInput?.value.trim() || order.status || "Order Placed";
        const nextStatusInfo = statusInfoInput.value.trim();
        try {
          await db.collection("orders").doc(id).update({ status: nextStatus, status_info: nextStatusInfo });
          order.status = nextStatus;
          order.status_info = nextStatusInfo;
        } catch (err) {
          reportError(err);
          return;
        }
        sendOrderNotificationEmail(order);
      };
    }

    const layout = document.createElement("div");
    layout.className = "admin-order-detail-layout";

    const categories = [
      ["Order and status", ["order_id", "status", "approved", "timestamp", "expected_delivery", "order_type"]],
      ["Customer", ["name", "email", "phone"]],
      ["Delivery or pickup", ["fulfillment_type", "address", "pickup_location"]],
      ["Payment and totals", ["item_total", "delivery_charge", "discount", "coupon_code", "total", "payment_ref", "payment_status", "mop", "upi_id"]],
      ["Items and request", ["items", "service_request", "order_note"]]
    ];
    const shown = new Set();
    categories.forEach(([title, keys]) => {
      const entries = keys.filter(key => Object.hasOwn(order, key));
      if (!entries.length) return;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const section = document.createElement("section");
      section.className = `admin-detail-section section-${slug}`;
      const heading = document.createElement("h3"); heading.textContent = title; section.append(heading);
      const grid = document.createElement("div"); grid.className = "admin-detail-grid";
      entries.forEach(key => { shown.add(key); appendDetailValue(grid, key, order[key]); });
      section.append(grid); layout.append(section);
    });
    if (Object.hasOwn(order, "final_product_images")) shown.add("final_product_images");
    const additional = Object.keys(order).filter(key => !shown.has(key));
    if (additional.length) {
      const section = document.createElement("section");
      section.className = "admin-detail-section section-additional-details";
      const heading = document.createElement("h3"); heading.textContent = "Additional details"; section.append(heading);
      const grid = document.createElement("div"); grid.className = "admin-detail-grid";
      additional.forEach(key => appendDetailValue(grid, key, order[key])); section.append(grid); layout.append(section);
    }
    content.append(layout);
    const finalImageSection = document.createElement("section");
    finalImageSection.className = "admin-detail-section admin-order-final-images";
    const finalImageHeading = document.createElement("h3");
    finalImageHeading.textContent = "Final product images";
    const finalImageHelp = document.createElement("p");
    finalImageHelp.className = "admin-helper";
    finalImageHelp.textContent = "Upload photos of the finished, ready-to-ship product (up to 25 MB per image). Customers will see these in My Orders, the order page, and the tracking link.";
    const finalImageGallery = document.createElement("div");
    finalImageGallery.className = "admin-order-final-image-grid";
    const renderFinalImages = () => {
      finalImageGallery.replaceChildren();
      const currentImages = Array.isArray(order.final_product_images) ? order.final_product_images : [];
      currentImages.forEach((image, imgIndex) => {
        const card = document.createElement("figure");
        card.className = "admin-order-final-image-card";
        const thumbBtn = document.createElement("button");
        thumbBtn.type = "button";
        thumbBtn.className = "admin-order-final-image-thumb-btn";
        thumbBtn.title = "Click to view full photo";
        thumbBtn.setAttribute("aria-label", `View photo ${imgIndex + 1}: ${image.name || "Final product image"}`);
        const img = document.createElement("img");
        img.src = image.thumbnailUrl || image.url;
        img.alt = image.name || "Final product image";
        thumbBtn.append(img);
        thumbBtn.addEventListener("click", () => {
          openAdminPhotoViewer(currentImages, imgIndex, `Final Product - Order ${order.order_id || id}`);
        });
        const caption = document.createElement("figcaption");
        caption.textContent = image.name || "Final product image";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "admin-order-final-image-remove";
        remove.textContent = "Remove";
        remove.addEventListener("click", async () => {
          if (!window.confirm(`Remove “${image.name || "this final product image"}” from order ${order.order_id || id}?`)) return;
          remove.disabled = true;
          try {
            await db.collection("orders").doc(id).update({ final_product_images: firebase.firestore.FieldValue.arrayRemove(image) });
            order.final_product_images = (order.final_product_images || []).filter(item => item.url !== image.url);
            renderFinalImages();
            await loadOrders();
            window.showAdminToast?.("Final product image removed from this order.", "success");
          } catch (error) {
            remove.disabled = false;
            window.showAdminToast?.(errorText(error), "danger");
            reportError(error);
          }
        });
        card.append(thumbBtn, caption, remove);
        finalImageGallery.append(card);
      });
      if (!finalImageGallery.childElementCount) {
        const empty = document.createElement("p");
        empty.className = "admin-helper";
        empty.textContent = "No final product photos have been added yet.";
        finalImageGallery.append(empty);
      }
    };
    renderFinalImages();

    let stagedFinalFiles = [];
    const uploadWrap = document.createElement("div");
    uploadWrap.className = "admin-order-final-image-upload-wrap";

    const stagingBadge = document.createElement("div");
    stagingBadge.className = "admin-order-final-staging-badge";
    stagingBadge.style.display = "none";

    const stagingGrid = document.createElement("div");
    stagingGrid.className = "admin-order-final-staging-grid";
    stagingGrid.style.display = "none";

    const uploadRow = document.createElement("div");
    uploadRow.className = "admin-order-final-image-upload";
    const imageInput = document.createElement("input");
    imageInput.type = "file";
    imageInput.accept = "image/*";
    imageInput.multiple = true;
    imageInput.setAttribute("aria-label", "Choose final product photos");
    const uploadButton = document.createElement("button");
    uploadButton.type = "button";
    uploadButton.className = "btn-primary";
    uploadButton.textContent = "Upload final product photos";

    const renderStagedFiles = () => {
      stagingGrid.querySelectorAll("[data-preview-url]").forEach(el => URL.revokeObjectURL(el.dataset.previewUrl));
      stagingGrid.replaceChildren();

      if (!stagedFinalFiles.length) {
        stagingBadge.style.display = "none";
        stagingGrid.style.display = "none";
        uploadButton.textContent = "Upload final product photos";
        return;
      }

      stagingBadge.style.display = "flex";
      stagingBadge.innerHTML = `<strong>${stagedFinalFiles.length} photo${stagedFinalFiles.length === 1 ? "" : "s"} selected</strong><span>Click "Choose Files" again to add more pictures, or "Upload" to upload all at once.</span>`;
      stagingGrid.style.display = "grid";

      stagedFinalFiles.forEach((file, fileIdx) => {
        const card = document.createElement("figure");
        card.className = "admin-order-final-staging-card";
        const img = document.createElement("img");
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        img.dataset.previewUrl = objectUrl;
        img.alt = file.name;

        const info = document.createElement("div");
        info.className = "admin-order-final-staging-info";
        const nameSpan = document.createElement("span");
        nameSpan.className = "admin-order-final-staging-name";
        nameSpan.textContent = file.name;
        const sizeSpan = document.createElement("small");
        sizeSpan.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
        info.append(nameSpan, sizeSpan);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "admin-order-final-staging-remove";
        removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
        removeBtn.textContent = "✕";
        removeBtn.addEventListener("click", () => {
          stagedFinalFiles.splice(fileIdx, 1);
          renderStagedFiles();
        });

        card.append(img, info, removeBtn);
        stagingGrid.append(card);
      });

      uploadButton.textContent = `Upload final product photos (${stagedFinalFiles.length})`;
    };

    imageInput.addEventListener("change", () => {
      const selected = [...(imageInput.files || [])];
      for (const file of selected) {
        if (!file.type.startsWith("image/")) {
          window.showAdminToast?.(`${file.name} is not an image file.`, "danger");
          continue;
        }
        if (file.size > IMAGEKIT_MAX_FILE_BYTES) {
          window.showAdminToast?.(`${file.name} exceeds the 25 MB limit.`, "danger");
          continue;
        }
        const isDuplicate = stagedFinalFiles.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified);
        if (!isDuplicate) {
          stagedFinalFiles.push(file);
        }
      }
      imageInput.value = "";
      renderStagedFiles();
    });

    uploadButton.addEventListener("click", async () => {
      if (!stagedFinalFiles.length) {
        window.showAdminToast?.("Choose one or more final product photos first.", "danger");
        return;
      }
      try {
        validateTicketMedia(stagedFinalFiles);
        uploadButton.disabled = true;
        imageInput.disabled = true;
        const count = stagedFinalFiles.length;
        uploadButton.textContent = `Uploading ${count} photo${count === 1 ? "" : "s"}…`;
        const uploaded = await uploadAdminTicketMedia(stagedFinalFiles, order.order_id || id, uploadButton);
        const images = uploaded.map(image => ({ ...image, addedAt: new Date().toISOString() }));
        await db.collection("orders").doc(id).update({ final_product_images: firebase.firestore.FieldValue.arrayUnion(...images) });
        order.final_product_images = [...(order.final_product_images || []), ...images];
        stagedFinalFiles = [];
        renderStagedFiles();
        renderFinalImages();
        await loadOrders();
        window.showAdminToast?.("Final product photos added to the customer order pages.", "success");
      } catch (error) {
        window.showAdminToast?.(errorText(error), "danger");
        reportError(error);
      } finally {
        uploadButton.disabled = false;
        imageInput.disabled = false;
        renderStagedFiles();
      }
    });

    uploadRow.append(imageInput, uploadButton);
    uploadWrap.append(stagingBadge, stagingGrid, uploadRow);
    finalImageSection.append(finalImageHeading, finalImageHelp, finalImageGallery, uploadWrap);
    content.append(finalImageSection);
    byId("order-detail-edit").onclick = () => {
      byId("order-detail-dialog").close();
      openEditor({ collection: "orders", id, data: order, creating: false });
    };
    const orderDupBtn = byId("order-detail-duplicate");
    if (orderDupBtn) {
      orderDupBtn.onclick = () => {
        byId("order-detail-dialog").close();
        duplicateAdminOrder(order, id);
      };
    }
    const ignoreBtn = byId("order-detail-ignore");
    if (ignoreBtn) {
      const isIgnored = isCustomerIgnored(order, id);
      ignoreBtn.textContent = isIgnored ? "Restore Customer" : "Ignore Customer";
      ignoreBtn.onclick = () => {
        toggleIgnoreCustomer(order, id);
        const nowIgnored = isCustomerIgnored(order, id);
        ignoreBtn.textContent = nowIgnored ? "Restore Customer" : "Ignore Customer";
      };
    }
    byId("order-detail-dialog").showModal();
  }
  function formatOrderMoney(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
  }
  function canonicalOrderStatus(value, fulfillmentType = "delivery") {
    const status = String(value || "Order Placed").trim().toLowerCase();
    const isPickup = String(fulfillmentType || "").trim().toLowerCase() === "pickup" || /pick|pickup/.test(status);
    if (/reject/.test(status)) return "Rejected";
    if (/cancel/.test(status)) return "Cancelled";
    if (/picked\s*up|collected/.test(status) || (isPickup && (/\b(delivered|product delivered)\b|delivery complete/.test(status)))) {
      return "Order Picked Up";
    }
    if (/ready\s*(for)?\s*pick/.test(status) || (isPickup && /ready/.test(status))) {
      return "Ready for Pickup";
    }
    if (/\b(delivered|product delivered)\b|delivery complete/.test(status)) return "Product Delivered";
    if (/out for delivery|delivery/.test(status)) return isPickup ? "Ready for Pickup" : "Out For Delivery";
    if (/ship|dispatch/.test(status)) return isPickup ? "Ready for Pickup" : "Order Dispatched";
    if (/print|production/.test(status)) return "Printing Product";
    if (/approve|confirm/.test(status)) return "Order Approved";
    if (/payment|due|request/.test(status)) return "Order Placed";
    if (/place|order placed/.test(status)) return "Order Placed";
    return "Other";
  }
  function canonicalPaymentStatus(value) {
    const status = String(value || "").trim().toLowerCase();
    if (status === "paid") return "Paid";
    if (status === "partial" || status === "partially paid") return "Partial";
    return "Pending";
  }
  window.canonicalOrderStatus = canonicalOrderStatus;
  function updateOrderOverview(docs) {
    const cleanDocs = (docs || []).filter(doc => !isCustomerIgnored(doc.data(), doc.id));
    const orders = cleanDocs.map(doc => doc.data());
    const delivered = orders.filter(order => {
      const st = canonicalOrderStatus(order.status, order.fulfillment_type);
      return st === "Product Delivered" || st === "Order Picked Up";
    }).length;
    const actionStatuses = new Set(["Order Placed", "Order Approved", "Printing Product", "Ready for Pickup", "Order Dispatched", "Out For Delivery", "Other"]);
    const needsAction = orders.filter(order => actionStatuses.has(canonicalOrderStatus(order.status, order.fulfillment_type))).length;
    byId("stat-total-orders").textContent = String(orders.length);
    byId("stat-open-orders").textContent = String(needsAction);
    byId("stat-delivered-orders").textContent = String(delivered);
    byId("stat-order-value").textContent = formatOrderMoney(orders.reduce((sum, order) => sum + Number(order.total || 0), 0));
    renderRecentDashboardOrders(cleanDocs);

  }
  function orderTimestamp(value) {
    const date = parseOrderDate(value);
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
  }
  function dateRange() {
    const fromValue = byId("orders-date-from").value;
    const toValue = byId("orders-date-to").value;
    const from = fromValue ? new Date(`${fromValue}T00:00:00`) : null;
    const to = toValue ? new Date(`${toValue}T23:59:59.999`) : null;
    return { from, to, invalid: !!(from && to && from > to) };
  }
  function ordersInDateRange() {
    const { from, to, invalid } = dateRange();
    if (invalid) return [];
    return orderDocuments.filter(doc => {
      const order = doc.data();
      if (isCustomerIgnored(order, doc.id)) return false;
      const time = orderTimestamp(order.timestamp);
      return time !== null && (!from || time >= from.getTime()) && (!to || time <= to.getTime());
    });
  }
  const svgElement = (name, attributes = {}) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  };
  function showChartEmpty(target, message) {
    target.replaceChildren();
    const empty = document.createElement("div"); empty.className = "admin-chart-empty"; empty.textContent = message; target.append(empty);
  }
  function timeChartSelection(date, mode, label) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (mode === "week") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    if (mode === "month") start.setDate(1);
    const end = new Date(start);
    if (mode === "month") end.setMonth(end.getMonth() + 1);
    else end.setDate(end.getDate() + (mode === "week" ? 7 : 1));
    return { kind: "time", start: start.getTime(), end: end.getTime(), label };
  }
  function makeChartMarkInteractive(element, selection, accessibleLabel) {
    element.classList.add("admin-chart-mark-interactive");
    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "button");
    element.setAttribute("aria-label", accessibleLabel);
    const activate = () => {
      chartSelection = selection;
      currentOrdersPage = 1;
      refreshVisibleOrders();
      byId("orders-list").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    element.addEventListener("click", activate);
    element.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate();
    });
  }
  function renderTrendChart(docs) {
    const target = byId("orders-trend-chart");
    const { from: selectedFrom, to: selectedTo, invalid } = dateRange();
    if (invalid) { showChartEmpty(target, "Start date must be on or before the end date."); return; }
    const now = new Date();
    const timestamps = docs.map(doc => orderTimestamp(doc.data().timestamp)).filter(time => time !== null);
    const oldest = timestamps.length ? new Date(Math.min(...timestamps)) : now;
    const start = selectedFrom || new Date(oldest.getFullYear(), oldest.getMonth(), oldest.getDate());
    const end = selectedTo || new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (start > end) { showChartEmpty(target, "Start date must be on or before the end date."); return; }
    const spanDays = Math.max(1, Math.ceil((end - start) / 86400000));
    const mode = spanDays <= 31 ? "day" : spanDays <= 180 ? "week" : "month";
    const buckets = new Map();
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const finish = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (mode === "week") cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    if (mode === "month") cursor.setDate(1);
    const keyFor = date => mode === "month" ? `${date.getFullYear()}-${date.getMonth()}` : mode === "week" ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const labelFor = date => date.toLocaleDateString("en-IN", mode === "month" ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" });
    while (cursor <= finish) {
      const key = keyFor(cursor); buckets.set(key, { date: new Date(cursor), label: labelFor(cursor), count: 0 });
      if (mode === "month") cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setDate(cursor.getDate() + (mode === "week" ? 7 : 1));
    }
    docs.forEach(doc => {
      const time = orderTimestamp(doc.data().timestamp); if (time === null) return;
      const date = new Date(time); const key = keyFor(mode === "week" ? new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7)) : mode === "month" ? new Date(date.getFullYear(), date.getMonth(), 1) : date);
      if (buckets.has(key)) buckets.get(key).count += 1;
    });
    const points = [...buckets.values()];
    const caption = mode === "day" ? "Daily order volume" : mode === "week" ? "Weekly order volume" : "Monthly order volume";
    byId("orders-trend-caption").textContent = `${caption} · ${selectedFrom || selectedTo ? `${start.toLocaleDateString("en-IN")} – ${end.toLocaleDateString("en-IN")}` : "all dates"}`;
    if (!points.length || !docs.length) { showChartEmpty(target, "No orders in this date range."); return; }
    const svg = svgElement("svg", { viewBox: "0 0 840 260", role: "group", "aria-label": "Orders over time chart. Select a bar or date label to filter the table." });
    const left = 48, right = 820, top = 18, baseline = 220, plotHeight = baseline - top;
    const max = Math.max(1, ...points.map(point => point.count));
    for (let i = 0; i <= 4; i += 1) {
      const y = top + plotHeight * i / 4; svg.append(svgElement("line", { x1: left, y1: y, x2: right, y2: y, class: "admin-chart-gridline" }));
      const label = svgElement("text", { x: left - 10, y: y + 4, "text-anchor": "end" }); label.textContent = String(Math.round(max * (4 - i) / 4)); svg.append(label);
    }
    const slot = (right - left) / points.length; const barWidth = Math.max(2, Math.min(30, slot * .68));
    points.forEach((point, index) => {
      const height = point.count ? Math.max(2, plotHeight * point.count / max) : 0; const x = left + slot * index + (slot - barWidth) / 2;
      const bar = svgElement("rect", { x, y: baseline - height, width: barWidth, height, rx: Math.min(5, barWidth / 3), class: "admin-chart-bar admin-chart-mark-interactive" });
      const title = svgElement("title"); title.textContent = `${point.label}: ${point.count} order${point.count === 1 ? "" : "s"}`; bar.append(title); svg.append(bar);
      const selection = timeChartSelection(point.date, mode, point.label);
      makeChartMarkInteractive(bar, selection, `Filter orders for ${point.label}`);
      if (point.count > 0 && barWidth >= 14) {
        const valLabel = svgElement("text", { x: x + barWidth / 2, y: baseline - height - 4, "text-anchor": "middle", class: "admin-chart-value-label" });
        valLabel.textContent = String(point.count); svg.append(valLabel);
      }
      if (index % Math.max(1, Math.ceil(points.length / 8)) === 0 || index === points.length - 1) { const label = svgElement("text", { x: x + barWidth / 2, y: 243, "text-anchor": "middle" }); label.textContent = point.label; makeChartMarkInteractive(label, selection, `Filter orders for ${point.label}`); svg.append(label); }
    });
    target.replaceChildren(svg);
  }
  function renderStatusChart(docs) {
    const target = byId("orders-status-chart");
    const counts = new Map(ORDER_STATUS_CATEGORIES.map(category => [category, 0]));
    docs.forEach(doc => { const category = canonicalOrderStatus(doc.data().status); counts.set(category, (counts.get(category) || 0) + 1); });
    const present = ORDER_STATUS_CATEGORIES.filter(category => counts.get(category) > 0);
    if (!present.length) { showChartEmpty(target, "No orders in this date range."); return; }
    const statusColors = ["#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#84cc16", "#f97316", "#64748b", "#ec4899", "#a3a3a3"];
    const svg = svgElement("svg", { viewBox: `0 0 520 ${Math.max(240, present.length * 34 + 20)}`, role: "group", "aria-label": "Orders by status chart. Select a status to filter the table." });
    const max = Math.max(1, ...present.map(category => counts.get(category)));
    present.forEach((category, index) => {
      const color = statusColors[index % statusColors.length];
      const y = 12 + index * 34; const label = svgElement("text", { x: 0, y: y + 14, class: "admin-status-bar-label" }); label.textContent = category; svg.append(label);
      const x = 165, width = 260 * counts.get(category) / max;
      const bar = svgElement("rect", { x, y, width: Math.max(width, 2), height: 18, rx: 6, fill: color, style: "cursor:pointer;transition:opacity 0.15s" });
      const title = svgElement("title"); title.textContent = `${category}: ${counts.get(category)} orders`; bar.append(title); svg.append(bar);
      const selection = { kind: "status", value: category, label: `Status: ${category}` };
      makeChartMarkInteractive(label, selection, `Filter orders with status ${category}`); makeChartMarkInteractive(bar, selection, `Filter orders with status ${category}`);
      const value = svgElement("text", { x: x + Math.max(width, 2) + 9, y: y + 14, class: "admin-chart-value-label" }); value.textContent = String(counts.get(category)); makeChartMarkInteractive(value, selection, `Filter orders with status ${category}`); svg.append(value);
    });
    target.replaceChildren(svg);
  }
  function renderStatusPieChart(docs) {
    const target = byId("orders-status-pie-chart");
    const counts = new Map(ORDER_STATUS_CATEGORIES.map(category => [category, 0]));
    docs.forEach(doc => {
      const category = canonicalOrderStatus(doc.data().status);
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    const slices = ORDER_STATUS_CATEGORIES.map(category => ({ label: category, value: counts.get(category) })).filter(slice => slice.value > 0);
    const total = slices.reduce((sum, slice) => sum + slice.value, 0);
    if (!total) { showChartEmpty(target, "No orders in this date range."); return; }
    const colors = ["#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#84cc16", "#f97316", "#64748b", "#ec4899", "#a3a3a3"];
    const height = Math.max(240, slices.length * 25 + 16);
    const centerX = 105, centerY = height / 2, radius = 82;
    const svg = svgElement("svg", { viewBox: `0 0 560 ${height}`, class: "admin-pie-svg", role: "group", "aria-label": "Order status share pie chart. Select a slice or legend item to filter the table." });
    let angle = -Math.PI / 2;
    slices.forEach((slice, index) => {
      const portion = slice.value / total;
      const nextAngle = angle + portion * Math.PI * 2;
      const color = colors[index % colors.length];
      if (portion >= 0.999999) {
        const circle = svgElement("circle", { cx: centerX, cy: centerY, r: radius, fill: color });
        const title = svgElement("title"); title.textContent = `${slice.label}: ${slice.value} orders (100%)`; circle.append(title);
        makeChartMarkInteractive(circle, { kind: "status", value: slice.label, label: `Status: ${slice.label}` }, `Filter orders with status ${slice.label}`); svg.append(circle);
      } else {
        const x1 = centerX + radius * Math.cos(angle), y1 = centerY + radius * Math.sin(angle);
        const x2 = centerX + radius * Math.cos(nextAngle), y2 = centerY + radius * Math.sin(nextAngle);
        const path = svgElement("path", { d: `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${portion > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`, fill: color });
        const title = svgElement("title"); title.textContent = `${slice.label}: ${slice.value} orders (${(portion * 100).toFixed(1)}%)`; path.append(title);
        makeChartMarkInteractive(path, { kind: "status", value: slice.label, label: `Status: ${slice.label}` }, `Filter orders with status ${slice.label}`); svg.append(path);
      }
      const y = 12 + index * 25;
      const selection = { kind: "status", value: slice.label, label: `Status: ${slice.label}` };
      const marker = svgElement("circle", { cx: 222, cy: y + 8, r: 5, fill: color }); makeChartMarkInteractive(marker, selection, `Filter orders with status ${slice.label}`); svg.append(marker);
      const label = svgElement("text", { x: 234, y: y + 12 });
      label.textContent = `${slice.label} · ${slice.value} (${(portion * 100).toFixed(1)}%)`;
      makeChartMarkInteractive(label, selection, `Filter orders with status ${slice.label}`); svg.append(label);
      angle = nextAngle;
    });
    target.replaceChildren(svg);
  }
  function renderRevenueChart(docs) {
    const target = byId("revenue-trend-chart");
    const { from, to, invalid } = dateRange();
    if (invalid) { showChartEmpty(target, "Start date must be on or before the end date."); return; }
    const validTimes = docs.map(doc => orderTimestamp(doc.data().timestamp)).filter(time => time !== null);
    const earliest = validTimes.length ? new Date(Math.min(...validTimes)) : new Date();
    const start = from || new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate());
    const end = to || new Date();
    if (start > end) { showChartEmpty(target, "Start date must be on or before the end date."); return; }
    const days = Math.max(1, Math.ceil((end - start) / 86400000));
    const mode = days <= 31 ? "day" : days <= 180 ? "week" : "month";
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const finish = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (mode === "week") cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    if (mode === "month") cursor.setDate(1);
    const keyFor = date => `${date.getFullYear()}-${date.getMonth()}-${mode === "day" ? date.getDate() : mode === "week" ? date.getDate() : 1}`;
    const labelFor = date => date.toLocaleDateString("en-IN", mode === "month" ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" });
    const buckets = new Map();
    while (cursor <= finish) {
      buckets.set(keyFor(cursor), { date: new Date(cursor), label: labelFor(cursor), amount: 0 });
      if (mode === "month") cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setDate(cursor.getDate() + (mode === "week" ? 7 : 1));
    }
    docs.forEach(doc => {
      const order = doc.data();
      const time = orderTimestamp(order.timestamp);
      if (time === null) return;
      const date = new Date(time);
      if (mode === "week") date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      if (mode === "month") date.setDate(1);
      const bucket = buckets.get(keyFor(date));
      if (bucket) bucket.amount += Number(order.total || 0);
    });
    const points = [...buckets.values()];
    const unit = mode === "day" ? "Daily" : mode === "week" ? "Weekly" : "Monthly";
    byId("revenue-trend-caption").textContent = `${unit} order value · INR`;
    if (!points.length || !docs.length) { showChartEmpty(target, "No revenue in this date range."); return; }
    const svg = svgElement("svg", { viewBox: "0 0 840 260", role: "group", "aria-label": "Revenue over time chart. Select a bar or date label to filter the table." });
    const left = 58, right = 820, top = 18, baseline = 220, height = baseline - top;
    const max = Math.max(1, ...points.map(point => point.amount));
    const money = value => new Intl.NumberFormat("en-IN", { notation: value >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
    for (let i = 0; i <= 4; i += 1) {
      const y = top + height * i / 4;
      svg.append(svgElement("line", { x1: left, y1: y, x2: right, y2: y, class: "admin-chart-gridline" }));
      const label = svgElement("text", { x: left - 8, y: y + 4, "text-anchor": "end" }); label.textContent = money(max * (4 - i) / 4); svg.append(label);
    }
    const slot = (right - left) / points.length;
    points.forEach((point, index) => {
      const barHeight = point.amount ? Math.max(2, height * point.amount / max) : 0;
      const width = Math.max(2, Math.min(30, slot * .68));
      const x = left + slot * index + (slot - width) / 2;
      const bar = svgElement("rect", { x, y: baseline - barHeight, width, height: barHeight, rx: 4, class: "admin-chart-bar-revenue admin-chart-mark-interactive" });
      const title = svgElement("title"); title.textContent = `${point.label}: ₹${money(point.amount)}`; bar.append(title);
      const selection = timeChartSelection(point.date, mode, point.label);
      makeChartMarkInteractive(bar, selection, `Filter orders for ${point.label}`); svg.append(bar);
      if (point.amount > 0 && width >= 14) {
        const valLabel = svgElement("text", { x: x + width / 2, y: baseline - barHeight - 4, "text-anchor": "middle", class: "admin-chart-value-label" });
        valLabel.textContent = `₹${money(point.amount)}`; svg.append(valLabel);
      }
      if (index % Math.max(1, Math.ceil(points.length / 8)) === 0 || index === points.length - 1) {
        const label = svgElement("text", { x: x + width / 2, y: 243, "text-anchor": "middle" }); label.textContent = point.label; makeChartMarkInteractive(label, selection, `Filter orders for ${point.label}`); svg.append(label);
      }
    });
    target.replaceChildren(svg);
  }
  function renderRankedChart(targetId, entries, emptyMessage, selectionKind, formatter = value => String(value)) {
    const target = byId(targetId);
    const ranked = entries.filter(entry => entry.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
    if (!ranked.length) { showChartEmpty(target, emptyMessage); return; }
    const rowHeight = 30;
    const rankedColors = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#8b5cf6", "#f97316", "#ec4899"];
    const svg = svgElement("svg", { viewBox: `0 0 560 ${Math.max(220, ranked.length * rowHeight + 12)}`, role: "group", "aria-label": `${selectionKind === "product" ? "Top products" : "Payment methods"} chart. Select a mark to filter the table.` });
    const max = Math.max(1, ...ranked.map(entry => entry.value));
    ranked.forEach((entry, index) => {
      const color = rankedColors[index % rankedColors.length];
      const y = 8 + index * rowHeight;
      const selection = { kind: selectionKind, value: entry.label, label: `${selectionKind === "product" ? "Product" : "Payment method"}: ${entry.label}` };
      const accessibleLabel = `Filter orders by ${selectionKind === "product" ? "product" : "payment method"}: ${entry.label}`;
      const label = svgElement("text", { x: 0, y: y + 14, class: "admin-status-bar-label" }); label.textContent = entry.label.length > 22 ? `${entry.label.slice(0, 20)}…` : entry.label; makeChartMarkInteractive(label, selection, accessibleLabel); svg.append(label);
      const x = 190, width = 270 * entry.value / max;
      const bar = svgElement("rect", { x, y, width: Math.max(width, 2), height: 18, rx: 6, fill: color, style: "cursor:pointer;transition:opacity 0.15s" });
      const title = svgElement("title"); title.textContent = `${entry.label}: ${formatter(entry.value)}`; bar.append(title); makeChartMarkInteractive(bar, selection, accessibleLabel); svg.append(bar);
      const value = svgElement("text", { x: x + Math.max(width, 2) + 8, y: y + 14, class: "admin-chart-value-label" }); value.textContent = formatter(entry.value); makeChartMarkInteractive(value, selection, accessibleLabel); svg.append(value);
    });
    target.replaceChildren(svg);
  }
  function renderTopProductsChart(docs) {
    const quantities = new Map();
    docs.forEach(doc => {
      const order = doc.data();
      (Array.isArray(order.items) ? order.items : []).forEach(item => {
        const name = String(item.productName || item.name || item.productId || item.id || "Unspecified product").trim();
        quantities.set(name, (quantities.get(name) || 0) + Number(item.quantity || 1));
      });
    });
    renderRankedChart("top-products-chart", [...quantities].map(([label, value]) => ({ label, value })), "No product items in this date range.", "product", value => `${value} units`);
  }
  function renderPaymentMethodsChart(docs) {
    const counts = new Map();
    docs.forEach(doc => {
      const order = doc.data();
      const method = paymentMethodForOrder(order);
      counts.set(method, (counts.get(method) || 0) + 1);
    });
    renderRankedChart("payment-methods-chart", [...counts].map(([label, value]) => ({ label, value })), "No payment data in this date range.", "payment", value => `${value} orders`);
  }
  function paymentMethodForOrder(order) {
    return String(order.mop || order.payment_method || order.paymentMethod || order.payment_ref || "Not specified").trim() || "Not specified";
  }
  function customerIdentity(order, documentId) {
    const email = String(order.email || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || "";
    if (email) return { key: `email:${email}`, label: email, canIgnoreCustomer: true };
    const phone = String(order.phone || "").replace(/\D/g, "");
    if (phone && phone.length >= 7) return { key: `phone:${phone}`, label: phone, canIgnoreCustomer: true };
    const name = String(order.name || "Customer details missing").trim();
    return { key: `order:${documentId}`, label: `${name} · ${order.order_id || documentId} (this order only)`, canIgnoreCustomer: false };
  }
  function isCustomerIgnored(order, documentId) {
    if (!order) return false;
    const email = String(order.email || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
    if (email && ignoredCustomers.has(`email:${email}`)) return true;
    const phone = String(order.phone || "").replace(/\D/g, "");
    if (phone && phone.length >= 7 && ignoredCustomers.has(`phone:${phone}`)) return true;
    if (documentId && ignoredCustomers.has(`order:${documentId}`)) return true;
    const identity = customerIdentity(order, documentId);
    return ignoredCustomers.has(identity.key);
  }
  function toggleIgnoreCustomer(order, documentId) {
    const isIgnored = isCustomerIgnored(order, documentId);
    const identity = customerIdentity(order, documentId);
    const email = String(order.email || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
    const phone = String(order.phone || "").replace(/\D/g, "");

    if (isIgnored) {
      ignoredCustomers.delete(identity.key);
      if (email) ignoredCustomers.delete(`email:${email}`);
      if (phone && phone.length >= 7) ignoredCustomers.delete(`phone:${phone}`);
      if (documentId) ignoredCustomers.delete(`order:${documentId}`);
      saveIgnoredCustomers();
      refreshVisibleOrders();
      window.showAdminToast?.(`Customer ${identity.label} restored.`, "success");
    } else {
      ignoredCustomers.set(identity.key, identity.label);
      if (email) ignoredCustomers.set(`email:${email}`, identity.label);
      if (phone && phone.length >= 7 && !email) ignoredCustomers.set(`phone:${phone}`, identity.label);
      saveIgnoredCustomers();
      refreshVisibleOrders();
      window.showAdminToast?.(`Customer ${identity.label} added to ignored list.`, "info");
    }
  }
  function saveIgnoredCustomers() {
    try {
      localStorage.setItem(IGNORED_CUSTOMERS_STORAGE_KEY, JSON.stringify([...ignoredCustomers]));
      return true;
    } catch (error) {
      console.error("Could not save ignored customers:", error);
      status.textContent = "Could not save the ignored customer list in this browser.";
      return false;
    }
  }
  function renderIgnoredCustomers() {
    const list = byId("ignored-customer-list");
    if (!list) return;
    byId("ignored-customer-count").textContent = String(ignoredCustomers.size);
    list.replaceChildren();
    if (!ignoredCustomers.size) {
      const empty = document.createElement("div"); empty.className = "admin-ignored-customer-empty"; empty.textContent = "No customers are ignored."; list.append(empty); return;
    }
    ignoredCustomers.forEach((label, key) => {
      const row = document.createElement("div"); row.className = "admin-ignored-customer-item";
      const name = document.createElement("span"); name.textContent = label;
      const restore = document.createElement("button"); restore.type = "button"; restore.textContent = "Restore";
      restore.addEventListener("click", () => {
        ignoredCustomers.delete(key);
        saveIgnoredCustomers();
        refreshVisibleOrders();
        window.showAdminToast?.(`Customer ${label} restored.`, "success");
      });
      row.append(name, restore); list.append(row);
    });
  }
  function renderAttentionQueue() {
    const target = byId("admin-attention-queue");
    const now = Date.now();
    const terminal = new Set(["Product Delivered", "Order Picked Up", "Cancelled", "Rejected"]);
    const attention = orderDocuments.map(doc => {
      const order = doc.data();
      if (isCustomerIgnored(order, doc.id)) return null;
      const canonicalStatus = canonicalOrderStatus(order.status, order.fulfillment_type);
      if (terminal.has(canonicalStatus)) return null;
      const createdAt = orderTimestamp(order.timestamp);
      const ageDays = createdAt === null ? null : Math.floor((now - createdAt) / 86400000);
      const reasons = [];
      if (ageDays !== null && ageDays >= 3) reasons.push(`Open for ${ageDays} days`);
      if (order.fulfillment_type !== "pickup") {
        if (!String(order.address || "").trim()) reasons.push("Delivery address missing");
        if (!String(order.phone || "").trim() || order.phone === "null") reasons.push("Phone number missing");
      }
      return reasons.length ? { doc, order, ageDays, reasons } : null;
    }).filter(Boolean).sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));
    target.replaceChildren();
    byId("admin-attention-count").textContent = String(attention.length);
    if (!attention.length) {
      const empty = document.createElement("div"); empty.className = "admin-attention-empty"; empty.textContent = "Nothing needs attention right now."; target.append(empty); return;
    }
    attention.slice(0, 12).forEach(({ doc, order, reasons }) => {
      const row = document.createElement("div"); row.className = "admin-attention-item";
      const copy = document.createElement("div");
      const title = document.createElement("strong"); title.textContent = `${order.order_id || doc.id} · ${order.name || order.email || "Customer details missing"}`;
      const detail = document.createElement("span"); detail.textContent = `${canonicalOrderStatus(order.status, order.fulfillment_type)} · ${reasons.join(" · ")}`;
      copy.append(title, detail);
      const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Review order";
      edit.addEventListener("click", () => openEditor({ collection: "orders", id: doc.id, data: order, creating: false }));
      row.append(copy, edit); target.append(row);
    });
    if (attention.length > 12) {
      const more = document.createElement("div"); more.className = "admin-helper"; more.textContent = `Showing 12 of ${attention.length} orders needing attention.`; target.append(more);
    }
  }
  function visibleOrders() {
    const query = byId("order-search").value.trim().toLowerCase();
    const selectedStatuses = [...byId("order-status-options").querySelectorAll("input:checked")].map(input => input.value);
    return ordersInDateRange().filter(doc => {
      const order = doc.data();
      if (isCustomerIgnored(order, doc.id)) return false;
      if (selectedStatuses.length && !selectedStatuses.includes(canonicalOrderStatus(order.status, order.fulfillment_type))) return false;
      if (query) {
        const searchable = [order.order_id, doc.id, order.name, order.email, order.phone, order.status, order.address, order.pickup_location,
          order.payment_ref, order.coupon_code, order.order_note, order.items, order.service_request]
          .map(value => typeof value === "string" ? value : JSON.stringify(value ?? ""))
          .join(" ").toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      if (!chartSelection) return true;
      if (chartSelection.kind === "time") {
        const time = orderTimestamp(order.timestamp);
        return time !== null && time >= chartSelection.start && time < chartSelection.end;
      }
      if (chartSelection.kind === "status") return canonicalOrderStatus(order.status, order.fulfillment_type) === chartSelection.value;
      if (chartSelection.kind === "product") return (Array.isArray(order.items) ? order.items : []).some(item => String(item.productName || item.name || item.productId || item.id || "Unspecified product").trim() === chartSelection.value);
      if (chartSelection.kind === "payment") return paymentMethodForOrder(order) === chartSelection.value;
      return true;
    });
  }
  function refreshVisibleOrders() {
    const dateDocs = ordersInDateRange();
    const { invalid } = dateRange();
    updateOrderOverview(dateDocs);
    renderTrendChart(dateDocs);
    renderStatusChart(dateDocs);
    renderStatusPieChart(dateDocs);
    renderRevenueChart(dateDocs);
    renderTopProductsChart(dateDocs);
    renderPaymentMethodsChart(dateDocs);
    renderAttentionQueue();
    renderIgnoredCustomers();
    byId("chart-filter-notice").hidden = !chartSelection;
    byId("chart-filter-label").textContent = chartSelection ? chartSelection.label : "";
    const docs = visibleOrders();
    const visibleIds = new Set(docs.map(doc => doc.id));
    selectedOrderIds.forEach(id => { if (!visibleIds.has(id)) selectedOrderIds.delete(id); });
    const valueFor = doc => {
      const order = doc.data();
      if (orderSort.field === "timestamp") return orderTimestamp(order.timestamp) ?? 0;
      if (orderSort.field === "total") return Number(order.total || 0);
      if (orderSort.field === "status") return canonicalOrderStatus(order.status);
      if (orderSort.field === "name") return String(order.name || order.email || "").toLowerCase();
      if (orderSort.field === "phone") return String(order.phone || "").toLowerCase();
      if (orderSort.field === "fulfillment_type") return String(order.fulfillment_type || "").toLowerCase();
      if (orderSort.field === "items") return (order.items || []).map(item => item.productName || item.name || item.id || "").join(" ").toLowerCase();
      if (orderSort.field === "payment_ref") return String(order.payment_ref || order.mop || "").toLowerCase();
      return String(order.order_id || doc.id).toLowerCase();
    };
    docs.sort((a, b) => {
      const left = valueFor(a), right = valueFor(b);
      const compare = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
      return orderSort.direction === "asc" ? compare : -compare;
    });
    const pageCount = Math.max(1, Math.ceil(docs.length / ordersPageSize));
    currentOrdersPage = Math.min(currentOrdersPage, pageCount);
    const start = (currentOrdersPage - 1) * ordersPageSize;
    const pageDocs = docs.slice(start, start + ordersPageSize);
    renderOrders(pageDocs);
    updateBulkSelectionControls(pageDocs);
    byId("orders-page-info").textContent = `Page ${currentOrdersPage} of ${pageCount}`;
    byId("orders-previous-page").disabled = currentOrdersPage <= 1;
    byId("orders-next-page").disabled = currentOrdersPage >= pageCount;
    byId("order-count-label").textContent = invalid ? "Choose a valid date range to display orders." : `Showing ${docs.length ? start + 1 : 0}–${Math.min(start + ordersPageSize, docs.length)} of ${docs.length} matching orders`;
    byId("select-all-matching-orders").textContent = `Select all matching (${docs.length})`;
    byId("select-all-matching-orders").disabled = docs.length === 0;
  }
  function updateBulkSelectionControls(docs = visibleOrders()) {
    const count = selectedOrderIds.size;
    const bulkToolbar = document.querySelector(".admin-bulk-toolbar");
    if (bulkToolbar) bulkToolbar.classList.toggle("active", count > 0);
    byId("bulk-selection-label").textContent = count ? `${count} order${count === 1 ? "" : "s"} selected` : "No orders selected";
    const deleteButton = byId("delete-selected-orders");
    deleteButton.textContent = `Delete selected (${count})`;
    deleteButton.disabled = count === 0;
    byId("clear-order-selection").disabled = count === 0;
    byId("apply-bulk-status").disabled = count === 0 || !byId("bulk-order-status").value;
    const selectAll = byId("select-all-visible-orders");
    if (selectAll) {
      const pageCheckboxes = [...byId("orders-list").querySelectorAll("input[data-order-id]")];
      const selectedVisible = pageCheckboxes.filter(input => selectedOrderIds.has(input.dataset.orderId)).length;
      selectAll.checked = pageCheckboxes.length > 0 && selectedVisible === pageCheckboxes.length;
      selectAll.indeterminate = selectedVisible > 0 && selectedVisible < pageCheckboxes.length;
      selectAll.disabled = pageCheckboxes.length === 0;
    }
  }
  function updateStatusFilterLabel() {
    const selected = [...byId("order-status-options").querySelectorAll("input:checked")];
    byId("order-status-filter-label").textContent = selected.length ? `${selected.length} status${selected.length === 1 ? "" : "es"} selected` : "All statuses";
  }
  function renderStatusFilterOptions() {
    const container = byId("order-status-options");
    container.replaceChildren();
    ORDER_STATUS_CATEGORIES.forEach(category => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.value = category;
      const text = document.createElement("span"); text.textContent = category;
      label.append(checkbox, text); container.append(label);
    });
    const clear = document.createElement("button"); clear.type = "button"; clear.className = "admin-status-filter-clear"; clear.textContent = "Clear selection · show all statuses";
    clear.addEventListener("click", () => {
      container.querySelectorAll("input:checked").forEach(input => { input.checked = false; });
      updateStatusFilterLabel(); refreshVisibleOrders();
    });
    container.append(clear);
  }
  function exportVisibleOrders() {
    const docs = visibleOrders();
    if (!docs.length) { status.textContent = "There are no orders to export with the current filters."; return; }
    const columns = [
      ["Order number", order => order.order_id], ["Document ID", (_, doc) => doc.id], ["Date", order => orderDate(order.timestamp)],
      ["Customer name", order => order.name], ["Email", order => order.email], ["Phone", order => order.phone],
      ["Fulfillment", order => order.fulfillment_type], ["Address or pickup location", order => order.pickup_location || order.address],
      ["Items", order => (order.items || []).map(item => `${item.productName || item.name || item.id || "Item"} x ${item.quantity || 1}`).join("; ")],
      ["Order note", order => order.order_note], ["Payment method", order => order.payment_ref || order.mop], ["Payment status", order => order.payment_status],
      ["Status", order => order.status], ["Item total", order => order.item_total], ["Delivery charge", order => order.delivery_charge],
      ["Discount", order => order.discount], ["Coupon", order => order.coupon_code], ["Total", order => order.total],
      ["Additional details", order => JSON.stringify(Object.fromEntries(Object.entries(order).filter(([key]) => !["order_id", "timestamp", "name", "email", "phone", "fulfillment_type", "address", "pickup_location", "items", "order_note", "payment_ref", "mop", "payment_status", "status", "item_total", "delivery_charge", "discount", "coupon_code", "total"].includes(key))))]
    ];
    const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [columns.map(([label]) => quote(label)).join(","), ...docs.map(doc => columns.map(([, getValue]) => quote(getValue(doc.data(), doc))).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    status.textContent = `Exported ${docs.length} order${docs.length === 1 ? "" : "s"} to CSV.`;
    window.showAdminToast?.(status.textContent, "success");
  }
  function renderOrders(docs) {
    const container = byId("orders-list"); container.replaceChildren();
    if (!docs.length) {
      const empty = document.createElement("div"); empty.className = "admin-empty-state";
      const message = document.createElement("div");
      const title = document.createElement("strong"); title.textContent = orderDocuments.length ? "No orders match these filters" : "No orders yet";
      const hint = document.createElement("span"); hint.textContent = orderDocuments.length ? "Try another search or choose a different status." : "New customer orders will appear here.";
      message.append(title, hint); empty.append(message); container.append(empty); return;
    }
    const wrapper = document.createElement("div"); wrapper.className = "admin-table-wrap";
    const table = document.createElement("table"); table.className = "admin-orders-table";
    const heading = (field, label) => `<button type='button' class='admin-sort-button' data-sort-field='${field}'>${label}${orderSort.field === field ? (orderSort.direction === "asc" ? " ↑" : " ↓") : " ↕"}</button>`;
    table.innerHTML = `<thead><tr><th><input id='select-all-visible-orders' type='checkbox' aria-label='Select all orders on this page' title='Select all orders on this page'></th><th>${heading("timestamp", "Order &amp; date")}</th><th>${heading("name", "Customer")}</th><th>${heading("phone", "Phone")}</th><th>${heading("fulfillment_type", "Delivery / pickup")}</th><th>${heading("items", "Items / request")}</th><th>${heading("payment_ref", "Payment")}</th><th>${heading("status", "Status")}</th><th>${heading("total", "Total")}</th><th>Actions</th></tr></thead>`;
    const body = document.createElement("tbody");
    docs.forEach(doc => {
      const order = doc.data();
      const row = document.createElement("tr");
      const selectionCell = document.createElement("td");
      const selectionCheckbox = document.createElement("input"); selectionCheckbox.type = "checkbox"; selectionCheckbox.dataset.orderId = doc.id;
      selectionCheckbox.checked = selectedOrderIds.has(doc.id); selectionCheckbox.setAttribute("aria-label", `Select order ${order.order_id || doc.id}`);
      selectionCell.append(selectionCheckbox); row.append(selectionCell);
      const cell = (primary, secondary = "", className = "") => {
        const td = document.createElement("td"); if (className) td.className = className;
        const main = document.createElement("strong"); main.textContent = primary || "—"; td.append(main);
        if (secondary) { const sub = document.createElement("span"); sub.className = "admin-order-secondary"; sub.textContent = secondary; td.append(sub); }
        return td;
      };
      const orderNumber = order.order_id || doc.id;
      const orderCell = cell("", orderDate(order.timestamp));
      const orderButton = document.createElement("button"); orderButton.type = "button"; orderButton.className = "admin-order-id"; orderButton.textContent = orderNumber;
      orderButton.setAttribute("aria-label", `Show all details for order ${orderNumber}`);
      orderButton.addEventListener("click", () => showOrderDetails(doc.id, order));
      orderCell.replaceChild(orderButton, orderCell.firstElementChild); row.append(orderCell);
      row.append(cell(order.name || "Customer name missing", order.email || "Email missing"));
      row.append(cell(order.phone && order.phone !== "null" ? order.phone : "Phone not provided"));
      row.append(cell(order.fulfillment_type === "pickup" ? "Store pickup" : "Home delivery", order.pickup_location || order.address || "Address not provided"));
      const items = Array.isArray(order.items) ? order.items : [];
      const itemSummary = items.length ? items.map(item => `${item.productName || item.name || item.id || "Item"} × ${item.quantity || 1}`).join("\n") : order.order_type ? (order.order_type === "bulk_order" ? "Bulk order request" : "3D printing service request") : "No item details";
      row.append(cell(itemSummary, order.order_note ? `Note: ${order.order_note}` : "", "admin-order-items"));
      row.append(cell(order.payment_ref || order.mop || "Payment not specified", order.payment_status ? `Payment status: ${order.payment_status}` : ""));
      const canonical = canonicalOrderStatus(order.status, order.fulfillment_type);
      const statusSlug = canonical.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const statusCell = cell(canonical);
      statusCell.firstElementChild.className = `admin-order-status status-${statusSlug}`;
      row.append(statusCell);
      const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(order.total || 0));
      row.append(cell(amount, order.coupon_code ? `Coupon: ${order.coupon_code}` : ""));
      const actionCell = document.createElement("td"); const actions = document.createElement("div"); actions.className = "admin-actions";
      const manage = document.createElement("button"); manage.type = "button"; manage.className = "btn-table-action btn-secondary";
      manage.textContent = "Manage";
      manage.title = "View & manage this order";
      manage.addEventListener("click", () => showOrderDetails(doc.id, order));

      const invoice = document.createElement("button"); invoice.type = "button"; invoice.className = "btn-table-action btn-invoice";
      invoice.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><span>Invoice</span>`;
      invoice.setAttribute("aria-label", `Download invoice for order ${orderNumber}`);
      invoice.addEventListener("click", () => downloadInvoice(order));

      const edit = document.createElement("button"); edit.type = "button"; edit.className = "btn-table-action btn-edit";
      edit.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg><span>Edit</span>`;
      edit.addEventListener("click", () => openEditor({ collection: "orders", id: doc.id, data: order, creating: false }));

      const ignore = document.createElement("button"); ignore.type = "button"; ignore.className = "btn-table-action btn-ignore";
      ignore.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg><span>Ignore</span>`;
      ignore.title = "Ignore customer from analytics, dashboard, and orders list";
      ignore.addEventListener("click", () => {
        const ident = customerIdentity(order, doc.id);
        if (window.confirm(`Ignore customer "${ident.label}"? All their orders will be hidden from dashboard metrics, sales analytics, and the orders list.`)) {
          toggleIgnoreCustomer(order, doc.id);
        }
      });

      const remove = document.createElement("button"); remove.type = "button"; remove.className = "btn-table-action danger";
      remove.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
      remove.title = "Delete this order";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return;
        try {
          await db.collection("orders").doc(doc.id).delete();
          status.textContent = "Order deleted.";
          window.showAdminToast?.("Order deleted successfully", "success");
          await loadOrders();
        } catch (error) { reportError(error); }
      });


      const notify = document.createElement("button"); notify.type = "button"; notify.className = "btn-table-action btn-notify";
      notify.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg><span>Notify</span>`;
      notify.title = "Send order status notification email to customer";
      notify.addEventListener("click", () => {
        sendOrderNotificationEmail(order);
      });

      actions.append(manage, invoice, notify, edit, ignore, remove); actionCell.append(actions); row.append(actionCell); body.append(row);
    });
    table.append(body); wrapper.append(table); container.append(wrapper);
  }
  async function deleteSelectedOrders() {
    const ids = [...selectedOrderIds].filter(id => visibleOrders().some(doc => doc.id === id));
    if (!ids.length) { selectedOrderIds.clear(); refreshVisibleOrders(); return; }
    const confirmed = window.confirm(`Permanently delete ${ids.length} selected order${ids.length === 1 ? "" : "s"}? This cannot be undone.`);
    if (!confirmed) return;
    const button = byId("delete-selected-orders");
    button.disabled = true;
    let deleted = 0;
    status.textContent = `Deleting ${ids.length} selected order${ids.length === 1 ? "" : "s"}…`;
    try {
      for (let offset = 0; offset < ids.length; offset += 450) {
        const batch = db.batch();
        ids.slice(offset, offset + 450).forEach(id => batch.delete(db.collection("orders").doc(id)));
        await batch.commit();
        deleted += Math.min(450, ids.length - offset);
        ids.slice(offset, offset + 450).forEach(id => selectedOrderIds.delete(id));
      }
      await loadOrders();
      status.textContent = `Deleted ${deleted} order${deleted === 1 ? "" : "s"}.`;
      window.showAdminToast?.(`Deleted ${deleted} order${deleted === 1 ? "" : "s"}.`, "success");
    } catch (error) {
      await loadOrders();
      const detail = errorText(error);
      status.textContent = deleted ? `Deleted ${deleted} order${deleted === 1 ? "" : "s"}; remaining deletes failed. ${detail}` : detail;
      window.showAdminToast?.(status.textContent, "danger");
      console.error(error);
    } finally {
      button.disabled = selectedOrderIds.size === 0;
      updateBulkSelectionControls();
    }
  }
  async function updateSelectedOrderStatus() {
    const newStatus = byId("bulk-order-status").value;
    const matchingIds = new Set(visibleOrders().map(doc => doc.id));
    const ids = [...selectedOrderIds].filter(id => matchingIds.has(id));
    if (!newStatus || !ids.length) return;
    if (!window.confirm(`Set ${ids.length} selected order${ids.length === 1 ? "" : "s"} to “${newStatus}”?`)) return;
    const button = byId("apply-bulk-status");
    button.disabled = true;
    let updated = 0;
    status.textContent = `Updating ${ids.length} selected order${ids.length === 1 ? "" : "s"}…`;
    try {
      for (let offset = 0; offset < ids.length; offset += 450) {
        const batch = db.batch();
        ids.slice(offset, offset + 450).forEach(id => batch.update(db.collection("orders").doc(id), { status: newStatus }));
        await batch.commit();
        updated += Math.min(450, ids.length - offset);
      }
      selectedOrderIds.clear();
      await loadOrders();
      status.textContent = `Updated ${updated} order${updated === 1 ? "" : "s"} to ${newStatus}.`;
      window.showAdminToast?.(`Updated ${updated} order${updated === 1 ? "" : "s"} to ${newStatus}.`, "success");
    } catch (error) {
      await loadOrders();
      status.textContent = updated ? `Updated ${updated} order${updated === 1 ? "" : "s"}; remaining updates failed. ${errorText(error)}` : errorText(error);
      window.showAdminToast?.(status.textContent, "danger");
      console.error(error);
    }
  }
  async function loadOrders() {
    status.textContent = "Loading orders…";
    try {
      const snapshot = await db.collection("orders").get();
      const docs = snapshot.docs.sort((a, b) => {
        const time = value => value && typeof value.toMillis === "function" ? value.toMillis() : Number(value || 0);
        return time(b.data().timestamp) - time(a.data().timestamp);
      });
      orderDocuments = docs;
      customerRecords = buildCustomerRecordsFromOrders(docs);
      updateOrderOverview(docs);
      refreshVisibleOrders();
      status.textContent = `${docs.length} order document${docs.length === 1 ? "" : "s"} loaded.`;
    } catch (error) { reportError(error); }
  }
  function nextAdminOrderId() {
    const existing = new Set(orderDocuments.map(doc => {
      const order = doc.data();
      return String(order.order_id || doc.id || "").replace(/\D/g, "");
    }));
    for (let attempt = 0; attempt < 10000; attempt += 1) {
      let code;
      if (window.crypto && window.crypto.getRandomValues) {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        code = String(100000 + (arr[0] % 900000));
      } else {
        code = String(Math.floor(100000 + Math.random() * 900000));
      }
      if (!existing.has(code)) return `#${code}`;
    }
    return `#${Math.floor(100000 + Math.random() * 900000)}`;
  }
  function nextProductId(usedIds) {
    for (let attempt = 0; attempt < 10000; attempt += 1) {
      const candidate = String(Math.floor(10000000 + Math.random() * 90000000));
      if (!usedIds.has(candidate)) return candidate;
    }
    let candidate = 10000000;
    while (usedIds.has(String(candidate))) candidate += 1;
    return String(candidate);
  }
  async function createAdminOrder() {
    status.textContent = "Loading products for the new order…";
    try {
      const [snapshot, ordersSnapshot] = await Promise.all([
        db.collection("products").get(),
        db.collection("orders").get()
      ]);
      adminProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(product => product.productName && Number.isFinite(Number(product.price)));
      const orderTime = doc => {
        const value = doc.data().timestamp;
        return value && typeof value.toMillis === "function" ? value.toMillis() : parseOrderDate(value)?.getTime() || 0;
      };
      orderDocuments = ordersSnapshot.docs.sort((a, b) => orderTime(b) - orderTime(a));
      customerRecords = buildCustomerRecordsFromOrders(orderDocuments);
      const orderId = nextAdminOrderId();
      const now = firebase.firestore.Timestamp.now();
      openEditor({
        collection: "orders",
        id: orderId,
        creating: true,
        data: {
          order_id: orderId,
          name: "",
          email: "",
          phone: "",
          address: "",
          fulfillment_type: "delivery",
          pickup_location: "",
          items: [],
          order_note: "",
          item_total: 0,
          delivery_charge: 0,
          discount: 0,
          total: 0,
          coupon_code: "",
          status: "Order Placed",
          timestamp: now,
          approved: false,
          payment_status: "Pending",
          mop: "cash",
          payment_ref: "cash-on-delivery",
          upi_id: "",
          expected_delivery: ""
        }
      });
      status.textContent = `${adminProducts.length} product${adminProducts.length === 1 ? "" : "s"} available to add.`;
      if (!adminProducts.length) byId("editor-error").textContent = "No products are available. Add a product in the Firestore data explorer before creating an order.";
    } catch (error) { reportError(error); }
  }
  async function createAdminProduct() {
    status.textContent = "Reserving an unused 8-digit product ID…";
    try {
      const snapshot = await db.collection("products").get();
      const usedIds = new Set([...snapshot.docs.map(doc => doc.id), ...reservedProductIds]);
      const id = nextProductId(usedIds);
      reservedProductIds.add(id);
      openEditor({
        collection: "products",
        id,
        creating: true,
        kind: "product",
        data: {
          productId: id,
          productName: "",
          price: 0,
          category: "",
          description: "",
          imageUrl: "",
          gifUrl: "",
          customizable: true,
          color: "",
          stock: 0,
          tags: "",
          colourOptions: {},
          colourPrices: {},
          sizes: {},
          sizePrices: {}
        }
      });
      status.textContent = `New product ${id} ready to create.`;
    } catch (error) { reportError(error); }
  }

  async function duplicateAdminOrder(order, sourceId) {
    status.textContent = "Loading product data and assigning a new unique order ID…";
    try {
      if (!adminProducts.length) {
        const snapshot = await db.collection("products").get();
        adminProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(product => product.productName && Number.isFinite(Number(product.price)));
      }

      let orderId = nextAdminOrderId();
      for (let attempt = 0; attempt < 20; attempt++) {
        const clean = orderId.replace("#", "");
        const [s1, s2] = await Promise.all([
          db.collection("orders").doc(orderId).get(),
          db.collection("orders").doc(clean).get()
        ]);
        if (!s1.exists && !s2.exists) break;
        orderId = nextAdminOrderId();
      }

      const now = firebase.firestore.Timestamp.now();
      const clone = JSON.parse(plainData(order || {}));
      clone.order_id = orderId;
      clone.timestamp = now;
      clone.status = "Order Placed";
      clone.approved = false;
      clone.payment_status = canonicalPaymentStatus(clone.payment_status) === "Paid" ? "Pending" : canonicalPaymentStatus(clone.payment_status);
      if (Array.isArray(clone.items)) {
        clone.items = clone.items.map(item => ({ ...item }));
      } else {
        clone.items = [];
      }

      openEditor({
        collection: "orders",
        id: orderId,
        creating: true,
        kind: "order",
        data: clone
      });
      status.textContent = `Duplicating order based on ${sourceId || "existing order"} with new ID ${orderId}. Review details and click Save Changes.`;
      window.showAdminToast?.(`Duplicating order as ${orderId}`, "info");
    } catch (error) { reportError(error); }
  }

  async function duplicateAdminProduct(product, sourceId) {
    status.textContent = "Reserving a new product ID for duplicate…";
    try {
      const snapshot = await db.collection("products").get();
      const usedIds = new Set([...snapshot.docs.map(doc => doc.id), ...reservedProductIds]);
      const id = nextProductId(usedIds);
      reservedProductIds.add(id);

      const clone = JSON.parse(plainData(product || {}));
      clone.productId = id;
      if (clone.productName) {
        clone.productName = `${clone.productName} (Copy)`;
      }
      clone.createdAt = firebase.firestore.Timestamp.now();

      openEditor({
        collection: "products",
        id,
        creating: true,
        kind: "product",
        data: clone
      });
      status.textContent = `Duplicating product based on ${sourceId || "existing product"} with new ID ${id}. Review details and click Save Changes.`;
      window.showAdminToast?.(`Duplicating product with new ID ${id}`, "info");
    } catch (error) { reportError(error); }
  }
  async function loadCollection() {
    const name = byId("collection-name").value.trim();
    if (!validCollectionPath(name)) { status.textContent = "Enter a valid collection path with an odd number of path segments."; return; }
    status.textContent = `Loading ${name}…`;
    try {
      const snapshot = await db.collection(name).get();
      renderDocuments(byId("collection-list"), name, snapshot.docs);
      status.textContent = `${snapshot.size} document${snapshot.size === 1 ? "" : "s"} in ${name}.`;
    } catch (error) { reportError(error); }
  }
  byId("refresh-orders").addEventListener("click", () => { loadOrders(); loadTickets(); });
  byId("order-search").addEventListener("input", () => { currentOrdersPage = 1; refreshVisibleOrders(); });
  byId("orders-list").addEventListener("click", event => {
    const button = event.target.closest("[data-sort-field]");
    if (!button) return;
    const field = button.dataset.sortField;
    orderSort = { field, direction: orderSort.field === field && orderSort.direction === "asc" ? "desc" : "asc" };
    currentOrdersPage = 1;
    refreshVisibleOrders();
  });
  byId("orders-list").addEventListener("change", event => {
    const target = event.target;
    if (target.id === "select-all-visible-orders") {
      byId("orders-list").querySelectorAll("input[data-order-id]").forEach(input => {
        if (target.checked) selectedOrderIds.add(input.dataset.orderId);
        else selectedOrderIds.delete(input.dataset.orderId);
      });
    } else if (target.matches("input[data-order-id]")) {
      if (target.checked) selectedOrderIds.add(target.dataset.orderId);
      else selectedOrderIds.delete(target.dataset.orderId);
    } else return;
    const pageDocs = visibleOrders().slice((currentOrdersPage - 1) * ordersPageSize, currentOrdersPage * ordersPageSize);
    updateBulkSelectionControls(pageDocs);
  });
  byId("delete-selected-orders").addEventListener("click", deleteSelectedOrders);
  byId("clear-chart-filter").addEventListener("click", () => {
    chartSelection = null;
    currentOrdersPage = 1;
    refreshVisibleOrders();
  });
  byId("select-all-matching-orders").addEventListener("click", () => {
    visibleOrders().forEach(doc => selectedOrderIds.add(doc.id));
    const pageDocs = visibleOrders().slice((currentOrdersPage - 1) * ordersPageSize, currentOrdersPage * ordersPageSize);
    updateBulkSelectionControls(pageDocs);
  });
  byId("clear-order-selection").addEventListener("click", () => {
    selectedOrderIds.clear();
    const pageDocs = visibleOrders().slice((currentOrdersPage - 1) * ordersPageSize, currentOrdersPage * ordersPageSize);
    updateBulkSelectionControls(pageDocs);
  });
  byId("bulk-order-status").addEventListener("input", () => updateBulkSelectionControls());
  byId("apply-bulk-status").addEventListener("click", updateSelectedOrderStatus);
  byId("orders-page-size").addEventListener("change", event => {
    ordersPageSize = Number(event.target.value) || 25;
    currentOrdersPage = 1;
    refreshVisibleOrders();
  });
  byId("orders-previous-page").addEventListener("click", () => { currentOrdersPage = Math.max(1, currentOrdersPage - 1); refreshVisibleOrders(); });
  byId("orders-next-page").addEventListener("click", () => { currentOrdersPage += 1; refreshVisibleOrders(); });
  renderStatusFilterOptions();
  initQuickStatusFilters();
  byId("order-status-options").addEventListener("change", () => { updateStatusFilterLabel(); currentOrdersPage = 1; refreshVisibleOrders(); });
  const clearDatePresetSelection = () => document.querySelectorAll("[data-date-preset]").forEach(button => button.setAttribute("aria-pressed", "false"));
  byId("orders-date-from").addEventListener("change", () => { clearDatePresetSelection(); currentOrdersPage = 1; refreshVisibleOrders(); });
  byId("orders-date-to").addEventListener("change", () => { clearDatePresetSelection(); currentOrdersPage = 1; refreshVisibleOrders(); });
  document.querySelectorAll("[data-date-preset]").forEach(button => button.addEventListener("click", () => {
    const preset = button.dataset.datePreset;
    document.querySelectorAll("[data-date-preset]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    if (preset === "all") {
      byId("orders-date-from").value = "";
      byId("orders-date-to").value = "";
    } else {
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      start.setDate(start.getDate() - Number(preset) + 1);
      const toInputValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      byId("orders-date-from").value = toInputValue(start);
      byId("orders-date-to").value = toInputValue(end);
    }
    currentOrdersPage = 1;
    refreshVisibleOrders();
  }));
  byId("clear-order-dates").addEventListener("click", () => {
    byId("orders-date-from").value = ""; byId("orders-date-to").value = "";
    document.querySelectorAll("[data-date-preset]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.datePreset === "all")));
    currentOrdersPage = 1; refreshVisibleOrders();
  });
  byId("export-orders").addEventListener("click", exportVisibleOrders);
  byId("browse-collection").addEventListener("click", loadCollection);
  byId("create-order").addEventListener("click", createAdminOrder);
  byId("toggle-customer-records").addEventListener("click", () => {
    const selector = byId("customer-record-selector");
    selector.hidden = !selector.hidden;
    if (!selector.hidden) byId("customer-record-search").focus();
  });
  byId("customer-record-search").addEventListener("input", event => {
    populateCustomerRecordSelect(event.target.value);
  });
  byId("customer-record-select").addEventListener("change", event => {
    if (event.target.value !== "") applyCustomerRecord(event.target.value);
  });
  byId("order-product-select").addEventListener("change", updateOrderProductVariantPicker);
  const updateOrderProductPricePreview = () => {
    const product = selectedOrderProduct();
    if (!product) return;
    byId("order-product-price-preview").textContent = `Unit price: ${formatMoney(getOrderProductPrice(
      product,
      byId("order-product-colour-select").value,
      byId("order-product-size-select").value
    ))}`;
  };
  byId("order-product-colour-select").addEventListener("change", updateOrderProductPricePreview);
  byId("order-product-size-select").addEventListener("change", updateOrderProductPricePreview);
  byId("add-order-product").addEventListener("click", () => {
    orderItemsDraft = readOrderItemRows();
    const product = selectedOrderProduct();
    if (!product) { byId("editor-error").textContent = "Choose a product to add."; return; }
    const colour = byId("order-product-colour-select").value;
    const size = byId("order-product-size-select").value;
    const unitPrice = getOrderProductPrice(product, colour, size);
    const existing = orderItemsDraft.find(item => item.id === product.id && String(item.colour || item.color || "") === colour && String(item.size || "") === size);
    if (existing) existing.quantity = Math.max(1, Number(existing.quantity) || 1) + 1;
    else orderItemsDraft.push({
      id: product.id,
      productName: product.productName || "Untitled product",
      imageUrl: firstProductImage(product.imageUrl || product.image_url || product.image),
      price: unitPrice,
      quantity: 1,
      colour,
      size,
      customizable: product.customizable === true,
      customization: ""
    });
    byId("editor-error").textContent = "";
    renderOrderItemRows();
  });
  byId("order-item-rows").addEventListener("input", updateOrderItemPreview);
  byId("create-product").addEventListener("click", createAdminProduct);
  byId("product-image-files")?.addEventListener("change", () => {
    const f = byId("product-image-files")?.files;
    if (f && f.length) addProductImageFiles(f);
  });
  byId("product-gif-file")?.addEventListener("change", () => renderProductGifPreview());
  byId("product-remove-gif")?.addEventListener("click", () => {
    productGifUrl = "";
    const gf = byId("product-gif-file");
    if (gf) gf.value = "";
    renderProductMedia();
  });
  byId("btn-browse-product-images")?.addEventListener("click", () => byId("product-image-files")?.click());
  byId("btn-toggle-url-input")?.addEventListener("click", () => {
    const bar = byId("product-url-input-bar");
    if (bar) {
      bar.hidden = !bar.hidden;
      if (!bar.hidden) byId("product-url-input")?.focus();
    }
  });
  byId("btn-add-product-url")?.addEventListener("click", () => {
    const input = byId("product-url-input");
    if (input && input.value.trim()) {
      addProductImageUrl(input.value.trim());
      input.value = "";
      const bar = byId("product-url-input-bar");
      if (bar) bar.hidden = true;
    }
  });
  byId("btn-cancel-product-url")?.addEventListener("click", () => {
    const input = byId("product-url-input");
    if (input) input.value = "";
    const bar = byId("product-url-input-bar");
    if (bar) bar.hidden = true;
  });
  byId("product-url-input")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      byId("btn-add-product-url")?.click();
    } else if (event.key === "Escape") {
      byId("btn-cancel-product-url")?.click();
    }
  });
  const dropzone = byId("product-image-dropzone");
  if (dropzone) {
    dropzone.addEventListener("click", e => {
      if (e.target !== byId("product-image-files")) {
        byId("product-image-files")?.click();
      }
    });
    dropzone.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        byId("product-image-files")?.click();
      }
    });
    ["dragenter", "dragover"].forEach(eventName => {
      dropzone.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("drag-active");
      });
    });
    ["dragleave", "dragend"].forEach(eventName => {
      dropzone.addEventListener(eventName, e => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("drag-active");
      });
    });
    dropzone.addEventListener("drop", e => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("drag-active");
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        const imageFiles = [...dt.files].filter(f => f.type.startsWith("image/"));
        if (imageFiles.length) {
          addProductImageFiles(imageFiles);
        } else {
          if (typeof showAdminToast === "function") showAdminToast("Only image files can be dropped here.", "error");
        }
      }
    });
  }
  byId("add-product-colour").addEventListener("click", () => {
    productColourDraft = readProductVariantRows("product-colour-rows", false);
    productColourDraft.push({ label: "", price: 0 });
    renderVariantRows("product-colour-rows", productColourDraft, "Colour (e.g. Black)", "Remove colour");
  });
  byId("add-product-size").addEventListener("click", () => {
    productSizeDraft = readProductVariantRows("product-size-rows", false);
    productSizeDraft.push({ label: "", price: 0 });
    renderVariantRows("product-size-rows", productSizeDraft, "Size (e.g. Small)", "Remove size");
  });
  byId("create-document").addEventListener("click", () => {
    const collection = byId("collection-name").value.trim();
    if (!validCollectionPath(collection)) { status.textContent = "Enter a valid collection path first."; return; }
    if (collection === "products") { createAdminProduct(); return; }
    openEditor({ collection, id: db.collection(collection).doc().id, data: {}, creating: true });
  });
  byId("editor-save").addEventListener("click", saveEditor);
  byId("order-detail-close").addEventListener("click", () => byId("order-detail-dialog").close());
  byId("order-detail-done").addEventListener("click", () => byId("order-detail-dialog").close());
  byId("order-detail-dialog").addEventListener("click", event => {
    if (event.target === byId("order-detail-dialog")) byId("order-detail-dialog").close();
  });
  byId("advanced-editor").addEventListener("toggle", event => {
    if (!event.currentTarget.open) return;
    const model = readEditorFields();
    if (activeDocument?.collection === "products") {
      try { applyProductVariants(model); } catch { /* Invalid variant rows are reported when saving. */ }
    }
    jsonInput.value = plainData(model);
  });
  byId("editor-close").addEventListener("click", () => { cleanupProductImageItemPreviews(); dialog.close(); });
  byId("editor-cancel").addEventListener("click", () => { cleanupProductImageItemPreviews(); dialog.close(); });
  dialog?.addEventListener("close", () => cleanupProductImageItemPreviews());

  // ── Image Studio Dialog Event Listeners ─────────────────────────────────
  const pieDialog = byId("product-image-editor-dialog");
  window.addEventListener("resize", () => {
    if (pieDialog?.open && imageEditorSourceImg) requestAnimationFrame(renderEditorCanvas);
  });
  pieDialog?.addEventListener("close", () => {
    imageEditorLoadToken++;
    imageEditorSourceImg = null;
    activeEditingImageIndex = -1;
    const applyButton = byId("pie-apply");
    if (applyButton) applyButton.disabled = false;
  });
  byId("pie-close")?.addEventListener("click", () => pieDialog?.close());
  byId("pie-cancel")?.addEventListener("click", () => pieDialog?.close());
  byId("pie-rotate-left")?.addEventListener("click", () => {
    imageEditorState.rotation = (imageEditorState.rotation + 270) % 360;
    initCropFromAspect(imageEditorState.aspectRatio);
    renderEditorCanvas();
  });
  (byId("pie-rotate-cw") || byId("pie-rotate-right"))?.addEventListener("click", () => {
    imageEditorState.rotation = (imageEditorState.rotation + 90) % 360;
    initCropFromAspect(imageEditorState.aspectRatio);
    renderEditorCanvas();
  });
  byId("pie-flip-h")?.addEventListener("click", () => {
    imageEditorState.flipH = !imageEditorState.flipH;
    renderEditorCanvas();
  });
  byId("pie-flip-v")?.addEventListener("click", () => {
    imageEditorState.flipV = !imageEditorState.flipV;
    renderEditorCanvas();
  });

  const wirePieSlider = (id, key, valId) => {
    byId(id)?.addEventListener("input", e => {
      const val = parseInt(e.target.value, 10) || 100;
      imageEditorState[key] = val;
      const display = byId(valId);
      if (display) display.textContent = `${val}%`;
      renderEditorCanvas();
    });
  };
  wirePieSlider("pie-brightness", "brightness", "pie-val-brightness");
  wirePieSlider("pie-contrast", "contrast", "pie-val-contrast");
  wirePieSlider("pie-saturation", "saturate", "pie-val-saturation");

  byId("pie-reset-sliders")?.addEventListener("click", () => {
    imageEditorState.brightness = 100;
    imageEditorState.contrast = 100;
    imageEditorState.saturate = 100;
    const brSlider = byId("pie-brightness"); if (brSlider) brSlider.value = 100;
    const ctSlider = byId("pie-contrast"); if (ctSlider) ctSlider.value = 100;
    const saSlider = byId("pie-saturation"); if (saSlider) saSlider.value = 100;
    const brVal = byId("pie-val-brightness"); if (brVal) brVal.textContent = "100%";
    const ctVal = byId("pie-val-contrast"); if (ctVal) ctVal.textContent = "100%";
    const saVal = byId("pie-val-saturation"); if (saVal) saVal.textContent = "100%";
    renderEditorCanvas();
  });

  byId("pie-reset-all")?.addEventListener("click", () => {
    imageEditorState.rotation = 0;
    imageEditorState.flipH = false;
    imageEditorState.flipV = false;
    imageEditorState.brightness = 100;
    imageEditorState.contrast = 100;
    imageEditorState.saturate = 100;
    const brSlider = byId("pie-brightness"); if (brSlider) brSlider.value = 100;
    const ctSlider = byId("pie-contrast"); if (ctSlider) ctSlider.value = 100;
    const saSlider = byId("pie-saturation"); if (saSlider) saSlider.value = 100;
    const brVal = byId("pie-val-brightness"); if (brVal) brVal.textContent = "100%";
    const ctVal = byId("pie-val-contrast"); if (ctVal) ctVal.textContent = "100%";
    const saVal = byId("pie-val-saturation"); if (saVal) saVal.textContent = "100%";
    initCropFromAspect("free");
    document.querySelectorAll(".pie-aspect-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.aspect === "free");
    });
    renderEditorCanvas();
  });

  document.querySelectorAll(".pie-aspect-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pie-aspect-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const aspect = btn.dataset.aspect;
      initCropFromAspect(aspect);
      renderEditorCanvas();
    });
  });

  byId("pie-apply")?.addEventListener("click", applyCurrentProductImageEdit);
  setupImageEditorCropInteraction();

  login.addEventListener("click", () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(reportError));

  // ── Catalog state ──────────────────────────────────────────────────────
  let catalogDocuments = [];
  const catalogSelectedIds = new Set();
  let catalogPdfLayout = "grid";
  let catalogPdfAccentColor = "#f59e0b";

  function catalogFmt(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  function availabilityClass(availability) {
    const val = String(availability || "In Stock").toLowerCase();
    if (val.includes("out")) return "availability-out-of-stock";
    if (val.includes("made") || val.includes("order")) return "availability-made-to-order";
    return "availability-in-stock";
  }

  function visibleCatalogProducts() {
    const query = byId("catalog-search").value.trim().toLowerCase();
    const category = byId("catalog-category-filter").value;
    const availability = byId("catalog-availability-filter").value;
    const customizable = byId("catalog-customizable-filter") ? byId("catalog-customizable-filter").value : "";
    const sortVal = byId("catalog-sort") ? byId("catalog-sort").value : "name-asc";

    let filtered = catalogDocuments.filter(doc => {
      const p = doc.data();
      if (category && String(p.category || "").toLowerCase() !== category.toLowerCase()) return false;
      if (availability && String(p.availability || "In Stock").toLowerCase() !== availability.toLowerCase()) return false;
      if (customizable === "yes" && !(p.customizable === true || p.isCustomizable === true)) return false;
      if (customizable === "no" && (p.customizable === true || p.isCustomizable === true)) return false;
      if (query) {
        const searchable = [p.productName, p.description, p.category, p.tags, p.colour, p.color, p.bestFor].map(v => String(v || "")).join(" ").toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    });

    // Sort
    const availabilityOrder = { "in stock": 0, "made to order": 1, "out of stock": 2 };
    filtered = filtered.slice().sort((a, b) => {
      const pa = a.data(), pb = b.data();
      switch (sortVal) {
        case "name-desc":
          return String(pb.productName || "").localeCompare(String(pa.productName || ""), undefined, { sensitivity: "base" });
        case "price-asc":
          return (Number(pa.price) || 0) - (Number(pb.price) || 0);
        case "price-desc":
          return (Number(pb.price) || 0) - (Number(pa.price) || 0);
        case "availability": {
          const oa = availabilityOrder[String(pa.availability || "in stock").toLowerCase()] ?? 3;
          const ob = availabilityOrder[String(pb.availability || "in stock").toLowerCase()] ?? 3;
          return oa !== ob ? oa - ob : String(pa.productName || "").localeCompare(String(pb.productName || ""), undefined, { sensitivity: "base" });
        }
        case "category":
          return String(pa.category || "").localeCompare(String(pb.category || ""), undefined, { sensitivity: "base" });
        default: // name-asc
          return String(pa.productName || "").localeCompare(String(pb.productName || ""), undefined, { sensitivity: "base" });
      }
    });

    return filtered;
  }

  function updateCatalogStats(docs) {
    const all = docs.map(d => d.data());
    byId("catalog-stat-total").textContent = String(all.length);
    byId("catalog-stat-instock").textContent = String(all.filter(p => String(p.availability || "In Stock").toLowerCase().includes("stock") && !String(p.availability || "").toLowerCase().includes("out")).length);
    byId("catalog-stat-mto").textContent = String(all.filter(p => String(p.availability || "").toLowerCase().includes("made") || String(p.availability || "").toLowerCase().includes("order")).length);
    byId("catalog-stat-oos").textContent = String(all.filter(p => String(p.availability || "").toLowerCase().includes("out")).length);
    byId("catalog-stat-custom").textContent = String(all.filter(p => p.customizable === true || p.isCustomizable === true).length);
  }

  function renderCatalogGrid() {
    const products = visibleCatalogProducts();
    const container = byId("catalog-product-grid");
    container.replaceChildren();
    byId("catalog-count-label").textContent = `Showing ${products.length} of ${catalogDocuments.length} products`;
    const selectedCount = products.filter(doc => catalogSelectedIds.has(doc.id)).length;
    byId("catalog-deselect-all").disabled = selectedCount === 0;

    if (!products.length) {
      const empty = document.createElement("div"); empty.className = "catalog-empty-state";
      const strong = document.createElement("strong"); strong.textContent = catalogDocuments.length ? "No products match the filters" : "No products yet";
      const span = document.createElement("span"); span.textContent = catalogDocuments.length ? "Try a different search or reset the filters." : "Add products via the Data Explorer.";
      empty.append(strong, span); container.append(empty); return;
    }

    products.forEach(doc => {
      const p = doc.data();
      const card = document.createElement("div"); card.className = `catalog-product-card${catalogSelectedIds.has(doc.id) ? " selected" : ""}`;

      // Image
      const imgWrap = document.createElement("div"); imgWrap.className = "catalog-product-img-wrap";
      const imgUrl = firstProductImage(p.imageUrl || p.image_url || p.image);
      const img = document.createElement("img"); img.src = imgUrl; img.alt = p.productName || "Product"; img.loading = "lazy";
      img.onerror = () => { img.src = "logo_creativesouls.jpg"; };

      const selectCheck = document.createElement("input"); selectCheck.type = "checkbox"; selectCheck.className = "catalog-product-select-check";
      selectCheck.checked = catalogSelectedIds.has(doc.id); selectCheck.setAttribute("aria-label", `Select ${p.productName || "product"} for PDF export`);
      selectCheck.addEventListener("change", () => {
        if (selectCheck.checked) catalogSelectedIds.add(doc.id); else catalogSelectedIds.delete(doc.id);
        card.classList.toggle("selected", selectCheck.checked);
        byId("catalog-deselect-all").disabled = catalogSelectedIds.size === 0;
      });

      const badge = document.createElement("span"); badge.className = `catalog-product-availability-badge ${availabilityClass(p.availability)}`;
      badge.textContent = String(p.availability || "In Stock");

      imgWrap.append(selectCheck, img, badge);

      // Body
      const body = document.createElement("div"); body.className = "catalog-product-body";

      if (p.category) {
        const cat = document.createElement("div"); cat.className = "catalog-product-category"; cat.textContent = p.category; body.append(cat);
      }
      const name = document.createElement("div"); name.className = "catalog-product-name"; name.textContent = p.productName || "Untitled"; body.append(name);

      if (p.description) {
        const desc = document.createElement("div"); desc.className = "catalog-product-desc"; desc.innerHTML = window.sanitizeProductDescription(p.description); body.append(desc);
      }

      const priceRow = document.createElement("div"); priceRow.className = "catalog-product-price-row";
      const price = document.createElement("span"); price.className = "catalog-product-price"; price.textContent = catalogFmt(p.price);
      priceRow.append(price);
      if (Number(p.originalPrice) > Number(p.price)) {
        const orig = document.createElement("span"); orig.className = "catalog-product-original-price"; orig.textContent = catalogFmt(p.originalPrice); priceRow.append(orig);
      }
      body.append(priceRow);

      // Actions
      const actions = document.createElement("div"); actions.className = "catalog-product-actions";
      const editBtn = document.createElement("button"); editBtn.type = "button"; editBtn.className = "btn-edit btn-table-action"; editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEditor({ collection: "products", id: doc.id, data: p, creating: false }));
      const dupBtn = document.createElement("button"); dupBtn.type = "button"; dupBtn.className = "btn-duplicate btn-table-action";
      dupBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Duplicate</span>`;
      dupBtn.title = "Duplicate this product with a new ID";
      dupBtn.addEventListener("click", () => duplicateAdminProduct(p, doc.id));
      actions.append(editBtn, dupBtn);

      card.append(imgWrap, body, actions);
      container.append(card);
    });
  }

  async function loadCatalogProducts() {
    byId("catalog-count-label").textContent = "Loading products…";
    try {
      const snapshot = await db.collection("products").get();
      catalogDocuments = snapshot.docs.sort((a, b) => String(a.data().productName || "").localeCompare(String(b.data().productName || ""), undefined, { sensitivity: "base" }));
      updateCatalogStats(catalogDocuments);
      renderCatalogGrid();
      status.textContent = `${catalogDocuments.length} product${catalogDocuments.length === 1 ? "" : "s"} loaded.`;
    } catch (error) { reportError(error); }
  }

  // ── Catalog toolbar listeners ───────────────────────────────────────────
  byId("catalog-refresh").addEventListener("click", loadCatalogProducts);
  byId("catalog-search").addEventListener("input", renderCatalogGrid);
  byId("catalog-category-filter").addEventListener("change", renderCatalogGrid);
  byId("catalog-availability-filter").addEventListener("change", renderCatalogGrid);
  byId("catalog-customizable-filter")?.addEventListener("change", renderCatalogGrid);
  byId("catalog-sort")?.addEventListener("change", renderCatalogGrid);

  byId("catalog-select-all").addEventListener("click", () => {
    visibleCatalogProducts().forEach(doc => catalogSelectedIds.add(doc.id));
    renderCatalogGrid();
  });

  byId("catalog-deselect-all").addEventListener("click", () => {
    catalogSelectedIds.clear();
    renderCatalogGrid();
  });

  // ── PDF Export Dialog ───────────────────────────────────────────────────
  function openCatalogPdfDialog() {
    const visible = visibleCatalogProducts();
    const toExport = catalogSelectedIds.size > 0 ? visible.filter(doc => catalogSelectedIds.has(doc.id)) : visible;
    const count = toExport.length;
    byId("pdf-product-count").textContent = String(count);
    byId("pdf-export-count").textContent = String(count);
    const noteText = byId("pdf-filter-note-text");
    if (catalogSelectedIds.size > 0) {
      noteText.innerHTML = `Exporting <strong>${count}</strong> selected product${count === 1 ? "" : "s"} (${visible.length} total visible).`;
    } else {
      noteText.innerHTML = `Exporting all <strong>${count}</strong> product${count === 1 ? "" : "s"} currently visible in the catalog.`;
    }
    byId("catalog-pdf-dialog").showModal();
  }

  byId("catalog-export-pdf").addEventListener("click", openCatalogPdfDialog);
  byId("pdf-dialog-close").addEventListener("click", () => byId("catalog-pdf-dialog").close());
  byId("pdf-dialog-cancel").addEventListener("click", () => byId("catalog-pdf-dialog").close());

  // Layout toggle
  document.querySelectorAll(".pdf-layout-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pdf-layout-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      catalogPdfLayout = btn.dataset.layout;
    });
  });

  // Colour swatches
  document.querySelectorAll(".pdf-color-swatch").forEach(swatch => {
    swatch.addEventListener("click", () => {
      document.querySelectorAll(".pdf-color-swatch").forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
      catalogPdfAccentColor = swatch.dataset.color;
    });
  });

  // Generate PDF
  byId("pdf-generate-btn").addEventListener("click", generateCatalogPdf);

  function generateCatalogPdf() {
    const visible = visibleCatalogProducts();
    const products = (catalogSelectedIds.size > 0 ? visible.filter(doc => catalogSelectedIds.has(doc.id)) : visible)
      .map(doc => ({ id: doc.id, ...doc.data() }));

    if (!products.length) {
      window.showAdminToast?.("No products to export.", "danger");
      return;
    }

    const opts = {
      showCover: byId("pdf-opt-cover").checked,
      showImage: byId("pdf-opt-image").checked,
      showPrice: byId("pdf-opt-price").checked,
      showDescription: byId("pdf-opt-description").checked,
      showCategory: byId("pdf-opt-category").checked,
      showAvailability: byId("pdf-opt-availability").checked,
      showVariants: byId("pdf-opt-variants").checked,
      showCustomizable: byId("pdf-opt-customizable").checked,
      showTags: byId("pdf-opt-tags").checked,
      showProductId: byId("pdf-opt-product-id").checked,
      groupByCategory: byId("pdf-opt-groupby-category").checked,
      showPageNumbers: byId("pdf-opt-page-numbers").checked,
      layout: catalogPdfLayout,
      accent: catalogPdfAccentColor,
    };

    const esc = v => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const fmt = v => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v) || 0);
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

    // Group products
    let groups;
    if (opts.groupByCategory) {
      const map = new Map();
      products.forEach(p => {
        const cat = String(p.category || "Uncategorized").trim();
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat).push(p);
      });
      groups = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => ({ cat, items }));
    } else {
      groups = [{ cat: null, items: products }];
    }

    // Columns per row
    const cols = opts.layout === "grid3" ? 3 : opts.layout === "list" ? 1 : 2;
    const accent = opts.accent;
    const accentLight = accent + "22";

    // Build product card HTML
    function productCardHtml(p) {
      const colours = (() => {
        const map = p.colourOptions || p.colorOptions;
        if (map && typeof map === "object") return Object.keys(map).join(", ");
        return String(p.colour || p.color || "").trim();
      })();
      const sizes = (() => {
        const map = p.sizes;
        if (map && typeof map === "object") return Object.keys(map).join(", ");
        return "";
      })();
      const customizable = p.customizable === true || p.isCustomizable === true;
      const hasDiscount = Number(p.originalPrice) > Number(p.price);

      if (opts.layout === "list") {
        return `
          <div class="product-row">
            ${opts.showImage ? `<div class="product-img-wrap"><img src="${esc(firstProductImage(p.imageUrl || p.image_url || p.image))}" alt="${esc(p.productName)}" onerror="this.src='logo_creativesouls.jpg'"/></div>` : ""}
            <div class="product-info">
              ${opts.showCategory && p.category ? `<div class="product-cat">${esc(p.category)}${p.bestFor ? ` · ${esc(p.bestFor)}` : ""}</div>` : ""}
              <div class="product-name">${esc(p.productName || "Untitled")}</div>
              ${opts.showCustomizable && customizable ? `<span class="badge badge-custom">✦ Personalizable</span>` : ""}
              ${opts.showAvailability ? `<span class="badge badge-avail avail-${String(p.availability || "In Stock").toLowerCase().replace(/\s+/g, "-")}">${esc(p.availability || "In Stock")}</span>` : ""}
              ${opts.showDescription && p.description ? `<div class="product-desc">${window.sanitizeProductDescription(p.description)}</div>` : ""}
              ${opts.showVariants && colours ? `<div class="product-meta"><strong>Colours:</strong> ${esc(colours)}</div>` : ""}
              ${opts.showVariants && sizes ? `<div class="product-meta"><strong>Sizes:</strong> ${esc(sizes)}</div>` : ""}
              ${opts.showTags && p.tags ? `<div class="product-meta product-tags">${String(p.tags).split(",").map(t => `<span class="tag">${esc(t.trim())}</span>`).join("")}</div>` : ""}
              ${opts.showProductId ? `<div class="product-sku">SKU: ${esc(p.productId || p.id)}</div>` : ""}
            </div>
            ${opts.showPrice ? `<div class="product-price-col">
              <div class="product-price">${fmt(p.price)}</div>
              ${hasDiscount ? `<div class="product-orig-price">${fmt(p.originalPrice)}</div>` : ""}
            </div>` : ""}
          </div>`;
      }

      return `
        <div class="product-card">
          ${opts.showImage ? `<div class="product-card-img"><img src="${esc(firstProductImage(p.imageUrl || p.image_url || p.image))}" alt="${esc(p.productName)}" onerror="this.src='logo_creativesouls.jpg'"/></div>` : ""}
          <div class="product-card-body">
            ${opts.showCategory && p.category ? `<div class="product-cat">${esc(p.category)}</div>` : ""}
            <div class="product-name">${esc(p.productName || "Untitled")}</div>
            ${opts.showCustomizable && customizable ? `<span class="badge badge-custom">✦ Personalizable</span>` : ""}
            ${opts.showAvailability ? `<span class="badge badge-avail avail-${String(p.availability || "In Stock").toLowerCase().replace(/\s+/g, "-")}">${esc(p.availability || "In Stock")}</span>` : ""}
            ${opts.showDescription && p.description ? `<div class="product-desc">${window.sanitizeProductDescription(p.description)}</div>` : ""}
            ${opts.showVariants && colours ? `<div class="product-meta"><strong>Colours:</strong> ${esc(colours)}</div>` : ""}
            ${opts.showVariants && sizes ? `<div class="product-meta"><strong>Sizes:</strong> ${esc(sizes)}</div>` : ""}
            ${opts.showTags && p.tags ? `<div class="product-meta product-tags">${String(p.tags).split(",").map(t => `<span class="tag">${esc(t.trim())}</span>`).join("")}</div>` : ""}
            ${opts.showProductId ? `<div class="product-sku">SKU: ${esc(p.productId || p.id)}</div>` : ""}
            ${opts.showPrice ? `<div class="product-price-row">
              <span class="product-price">${fmt(p.price)}</span>
              ${hasDiscount ? `<span class="product-orig-price">${fmt(p.originalPrice)}</span>` : ""}
            </div>` : ""}
          </div>
        </div>`;
    }

    // Build all sections HTML
    const sectionsHtml = groups.map(({ cat, items }) => {
      const catHeading = opts.groupByCategory && cat ? `<div class="category-heading"><span>${esc(cat)}</span></div>` : "";
      if (opts.layout === "list") {
        return `${catHeading}<div class="product-list">${items.map(productCardHtml).join("")}</div>`;
      }
      // Grid layout — flex-wrap, no empty placeholder cards
      return `${catHeading}<div class="product-grid">${items.map(productCardHtml).join("")}</div>`;
    }).join("");

    const coverHtml = opts.showCover ? `
      <div class="cover-page">
        <div class="cover-brand">Creative Souls 3D</div>
        <div class="cover-tagline">Personalized 3D Printed Art, Gifts &amp; Keepsakes</div>
        <div class="cover-title">Product Catalog</div>
        <div class="cover-meta">${products.length} Products · ${today}</div>
        ${catalogSelectedIds.size > 0 ? `<div class="cover-meta" style="font-size:12px;margin-top:6px;">Filtered selection</div>` : ""}
      </div>` : "";

    const colWidth = opts.layout === "grid3" ? "calc(33.33% - 10px)" : opts.layout === "grid" ? "calc(50% - 10px)" : "100%";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Creative Souls 3D — Product Catalog</title>
  <style>
    @page { margin: 14mm; size: A4; ${opts.showPageNumbers ? `@bottom-center { content: "Page " counter(page) " of " counter(pages); font-family: Arial, sans-serif; font-size: 10px; color: #94a3b8; }` : ""} }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1e293b; background: #fff; }

    .cover-page {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: calc(100vh - 28mm); text-align: center; page-break-after: always;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 60px 40px; border-radius: 12px; margin-bottom: 20px;
    }
    .cover-brand { font-size: 14px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${accent}; margin-bottom: 12px; }
    .cover-tagline { font-size: 11px; color: #94a3b8; margin-bottom: 40px; }
    .cover-title { font-size: 42px; font-weight: 900; color: #ffffff; letter-spacing: -0.03em; line-height: 1; margin-bottom: 20px; }
    .cover-meta { font-size: 13px; color: #64748b; }

    .category-heading {
      display: flex; align-items: center; gap: 12px;
      margin: 24px 0 14px; page-break-after: avoid;
    }
    .category-heading span {
      font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
      color: ${accent}; white-space: nowrap; padding: 4px 12px;
      border-left: 4px solid ${accent}; background: ${accentLight};
    }

    .product-grid { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 14px; }
    .product-card { flex: 0 0 ${colWidth}; max-width: ${colWidth}; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; page-break-inside: avoid; }
    .product-card-img { width: 100%; aspect-ratio: 4/3; overflow: hidden; background: #f8fafc; }
    .product-card-img img { width: 100%; height: 100%; object-fit: cover; }
    .product-card-body { padding: 10px 12px 12px; }

    /* List layout */
    .product-list { display: flex; flex-direction: column; gap: 10px; }
    .product-row { display: flex; gap: 14px; align-items: flex-start; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; padding: 12px; page-break-inside: avoid; }
    .product-img-wrap { flex: 0 0 100px; width: 100px; height: 80px; overflow: hidden; border-radius: 6px; background: #f8fafc; }
    .product-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
    .product-info { flex: 1; min-width: 0; }
    .product-price-col { flex: 0 0 80px; text-align: right; padding-top: 2px; }

    .product-cat { font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: ${accent}; margin-bottom: 4px; }
    .product-name { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 5px; line-height: 1.3; }
    .product-desc { font-size: 10px; color: #64748b; line-height: 1.5; margin: 5px 0; }
    .product-meta { font-size: 10px; color: #475569; margin-top: 4px; }
    .product-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
    .tag { background: #f1f5f9; color: #475569; border-radius: 4px; padding: 1px 6px; font-size: 9px; }
    .product-sku { font-size: 9px; color: #94a3b8; margin-top: 6px; font-family: 'Courier New', monospace; }
    .product-price-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .product-price { font-size: 14px; font-weight: 800; color: #0f172a; }
    .product-orig-price { font-size: 10px; color: #94a3b8; text-decoration: line-through; }

    .badge { display: inline-block; font-size: 8.5px; font-weight: 800; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 999px; margin-bottom: 5px; margin-right: 4px; }
    .badge-custom { background: #fdf4ff; color: #7c3aed; border: 1px solid #e9d5ff; }
    .badge-avail { }
    .avail-in-stock { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .avail-made-to-order { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .avail-out-of-stock { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  </style>
</head>
<body>
  ${coverHtml}
  ${sectionsHtml}
</body>
</html>`;

    byId("catalog-pdf-dialog").close();
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;";
    document.body.append(iframe);
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open(); iframeDoc.write(html); iframeDoc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    window.setTimeout(() => iframe.remove(), 3000);
    window.showAdminToast?.(`Catalog PDF for ${products.length} products sent to print dialog.`, "success");
    status.textContent = `Catalog PDF generated for ${products.length} products.`;
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function ticketDate(value) {
    const date = parseOrderDate(value);
    return date ? date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
  }
  function canonicalTicketStatus(value) {
    const status = String(value || "Open").trim().toLowerCase();
    if (status.includes("resolve")) return "Resolved";
    if (status.includes("repl")) return "Replied";
    return "Open";
  }
  function ticketFirstName(ticket) {
    const name = String(ticket?.name || "").trim();
    return name.split(/\s+/)[0] || "there";
  }
  function isTicketVideoAttachment(file) {
    return String(file?.fileType || "").toLowerCase().includes("video") || /\.(mp4|webm|mov|m4v|avi|mkv|ogv)(?:[?#]|$)/i.test(file?.url || "");
  }
  function ticketImageAttachments(ticket) {
    return (ticket?.attachments || []).filter(file => !isTicketVideoAttachment(file) && file?.url);
  }
  function selectedTicketReplyImages() {
    return [...(byId("ticket-reply-image-picker")?.querySelectorAll("input[type=checkbox]:checked") || [])]
      .map(input => ticketImageAttachments(activeTicket?.data)[Number(input.value)])
      .filter(Boolean);
  }
  function ticketReplyEmailBody(ticket, typedReply, images = []) {
    const body = formatTicketReplyEmail(ticket, typedReply);
    if (!images.length) return body;
    return `${body}\n\nImages included for reference:\n${images.map(file => `${file.name || "Ticket image"}: ${file.url}`).join("\n")}`;
  }
  async function removeTicketAttachment(file, button) {
    const currentTicket = activeTicket;
    if (!currentTicket || !file) return;
    const fileName = file.name || "this image";
    if (!window.confirm(`Remove “${fileName}” from this support ticket? It will also disappear from reply image options.`)) return;
    const draft = byId("ticket-reply-input")?.value || "";
    const selectedUrls = selectedTicketReplyImages().map(image => image.url);
    button.disabled = true;
    button.textContent = "Removing…";
    try {
      await db.collection("tickets").doc(currentTicket.id).update({
        attachments: firebase.firestore.FieldValue.arrayRemove(file)
      });
      await loadTickets();
      await showTicketDetails(currentTicket.id);
      const replyInput = byId("ticket-reply-input");
      if (replyInput) replyInput.value = draft;
      const remainingImages = ticketImageAttachments(activeTicket?.data);
      byId("ticket-reply-image-picker")?.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.checked = selectedUrls.includes(remainingImages[Number(input.value)]?.url);
      });
      updateTicketEmailPreview();
      window.showAdminToast?.("Image removed from the support ticket.", "success");
    } catch (error) {
      window.showAdminToast?.(errorText(error), "danger");
      reportError(error);
      button.disabled = false;
      button.textContent = "Delete";
    }
  }
  function renderTicketReplyImagePicker(ticket, container) {
    container.replaceChildren();
    const images = ticketImageAttachments(ticket);
    const heading = document.createElement("strong");
    heading.textContent = "Images to include in this email";
    const helper = document.createElement("p");
    helper.className = "admin-helper";
    helper.textContent = "Selected images are added as clickable links in the Gmail message.";
    container.append(heading, helper);
    if (!images.length) {
      const empty = document.createElement("p");
      empty.className = "admin-helper";
      empty.textContent = "No ticket images are available to include.";
      container.append(empty);
      return;
    }
    [
      ["Original images", images.filter(file => !file.reviewedAt)],
      ["Annotated review images", images.filter(file => !!file.reviewedAt)]
    ].forEach(([title, group]) => {
      if (!group.length) return;
      const groupEl = document.createElement("fieldset");
      groupEl.className = "ticket-reply-image-group";
      const legend = document.createElement("legend");
      legend.textContent = title;
      const grid = document.createElement("div");
      grid.className = "ticket-reply-image-grid";
      group.forEach(file => {
        const index = images.indexOf(file);
        const label = document.createElement("label");
        label.className = "ticket-reply-image-option";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = String(index);
        checkbox.addEventListener("change", updateTicketEmailPreview);
        const thumbWrap = document.createElement("div");
        thumbWrap.className = "ticket-reply-thumb-wrap";
        thumbWrap.title = "Click to view full photo";
        thumbWrap.setAttribute("role", "button");
        thumbWrap.setAttribute("tabindex", "0");
        thumbWrap.setAttribute("aria-label", `View ${file.name || "ticket photo"}`);
        const img = document.createElement("img");
        img.src = file.thumbnailUrl || file.url;
        img.alt = file.name || "Ticket photo";
        const viewIcon = document.createElement("span");
        viewIcon.className = "ticket-reply-thumb-view-icon";
        viewIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="13" r="3"/></svg>`;
        thumbWrap.append(img, viewIcon);

        const openViewer = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openTicketImageViewer(images, index);
        };
        thumbWrap.addEventListener("click", openViewer);
        thumbWrap.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") openViewer(e);
        });

        const name = document.createElement("span");
        name.textContent = file.name || "Ticket image";
        label.append(checkbox, thumbWrap, name);
        grid.append(label);
      });
      groupEl.append(legend, grid);
      container.append(groupEl);
    });
  }
  function formatTicketReplyEmail(ticket, typedReply) {
    const reply = String(typedReply || "").trim();
    const firstName = ticketFirstName(ticket);
    const alreadyGreets = /^(dear|hi\b|hello|hey\b)/i.test(reply);
    const lastLines = reply.split(/\n+/).slice(-5).join("\n");
    const alreadySigns = /(warm regards|kind regards|best regards|sincerely|creative souls 3d)/i.test(lastLines);
    const mentionsOrder = /order|ticket/i.test(reply);
    const parts = [];
    if (!alreadyGreets) parts.push(`Dear ${firstName},`, "");
    if (!mentionsOrder) {
      parts.push("Thank you for writing to Creative Souls 3D.");
      parts.push("");
      parts.push(`We are writing in response to your support request for Order ${ticket.order_id || "your recent order"} (Ticket ${ticket.ticket_id || ""}).`);
      parts.push("");
    }
    parts.push(reply);
    parts.push("");
    if (!alreadySigns) {
      parts.push("Please reply to this email if you need anything further. We are here to help.");
      parts.push("");
      parts.push("Warm regards,");
      parts.push("Creative Souls 3D");
      parts.push("Customer Support");
      parts.push("hello.creative.souls3d@gmail.com");
      parts.push("Instagram: @creative.souls3d");
    }
    parts.push("");
    parts.push("—");
    parts.push(`Ticket ID: ${ticket.ticket_id || ""}`);
    if (ticket.order_id) parts.push(`Order ID: ${ticket.order_id}`);
    return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function ticketEmailSubject(ticket) {
    return `Re: Your Creative Souls 3D order ${ticket.order_id || ""} — Ticket ${ticket.ticket_id || ""}`.replace(/\s+/g, " ").trim();
  }
  async function openGmailCompose({ to, subject, body }) {
    const cleanTo = String(to || "").trim();
    const cleanSubject = String(subject || "").trim();
    const cleanBody = String(body || "").trim();

    // Explicitly target hello.creative.souls3d@gmail.com account session
    const sender = encodeURIComponent(NOTIFY_EMAIL);
    const base = `https://mail.google.com/mail/u/${sender}/?view=cm&fs=1&authuser=${sender}`;
    const fullUrl = `${base}&to=${encodeURIComponent(cleanTo)}&su=${encodeURIComponent(cleanSubject)}&body=${encodeURIComponent(cleanBody)}`;

    const win = window.open(fullUrl, "_blank", "noopener");

    // If popup was blocked or window.open failed, fall back to mailto:
    if (!win || win.closed || typeof win.closed === "undefined") {
      const mailtoUrl = `mailto:${encodeURIComponent(cleanTo)}?subject=${encodeURIComponent(cleanSubject)}&body=${encodeURIComponent(cleanBody)}`;
      window.location.href = mailtoUrl;
    }

    return "opened";
  }

  // ── Order notification email system ────────────────────────────────────

  function orderEmailSubject(order) {
    const rawId = String(order.order_id || "").trim().replace(/^#+/, "");
    const idStr = rawId ? `#${rawId}` : "";
    const status = String(order.status || "Order Placed").trim();
    const canonical = canonicalOrderStatus(status, order.fulfillment_type);
    switch (canonical) {
      case "Order Placed":
        return `Order Received ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
      case "Request Received":
        return `Service Request Received ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
      case "Order Approved":
        return `Order Confirmed ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
      case "Payment Pending":
        return `Payment Pending for Order ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
      case "Printing Product":
        return `Order In Production ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
      case "Ready for Pickup":
        return `Your Order is Ready for Pickup! ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
      case "Order Picked Up":
        return `Order Picked Up ${idStr} — Thank You for Choosing Creative Souls 3D!`.replace(/\s+/g, " ").trim();
      case "Order Dispatched":
        return `Order Ready for Dispatch ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
      case "Out For Delivery":
        return `Order Out for Delivery ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
      case "Product Delivered":
        return `Order Delivered ${idStr} — Thank You for Choosing Creative Souls 3D!`.replace(/\s+/g, " ").trim();
      case "Cancelled":
        return `Order Cancelled ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
      case "Rejected":
        return `Order Request Update ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
      default:
        return `Order Status: ${status} ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
    }
  }

  function buildOrderNotificationEmailBody(order) {
    const esc = v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const fmt = v => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v) || 0);
    const firstName = String(order.name || "Customer").trim().split(/\s+/)[0] || "Customer";
    const cleanId = String(order.order_id || "").trim().replace(/^#+/, "");
    const locOrigin = (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "";
    const locPathname = (typeof window !== "undefined" && window.location && window.location.pathname) ? window.location.pathname : "";
    const feedbackUrl = `${locOrigin}${locPathname.replace(/[^/]*$/, "")}feedback.html?id=${encodeURIComponent(cleanId)}&token=${encodeURIComponent(order._feedbackToken || "")}`;
    const displayId = cleanId ? `#${cleanId}` : "—";
    const status = String(order.status || "Order Placed").trim();
    const canonicalSt = canonicalOrderStatus(status, order.fulfillment_type);
    const placedOn = orderDate(order.timestamp);
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsSubtotal = Number(order.item_total) || items.reduce((s, it) => s + (Number(it.price) || 0) * Math.max(1, Number(it.quantity) || 1), 0);
    const deliveryCharge = Number(order.delivery_charge || 0);
    const discount = Number(order.discount || 0);
    const total = Number(order.total) || itemsSubtotal + deliveryCharge - discount;
    const trackingLink = String(order.tracking_url || order.trackingUrl || order.tracking_link || "").trim();
    const estimatedDelivery = String(order.expected_delivery || order.estimatedDelivery || "").trim();
    const paymentStatus = String(order.payment_status || "").trim();
    const paymentMode = String(order.payment_ref || order.mop || "").trim();
    const isPickup = order.fulfillment_type === "pickup";
    const isPaid = paymentStatus.toLowerCase() === "paid";

    // Status config with Creative Souls 3D brand styling (solid, high-contrast, dark-mode proof)
    const statusConfig = {
      "Order Placed":       { emoji: "🛍️", color: "#ffffff", bg: "#2563eb", border: "#3b82f6" },
      "Request Received":   { emoji: "📋", color: "#ffffff", bg: "#7c3aed", border: "#8b5cf6" },
      "Confirmed":          { emoji: "✅", color: "#ffffff", bg: "#059669", border: "#10b981" },
      "In Production":      { emoji: "⚙️", color: "#ffffff", bg: "#d97706", border: "#f59e0b" },
      "Ready for Dispatch": { emoji: "📦", color: "#ffffff", bg: "#ea580c", border: "#f97316" },
      "Ready for Pickup":   { emoji: "📍", color: "#ffffff", bg: "#d97706", border: "#f59e0b" },
      "Shipped":            { emoji: "🚚", color: "#ffffff", bg: "#1d4ed8", border: "#3b82f6" },
      "Delivered":          { emoji: "🎉", color: "#ffffff", bg: "#16a34a", border: "#22c55e" },
      "Order Picked Up":    { emoji: "🎉", color: "#ffffff", bg: "#16a34a", border: "#22c55e" },
      "Payment Pending":    { emoji: "⏳", color: "#0f172a", bg: "#f59e0b", border: "#fbbf24" },
      "Cancelled":          { emoji: "❌", color: "#ffffff", bg: "#dc2626", border: "#ef4444" },
      "Rejected":           { emoji: "🚫", color: "#ffffff", bg: "#dc2626", border: "#ef4444" }
    };
    const sc = statusConfig[canonicalSt] || { emoji: "📋", color: "#ffffff", bg: "#475569", border: "#64748b" };

    // Status message copy tailored per status
    let statusHeadline = "Order Status Update";
    let statusDescription = `Your order status has been updated to <strong>${esc(status)}</strong>.`;

    switch (canonicalSt) {
      case "Order Placed":
        statusHeadline = "Your order has been received!";
        statusDescription = "Thank you for choosing <strong>Creative Souls 3D</strong>. We have received your order details and our workshop is reviewing the specifications. We will keep you updated every step of the way.";
        break;
      case "Request Received":
        statusHeadline = "We've received your custom request!";
        statusDescription = "Thank you for reaching out to <strong>Creative Souls 3D</strong>. Our design team is currently reviewing your 3D printing requirements and reference files. We will update you shortly.";
        break;
      case "Order Approved":
        statusHeadline = "Your order has been approved!";
        statusDescription = "Great news! Your order has been officially verified and added to our production schedule. Our workshop is preparing the 3D models and premium materials to begin manufacturing.";
        break;
      case "Payment Pending":
        statusHeadline = "Payment Pending for your order";
        statusDescription = `Your order payment of <strong>${fmt(total)}</strong> is currently pending. Please complete the payment so that our workshop can begin crafting your custom items. If you have already made the transfer, please reply to this email with your transaction reference.`;
        break;
      case "Printing Product":
        statusHeadline = "Your product is now being printed!";
        statusDescription = "Our high-precision 3D printers are currently crafting your items with care and precision. Every piece is monitored to ensure top quality. We will notify you once printing and quality inspections are complete.";
        break;
      case "Ready for Pickup":
        statusHeadline = "Your order is ready for pickup!";
        statusDescription = `Great news! Your 3D printed items are finished, quality checked, and ready for you to collect at our studio.<br><br><strong>Studio Pickup Location:</strong><br>${esc(order.pickup_location || order.address || "Creative Souls 3D Studio")}<br><br>Please keep your Order ID <strong>${esc(displayId)}</strong> handy when you arrive.`;
        break;
      case "Order Picked Up":
        statusHeadline = "Thank you for picking up your order!";
        statusDescription = "Your order has been collected from our studio. We hope you love your custom 3D printed piece! Help us improve by sharing your experience.";
        break;
      case "Order Dispatched":
        statusHeadline = "Your order is packed and ready!";
        statusDescription = "Your 3D printed items have completed production and successfully passed our quality inspection! They have been carefully cleaned, packaged, and are now ready for dispatch with our courier partner.";
        break;
      case "Order Dispatched":
        statusHeadline = "Your order has been dispatched!";
        statusDescription = "Your package has been handed over to our delivery partner and is on its way to you.";
        break;
      case "Out For Delivery":
        statusHeadline = "Your order is out for delivery!";
        statusDescription = "Your package is with the courier and is expected to reach you soon. Please keep your phone available for the delivery.";
        break;
      case "Product Delivered":
        statusHeadline = "Your order has been delivered!";
        statusDescription = "Your order has been delivered! We hope you loved your purchase. Help us improve by sharing your experience.";
        break;
      case "Cancelled":
        statusHeadline = "Your order has been cancelled";
        statusDescription = `We are writing to confirm that order <strong>${esc(displayId)}</strong> has been cancelled. If this cancellation was unexpected or made in error, please reply to this email and our support team will assist you right away.`;
        break;
      case "Rejected":
        statusHeadline = "Update regarding your order request";
        statusDescription = "Thank you for your interest in <strong>Creative Souls 3D</strong>. Regrettably, after careful review, we are unable to fulfill this custom request at this time. If you would like to discuss alternative designs or modifications, please reply directly to this email.";
        break;
    }

    if (canonicalSt === "Order Dispatched") {
      statusHeadline = status.toLowerCase() === "shipped" ? "Your order has been shipped!" : "Your order has been dispatched!";
      statusDescription = "Your package has been handed over to our delivery partner and is on its way to you.";
    } else if (canonicalSt === "Out For Delivery") {
      statusHeadline = "Your order is out for delivery!";
      statusDescription = "Your package is with the courier and is expected to reach you soon. Please keep your phone available for the delivery.";
    }

    // Items table rows
    const itemsRowsHtml = items.length
      ? items.map(it => {
          const qty = Math.max(1, Number(it.quantity) || 1);
          const lineTotal = (Number(it.price) || 0) * qty;
          const specs = [
            it.colour && `Colour: ${esc(it.colour)}`,
            it.size && `Size: ${esc(it.size)}`
          ].filter(Boolean).join(" · ");
          return `
            <tr style="background-color:#0f172a; background-image:linear-gradient(#0f172a,#0f172a);">
              <td style="padding:12px 14px; border-bottom:1px solid #1e293b; color:#f8fafc; vertical-align:top;">
                <div style="font-weight:700; font-size:13.5px; color:#ffffff; margin-bottom:2px;">${esc(it.productName || "Product")}</div>
                ${specs ? `<div style="font-size:12px; color:#94a3b8;">${specs}</div>` : ""}
                ${it.customization ? `<div style="font-size:12px; color:#fbbf24; background-color:#2a1b08; background-image:linear-gradient(#2a1b08,#2a1b08); border:1px solid #78350f; padding:2px 7px; border-radius:4px; display:inline-block; margin-top:4px;">Note: ${esc(it.customization)}</div>` : ""}
              </td>
              <td style="padding:12px 14px; border-bottom:1px solid #1e293b; text-align:center; color:#cbd5e1; font-weight:600; font-size:13px; vertical-align:top;">${qty}</td>
              <td style="padding:12px 14px; border-bottom:1px solid #1e293b; text-align:right; font-weight:700; color:#ffffff; font-size:13.5px; vertical-align:top;">${fmt(lineTotal)}</td>
            </tr>`;
        }).join("")
      : `<tr><td colspan="3" style="padding:16px; color:#94a3b8; text-align:center; font-size:13px; background-color:#0f172a; background-image:linear-gradient(#0f172a,#0f172a);">No items listed</td></tr>`;

    // Items table block
    const itemsSectionHtml = items.length ? `
      <div style="margin:24px 0 8px;">
        <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#f59e0b; margin-bottom:10px;">
          🛒 Ordered Items
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #334155; border-radius:10px; overflow:hidden; background-color:#0f172a; background-image:linear-gradient(#0f172a,#0f172a);">
          <thead>
            <tr style="background-color:#1e293b; background-image:linear-gradient(#1e293b,#1e293b); border-bottom:1px solid #334155;">
              <th style="padding:10px 14px; text-align:left; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">Product</th>
              <th style="padding:10px 14px; text-align:center; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; width:45px;">Qty</th>
              <th style="padding:10px 14px; text-align:right; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; width:90px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>

        <!-- Totals strip -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px; background-color:#1e293b; background-image:linear-gradient(#1e293b,#1e293b); border:1px solid #334155; border-radius:10px; overflow:hidden;">
          <tr>
            <td style="padding:8px 14px; color:#94a3b8; font-size:12.5px;">Item Subtotal</td>
            <td style="padding:8px 14px; text-align:right; font-size:12.5px; color:#cbd5e1; font-weight:600;">${fmt(itemsSubtotal)}</td>
          </tr>
          ${deliveryCharge > 0 ? `
          <tr>
            <td style="padding:5px 14px; color:#94a3b8; font-size:12.5px;">Delivery Charge</td>
            <td style="padding:5px 14px; text-align:right; font-size:12.5px; color:#cbd5e1; font-weight:600;">${fmt(deliveryCharge)}</td>
          </tr>` : ""}
          ${discount > 0 ? `
          <tr>
            <td style="padding:5px 14px; color:#34d399; font-size:12.5px; font-weight:600;">Discount</td>
            <td style="padding:5px 14px; text-align:right; font-size:12.5px; color:#34d399; font-weight:600;">-${fmt(discount)}</td>
          </tr>` : ""}
          <tr style="border-top:1.5px solid #334155; background-color:#2a1b08; background-image:linear-gradient(#2a1b08,#2a1b08);">
            <td style="padding:11px 14px; font-size:14px; font-weight:800; color:#f59e0b; border-left:4px solid #f59e0b;">Total Amount</td>
            <td style="padding:11px 14px; text-align:right; font-size:15px; font-weight:900; color:#fbbf24;">${fmt(total)}</td>
          </tr>
        </table>
      </div>` : "";

    // Tracking Card
    const trackingCardHtml = trackingLink ? `
      <div style="margin:20px 0; padding:16px 20px; background-color:#064e3b; background-image:linear-gradient(#064e3b,#064e3b); border:1.5px solid #059669; border-radius:12px;">
        <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:#6ee7b7; letter-spacing:0.05em; margin-bottom:4px;">🚚 Courier Tracking Details</div>
        <p style="margin:0 0 12px; font-size:13px; color:#d1fae5; line-height:1.5;">
          ${estimatedDelivery ? `Estimated Delivery: <strong style="color:#ffffff;">${esc(estimatedDelivery)}</strong>` : "Your package has been dispatched and is on its way."}
        </p>
        <a href="${esc(trackingLink)}" target="_blank" style="display:inline-block; background-color:#10b981; background-image:linear-gradient(#10b981,#10b981); color:#ffffff !important; font-weight:800; font-size:12.5px; padding:9px 20px; border-radius:8px; text-decoration:none;">Track Package &rarr;</a>
      </div>` : "";

    // Payment Pending Card
    const paymentPendingCardHtml = canonicalSt === "Payment Pending" ? `
      <div style="margin:20px 0; padding:16px 20px; background-color:#451a03; background-image:linear-gradient(#451a03,#451a03); border:1.5px solid #d97706; border-radius:12px;">
        <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; color:#fbbf24; letter-spacing:0.05em; margin-bottom:4px;">⚠️ Payment Pending</div>
        <p style="margin:0; color:#fef3c7; font-size:13.5px; line-height:1.6;">Your order total of <strong style="color:#ffffff;">${fmt(total)}</strong> is awaiting payment. Please complete the transaction so our workshop can begin crafting your custom items.</p>
        ${paymentMode ? `<div style="margin-top:8px; font-size:12px; color:#fde68a;">Payment Method: <strong style="color:#ffffff;">${esc(paymentMode)}</strong></div>` : ""}
      </div>` : "";

    // Note Card
    const noteCardHtml = order.order_note ? `
      <div style="margin:16px 0; padding:12px 16px; background-color:#2a1b08; background-image:linear-gradient(#2a1b08,#2a1b08); border:1px solid #78350f; border-left:4px solid #f59e0b; border-radius:8px;">
        <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:#f59e0b; letter-spacing:0.05em; margin-bottom:3px;">📝 Customer Note</div>
        <p style="margin:0; font-size:13px; color:#fef3c7; line-height:1.5;">${esc(order.order_note)}</p>
      </div>` : "";

    // Delivery / Pickup Address Card
    const addressCardHtml = `
      <div style="margin:22px 0 16px; padding:14px 18px; background-color:#1e293b; background-image:linear-gradient(#1e293b,#1e293b); border:1px solid #334155; border-radius:10px;">
        <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:#94a3b8; letter-spacing:0.05em; margin-bottom:4px;">
          ${isPickup ? "📍 Store Pickup Location" : "🏠 Delivery Address"}
        </div>
        <p style="margin:0; font-size:13px; color:#e2e8f0; line-height:1.6;">
          ${esc(isPickup ? (order.pickup_location || "Store Pickup") : (order.address || "—"))}
        </p>
      </div>`;

    const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="dark light"/>
  <meta name="supported-color-schemes" content="dark light"/>
  <title>Order ${esc(displayId)} — Creative Souls 3D</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root { color-scheme: dark light; }
    @media (prefers-color-scheme: dark) {
      .email-bg-wrapper { background-color: #0b0f19 !important; }
      .email-main-card { background-color: #0f172a !important; }
    }
    [data-ogsb] .email-main-card { background-color: #0f172a !important; }
  </style>
</head>
<body style="margin:0; padding:0; color-scheme:light; background-color:#0b0f19; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; color:#334155;">

  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0b0f19" class="email-bg-wrapper" style="background-color:#0b0f19; background-image:linear-gradient(#0b0f19,#0b0f19); padding:32px 12px; width:100%;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" bgcolor="#0f172a" class="email-main-card" style="max-width:600px; width:100%; background-color:#0f172a; background-image:linear-gradient(#0f172a,#0f172a); border-radius:16px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,0.12); border:1px solid #cbd5e1;">

        <!-- Brand Header -->
        <tr>
          <td bgcolor="#0f172a" class="email-header-cell" style="background-color:#0f172a; background-image:linear-gradient(135deg,#0f172a 0%,#1e293b 100%); padding:36px 36px 30px; text-align:center; color:#0f172a;">
            <div style="font-size:11px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:#f59e0b; margin-bottom:8px;">CREATIVE SOULS 3D</div>
            <div style="font-size:23px; font-weight:900; color:#ffffff; letter-spacing:-0.02em; margin:0 0 14px;">Order Status Update</div>
            <div style="display:inline-block; background-color:${sc.bg}; background-image:linear-gradient(${sc.bg},${sc.bg}); color:${sc.color} !important; border:1.5px solid ${sc.border}; padding:6px 20px; border-radius:999px; font-size:13px; font-weight:800;">
              ${sc.emoji} ${esc(canonicalSt)}
            </div>
          </td>
        </tr>

        <!-- Main Body -->
        <tr>
          <td bgcolor="#0f172a" class="email-body-cell" style="padding:32px 36px; background-color:#0f172a; background-image:linear-gradient(#0f172a,#0f172a);">

            <p class="email-title-text" style="margin:0 0 12px; font-size:16px; color:#ffffff; font-weight:700;">Dear ${esc(firstName)},</p>

            <!-- Status Headline & Description Card -->
            <div style="margin:14px 0 22px; padding:14px 18px; background-color:#1e293b; background-image:linear-gradient(#1e293b,#1e293b); border:1px solid #334155; border-left:4px solid #f59e0b; border-radius:10px;">
              <div class="email-title-text" style="font-size:16.5px; font-weight:800; color:#ffffff; margin-bottom:6px;">${statusHeadline}</div>
              <p class="email-body-text" style="margin:0; font-size:13.5px; color:#cbd5e1; line-height:1.7;">${statusDescription}</p>
            </div>

            <!-- Order Metadata Strip -->
            <table width="100%" cellpadding="0" cellspacing="0" class="email-meta-strip" style="background-color:#1e293b; background-image:linear-gradient(#1e293b,#1e293b); border:1px solid #334155; border-radius:12px; margin-bottom:20px; overflow:hidden;">
              <tr>
                <td width="50%" style="padding:12px 16px; border-bottom:1px solid #334155; border-right:1px solid #334155;">
                  <span style="font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">Order ID</span><br>
                  <strong style="font-size:14.5px; color:#ffffff;">${esc(displayId)}</strong>
                </td>
                <td width="50%" style="padding:12px 16px; border-bottom:1px solid #334155;">
                  <span style="font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">Current Status</span><br>
                  <strong style="font-size:13.5px; color:${sc.color === '#ffffff' ? '#38bdf8' : sc.color};">${sc.emoji} ${esc(canonicalSt)}</strong>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:12px 16px; border-right:1px solid #334155;">
                  <span style="font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">Order Date</span><br>
                  <strong style="font-size:13px; color:#e2e8f0;">${esc(placedOn)}</strong>
                </td>
                <td width="50%" style="padding:12px 16px;">
                  <span style="font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">Payment</span><br>
                  <strong style="font-size:13px; color:${isPaid ? '#34d399' : '#fbbf24'};">${esc(paymentStatus || paymentMode || "—")}</strong>
                </td>
              </tr>
            </table>

            ${trackingCardHtml}
            ${(canonicalSt === "Product Delivered" || canonicalSt === "Order Picked Up") ? `<div style="margin:20px 0;padding:20px;text-align:center;background-color:#111;background-image:linear-gradient(#111,#111);border:1px solid #ffeb3b;border-radius:12px;"><div style="font-size:11px;font-weight:900;letter-spacing:.13em;color:#ffeb3b;margin-bottom:8px;">WE'D LOVE TO HEAR FROM YOU!</div><div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:7px;">Your order has been ${canonicalSt === "Order Picked Up" ? "collected" : "delivered"}! We hope you loved your purchase.</div><p style="margin:0 0 14px;color:#e5e5e5;font-size:13px;">Help us improve by sharing your experience.</p><a href="${esc(feedbackUrl)}" style="display:inline-block;background:#ffeb3b;color:#111!important;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:900;">SHARE YOUR FEEDBACK</a></div>` : ""}
            ${paymentPendingCardHtml}
            ${itemsSectionHtml}
            ${addressCardHtml}
            ${noteCardHtml}

            <p style="margin:26px 0 10px; font-size:13.5px; color:#94a3b8; line-height:1.7;">
              If you have any questions or need to make any changes, simply reply directly to this email. We are always happy to help!
            </p>

            <p style="margin:16px 0 0; font-size:13.5px; color:#ffffff; line-height:1.6;">
              Warm regards,<br>
              <strong style="color:#ffffff;">Customer Support Team</strong><br>
              <span style="color:#f59e0b; font-weight:700;">Creative Souls 3D</span>
            </p>

          </td>
        </tr>

        <!-- Brand Footer -->
        <tr>
          <td bgcolor="#f8fafc" class="email-footer-cell" style="background-color:#f8fafc; padding:24px 36px; text-align:center; border-top:1px solid #e2e8f0; color:#475569;">
            <div style="font-size:12px; font-weight:700; color:#f8fafc; margin-bottom:4px;">Creative Souls 3D</div>
            <div style="font-size:11px; color:#94a3b8; line-height:1.5;">
              Personalized 3D Printed Art, Lithophanes, Gifts &amp; Keepsakes
            </div>
            <div style="margin-top:10px; font-size:11.5px;">
              <a href="mailto:hello.creative.souls3d@gmail.com" style="color:#f59e0b !important; text-decoration:none; font-weight:600; margin:0 6px;">hello.creative.souls3d@gmail.com</a>
              <span style="color:#475569;">·</span>
              <a href="https://www.instagram.com/creative.souls3d/" target="_blank" style="color:#f59e0b !important; text-decoration:none; font-weight:600; margin:0 6px;">Instagram: @creative.souls3d</a>
            </div>
            <div style="margin-top:12px; font-size:10px; color:#64748b;">
              Order Reference: <strong style="color:#94a3b8;">${esc(displayId)}</strong>
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
    return html;
  }

  function toBold(str) {
    if (!str) return "";
    return String(str).split("").map(ch => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D5D4 + (code - 65));
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + (code - 97));
      return ch;
    }).join("");
  }
  window.toBold = toBold;

  function buildOrderNotificationPlainText(order) {
    const fmt = v => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v) || 0);
    const firstName = String(order.name || "Customer").trim().split(/\s+/)[0] || "Customer";
    const status = String(order.status || "Order Placed").trim();
    const canonicalSt = canonicalOrderStatus(status, order.fulfillment_type);
    const placedOn = orderDate(order.timestamp);
    const cleanId = String(order.order_id || "").trim().replace(/^#+/, "");
    const displayId = cleanId ? `#${cleanId}` : "—";

    const items = Array.isArray(order.items) ? order.items : [];
    const itemsSubtotal = Number(order.item_total) || items.reduce((s, it) => s + (Number(it.price) || 0) * Math.max(1, Number(it.quantity) || 1), 0);
    const deliveryCharge = Number(order.delivery_charge || 0);
    const discount = Number(order.discount || 0);
    const total = Number(order.total) || itemsSubtotal + deliveryCharge - discount;

    const trackingLink = String(order.tracking_url || order.trackingUrl || order.tracking_link || "").trim();
    const estimatedDelivery = String(order.expected_delivery || order.estimatedDelivery || "").trim();
    const paymentStatus = String(order.payment_status || "").trim();
    const paymentMode = String(order.payment_ref || order.mop || "").trim();
    const isPickup = order.fulfillment_type === "pickup";

    let introLines = [];
    switch (canonicalSt) {
      case "Order Placed":
        introLines = [
          "Thank you for your order with Creative Souls 3D!",
          "",
          "We have successfully received your order and our workshop is reviewing the specifications. We will keep you updated every step of the way."
        ];
        break;
      case "Request Received":
        introLines = [
          "Thank you for reaching out to Creative Souls 3D!",
          "",
          "We have received your custom 3D printing service request. Our team is currently reviewing your design files and requirements. We will update you shortly."
        ];
        break;
      case "Order Approved":
        introLines = [
          "Great news — your order has been confirmed!",
          "",
          "Your order has been verified and added to our production schedule. We are preparing the 3D models and premium materials to begin manufacturing."
        ];
        break;
      case "Payment Pending":
        introLines = [
          "This is a friendly reminder regarding your order with Creative Souls 3D.",
          "",
          `Your order payment of ${fmt(total)} is currently pending. Please complete the payment so our workshop can begin crafting your custom items.`,
          paymentMode ? `Payment Method: ${paymentMode}` : "",
          "If you have already transferred the funds, please reply to this email with your transaction reference number or screenshot so we can verify it immediately."
        ].filter(Boolean);
        break;
      case "Printing Product":
        introLines = [
          "Exciting news about your order!",
          "",
          "Your order is now actively in production. Our high-precision 3D printers are currently crafting your items with care and precision. We will update you as soon as printing and quality inspections are complete."
        ];
        break;
      case "Ready for Pickup":
        introLines = [
          "Your order is ready for pickup!",
          "",
          "Great news! Your custom 3D printed items are finished, quality checked, and ready for pickup at our studio.",
          "",
          `Pickup Location: ${order.pickup_location || order.address || "Creative Souls 3D Studio"}`,
          `Please provide your Order ID (${displayId}) when you come to collect.`
        ];
        break;
      case "Order Picked Up":
        introLines = [
          "Thank you for picking up your order!",
          "",
          "Your order has been collected from our studio. We hope your custom 3D printed items bring joy to you!",
          "",
          "We would love to see your items in action — feel free to tag us on Instagram @creative.souls3d or reply to this email with your feedback."
        ];
        break;
      case "Order Dispatched":
        introLines = [
          "Your order is finished and ready!",
          "",
          "Your 3D printed items have completed production and passed our quality inspection. They have been securely packaged and are now ready for dispatch with our courier partner."
        ];
        break;
      case "Order Dispatched":
        introLines = [
          "Your order has been dispatched and is on the way!",
          "",
          "Your package has been handed over to our delivery partner and is en route to your address."
        ];
        if (trackingLink) introLines.push(`Tracking URL: ${trackingLink}`);
        if (estimatedDelivery) introLines.push(`Estimated Delivery: ${estimatedDelivery}`);
        break;
      case "Out For Delivery":
        introLines = [
          "Your order is out for delivery!",
          "",
          "Your package is with the courier and is expected to reach you soon. Please keep your phone available for the delivery."
        ];
        if (trackingLink) introLines.push(`Tracking URL: ${trackingLink}`);
        break;
      case "Product Delivered":
        introLines = [
          "Your order has been delivered!",
          "",
          "We hope your 3D printed items arrived in perfect condition and bring joy to you! We loved creating them for you.",
          "",
          "We would love to see your items in action — feel free to tag us on Instagram @creative.souls3d or reply to this email with your feedback."
        ];
        break;
      case "Cancelled":
        introLines = [
          "Your order has been cancelled.",
          "",
          `We are writing to confirm that order ${displayId} has been cancelled. If this cancellation was unexpected or made in error, please reply to this email and our team will assist you right away.`
        ];
        break;
      case "Rejected":
        introLines = [
          "Update regarding your order request with Creative Souls 3D.",
          "",
          "Thank you for your interest. Regrettably, after careful review, we are unable to fulfill this custom request at this time. If you would like to discuss alternative designs or modifications, please reply directly to this email."
        ];
        break;
      default:
        introLines = [
          "We are writing to update you on your order with Creative Souls 3D.",
          "",
          `Your current order status is: ${status}.`
        ];
        break;
    }

    if ((canonicalSt === "Product Delivered" || canonicalSt === "Order Picked Up") && order._feedbackLink) introLines.push("", "WE'D LOVE TO HEAR FROM YOU!", `Your order has been ${canonicalSt === "Order Picked Up" ? "collected" : "delivered"}! We hope you loved your purchase.`, "Help us improve by sharing your experience.", "SHARE YOUR FEEDBACK: " + order._feedbackLink);
    const divider = "─".repeat(40);
    const boldDivider = "━".repeat(40);

    if (canonicalSt === "Order Dispatched") {
      introLines = ["Your order has been dispatched and is on the way!", "", "Your package has been handed over to our delivery partner and is en route to your address."];
      if (trackingLink) introLines.push(`Tracking URL: ${trackingLink}`);
      if (estimatedDelivery) introLines.push(`Estimated Delivery: ${estimatedDelivery}`);
    } else if (canonicalSt === "Out For Delivery") {
      introLines = ["Your order is out for delivery!", "", "Your package is with the courier and is expected to reach you soon. Please keep your phone available for the delivery."];
      if (trackingLink) introLines.push(`Tracking URL: ${trackingLink}`);
    }

    const lines = [
      `Dear ${firstName},`,
      "",
      ...introLines,
      "",
      boldDivider,
      ` ${toBold("ORDER SUMMARY")}`,
      boldDivider,
      `Order ID:         ${displayId}`,
      `Current Status:   ${canonicalSt}`,
      `Order Date:       ${placedOn}`
    ];

    if (paymentStatus || paymentMode) {
      lines.push(`Payment:          ${[paymentStatus, paymentMode].filter(Boolean).join(" · ")}`);
    }
    if (estimatedDelivery && canonicalSt !== "Shipped") {
      lines.push(`Est. Delivery:    ${estimatedDelivery}`);
    }
    if (trackingLink && canonicalSt !== "Shipped") {
      lines.push(`Tracking URL:     ${trackingLink}`);
    }

    if (items.length) {
      lines.push(
        "",
        boldDivider,
        ` ${toBold("ITEMS ORDERED")}`,
        boldDivider
      );
      items.forEach((it, idx) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const lineTotal = (Number(it.price) || 0) * qty;
        lines.push(`${idx + 1}. ${it.productName || "Product"} × ${qty} (${fmt(lineTotal)})`);
        const specs = [
          it.colour && `Colour: ${it.colour}`,
          it.size && `Size: ${it.size}`
        ].filter(Boolean).join(" | ");
        if (specs) lines.push(`   ${specs}`);
        if (it.customization) lines.push(`   Customization: ${it.customization}`);
        if (idx < items.length - 1) lines.push("");
      });

      lines.push(
        "",
        divider,
        `Item Subtotal:    ${fmt(itemsSubtotal)}`
      );
      if (deliveryCharge > 0) lines.push(`Delivery Charge:  ${fmt(deliveryCharge)}`);
      if (discount > 0) lines.push(`Discount:        -${fmt(discount)}`);
      lines.push(
        `Total Amount:     ${fmt(total)}`,
        divider
      );
    } else {
      lines.push(
        "",
        divider,
        `Total Amount:     ${fmt(total)}`,
        divider
      );
    }

    const address = isPickup ? (order.pickup_location || "Store Pickup") : (order.address || "");
    if (address) {
      lines.push(
        "",
        boldDivider,
        ` ${toBold(isPickup ? "PICKUP LOCATION" : "DELIVERY ADDRESS")}`,
        boldDivider,
        address
      );
    }

    if (order.order_note) {
      lines.push(
        "",
        boldDivider,
        ` ${toBold("CUSTOMER NOTE")}`,
        boldDivider,
        order.order_note
      );
    }

    lines.push(
      "",
      boldDivider,
      "",
      "If you have any questions or need to make any changes, please reply directly to this email.",
      "",
      "Warm regards,",
      "Customer Support Team",
      "Creative Souls 3D",
      "Email: hello.creative.souls3d@gmail.com",
      "Instagram: @creative.souls3d"
    );

    return lines.join("\n");
  }

  async function copyStyledHtmlToClipboard(html, plainText) {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([html], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "text/plain": textBlob
          })
        ]);
        return true;
      }
    } catch (err) {
      console.warn("Clipboard rich copy failed, falling back to text:", err);
    }
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(plainText);
        return false;
      }
    } catch {}
    return false;
  }

  function openOrderNotificationPreview(order) {
    const to = String(order.email || "").trim();
    if (!to || !to.includes("@")) {
      window.showAdminToast?.("This order has no valid customer email address.", "danger");
      return;
    }
    const dialog = byId("email-preview-dialog");
    if (!dialog) {
      const subject = orderEmailSubject(order);
      const plain = buildOrderNotificationPlainText(order);
      openGmailCompose({ to, subject, body: plain });
      return;
    }

    const subject = orderEmailSubject(order);
    const html = buildOrderNotificationEmailBody(order);
    const plain = buildOrderNotificationPlainText(order);

    const toEl = byId("email-preview-to");
    const subEl = byId("email-preview-subject");
    const frameEl = byId("email-preview-frame");
    const titleEl = byId("email-preview-title");

    const cleanId = String(order.order_id || "").trim().replace(/^#+/, "");
    if (titleEl) titleEl.textContent = `Customer Email: ${cleanId ? '#' + cleanId : 'Order'} (${canonicalOrderStatus(order.status, order.fulfillment_type)})`;
    if (toEl) toEl.textContent = to;
    if (subEl) subEl.textContent = subject;
    if (frameEl) frameEl.srcdoc = html;

    const copyBtn = byId("email-preview-copy-btn");
    if (copyBtn) {
      copyBtn.onclick = async () => {
        copyBtn.disabled = true;
        const success = await copyStyledHtmlToClipboard(html, plain);
        window.showAdminToast?.(success ? "Styled brand HTML copied to clipboard!" : "Plain text copied to clipboard.", "success");
        setTimeout(() => { copyBtn.disabled = false; }, 800);
      };
    }

    const gmailBtn = byId("email-preview-gmail-btn");
    if (gmailBtn) {
      gmailBtn.onclick = async () => {
        gmailBtn.disabled = true;
        gmailBtn.textContent = "Opening Gmail…";
        try {
          await copyStyledHtmlToClipboard(html, plain);
          await openGmailCompose({ to, subject, body: plain });
          dialog.close();
          window.showAdminToast?.("Gmail opened! Styled brand template copied — press Ctrl+V in Gmail to paste.", "success");
          try {
            const orderDocId = order._docId || order.order_id;
            if (orderDocId) {
              const docMatch = orderDocuments.find(d => d.id === orderDocId || d.data().order_id === order.order_id);
              if (docMatch) {
                await db.collection("orders").doc(docMatch.id).update({
                  last_notified_at: firebase.firestore.FieldValue.serverTimestamp(),
                  last_notified_status: order.status || "Order Placed"
                });
              }
            }
          } catch (e) {
            console.warn("Could not log notification timestamp:", e);
          }
        } finally {
          gmailBtn.disabled = false;
          gmailBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> <span>Open in Gmail (Copy &amp; Paste)</span>`;
        }
      };
    }

    const frameWrap = byId("email-preview-frame-wrap");
    if (frameWrap) frameWrap.style.background = "#f1f5f9";

    const closeBtn = byId("email-preview-close");
    if (closeBtn) closeBtn.onclick = () => dialog.close();
    const cancelBtn = byId("email-preview-cancel");
    if (cancelBtn) cancelBtn.onclick = () => dialog.close();

    dialog.showModal();
  }

  async function sendOrderNotificationEmail(order) {
    const prepared = { ...order };
    const canSt = canonicalOrderStatus(prepared.status, prepared.fulfillment_type);
    if (canSt === "Product Delivered" || canSt === "Order Picked Up") {
      try {
        const workerUrl = window.PRODUCT_MARKETING_WORKER_URL;
        if (!workerUrl) throw new Error("Set the Cloudflare Worker URL in cloudflare-worker-config.js, then reload this page.");
        const user = auth.currentUser;
        if (!user) throw new Error("Sign in as an administrator, then try again.");
        const token = await user.getIdToken();
        const docId = prepared._docId || orderDocuments.find(doc => doc.data().order_id === prepared.order_id)?.id || prepared.order_id;
        const response = await fetch(`${workerUrl.replace(/\/+$/, "")}/feedback/issue-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ orderDocId: docId })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Could not issue feedback token (HTTP ${response.status}).`);
        prepared._feedbackToken = result.token;
        prepared._feedbackLink = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}feedback.html?id=${encodeURIComponent(String(result.orderId).replace(/^#/, ""))}&token=${encodeURIComponent(result.token)}`;
      } catch (error) {
        console.error("Could not create a secure feedback link:", error);
        window.showAdminToast?.(`Could not create a secure feedback link: ${error.message || error}`, "danger");
        return;
      }
    }
    openOrderNotificationPreview(prepared);
  }

  let customerFeedbackRecords = [];
  let feedbackFilterValue = "all";
  const normalizeFeedbackTimestamp = ts => {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate().toISOString();
    if (typeof ts === "string") return ts;
    if (typeof ts === "number") return new Date(ts).toISOString();
    if (ts.seconds !== undefined) return new Date(ts.seconds * 1000).toISOString();
    if (ts._seconds !== undefined) return new Date(ts._seconds * 1000).toISOString();
    return null;
  };
  const feedbackRating = (record, key) => {
    if (key === "overall_satisfaction") {
      return Number(record.overall_satisfaction ?? record.ratings?.overall_satisfaction ?? record.rating ?? 0);
    }
    return Number(record[key] ?? record.ratings?.[key] ?? 0);
  };
  const isNegativeFeedback = record => {
    const score = feedbackRating(record, "overall_satisfaction");
    if (score > 0 && score <= 2) return true;
    return ["printing_quality", "colour_quality", "delivery_rating", "timing_rating", "support_rating"].some(key => {
      const s = feedbackRating(record, key);
      return s > 0 && s <= 2;
    });
  };
  const averageFeedback = (records, keys) => {
    const values = records.flatMap(record => keys.map(key => feedbackRating(record, key))).filter(value => value > 0);
    return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : "—";
  };
  function updateFeedbackBadge() {
    const badge = byId("nav-feedback-badge");
    if (!badge) return;
    const count = customerFeedbackRecords.length;
    badge.textContent = count;
    badge.style.display = count > 0 ? "inline-flex" : "none";
  }
  async function loadCustomerFeedback() {
    const label = byId("feedback-count-label");
    label?.classList.remove("is-error");
    if (label) label.textContent = "Loading feedback…";
    try {
      // Primary: direct Firestore read (fast, reliable, matches loadOrders/loadTickets)
      const snap = await db.collection("feedback").limit(1000).get();
      customerFeedbackRecords = snap.docs.map(doc => {
        const data = doc.data();
        const ts = data.created_at ?? data.submitted_at;
        return {
          id: doc.id,
          ...data,
          created_at: normalizeFeedbackTimestamp(ts),
          acknowledged_at: normalizeFeedbackTimestamp(data.acknowledged_at),
        };
      }).sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
      renderCustomerFeedback();
    } catch (firestoreError) {
      console.warn("Direct Firestore read failed, falling back to Cloudflare Worker /feedback/list:", firestoreError);
      try {
        const workerUrl = window.PRODUCT_MARKETING_WORKER_URL;
        if (!workerUrl) throw new Error("Cloudflare Worker URL is not configured.");
        const user = auth.currentUser;
        if (!user) throw new Error("Sign in as an administrator, then try again.");
        const idToken = await user.getIdToken();
        const workerResponse = await fetch(`${workerUrl.replace(/\/+$/, "")}/feedback/list`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
          body: JSON.stringify({})
        });
        const result = await workerResponse.json().catch(() => ({}));
        if (!workerResponse.ok) throw new Error(result.error || `Feedback list failed (HTTP ${workerResponse.status}).`);
        const response = { data: result };
        customerFeedbackRecords = (response.data.feedback || []).map(data => {
          const ts = data.created_at ?? data.submitted_at;
          return {
            ...data,
            created_at: normalizeFeedbackTimestamp(ts),
            acknowledged_at: normalizeFeedbackTimestamp(data.acknowledged_at),
          };
        }).sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        renderCustomerFeedback();
      } catch (cloudFnError) {
        console.error("Could not load customer feedback:", firestoreError, cloudFnError);
        if (label) {
          const code = firestoreError?.code || cloudFnError?.code || "unknown";
          const reason = code.includes("permission-denied") || code.includes("unauthenticated")
            ? "Your admin session cannot access feedback. Sign in with an authorized admin account."
            : code.includes("not-found")
              ? "The feedback collection is empty or not found."
              : `Feedback could not be loaded (${code}). Check the browser console for details, then refresh.`;
          label.textContent = reason;
          label.classList.add("is-error");
        }
      }
    }
  }
  function renderCustomerFeedback() {
    const records = customerFeedbackRecords;
    const negative = records.filter(isNegativeFeedback);

    // ── Metric cards ─────────────────────────────────────────────────────
    const metrics = byId("feedback-metrics");
    if (metrics) {
      const avg = key => averageFeedback(records, [key]);
      const metricItems = [
        { label: "Total Responses", value: records.length, icon: "💬", color: "blue" },
        { label: "Overall Rating", value: averageFeedback(records, ["overall_satisfaction"]) + " / 5", icon: "⭐", color: "amber" },
        { label: "Print Quality", value: averageFeedback(records, ["printing_quality", "colour_quality"]) + " / 5", icon: "🎨", color: "purple" },
        { label: "Delivery Rating", value: avg("delivery_rating") + " / 5", icon: "🚚", color: "green" },
        { label: "Support Rating", value: avg("support_rating") + " / 5", icon: "🤝", color: "blue" },
        { label: "Flagged Low Ratings", value: negative.length, icon: "⚠️", color: negative.length ? "red" : "green" },
      ];
      metricItems.splice(1, 0, { label: "Timing Rating", value: avg("timing_rating") + " / 5", icon: "Timing", color: "amber" });
      metrics.innerHTML = metricItems.map(({ label, value, icon, color }) => `
        <article class="admin-stat-card ${color}">
          <div class="admin-stat-card-top">
            <div class="admin-stat-icon" style="font-size:1.2rem">${icon}</div>
          </div>
          <div>
            <div class="admin-stat-label">${label}</div>
            <div class="admin-stat-value">${value}</div>
          </div>
        </article>`).join("");
    }

    // ── Rating distribution bar ──────────────────────────────────────────
    const distEl = byId("feedback-rating-dist");
    if (distEl && records.length) {
      const dist = [5, 4, 3, 2, 1].map(star => ({
        star,
        count: records.filter(r => feedbackRating(r, "overall_satisfaction") === star).length,
      }));
      const maxCount = Math.max(...dist.map(d => d.count), 1);
      distEl.hidden = false;
      distEl.innerHTML = `
        <div style="font-family:var(--font-display);font-size:0.95rem;font-weight:700;color:var(--text-1);margin-bottom:14px;">Rating Distribution</div>
        <div class="fb-dist-rows">
          ${dist.map(({ star, count }) => `
            <div class="fb-dist-row">
              <span class="fb-dist-label">${star} ★</span>
              <div class="fb-dist-track">
                <div class="fb-dist-bar fb-dist-bar-${star}" style="width:${Math.round((count / maxCount) * 100)}%"></div>
              </div>
              <span class="fb-dist-count">${count}</span>
            </div>`).join("")}
        </div>`;
    } else if (distEl) {
      distEl.hidden = true;
    }

    // ── Filter & search ──────────────────────────────────────────────────
    const query = String(byId("feedback-search")?.value || "").trim().toLowerCase();
    const filter = feedbackFilterValue || "all";
    const visible = records.filter(record => {
      if (filter === "negative" && !isNegativeFeedback(record)) return false;
      if (["5", "4", "3", "2", "1"].includes(filter) && feedbackRating(record, "overall_satisfaction") !== Number(filter)) return false;
      const searchable = Object.values(record).map(value => value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "")).join(" ").toLowerCase();
      return !query || searchable.includes(query);
    });

    // ── Count label ──────────────────────────────────────────────────────
    const countEl = byId("feedback-count-label");
    if (countEl) countEl.textContent = `${visible.length} response${visible.length === 1 ? "" : "s"}${negative.length ? ` · ${negative.length} flagged` : ""}`;

    // ── Card list ────────────────────────────────────────────────────────
    const list = byId("feedback-list");
    if (countEl) countEl.textContent = `Showing ${visible.length} of ${records.length} responses${negative.length ? ` · ${negative.length} flagged for follow-up` : ""}`;
    if (!list) return;
    list.replaceChildren();

    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "admin-empty-state";
      empty.innerHTML = `<div><div style="font-size:2.5rem;margin-bottom:12px">${records.length ? "🔍" : "💬"}</div><strong>${records.length ? "No feedback matches your search or filter." : "No customer feedback yet."}</strong><span>${records.length ? "Try clearing the search or switching filters." : "Feedback will appear here once customers submit their post-purchase reviews."}</span></div>`;
      list.append(empty);
      return;
    }

    // Rating field pairs to display
    const ratingPairs = [
      ["Overall satisfaction", "overall_satisfaction"],
      ["Printing quality", "printing_quality"],
      ["Colour / painting", "colour_quality"],
      ["Packaging", "packaging_quality"],
      ["Delivery rating", "delivery_rating"],
      ["Timing", "timing_rating"],
      ["Support", "support_rating"],
    ];
    const textPairs = [
      ["Customer Review", "review"],
      ["Comments", "comments"],
      ["Ordered easily", "ordering_ease"],
      ["Matched images", "matched_images"],
      ["Arrived without defects", "arrived_without_defects"],
      ["Arrived safely", "arrived_safely"],
      ["Within estimate", "within_estimate"],
      ["Questions answered", "questions_answered"],
      ["Notifications helpful", "notifications_helpful"],
      ["Website navigation", "website_navigation"],
      ["Product information", "product_information"],
      ["Checkout experience", "checkout_experience"],
      ["Would purchase again", "purchase_again"],
      ["Recommend score (NPS)", "recommendation_nps"],
      ["Product liked", "product_liked"],
      ["Improvements", "improvements"],
      ["Product ideas", "product_ideas"],
    ];
    const boolPairs = [
      ["Damage reported", "damage_reported", "Damage details", "damage_details"],
      ["Poor quality reported", "poor_quality_reported", "Quality details", "quality_details"],
      ["Delivery delayed", "delivery_delayed", "Delay details", "delay_details"],
    ];

    function starBar(score, max = 5) {
      if (!score) return "<span style='color:var(--text-4);font-size:0.78rem'>—</span>";
      const pct = Math.round((score / max) * 100);
      const color = score >= 4 ? "#10b981" : score === 3 ? "#f59e0b" : "#ef4444";
      return `<div class="fb-star-bar"><div class="fb-star-fill" style="width:${pct}%;background:${color}"></div></div><span class="fb-star-label" style="color:${color}">${score}/${max}</span>`;
    }

    visible.forEach(record => {
      const isNeg = isNegativeFeedback(record);
      const overallScore = feedbackRating(record, "overall_satisfaction");
      const dateStr = record.created_at ? new Date(record.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date unavailable";
      const refId = record.reference_id || record.id || "—";

      const card = document.createElement("details");
      card.className = `fb-card${isNeg ? " fb-card--flagged" : ""}`;

      // ── Summary (collapsed header) ───────────────────────────────────
      const summary = document.createElement("summary");
      summary.className = "fb-card-summary";
      summary.innerHTML = `
        <div class="fb-card-summary-left">
          ${isNeg ? `<span class="fb-flag-badge">⚠️ Flagged</span>` : ""}
          ${record.acknowledged_at ? `<span class="fb-ack-badge">✓ Acknowledged</span>` : ""}
          <div class="fb-card-meta">
            <span class="fb-order-pill">${escapeHtml(record.order_id || record.id || "—")}</span>
            <strong class="fb-customer-name">${escapeHtml(record.name || "Customer")}</strong>
            <span class="fb-customer-email">${escapeHtml(record.email || "")}</span>
          </div>
        </div>
        <div class="fb-card-summary-right">
          <div class="fb-overall-score">
            <span class="fb-score-num" style="color:${overallScore >= 4 ? "#059669" : overallScore === 3 ? "#d97706" : "#dc2626"}">${overallScore || "—"}</span>
            <span class="fb-score-denom">/5</span>
            <div class="fb-stars">${[1,2,3,4,5].map(s => `<span style="color:${s <= overallScore ? "#f59e0b" : "#e2e8f0"}">★</span>`).join("")}</div>
          </div>
          <span class="fb-date">${dateStr}</span>
          <svg class="fb-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>`;
      card.append(summary);

      // ── Body (expanded) ──────────────────────────────────────────────
      const body = document.createElement("div");
      body.className = "fb-card-body";

      // Reference + contact row
      const meta = document.createElement("div");
      meta.className = "fb-body-meta";
      meta.innerHTML = `
        <div class="fb-meta-chip"><span>Ref</span><strong>${escapeHtml(refId)}</strong></div>
        <div class="fb-meta-chip"><span>Email</span><strong>${escapeHtml(record.email || "—")}</strong></div>
        ${record.phone ? `<div class="fb-meta-chip"><span>Phone</span><strong>${escapeHtml(record.phone)}</strong></div>` : ""}
        ${record.order_total ? `<div class="fb-meta-chip"><span>Total</span><strong>₹${Number(record.order_total).toLocaleString("en-IN")}</strong></div>` : ""}
        <div class="fb-meta-chip"><span>Submitted</span><strong>${escapeHtml(dateStr)}</strong></div>
        ${record.acknowledged_at ? `<div class="fb-meta-chip"><span>Acknowledged</span><strong style="color:#059669;">${escapeHtml(new Date(record.acknowledged_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))}</strong></div>` : ""}
        ${record.contact_permission !== undefined ? `<div class="fb-meta-chip"><span>Contact OK</span><strong>${escapeHtml(record.contact_permission)}</strong></div>` : ""}`;
      body.append(meta);

      // Categories (from feedback form)
      if (Array.isArray(record.categories) && record.categories.length) {
        const catSection = document.createElement("div");
        catSection.className = "fb-section";
        catSection.innerHTML = `<div class="fb-section-title">Categories</div><div class="fb-category-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">${record.categories.map(cat => `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background:rgba(245,158,11,0.12);color:var(--brand-dark,#b45309);border:1px solid rgba(245,158,11,0.3);font-size:0.78rem;font-weight:700;">${escapeHtml(cat)}</span>`).join("")}</div>`;
        body.append(catSection);
      }

      // Ratings grid
      const hasRatings = ratingPairs.some(([, key]) => feedbackRating(record, key) > 0);
      if (hasRatings) {
        const ratingsSection = document.createElement("div");
        ratingsSection.className = "fb-section";
        ratingsSection.innerHTML = `<div class="fb-section-title">Ratings</div>`;
        const grid = document.createElement("div");
        grid.className = "fb-ratings-grid";
        ratingPairs.forEach(([label, key]) => {
          const score = feedbackRating(record, key);
          if (!score) return;
          const cell = document.createElement("div");
          cell.className = "fb-rating-cell";
          cell.innerHTML = `<div class="fb-rating-label">${label}</div><div class="fb-rating-bar-wrap">${starBar(score)}</div>`;
          grid.append(cell);
        });
        ratingsSection.append(grid);
        body.append(ratingsSection);
      }

      // Boolean flags (damage, quality, delay)
      const hasBoolFlags = boolPairs.some(([, key]) => record[key]);
      if (hasBoolFlags) {
        const flagSection = document.createElement("div");
        flagSection.className = "fb-section";
        flagSection.innerHTML = `<div class="fb-section-title">Reported Issues</div>`;
        const flagGrid = document.createElement("div");
        flagGrid.className = "fb-flag-grid";
        boolPairs.forEach(([boolLabel, boolKey, detailLabel, detailKey]) => {
          if (!record[boolKey]) return;
          const chip = document.createElement("div");
          chip.className = "fb-issue-chip";
          chip.innerHTML = `<span class="fb-issue-icon">⚠️</span><div><strong>${boolLabel}</strong>${record[detailKey] ? `<p>${record[detailKey]}</p>` : ""}</div>`;
          const issueIcon = document.createElement("span");
          issueIcon.className = "fb-issue-icon";
          issueIcon.textContent = "⚠️";
          const issueText = document.createElement("div");
          const issueTitle = document.createElement("strong");
          issueTitle.textContent = boolLabel;
          issueText.append(issueTitle);
          if (record[detailKey]) {
            const issueDetail = document.createElement("p");
            issueDetail.textContent = record[detailKey];
            issueText.append(issueDetail);
          }
          chip.replaceChildren(issueIcon, issueText);
          flagGrid.append(chip);
        });
        flagSection.append(flagGrid);
        body.append(flagSection);
      }

      // Text answers
      const hasText = textPairs.some(([, key]) => record[key] !== undefined && record[key] !== "");
      if (hasText) {
        const textSection = document.createElement("div");
        textSection.className = "fb-section";
        textSection.innerHTML = `<div class="fb-section-title">Written Answers</div>`;
        const textGrid = document.createElement("div");
        textGrid.className = "fb-text-grid";
        textPairs.forEach(([label, key]) => {
          const value = record[key];
          if (value === undefined || value === "") return;
          const cell = document.createElement("div");
          cell.className = "fb-text-cell";
          cell.innerHTML = `<div class="fb-text-label">${escapeHtml(label)}</div><div class="fb-text-value">${escapeHtml(value)}</div>`;
          textGrid.append(cell);
        });
        textSection.append(textGrid);
        body.append(textSection);
      }

      // Attachments
      const attachments = Array.isArray(record.attachments) ? record.attachments : [];
      if (attachments.length) {
        const attSection = document.createElement("div");
        attSection.className = "fb-section";
        attSection.innerHTML = `<div class="fb-section-title">Photos</div>`;
        const attGrid = document.createElement("div");
        attGrid.className = "fb-attachments";
        attachments.forEach((item, attIdx) => {
          const figure = document.createElement("figure");
          figure.className = "fb-attachment";
          let mediaUrl = "";
          try { const parsed = new URL(String(item.url || "")); if (parsed.protocol === "https:") mediaUrl = parsed.href; } catch {}
          if (!mediaUrl) return;
          const mediaName = escapeHtml(item.name || "Photo");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "admin-order-final-image-thumb-btn";
          btn.title = "Click to view full photo";
          btn.setAttribute("aria-label", `View ${mediaName}`);
          btn.innerHTML = `<img src="${escapeHtml(mediaUrl)}" alt="${mediaName}" loading="lazy" />`;
          btn.addEventListener("click", () => openAdminPhotoViewer(attachments, attIdx, `Feedback Photo - ${record.reference_id || record.order_id || ""}`));
          const caption = document.createElement("figcaption");
          caption.textContent = item.name || "View photo";
          figure.append(btn, caption);
          attGrid.append(figure);
        });
        attSection.append(attGrid);
        body.append(attSection);
      }

      // Actions: Notify Customer (Acknowledge) & Delete
      const actions = document.createElement("div");
      actions.className = "fb-card-actions";

      const notifyBtn = document.createElement("button");
      notifyBtn.type = "button";
      notifyBtn.className = "fb-btn-notify";
      notifyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> <span>${record.acknowledged_at ? "Re-notify Customer" : "Notify Customer"}</span>`;
      notifyBtn.title = "Send an acknowledgment email to this customer";
      notifyBtn.addEventListener("click", e => {
        e.stopPropagation();
        notifyCustomerFeedbackAcknowledged(record, notifyBtn);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "fb-btn-delete";
      deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg> <span>Delete Feedback</span>`;
      deleteBtn.title = "Permanently delete this customer feedback";
      deleteBtn.addEventListener("click", e => {
        e.stopPropagation();
        deleteCustomerFeedback(record, deleteBtn);
      });

      actions.append(notifyBtn, deleteBtn);
      body.append(actions);

      card.append(body);
      list.append(card);
    });
    updateFeedbackBadge();
  }

  async function deleteCustomerFeedback(record, buttonEl) {
    const orderDisplay = record.order_id || record.id || "this order";
    const confirmed = window.confirm(`Are you sure you want to permanently delete feedback for order ${orderDisplay}? This action cannot be undone.`);
    if (!confirmed) return;

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Deleting…";
    }

    try {
      await db.collection("feedback").doc(record.id).delete();
      customerFeedbackRecords = customerFeedbackRecords.filter(r => r.id !== record.id);
      renderCustomerFeedback();
      updateFeedbackBadge();
      window.showAdminToast?.(`Feedback for order ${orderDisplay} deleted successfully.`, "success");
    } catch (error) {
      console.error("Could not delete feedback:", error);
      window.showAdminToast?.(`Failed to delete feedback: ${error.message || error}`, "danger");
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg> <span>Delete Feedback</span>`;
      }
    }
  }

  async function notifyCustomerFeedbackAcknowledged(record, buttonEl) {
    const recipientEmail = String(record.email || "").trim();
    if (!recipientEmail) {
      window.showAdminToast?.("This feedback record has no customer email address to notify.", "danger");
      return;
    }

    const customerName = String(record.name || "Customer").trim();
    const rawId = String(record.order_id || "").trim().replace(/^#+/, "");
    const orderDisplay = rawId ? `#${rawId}` : "your order";
    const ratingScore = feedbackRating(record, "overall_satisfaction");
    const reviewText = String(record.review || record.comments || "").trim();
    const ratingStars = ratingScore ? "★".repeat(ratingScore) + "☆".repeat(Math.max(0, 5 - ratingScore)) : "";

    const subject = `Feedback Acknowledged for Order ${orderDisplay} — Creative Souls 3D`;

    const plainText = [
      `Dear ${customerName},`,
      "",
      `Thank you so much for taking the time to share your feedback with Creative Souls 3D regarding order ${orderDisplay}!`,
      "",
      `We have successfully received and reviewed your feedback${ratingScore ? ` (${ratingScore}/5 ⭐)` : ""}.`,
      reviewText ? `\nYour review:\n"${reviewText}"\n` : "",
      "Your ratings and suggestions directly guide our ongoing 3D printing craftsmanship, packaging standards, and customer care.",
      "",
      "If you ever need any assistance or have ideas for future custom 3D prints, feel free to reply directly to this email or reach out to us on Instagram @creative.souls3d.",
      "",
      "Warm regards,",
      "Creative Souls 3D Team",
      NOTIFY_EMAIL,
      "https://creativesouls3d.github.io"
    ].filter(line => line !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");

    const styledHtml = `
<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#111111;color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #333333;">
  <div style="background:#18181b;padding:24px;text-align:center;border-bottom:1px solid #27272a;">
    <h2 style="margin:0;color:#f59e0b;font-size:20px;letter-spacing:1px;font-weight:800;">CREATIVE SOULS 3D</h2>
    <p style="margin:6px 0 0;font-size:12px;color:#a1a1aa;letter-spacing:0.5px;">CUSTOMER FEEDBACK ACKNOWLEDGMENT</p>
  </div>
  <div style="padding:28px 24px;">
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#e4e4e7;">Dear <strong>${escapeHtml(customerName)}</strong>,</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#e4e4e7;">Thank you so much for taking the time to share your feedback for order <strong>${escapeHtml(orderDisplay)}</strong>!</p>
    <div style="background:#27272a;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:8px;margin:20px 0;">
      <div style="font-size:13px;color:#f59e0b;font-weight:700;margin-bottom:6px;">FEEDBACK ACKNOWLEDGED ${ratingStars ? `· ${ratingStars}` : ""}</div>
      ${reviewText ? `<p style="font-size:14px;color:#d4d4d8;font-style:italic;margin:0;line-height:1.5;">"${escapeHtml(reviewText)}"</p>` : `<p style="font-size:14px;color:#a1a1aa;margin:0;">Your feedback has been received and reviewed with appreciation.</p>`}
    </div>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#a1a1aa;">Your experience and suggestions directly help us refine our 3D printing precision, finishing, and customer care.</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#a1a1aa;">If there is anything more we can do for you or if you have custom printing projects in mind, simply reply to this email or connect with us on Instagram <strong>@creative.souls3d</strong>.</p>
    <div style="border-top:1px solid #27272a;padding-top:16px;font-size:13px;color:#71717a;">
      <p style="margin:0 0 4px;color:#e4e4e7;font-weight:600;">Creative Souls 3D</p>
      <p style="margin:0;color:#a1a1aa;">Precision 3D Printing &amp; Custom Gifts · <a href="mailto:${NOTIFY_EMAIL}" style="color:#f59e0b;text-decoration:none;">${NOTIFY_EMAIL}</a></p>
    </div>
  </div>
</div>`.trim();

    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Opening Gmail…";
    }

    try {
      await copyStyledHtmlToClipboard(styledHtml, plainText);
      await openGmailCompose({
        to: recipientEmail,
        subject,
        body: plainText
      });

      const nowIso = new Date().toISOString();
      try {
        await db.collection("feedback").doc(record.id).update({
          acknowledged_at: firebase.firestore.FieldValue.serverTimestamp(),
          acknowledged_by: auth.currentUser?.email || "admin"
        });
        record.acknowledged_at = nowIso;
        record.acknowledged_by = auth.currentUser?.email || "admin";
      } catch (dbErr) {
        console.warn("Could not mark feedback as acknowledged in Firestore:", dbErr);
      }

      window.showAdminToast?.("Gmail opened! Styled brand template copied to clipboard (press Ctrl+V).", "success");
      renderCustomerFeedback();
    } catch (err) {
      console.error("Error sending feedback notification:", err);
      window.showAdminToast?.("Failed to open Gmail: " + (err.message || err), "danger");
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> <span>Notify Customer</span>`;
      }
    }
  }

  function exportCustomerFeedback() {
    const columns = ["reference_id", "order_id", "name", "email", "phone", "rating", "review", "categories", "acknowledged_at", "acknowledged_by", "created_at", "overall_satisfaction", "ordering_ease", "recommendation_nps", "printing_quality", "colour_quality", "matched_images", "arrived_without_defects", "damage_reported", "damage_details", "poor_quality_reported", "quality_details", "product_liked", "packaging_quality", "arrived_safely", "delivery_rating", "timing_rating", "within_estimate", "delivery_delayed", "delay_details", "support_rating", "questions_answered", "notifications_helpful", "website_navigation", "product_information", "checkout_experience", "improvements", "product_ideas", "purchase_again", "comments", "contact_permission", "attachments"];
    const csvCell = value => `"${String(value && typeof value === "object" ? JSON.stringify(value) : value ?? "").replaceAll('"', '""')}"`;
    const csv = [columns.map(csvCell).join(","), ...customerFeedbackRecords.map(record => columns.map(key => csvCell(record[key])).join(","))].join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = "creative-souls-customer-feedback.csv"; link.click(); URL.revokeObjectURL(link.href);
  }
  // ── Feedback filter pills ────────────────────────────────────────────
  feedbackFilterValue = "all";
  byId("feedback-filter-pills")?.querySelectorAll("[data-fb-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      byId("feedback-filter-pills").querySelectorAll(".admin-filter-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      feedbackFilterValue = btn.dataset.fbFilter;
      renderCustomerFeedback();
    });
  });
  byId("feedback-search")?.addEventListener("input", renderCustomerFeedback);
  byId("feedback-refresh")?.addEventListener("click", loadCustomerFeedback);
  byId("feedback-export")?.addEventListener("click", exportCustomerFeedback);

  function visibleTickets() {
    const query = String(byId("ticket-search")?.value || "").trim().toLowerCase();
    return ticketDocuments.filter(doc => {
      const ticket = doc.data();
      const status = canonicalTicketStatus(ticket.status);
      if (ticketFilter !== "all" && status.toLowerCase() !== ticketFilter) return false;
      if (!query) return true;
      const haystack = [
        ticket.ticket_id, doc.id, ticket.order_id, ticket.name, ticket.email, ticket.phone, ticket.issue,
        ...(ticket.products || []).map(item => item.productName)
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }
  function updateTicketBadges() {
    const openCount = ticketDocuments.filter(doc => canonicalTicketStatus(doc.data().status) === "Open").length;
    ["nav-tickets-badge", "bnav-tickets-badge"].forEach(id => {
      const badge = byId(id);
      if (!badge) return;
      badge.textContent = String(openCount);
      badge.hidden = openCount === 0;
    });
  }
  function renderDashboardOpenTickets() {
    const container = byId("dashboard-open-tickets");
    if (!container) return;
    container.replaceChildren();
    const openDocs = ticketDocuments.filter(doc => canonicalTicketStatus(doc.data().status) === "Open");
    if (!openDocs.length) {
      container.innerHTML = '<p class="admin-helper" style="padding:16px 0; color:var(--text-3); text-align:center;">No open support tickets.</p>';
      return;
    }
    const table = document.createElement("table");
    table.className = "admin-recent-orders-table";
    table.innerHTML = "<thead><tr><th>Ticket</th><th>Customer</th><th>Order</th><th>Date</th><th></th></tr></thead><tbody></tbody>";
    const tbody = table.querySelector("tbody");
    openDocs.slice(0, 5).forEach(doc => {
      const ticket = doc.data();
      const tr = document.createElement("tr");
      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "btn-table-action btn-secondary";
      openBtn.style.cssText = "height:28px!important; padding:0 10px!important;";
      openBtn.textContent = "Open";
      openBtn.addEventListener("click", () => showTicketDetails(doc.id, ticket));
      tr.innerHTML = `<td><strong>${escapeHtml(ticket.ticket_id || doc.id)}</strong></td><td>${escapeHtml(ticket.name || ticket.email || "Customer")}</td><td>${escapeHtml(ticket.order_id || "—")}</td><td style="color:var(--text-3); font-size:0.75rem;">${escapeHtml(ticketDate(ticket.created_at))}</td><td></td>`;
      tr.lastElementChild.append(openBtn);
      tbody.append(tr);
    });
    container.append(table);
  }
  function renderTickets() {
    const container = byId("tickets-list");
    const label = byId("ticket-count-label");
    if (!container) return;
    const docs = visibleTickets();
    if (label) label.textContent = `${docs.length} ticket${docs.length === 1 ? "" : "s"} shown · ${ticketDocuments.length} total`;
    container.replaceChildren();
    if (!docs.length) {
      const empty = document.createElement("div");
      empty.className = "admin-empty-state";
      empty.innerHTML = "<div><strong>No tickets in this view</strong><span>New customer issues will appear here.</span></div>";
      container.append(empty);
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "admin-table-wrap";
    const table = document.createElement("table");
    table.className = "admin-tickets-table";
    table.innerHTML = "<thead><tr><th>Ticket</th><th>Customer</th><th>Order</th><th>Issue</th><th>Status</th><th>Actions</th></tr></thead>";
    const body = document.createElement("tbody");
    docs.forEach(doc => {
      const ticket = doc.data();
      const status = canonicalTicketStatus(ticket.status);
      const row = document.createElement("tr");
      const issue = document.createElement("div");
      issue.className = "admin-ticket-issue";
      issue.textContent = ticket.issue || "No description";
      row.innerHTML = `<td><strong>${ticket.ticket_id || doc.id}</strong><div style="color:var(--text-3);font-size:0.74rem;">${ticketDate(ticket.created_at)}</div></td><td><strong>${ticket.name || "Customer"}</strong><div style="color:var(--text-3);font-size:0.74rem;">${ticket.email || ""}</div></td><td>${ticket.order_id || "—"}</td><td></td><td><span class="admin-ticket-status status-${status.toLowerCase()}">${status}</span></td><td></td>`;
      row.children[3].append(issue);
      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "btn-table-action btn-secondary";
      openBtn.textContent = "Review & reply";
      openBtn.addEventListener("click", () => showTicketDetails(doc.id, ticket));
      row.lastElementChild.append(openBtn);
      body.append(row);
    });
    table.append(body);
    wrap.append(table);
    container.append(wrap);
  }
  function updateTicketEmailPreview() {
    const preview = byId("ticket-email-preview");
    if (!preview || !activeTicket) return;
    const typed = byId("ticket-reply-input")?.value || "";
    if (typed.trim()) preview.textContent = ticketReplyEmailBody(activeTicket.data, typed, selectedTicketReplyImages());
    else preview.textContent = "Type a reply to preview the Gmail message.";
  }
  const ticketMediaUploads = new WeakMap();
  function validateTicketMedia(files) {
    for (const file of files) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        throw new Error(`${file.name} is not a photo or video. Please choose image or video files.`);
      }
      if (file.size > IMAGEKIT_MAX_FILE_BYTES) {
        throw new Error(`${file.name} is larger than 25 MB. Please choose a smaller photo or video.`);
      }
    }
  }
  function renderTicketMediaSelection(input, preview) {
    preview.querySelectorAll("[data-preview-url]").forEach(item => URL.revokeObjectURL(item.dataset.previewUrl));
    preview.replaceChildren();
    const files = [...(input.files || [])];
    if (!files.length) {
      const empty = document.createElement("p");
      empty.className = "ticket-media-empty";
      empty.textContent = "Your selected photos and videos will appear here.";
      preview.append(empty);
      return;
    }
    files.forEach((file, index) => {
      const card = document.createElement("figure");
      card.className = "ticket-media-card";
      const visual = document.createElement(file.type.startsWith("video/") ? "video" : "img");
      visual.className = "ticket-media-thumb";
      visual.src = URL.createObjectURL(file);
      visual.dataset.previewUrl = visual.src;
      if (visual.tagName === "VIDEO") { visual.muted = true; visual.preload = "metadata"; }
      else visual.alt = file.name;
      const caption = document.createElement("figcaption");
      const name = document.createElement("span");
      name.className = "ticket-media-name";
      name.textContent = file.name;
      const size = document.createElement("small");
      size.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ticket-media-remove";
      remove.setAttribute("aria-label", `Remove ${file.name}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        const transfer = new DataTransfer();
        files.filter((_, fileIndex) => fileIndex !== index).forEach(selected => transfer.items.add(selected));
        input.files = transfer.files;
        renderTicketMediaSelection(input, preview);
      });
      caption.append(name, size);
      card.append(visual, caption, remove);
      preview.append(card);
    });
  }
  function setupTicketMediaPicker(input, preview, dropzone) {
    const update = () => renderTicketMediaSelection(input, preview);
    input.addEventListener("change", update);
    if (!dropzone) return;
    ["dragenter", "dragover"].forEach(type => dropzone.addEventListener(type, event => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    }));
    ["dragleave", "drop"].forEach(type => dropzone.addEventListener(type, event => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    }));
    dropzone.addEventListener("drop", event => {
      const transfer = new DataTransfer();
      [...(input.files || []), ...event.dataTransfer.files].forEach(file => transfer.items.add(file));
      input.files = transfer.files;
      update();
    });
  }
  async function uploadAdminTicketMedia(files, folderId, button) {
    validateTicketMedia(files);
    const folder = `${IMAGEKIT_FOLDER}/${String(folderId).replace(/^#/, "")}`;
    const attachments = [];
    for (let i = 0; i < files.length; i++) {
      button.textContent = `Uploading media ${i + 1} of ${files.length}…`;
      let uploads = ticketMediaUploads.get(files[i]);
      if (!uploads) {
        uploads = new Map();
        ticketMediaUploads.set(files[i], uploads);
      }
      // Reuse completed uploads when retrying after an upload or database failure.
      if (!uploads.has(folder)) uploads.set(folder, await uploadFileToImageKit(files[i], folder));
      attachments.push(uploads.get(folder));
    }
    return attachments;
  }
  async function addAdminTicketMedia() {
    if (!activeTicket) return;
    const currentTicket = activeTicket;
    const input = byId("ticket-media-input");
    const button = byId("ticket-media-save");
    const message = byId("ticket-media-status");
    if (button.disabled) return;
    const files = [...input.files];
    message.textContent = "";
    try {
      if (!files.length) throw new Error("Choose photos or videos to upload first.");
      validateTicketMedia(files);
      button.disabled = true;
      input.disabled = true;
      const attachments = await uploadAdminTicketMedia(files, currentTicket.data.order_id || currentTicket.id, button);
      button.textContent = "Saving media…";
      await db.collection("tickets").doc(currentTicket.id).update({
        attachments: firebase.firestore.FieldValue.arrayUnion(...attachments)
      });
      window.showAdminToast?.("Photos and videos saved to the ticket in ImageKit.", "success");
      await loadTickets();
      if (activeTicket === currentTicket && byId("ticket-detail-dialog").open) {
        const replyDraft = byId("ticket-reply-input")?.value || "";
        await showTicketDetails(currentTicket.id, currentTicket.data);
        byId("ticket-reply-input").value = replyDraft;
        updateTicketEmailPreview();
      }
    } catch (error) {
      message.textContent = errorText(error);
      console.error("Could not add ticket media:", error);
    } finally {
      button.disabled = false;
      input.disabled = false;
      button.textContent = "Upload to ticket";
    }
  }
  const ticketImageViewerState = { files: [], index: 0, image: null, zoom: 1, mode: "draw", marks: [], marksByImage: new Map(), undo: [], redo: [], undoByImage: new Map(), redoByImage: new Map(), selectedMarkIndex: -1, drawing: null, loadToken: 0 };
  const ticketImageCache = new Map();
  function cloneTicketImageMarks(marks) { return marks.map(mark => mark.type === "draw" ? { ...mark, points: mark.points.map(point => ({ ...point })) } : { ...mark }); }
  function cloneTicketImageHistory(history) { return history.map(snapshot => cloneTicketImageMarks(snapshot)); }
  function recordTicketImageEdit() {
    ticketImageViewerState.undo.push(cloneTicketImageMarks(ticketImageViewerState.marks));
    ticketImageViewerState.redo = [];
    updateTicketImageHistoryButtons();
  }
  function updateTicketImageHistoryButtons() {
    byId("ticket-image-undo").disabled = !ticketImageViewerState.undo.length;
    byId("ticket-image-redo").disabled = !ticketImageViewerState.redo.length;
  }
  function updateSelectedTicketText(mutator) {
    const mark = ticketImageViewerState.marks[ticketImageViewerState.selectedMarkIndex];
    if (!mark || mark.type !== "text" || mark.stamp) return false;
    recordTicketImageEdit();
    mutator(mark);
    redrawTicketImageCanvas();
    return true;
  }
  function redrawTicketImageCanvas() {
    const canvas = byId("ticket-image-canvas");
    const ctx = canvas?.getContext("2d");
    if (!ctx || !ticketImageViewerState.image) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(ticketImageViewerState.image, 0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ticketImageViewerState.marks.forEach(mark => {
      if (mark.type === "text") {
        const fontSize = Math.max(12, Math.round(canvas.width * (mark.sizeScale || .05)));
        ctx.font = `${mark.bold === false ? "normal" : "bold"} ${fontSize}px sans-serif`;
        ctx.lineWidth = Math.max(4, Math.round(canvas.width / 450));
        if (mark.stamp) {
          const width = ctx.measureText(mark.text).width;
          ctx.fillStyle = "rgba(17,24,39,.82)";
          ctx.fillRect(mark.x, mark.y - fontSize, width + fontSize * .7, fontSize * 1.6);
          ctx.fillStyle = "#fff";
          ctx.fillText(mark.text, mark.x + fontSize * .35, mark.y + fontSize * .15);
        } else if (mark.background) {
          const width = ctx.measureText(mark.text).width;
          const padding = fontSize * .25;
          ctx.fillStyle = "rgba(17,24,39,.82)";
          ctx.fillRect(mark.x - padding, mark.y - fontSize - padding, width + padding * 2, fontSize + padding * 2);
          ctx.fillStyle = mark.color || "#e11d48";
          ctx.fillText(mark.text, mark.x, mark.y);
        } else {
          ctx.strokeStyle = "#fff";
          ctx.fillStyle = mark.color || "#e11d48";
          ctx.strokeText(mark.text, mark.x, mark.y);
          ctx.fillText(mark.text, mark.x, mark.y);
        }
      } else {
        ctx.beginPath();
        mark.points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        ctx.strokeStyle = "#e11d48";
        ctx.lineWidth = Math.max(5, Math.round(canvas.width / 180));
        ctx.stroke();
      }
    });
  }
  function setTicketImageZoom(value) {
    ticketImageViewerState.zoom = Math.max(.5, Math.min(3, value));
    const canvas = byId("ticket-image-canvas");
    if (canvas) canvas.style.transform = `scale(${ticketImageViewerState.zoom})`;
    byId("ticket-image-zoom-label").textContent = `${Math.round(ticketImageViewerState.zoom * 100)}%`;
  }
  function showTicketImageAt(index) {
    if (!ticketImageViewerState.files.length) return;
    if (ticketImageViewerState.image) {
      ticketImageViewerState.marksByImage.set(ticketImageViewerState.index, cloneTicketImageMarks(ticketImageViewerState.marks));
      ticketImageViewerState.undoByImage.set(ticketImageViewerState.index, cloneTicketImageHistory(ticketImageViewerState.undo));
      ticketImageViewerState.redoByImage.set(ticketImageViewerState.index, cloneTicketImageHistory(ticketImageViewerState.redo));
    }
    ticketImageViewerState.index = (index + ticketImageViewerState.files.length) % ticketImageViewerState.files.length;
    const file = ticketImageViewerState.files[ticketImageViewerState.index];
    const canvas = byId("ticket-image-canvas");
    ticketImageViewerState.image = null;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
    const hideLoading = () => {
      const loadEl = byId("ticket-image-loading");
      if (loadEl) {
        loadEl.hidden = true;
        loadEl.style.display = "none";
        loadEl.classList.add("is-hidden");
      }
    };
    const showLoading = () => {
      const loadEl = byId("ticket-image-loading");
      if (loadEl) {
        loadEl.hidden = false;
        loadEl.style.display = "grid";
        loadEl.classList.remove("is-hidden");
      }
    };
    showLoading();
    const token = ++ticketImageViewerState.loadToken;
    byId("ticket-image-title").textContent = file.name || `Image ${ticketImageViewerState.index + 1}`;
    byId("ticket-image-counter").textContent = `${ticketImageViewerState.index + 1} / ${ticketImageViewerState.files.length}`;
    const hasMultiple = ticketImageViewerState.files.length > 1;
    const prevBtn = byId("ticket-image-prev");
    const nextBtn = byId("ticket-image-next");
    const stagePrevBtn = byId("ticket-image-stage-prev");
    const stageNextBtn = byId("ticket-image-stage-next");
    if (prevBtn) prevBtn.disabled = !hasMultiple;
    if (nextBtn) nextBtn.disabled = !hasMultiple;
    if (stagePrevBtn) stagePrevBtn.style.display = hasMultiple ? "flex" : "none";
    if (stageNextBtn) stageNextBtn.style.display = hasMultiple ? "flex" : "none";
    const drawLoadedImage = image => {
      if (token !== ticketImageViewerState.loadToken) return;
      ticketImageViewerState.image = image;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ticketImageViewerState.marks = ticketImageViewerState.marksByImage.get(ticketImageViewerState.index) || [];
      ticketImageViewerState.undo = ticketImageViewerState.undoByImage.get(ticketImageViewerState.index) || [];
      ticketImageViewerState.redo = ticketImageViewerState.redoByImage.get(ticketImageViewerState.index) || [];
      ticketImageViewerState.selectedMarkIndex = -1;
      byId("ticket-image-text-delete").disabled = true;
      updateTicketImageHistoryButtons();
      hideLoading();
      setTicketImageZoom(1);
      redrawTicketImageCanvas();
    };
    const tryFallbackLoad = () => {
      const fallback = new Image();
      ticketImageCache.set(file.url, fallback);
      fallback.onload = () => {
        if (token === ticketImageViewerState.loadToken) {
          hideLoading();
          drawLoadedImage(fallback);
        }
      };
      fallback.onerror = () => {
        ticketImageCache.delete(file.url);
        if (token === ticketImageViewerState.loadToken) {
          hideLoading();
          window.showAdminToast?.("This image could not be loaded.", "danger");
        }
      };
      fallback.src = file.url;
      if (fallback.complete && fallback.naturalWidth) {
        if (token === ticketImageViewerState.loadToken) {
          hideLoading();
          drawLoadedImage(fallback);
        }
      }
    };
    let image = ticketImageCache.get(file.url);
    if (image?.complete && image.naturalWidth) { drawLoadedImage(image); return; }
    showLoading();
    if (!image) {
      image = new Image();
      image.crossOrigin = "anonymous";
      ticketImageCache.set(file.url, image);
      image.onerror = () => {
        if (image.crossOrigin) {
          tryFallbackLoad();
          return;
        }
        ticketImageCache.delete(file.url);
        if (token === ticketImageViewerState.loadToken) {
          hideLoading();
          window.showAdminToast?.("This image could not be loaded.", "danger");
        }
      };
      image.onload = () => { if (token === ticketImageViewerState.loadToken) { hideLoading(); drawLoadedImage(image); } };
      image.src = file.url;
      if (image.complete && image.naturalWidth) {
        drawLoadedImage(image);
      }
    } else {
      image.addEventListener("load", () => { if (token === ticketImageViewerState.loadToken) { hideLoading(); drawLoadedImage(image); } }, { once: true });
      image.addEventListener("error", () => {
        if (image.crossOrigin) {
          tryFallbackLoad();
          return;
        }
        if (token === ticketImageViewerState.loadToken) {
          hideLoading();
          ticketImageCache.delete(file.url);
          window.showAdminToast?.("This image could not be loaded.", "danger");
        }
      }, { once: true });
      if (image.complete && image.naturalWidth) {
        drawLoadedImage(image);
      }
    }
    if (image.complete && !image.naturalWidth) {
      if (image.crossOrigin) {
        tryFallbackLoad();
      } else {
        ticketImageCache.delete(file.url);
        hideLoading();
        if (token === ticketImageViewerState.loadToken) window.showAdminToast?.("This image could not be loaded.", "danger");
      }
    }
  }
  function openTicketImageViewer(files, index) {
    ticketImageViewerState.files = files;
    ticketImageViewerState.mode = "draw";
    ticketImageViewerState.marks = [];
    ticketImageViewerState.marksByImage = new Map();
    ticketImageViewerState.undo = [];
    ticketImageViewerState.undoByImage = new Map();
    ticketImageViewerState.redo = [];
    ticketImageViewerState.redoByImage = new Map();
    ticketImageViewerState.image = null;
    ticketImageViewerState.loadToken++;
    files.forEach(file => {
      if (ticketImageCache.has(file.url)) return;
      const preload = new Image();
      preload.crossOrigin = "anonymous";
      ticketImageCache.set(file.url, preload);
      preload.src = file.url;
    });
    byId("ticket-image-draw").classList.add("active");
    byId("ticket-image-text").classList.remove("active");
    byId("ticket-image-stamp").classList.remove("active");
    byId("ticket-image-text-value").value = "";
    byId("ticket-image-text-size").value = "5";
    byId("ticket-image-text-size-value").textContent = "5%";
    byId("ticket-image-text-color").value = "#e11d48";
    byId("ticket-image-text-bold").classList.add("active");
    byId("ticket-image-text-bold").setAttribute("aria-pressed", "true");
    byId("ticket-image-text-background").classList.add("active");
    byId("ticket-image-text-background").setAttribute("aria-pressed", "true");
    byId("ticket-image-text-delete").disabled = true;
    byId("ticket-image-undo").disabled = true;
    byId("ticket-image-redo").disabled = true;
    byId("ticket-image-loading").hidden = false;
    showTicketImageAt(index);
    byId("ticket-image-viewer").showModal();
  }
  function ticketCanvasPoint(event) {
    const canvas = byId("ticket-image-canvas");
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }
  function initTicketImageViewerListeners() {
    byId("ticket-image-close")?.addEventListener("click", () => byId("ticket-image-viewer").close());
    byId("ticket-image-prev")?.addEventListener("click", () => showTicketImageAt(ticketImageViewerState.index - 1));
    byId("ticket-image-next")?.addEventListener("click", () => showTicketImageAt(ticketImageViewerState.index + 1));
    byId("ticket-image-stage-prev")?.addEventListener("click", () => showTicketImageAt(ticketImageViewerState.index - 1));
    byId("ticket-image-stage-next")?.addEventListener("click", () => showTicketImageAt(ticketImageViewerState.index + 1));
    const stageEl = byId("ticket-image-stage");
    let touchStartX = 0;
    let touchStartY = 0;
    stageEl?.addEventListener("touchstart", (e) => {
      if (ticketImageViewerState.mode === "draw" || e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    stageEl?.addEventListener("touchend", (e) => {
      if (ticketImageViewerState.mode === "draw" || !touchStartX) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      touchStartX = 0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) showTicketImageAt(ticketImageViewerState.index + 1);
        else showTicketImageAt(ticketImageViewerState.index - 1);
      }
    }, { passive: true });
  byId("ticket-image-zoom-in")?.addEventListener("click", () => setTicketImageZoom(ticketImageViewerState.zoom + .25));
  byId("ticket-image-zoom-out")?.addEventListener("click", () => setTicketImageZoom(ticketImageViewerState.zoom - .25));
  byId("ticket-image-zoom-fit")?.addEventListener("click", () => setTicketImageZoom(1));
  [ ["ticket-image-draw", "draw"], ["ticket-image-text", "text"], ["ticket-image-stamp", "stamp"] ].forEach(([id, mode]) => byId(id)?.addEventListener("click", () => {
    ticketImageViewerState.mode = mode;
    [ ["ticket-image-draw", "draw"], ["ticket-image-text", "text"], ["ticket-image-stamp", "stamp"] ].forEach(([buttonId, value]) => byId(buttonId).classList.toggle("active", mode === value));
    if (mode === "text") byId("ticket-image-text-value").focus();
  }));
  byId("ticket-image-text-value")?.addEventListener("input", event => {
    updateSelectedTicketText(mark => { mark.text = event.target.value; });
  });
  byId("ticket-image-text-size")?.addEventListener("input", event => {
    byId("ticket-image-text-size-value").textContent = `${event.target.value}%`;
    updateSelectedTicketText(mark => { mark.sizeScale = Number(event.target.value) / 100; });
  });
  byId("ticket-image-text-color")?.addEventListener("input", event => updateSelectedTicketText(mark => { mark.color = event.target.value; }));
  [["ticket-image-text-bold", "bold"], ["ticket-image-text-background", "background"]].forEach(([id, property]) => byId(id)?.addEventListener("click", () => {
    const button = byId(id);
    const enabled = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(enabled));
    button.classList.toggle("active", enabled);
    updateSelectedTicketText(mark => { mark[property] = enabled; });
  }));
  byId("ticket-image-text-delete")?.addEventListener("click", () => {
    if (ticketImageViewerState.selectedMarkIndex < 0) return;
    recordTicketImageEdit();
    ticketImageViewerState.marks.splice(ticketImageViewerState.selectedMarkIndex, 1);
    ticketImageViewerState.selectedMarkIndex = -1;
    byId("ticket-image-text-value").value = "";
    byId("ticket-image-text-delete").disabled = true;
    updateTicketImageHistoryButtons();
    redrawTicketImageCanvas();
  });
  byId("ticket-image-undo")?.addEventListener("click", () => {
    if (!ticketImageViewerState.undo.length) return;
    ticketImageViewerState.redo.push(cloneTicketImageMarks(ticketImageViewerState.marks));
    ticketImageViewerState.marks = ticketImageViewerState.undo.pop();
    ticketImageViewerState.selectedMarkIndex = -1;
    byId("ticket-image-text-delete").disabled = true;
    updateTicketImageHistoryButtons();
    redrawTicketImageCanvas();
  });
  byId("ticket-image-redo")?.addEventListener("click", () => {
    if (!ticketImageViewerState.redo.length) return;
    ticketImageViewerState.undo.push(cloneTicketImageMarks(ticketImageViewerState.marks));
    ticketImageViewerState.marks = ticketImageViewerState.redo.pop();
    ticketImageViewerState.selectedMarkIndex = -1;
    byId("ticket-image-text-delete").disabled = true;
    updateTicketImageHistoryButtons();
    redrawTicketImageCanvas();
  });
  byId("ticket-image-revert")?.addEventListener("click", () => {
    if (!ticketImageViewerState.marks.length) return;
    recordTicketImageEdit();
    ticketImageViewerState.marks = [];
    ticketImageViewerState.marksByImage.set(ticketImageViewerState.index, []);
    ticketImageViewerState.selectedMarkIndex = -1;
    byId("ticket-image-text-delete").disabled = true;
    updateTicketImageHistoryButtons();
    redrawTicketImageCanvas();
  });
  document.addEventListener("keydown", event => {
    if (!byId("ticket-image-viewer")?.open) return;
    const tag = event.target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || event.target?.isContentEditable) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showTicketImageAt(ticketImageViewerState.index + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      byId(event.shiftKey ? "ticket-image-redo" : "ticket-image-undo").click();
    } else if (key === "y") {
      event.preventDefault();
      byId("ticket-image-redo").click();
    }
  });
  byId("ticket-image-canvas")?.addEventListener("pointerdown", event => {
    if (!ticketImageViewerState.image) return;
    const point = ticketCanvasPoint(event);
    if (ticketImageViewerState.mode === "text") {
      const ctx = byId("ticket-image-canvas").getContext("2d");
      const selectedIndex = ticketImageViewerState.marks.findLastIndex(mark => {
        if (mark.type !== "text" || mark.stamp) return false;
        const size = Math.max(12, Math.round(byId("ticket-image-canvas").width * (mark.sizeScale || .05)));
        ctx.font = `${mark.bold === false ? "normal" : "bold"} ${size}px sans-serif`;
        const width = ctx.measureText(mark.text).width;
        const padding = mark.background ? size * .25 : 5;
        return point.x >= mark.x - padding && point.x <= mark.x + width + padding && point.y >= mark.y - size - padding && point.y <= mark.y + padding;
      });
      if (selectedIndex >= 0) {
        ticketImageViewerState.selectedMarkIndex = selectedIndex;
        const mark = ticketImageViewerState.marks[selectedIndex];
        byId("ticket-image-text-value").value = mark.text;
        byId("ticket-image-text-size").value = String(Math.round((mark.sizeScale || .05) * 100));
        byId("ticket-image-text-size-value").textContent = `${Math.round((mark.sizeScale || .05) * 100)}%`;
        byId("ticket-image-text-color").value = mark.color || "#e11d48";
        [["ticket-image-text-bold", mark.bold !== false], ["ticket-image-text-background", !!mark.background]].forEach(([id, enabled]) => {
          byId(id).classList.toggle("active", enabled);
          byId(id).setAttribute("aria-pressed", String(enabled));
        });
        byId("ticket-image-text-delete").disabled = false;
        return;
      }
      const value = byId("ticket-image-text-value").value.trim();
      ticketImageViewerState.selectedMarkIndex = -1;
      byId("ticket-image-text-delete").disabled = true;
      if (value) {
        recordTicketImageEdit();
        ticketImageViewerState.marks.push({
          type: "text", text: value, ...point,
          sizeScale: Number(byId("ticket-image-text-size").value) / 100,
          color: byId("ticket-image-text-color").value,
          bold: byId("ticket-image-text-bold").getAttribute("aria-pressed") === "true",
          background: byId("ticket-image-text-background").getAttribute("aria-pressed") === "true"
        });
        ticketImageViewerState.selectedMarkIndex = ticketImageViewerState.marks.length - 1;
        byId("ticket-image-text-delete").disabled = false;
        updateTicketImageHistoryButtons();
        redrawTicketImageCanvas();
      }
      return;
    }
    if (ticketImageViewerState.mode === "stamp") {
      const stamp = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
      recordTicketImageEdit();
      ticketImageViewerState.marks.push({ type: "text", text: `Reviewed ${stamp}`, stamp: true, ...point });
      updateTicketImageHistoryButtons();
      redrawTicketImageCanvas();
      return;
    }
    recordTicketImageEdit();
    ticketImageViewerState.drawing = { type: "draw", points: [point] };
    ticketImageViewerState.marks.push(ticketImageViewerState.drawing);
    updateTicketImageHistoryButtons();
    byId("ticket-image-canvas").setPointerCapture(event.pointerId);
  });
  byId("ticket-image-canvas")?.addEventListener("pointermove", event => {
    if (!ticketImageViewerState.drawing) return;
    ticketImageViewerState.drawing.points.push(ticketCanvasPoint(event));
    redrawTicketImageCanvas();
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => byId("ticket-image-canvas")?.addEventListener(type, () => { ticketImageViewerState.drawing = null; }));
  byId("ticket-image-save")?.addEventListener("click", async () => {
    const button = byId("ticket-image-save");
    const canvas = byId("ticket-image-canvas");
    if (!ticketImageViewerState.marks.length || !activeTicket) {
      window.showAdminToast?.("Add a drawing or text note before saving.", "danger");
      return;
    }
    button.disabled = true;
    try {
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not export this image.")), "image/png"));
      const original = ticketImageViewerState.files[ticketImageViewerState.index];
      const file = new File([blob], `${(original.name || "ticket-image").replace(/\.[^.]+$/, "")}-annotated.png`, { type: "image/png" });
      const uploaded = (await uploadAdminTicketMedia([file], activeTicket.data.order_id || activeTicket.id, button))[0];
      const reviewedAt = new Date();
      const attachment = { ...uploaded, reviewedAt: reviewedAt.toISOString(), reviewedBy: firebase.auth().currentUser?.email || ADMIN_EMAIL };
      await db.collection("tickets").doc(activeTicket.id).update({ attachments: firebase.firestore.FieldValue.arrayUnion(attachment) });
      window.showAdminToast?.("Annotated copy saved to the ticket.", "success");
      byId("ticket-image-viewer").close();
      await loadTickets();
      await showTicketDetails(activeTicket.id);
    } catch (error) {
      window.showAdminToast?.(errorText(error), "danger");
      reportError(error);
    } finally {
      button.disabled = false;
      button.textContent = "Save annotated copy";
    }
  });
  }
  async function showTicketDetails(id, ticket) {
    if (id) {
      try {
        const snap = await db.collection("tickets").doc(id).get();
        if (snap.exists) ticket = { ...(ticket || {}), ...snap.data() };
      } catch (err) {
        console.warn("Could not fetch ticket:", err);
      }
    }
    activeTicket = { id, data: ticket };
    byId("ticket-detail-title").textContent = ticket.ticket_id || id;
    const content = byId("ticket-detail-content");
    content.replaceChildren();

    const addSection = (title, builder) => {
      const section = document.createElement("section");
      section.className = "admin-detail-section";
      const heading = document.createElement("h3");
      heading.textContent = title;
      section.append(heading);
      builder(section);
      content.append(section);
    };

    addSection("Customer & order", section => {
      const grid = document.createElement("div");
      grid.className = "admin-detail-grid";
      [
        ["Ticket ID", ticket.ticket_id || id],
        ["Status", canonicalTicketStatus(ticket.status)],
        ["Customer", ticket.name || "—"],
        ["Email", ticket.email || "—"],
        ["Phone", ticket.phone || "—"],
        ["Address", ticket.address || "—"],
        ["Order", ticket.order_id || "—"],
        ["Raised", ticketDate(ticket.created_at)]
      ].forEach(([label, value]) => {
        const item = document.createElement("div");
        const dt = document.createElement("dt"); dt.textContent = label;
        const dd = document.createElement("dd"); dd.textContent = value;
        item.append(dt, dd); grid.append(item);
      });
      section.append(grid);
      if (ticket.order_id || ticket.order_doc_id) {
        const orderBtn = document.createElement("button");
        orderBtn.type = "button";
        orderBtn.className = "btn-secondary";
        orderBtn.style.marginTop = "10px";
        orderBtn.textContent = "Open related order";
        orderBtn.addEventListener("click", () => {
          const orderId = String(ticket.order_doc_id || ticket.order_id || "");
          const match = orderDocuments.find(doc => doc.id === orderId || doc.id === orderId.replace(/^#/, "") || doc.data().order_id === ticket.order_id);
          if (match) {
            byId("ticket-detail-dialog").close();
            showOrderDetails(match.id, match.data());
          } else {
            window.showAdminToast?.("Related order could not be found in the loaded orders.", "danger");
          }
        });
        section.append(orderBtn);
      }
    });

    addSection("Products in this issue", section => {
      const products = ticket.products || [];
      if (!products.length) {
        const empty = document.createElement("p");
        empty.className = "admin-helper";
        empty.textContent = "No products were selected.";
        section.append(empty);
        return;
      }
      const list = document.createElement("div");
      list.className = "ticket-products";
      products.forEach(item => {
        const row = document.createElement("div");
        row.className = "ticket-product";
        const img = document.createElement("img");
        img.src = item.imageUrl || "logo_creativesouls.jpg";
        img.alt = "";
        const text = document.createElement("div");
        text.innerHTML = `<strong></strong><div style="color:var(--text-3);font-size:0.78rem;"></div>`;
        text.firstElementChild.textContent = item.productName || "Product";
        text.lastElementChild.textContent = [item.colour && `Colour: ${item.colour}`, item.size && `Size: ${item.size}`, `Qty: ${item.quantity || 1}`].filter(Boolean).join(" · ");
        row.append(img, text);
        list.append(row);
      });
      section.append(list);
    });

    addSection("Customer issue", section => {
      const p = document.createElement("p");
      p.style.whiteSpace = "pre-wrap";
      p.textContent = ticket.issue || "No description provided.";
      section.append(p);
    });

    addSection("Photos & videos", section => {
      const files = ticket.attachments || [];
      if (!files.length) {
        const empty = document.createElement("p");
        empty.className = "admin-helper";
        empty.textContent = "No media was uploaded.";
        section.append(empty);
        return;
      }
      const imageFiles = ticketImageAttachments(ticket);
      const renderAttachmentGroup = (title, group) => {
        if (!group.length) return;
        const heading = document.createElement("h4");
        heading.className = "ticket-attachment-subheading";
        heading.textContent = title;
        const grid = document.createElement("div");
        grid.className = "ticket-attachments";
        group.forEach(file => {
        const isVideo = String(file.fileType || "").toLowerCase().includes("video") || /\.(mp4|webm|mov|m4v|avi|mkv|ogv)(?:[?#]|$)/i.test(file.url || "");
        const figure = document.createElement("figure");
        const caption = document.createElement("figcaption");
        if (isVideo) {
          const video = document.createElement("video");
          video.src = file.url;
          video.controls = true;
          video.preload = "metadata";
          figure.append(video);
          const link = document.createElement("a");
          link.href = file.url || "#";
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = file.name || "Open video";
          caption.append(link);
        } else {
          const img = document.createElement("img");
          img.src = file.thumbnailUrl || file.url;
          img.alt = file.name || "Attachment";
          const imageButton = document.createElement("button");
          imageButton.type = "button";
          imageButton.className = "ticket-image-open";
          imageButton.setAttribute("aria-label", `Examine ${file.name || "ticket image"}`);
          imageButton.append(img);
          imageButton.addEventListener("click", () => openTicketImageViewer(imageFiles, imageFiles.indexOf(file)));
          figure.append(imageButton);
          const nameButton = document.createElement("button");
          nameButton.type = "button";
          nameButton.className = "ticket-image-name";
          nameButton.textContent = file.name || "Examine image";
          nameButton.addEventListener("click", () => openTicketImageViewer(imageFiles, imageFiles.indexOf(file)));
          caption.append(nameButton);
          if (file.reviewedAt) {
            const reviewed = document.createElement("small");
            reviewed.className = "ticket-image-reviewed";
            reviewed.textContent = `Reviewed ${new Date(file.reviewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}${file.reviewedBy ? ` · ${file.reviewedBy}` : ""}`;
            caption.append(reviewed);
          }
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "ticket-attachment-delete";
        remove.textContent = "Delete";
        remove.setAttribute("aria-label", `Remove ${file.name || "attachment"} from this ticket`);
        remove.addEventListener("click", () => removeTicketAttachment(file, remove));
        caption.append(remove);
        figure.append(caption);
        grid.append(figure);
        });
        section.append(heading, grid);
      };
      const originalFiles = files.filter(file => !file.reviewedAt);
      const reviewedFiles = files.filter(file => !!file.reviewedAt);
      renderAttachmentGroup("Original photos & videos", originalFiles);
      renderAttachmentGroup("Annotated review images", reviewedFiles);
    });

    addSection("Add photos & videos", section => {
      const box = document.createElement("div");
      box.className = "ticket-media-upload";
      const label = document.createElement("label");
      label.htmlFor = "ticket-media-input";
      label.textContent = "Select photos or videos (maximum 25 MB per file). Stored in ImageKit.";
      const input = document.createElement("input");
      input.id = "ticket-media-input";
      input.type = "file";
      input.accept = "image/*,video/*";
      input.multiple = true;
      input.className = "ticket-media-input";
      const dropzone = document.createElement("div");
      dropzone.className = "ticket-media-dropzone";
      const prompt = document.createElement("strong");
      prompt.textContent = "Drop photos or videos here";
      const or = document.createElement("span");
      or.textContent = "or";
      const browse = document.createElement("label");
      browse.className = "btn-secondary ticket-media-browse";
      browse.htmlFor = input.id;
      browse.textContent = "Choose files";
      dropzone.append(prompt, or, browse, input);
      const preview = document.createElement("div");
      preview.className = "ticket-media-selection";
      preview.setAttribute("aria-live", "polite");
      setupTicketMediaPicker(input, preview, dropzone);
      const button = document.createElement("button");
      button.id = "ticket-media-save";
      button.type = "button";
      button.className = "btn-secondary";
      button.textContent = "Upload to ticket";
      button.addEventListener("click", addAdminTicketMedia);
      const message = document.createElement("p");
      message.id = "ticket-media-status";
      message.className = "admin-status";
      message.setAttribute("role", "alert");
      label.className = "admin-helper";
      box.append(label, dropzone, preview, button, message);
      section.append(box);
    });

    const replies = ticket.replies || [];
    if (replies.length) {
      addSection("Previous replies", section => {
        const list = document.createElement("div");
        list.className = "ticket-reply-history";
        replies.forEach(reply => {
          const item = document.createElement("div");
          item.className = "ticket-reply-item";
          const meta = document.createElement("small");
          meta.textContent = `${reply.admin_email || "Admin"} · ${ticketDate(reply.created_at)}`;
          const body = document.createElement("div");
          body.style.whiteSpace = "pre-wrap";
          body.textContent = reply.body || reply.formatted_body || "";
          item.append(meta, body);
          if (Array.isArray(reply.included_images) && reply.included_images.length) {
            const links = document.createElement("div");
            links.className = "ticket-reply-image-history";
            reply.included_images.forEach(image => {
              const link = document.createElement("a");
              link.href = image.url;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              link.textContent = image.name || "Included ticket image";
              links.append(link);
            });
            item.append(links);
          }
          list.append(item);
        });
        section.append(list);
      });
    }

    addSection("Reply to customer", section => {
      const box = document.createElement("div");
      box.className = "ticket-reply-box";
      const label = document.createElement("p");
      label.className = "admin-helper";
      label.textContent = "Type your reply. Improve with AI rewrites only the text in this box and keeps it in clear paragraphs; review it before opening Gmail.";
      const imagePicker = document.createElement("div");
      imagePicker.id = "ticket-reply-image-picker";
      imagePicker.className = "ticket-reply-image-picker";
      renderTicketReplyImagePicker(ticket, imagePicker);
      const textarea = document.createElement("textarea");
      textarea.id = "ticket-reply-input";
      textarea.placeholder = "Example: We checked the photos and will reprint the keychain. A replacement will be dispatched in 2 days.";
      const aiActions = document.createElement("div");
      aiActions.className = "ticket-reply-ai-actions";
      const improveButton = document.createElement("button");
      improveButton.type = "button";
      improveButton.className = "btn-secondary";
      improveButton.textContent = "✦ Improve with AI";
      const undoAiButton = document.createElement("button");
      undoAiButton.type = "button";
      undoAiButton.className = "btn-secondary";
      undoAiButton.textContent = "Undo AI change";
      undoAiButton.hidden = true;
      const aiStatus = document.createElement("p");
      aiStatus.className = "admin-helper ticket-reply-ai-status";
      aiStatus.setAttribute("role", "status");
      improveButton.addEventListener("click", async () => {
        const draft = textarea.value.trim();
        if (!draft) {
          aiStatus.textContent = "Write a reply first, then ask AI to improve it.";
          textarea.focus();
          return;
        }
        const workerUrl = window.PRODUCT_MARKETING_WORKER_URL;
        const user = auth.currentUser;
        if (!workerUrl || !user) {
          aiStatus.textContent = !workerUrl ? "The AI service is not configured." : "Sign in again before using AI.";
          return;
        }
        improveButton.disabled = true;
        improveButton.textContent = "Improving…";
        aiStatus.textContent = "Improving your reply…";
        try {
          const token = await user.getIdToken();
          const response = await fetch(`${workerUrl.replace(/\/+$/, "")}/improve-ticket-reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ draft })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || `AI improvement failed (HTTP ${response.status}).`);
          const improved = String(result.improvedReply || "").trim();
          if (!improved) throw new Error("AI returned an empty suggestion. Please try again.");
          textarea.dataset.beforeAiImprovement = textarea.value;
          textarea.value = improved;
          undoAiButton.hidden = false;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
          aiStatus.textContent = "Suggestion added. Review and edit it before opening the Gmail draft.";
        } catch (error) {
          aiStatus.textContent = errorText(error);
          reportError(error);
        } finally {
          improveButton.disabled = false;
          improveButton.textContent = "✦ Improve with AI";
        }
      });
      undoAiButton.addEventListener("click", () => {
        if (textarea.dataset.beforeAiImprovement === undefined) return;
        textarea.value = textarea.dataset.beforeAiImprovement;
        delete textarea.dataset.beforeAiImprovement;
        undoAiButton.hidden = true;
        aiStatus.textContent = "Restored your previous draft.";
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      });
      aiActions.append(improveButton, undoAiButton);
      const preview = document.createElement("div");
      preview.className = "ticket-email-preview";
      preview.innerHTML = "<strong>Gmail message preview</strong>";
      const pre = document.createElement("pre");
      pre.id = "ticket-email-preview";
      preview.append(pre);
      textarea.addEventListener("input", updateTicketEmailPreview);
      box.append(label, imagePicker, textarea, preview, aiActions, aiStatus);
      section.append(box);
      updateTicketEmailPreview();
    });

    const resolvedBtn = byId("ticket-mark-resolved");
    resolvedBtn.textContent = canonicalTicketStatus(ticket.status) === "Resolved" ? "Already resolved" : "Mark resolved";
    resolvedBtn.disabled = canonicalTicketStatus(ticket.status) === "Resolved";
    byId("ticket-detail-dialog").showModal();
    updateTicketEmailPreview();
  }

  async function saveTicketReplyAndOpenGmail() {
    if (!activeTicket) return;
    const typed = String(byId("ticket-reply-input")?.value || "").trim();
    if (!typed) {
      window.showAdminToast?.("Type a reply first.", "danger");
      return;
    }
    const ticket = activeTicket.data;
    const to = String(ticket.email || "").trim();
    if (!to || !to.includes("@")) {
      window.showAdminToast?.("This ticket has no valid customer email.", "danger");
      return;
    }
    const selectedImages = selectedTicketReplyImages();
    const formatted = ticketReplyEmailBody(ticket, typed, selectedImages);
    const button = byId("ticket-open-gmail");
    button.disabled = true;
    button.textContent = "Opening Gmail…";
    try {
      const result = await openGmailCompose({
        to,
        subject: ticketEmailSubject(ticket),
        body: formatted
      });
      const reply = {
        body: typed,
        formatted_body: formatted,
        included_images: selectedImages.map(file => ({ name: file.name || "Ticket image", url: file.url, reviewedAt: file.reviewedAt || "" })),
        admin_email: firebase.auth().currentUser?.email || ADMIN_EMAIL,
        created_at: new Date().toISOString()
      };
      const existing = Array.isArray(ticket.replies) ? ticket.replies : [];
      await db.collection("tickets").doc(activeTicket.id).update({
        replies: [...existing, reply],
        status: "Replied",
        last_replied_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      window.showAdminToast?.(
        result === "copied"
          ? "Gmail opened. The message was copied — paste it into the email if the body is empty, then click Send."
          : "Gmail opened with the formatted reply. Click Send in Gmail.",
        "success"
      );
      await loadTickets();
      await showTicketDetails(activeTicket.id);
    } catch (error) {
      reportError(error);
    } finally {
      button.disabled = false;
      button.textContent = "Open reply in Gmail";
    }
  }

  async function markTicketResolved() {
    if (!activeTicket) return;
    try {
      await db.collection("tickets").doc(activeTicket.id).update({
        status: "Resolved",
        resolved_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      window.showAdminToast?.("Ticket marked as resolved.", "success");
      await loadTickets();
      byId("ticket-detail-dialog").close();
    } catch (error) {
      reportError(error);
    }
  }

  async function loadTickets() {
    const label = byId("ticket-count-label");
    if (label) label.textContent = "Loading tickets…";
    try {
      const snapshot = await db.collection("tickets").get();
      ticketDocuments = snapshot.docs.sort((a, b) => {
        const time = value => {
          const date = parseOrderDate(value);
          return date ? date.getTime() : 0;
        };
        return time(b.data().created_at) - time(a.data().created_at);
      });
      updateTicketBadges();
      renderDashboardOpenTickets();
      renderTickets();
    } catch (error) {
      if (label) label.textContent = "Could not load tickets.";
      reportError(error);
    }
  }

  byId("tickets-quick-filters")?.addEventListener("click", event => {
    const btn = event.target.closest("button[data-ticket-filter]");
    if (!btn) return;
    ticketFilter = btn.dataset.ticketFilter;
    byId("tickets-quick-filters").querySelectorAll("button").forEach(item => item.classList.toggle("active", item === btn));
    renderTickets();
  });
  byId("ticket-search")?.addEventListener("input", renderTickets);
  byId("refresh-tickets")?.addEventListener("click", loadTickets);
  byId("ticket-open-gmail")?.addEventListener("click", saveTicketReplyAndOpenGmail);
  byId("ticket-mark-resolved")?.addEventListener("click", markTicketResolved);
  byId("ticket-detail-close")?.addEventListener("click", () => byId("ticket-detail-dialog").close());
  byId("ticket-detail-done")?.addEventListener("click", () => byId("ticket-detail-dialog").close());

  // ── Admin: create a ticket on behalf of a customer ──────────────────────
  const ticketCreateDialog = byId("ticket-create-dialog");
  let ticketCreateOrder = null; // { id, data } of the matched order, if any

  function randomSixDigits() {
    if (window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      return String(100000 + (buffer[0] % 900000));
    }
    return String(Math.floor(100000 + Math.random() * 900000));
  }
  async function generateUniqueTicketId() {
    for (let attempt = 0; attempt < 20; attempt++) {
      const ticketId = `TKT-${randomSixDigits()}`;
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
  function ticketItemImage(item = {}) {
    return String(item.imageUrl || "").split(",").map(url => url.trim()).find(Boolean) || "logo_creativesouls.jpg";
  }
  function findOrderByInput(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const digits = raw.replace(/^#/, "");
    return orderDocuments.find(doc => {
      const data = doc.data();
      return doc.id.replace(/^#/, "") === digits || String(data.order_id || "").replace(/^#/, "") === digits;
    }) || null;
  }
  function setTicketCreateError(message) {
    const el = byId("tc-error");
    if (el) el.textContent = message || "";
  }
  function renderTicketCreateProducts(items) {
    const wrap = byId("tc-products-wrap");
    const list = byId("tc-products");
    list.replaceChildren();
    if (!items.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    items.forEach((item, index) => {
      const label = document.createElement("label");
      label.className = "ticket-create-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = String(index);
      checkbox.checked = true;
      const img = document.createElement("img");
      img.src = ticketItemImage(item);
      img.alt = "";
      const text = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = item.productName || "Untitled product";
      const meta = document.createElement("small");
      meta.textContent = [
        item.colour && `Colour: ${item.colour}`,
        item.size && `Size: ${item.size}`,
        `Qty: ${Number(item.quantity || 0)}`
      ].filter(Boolean).join(" · ");
      text.append(title, meta);
      label.append(checkbox, img, text);
      list.append(label);
    });
  }
  function applyTicketCreateOrder() {
    const input = byId("tc-order");
    const hint = byId("tc-order-hint");
    const match = findOrderByInput(input.value);
    ticketCreateOrder = match ? { id: match.id, data: match.data() } : null;
    if (!match) {
      renderTicketCreateProducts([]);
      hint.textContent = String(input.value || "").trim()
        ? "No loaded order matches this ID. The ticket will still be linked to it as typed."
        : "";
      return;
    }
    const order = ticketCreateOrder.data;
    hint.textContent = `Order found — ${order.name || "Customer"} · ${order.status || "Order Placed"}`;
    byId("tc-name").value = order.name || "";
    byId("tc-email").value = order.email || "";
    byId("tc-phone").value = order.phone || "";
    byId("tc-address").value = order.pickup_location || order.address || "";
    renderTicketCreateProducts(Array.isArray(order.items) ? order.items : []);
  }
  function openTicketCreateDialog(prefillOrder) {
    ["tc-order", "tc-name", "tc-email", "tc-phone", "tc-address", "tc-product-extra", "tc-issue", "tc-media"].forEach(id => { byId(id).value = ""; });
    renderTicketMediaSelection(byId("tc-media"), byId("tc-media-preview"));
    byId("tc-send-email").checked = true;
    byId("tc-order-hint").textContent = "";
    byId("tc-products").replaceChildren();
    byId("tc-products-wrap").hidden = true;
    ticketCreateOrder = null;
    setTicketCreateError("");
    const options = byId("tc-order-options");
    options.replaceChildren();
    orderDocuments.slice(0, 300).forEach(doc => {
      const data = doc.data();
      const option = document.createElement("option");
      option.value = data.order_id || doc.id;
      option.label = [data.name, data.email].filter(Boolean).join(" · ");
      options.append(option);
    });
    if (prefillOrder) {
      byId("tc-order").value = prefillOrder;
      applyTicketCreateOrder();
    }
    const saveBtn = byId("ticket-create-save");
    saveBtn.disabled = false;
    saveBtn.textContent = "Create Ticket";
    ticketCreateDialog.showModal();
    byId("tc-order").focus();
  }
  async function saveAdminTicket() {
    if (byId("ticket-create-save").disabled) return;
    setTicketCreateError("");
    const email = byId("tc-email").value.trim();
    const issue = byId("tc-issue").value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setTicketCreateError("Enter a valid customer email address.");
      return;
    }
    if (!issue) {
      setTicketCreateError("Describe the customer's issue.");
      return;
    }
    const orderInput = byId("tc-order").value.trim();
    const orderData = ticketCreateOrder?.data || null;
    const orderItems = Array.isArray(orderData?.items) ? orderData.items : [];
    const selectedIndexes = [...byId("tc-products").querySelectorAll('input[type="checkbox"]:checked')].map(input => Number(input.value));
    const products = selectedIndexes
      .map(index => orderItems[index])
      .filter(Boolean)
      .map(item => ({
        productName: item.productName || "",
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        colour: item.colour || "",
        size: item.size || "",
        customization: item.customization || "",
        imageUrl: ticketItemImage(item)
      }));
    const extraProduct = byId("tc-product-extra").value.trim();
    if (extraProduct) {
      products.push({ productName: extraProduct, quantity: 1, price: 0, colour: "", size: "", customization: "", imageUrl: "logo_creativesouls.jpg" });
    }

    const saveBtn = byId("ticket-create-save");
    const mediaInput = byId("tc-media");
    const files = [...mediaInput.files];
    try {
      validateTicketMedia(files);
    } catch (error) {
      setTicketCreateError(error.message);
      return;
    }
    saveBtn.disabled = true;
    mediaInput.disabled = true;
    saveBtn.textContent = "Creating…";
    try {
      const ticketId = await generateUniqueTicketId();
      const attachments = await uploadAdminTicketMedia(files, orderData?.order_id || orderInput || ticketId, saveBtn);
      saveBtn.textContent = "Saving ticket…";
      const adminEmail = firebase.auth().currentUser?.email || ADMIN_EMAIL;
      const ticket = {
        ticket_id: ticketId,
        order_id: orderData?.order_id || orderInput,
        order_doc_id: ticketCreateOrder?.id || "",
        email,
        name: byId("tc-name").value.trim(),
        phone: byId("tc-phone").value.trim(),
        address: byId("tc-address").value.trim(),
        fulfillment_type: orderData?.fulfillment_type || "",
        products,
        issue,
        attachments,
        status: "Open",
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        user_uid: "",
        created_by: "admin",
        created_by_email: adminEmail
      };
      await db.collection("tickets").doc(ticketId).set(ticket);
      const prefillReply = byId("tc-send-email").checked;
      ticketCreateDialog.close();
      window.showAdminToast?.(`Ticket ${ticketId} created.`, "success");
      await loadTickets();
      await showTicketDetails(ticketId, { ...ticket, created_at: new Date() });
      if (prefillReply) {
        const reply = byId("ticket-reply-input");
        if (reply) {
          reply.value = `We have raised a support ticket (${ticketId}) for your issue and our team is looking into it. We will get back to you shortly with an update.`;
          updateTicketEmailPreview();
        }
      }
    } catch (error) {
      setTicketCreateError(errorText(error));
      reportError(error);
      saveBtn.disabled = false;
      saveBtn.textContent = "Create Ticket";
    } finally {
      mediaInput.disabled = false;
    }
  }

  byId("create-ticket-btn")?.addEventListener("click", () => openTicketCreateDialog());
  byId("tc-order")?.addEventListener("change", applyTicketCreateOrder);
  byId("tc-order")?.addEventListener("input", () => { if (findOrderByInput(byId("tc-order").value)) applyTicketCreateOrder(); });
  byId("ticket-create-save")?.addEventListener("click", saveAdminTicket);
  setupTicketMediaPicker(byId("tc-media"), byId("tc-media-preview"), byId("tc-media-dropzone"));
  byId("ticket-create-cancel")?.addEventListener("click", () => ticketCreateDialog.close());
  byId("ticket-create-close")?.addEventListener("click", () => ticketCreateDialog.close());
  initTicketImageViewerListeners();

  // Admin Photo Lightbox (for viewing final product photos & media)
  let adminLightboxState = { images: [], index: 0, title: "" };

  function updateAdminLightboxView() {
    if (!adminLightboxState.images.length) return;
    const total = adminLightboxState.images.length;
    adminLightboxState.index = (adminLightboxState.index + total) % total;
    const cur = adminLightboxState.images[adminLightboxState.index];
    const url = typeof cur === "string" ? cur : (cur.url || cur.thumbnailUrl || "");
    const name = typeof cur === "string" ? "Photo" : (cur.name || "Photo");

    const titleEl = byId("admin-lightbox-title");
    const counterEl = byId("admin-lightbox-counter");
    const extLink = byId("admin-lightbox-external");
    const imgEl = byId("admin-lightbox-img");
    const loadingEl = byId("admin-lightbox-loading");
    const prevBtn = byId("admin-lightbox-prev");
    const nextBtn = byId("admin-lightbox-next");

    if (titleEl) titleEl.textContent = name;
    if (counterEl) counterEl.textContent = total > 1 ? `${adminLightboxState.index + 1} / ${total}` : "";
    if (extLink) extLink.href = url;

    if (prevBtn) prevBtn.style.display = total > 1 ? "flex" : "none";
    if (nextBtn) nextBtn.style.display = total > 1 ? "flex" : "none";

    if (imgEl) {
      const hideLoading = () => {
        if (loadingEl) {
          loadingEl.hidden = true;
          loadingEl.style.display = "none";
          loadingEl.classList.add("is-hidden");
        }
      };
      const showLoading = () => {
        if (loadingEl) {
          loadingEl.hidden = false;
          loadingEl.style.display = "grid";
          loadingEl.classList.remove("is-hidden");
        }
      };

      imgEl.onload = hideLoading;
      imgEl.onerror = hideLoading;

      if (imgEl.src !== url) {
        showLoading();
        imgEl.src = url;
      }
      imgEl.alt = name;
      if (imgEl.complete && imgEl.naturalWidth) {
        hideLoading();
      }
    }
  }

  function openAdminPhotoViewer(images, startIndex = 0, title = "Photos") {
    if (!images || !images.length) return;
    adminLightboxState = {
      images,
      index: Math.max(0, Math.min(images.length - 1, startIndex)),
      title
    };
    updateAdminLightboxView();
    const dialog = byId("admin-photo-lightbox");
    if (dialog?.showModal && !dialog.open) {
      dialog.showModal();
    }
  }

  function initAdminPhotoLightboxListeners() {
    byId("admin-lightbox-close")?.addEventListener("click", () => byId("admin-photo-lightbox")?.close());
    byId("admin-lightbox-prev")?.addEventListener("click", () => {
      adminLightboxState.index--;
      updateAdminLightboxView();
    });
    byId("admin-lightbox-next")?.addEventListener("click", () => {
      adminLightboxState.index++;
      updateAdminLightboxView();
    });
    const dialog = byId("admin-photo-lightbox");
    dialog?.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.addEventListener("keydown", (event) => {
      if (!byId("admin-photo-lightbox")?.open) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        adminLightboxState.index--;
        updateAdminLightboxView();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        adminLightboxState.index++;
        updateAdminLightboxView();
      }
    });
    const body = byId("admin-lightbox-body");
    let touchX = 0;
    let touchY = 0;
    body?.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
      }
    }, { passive: true });
    body?.addEventListener("touchend", (e) => {
      if (!touchX) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      touchX = 0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) {
          adminLightboxState.index++;
          updateAdminLightboxView();
        } else {
          adminLightboxState.index--;
          updateAdminLightboxView();
        }
      }
    }, { passive: true });
  }
  initAdminPhotoLightboxListeners();

  // ══════════════════════════════════════════════════════════════════════════
  // WALLET & REFUNDS MANAGEMENT MODULE
  // ══════════════════════════════════════════════════════════════════════════
  let activeRefundOrder = null;
  let activeWalletCustomer = null;
  let customerWalletHistoryData = [];
  let globalWalletLogsData = [];
  let allKnownWalletCustomers = new Map();
  let walletCustFilterState = "all";
  let walletCustTxFilterState = "all";
  let walletGlobalTxFilterState = "all";
  let walletCurrentBalanceVal = 0;
  let walletCurrentPointsVal = 0;

  function openWalletRefundModal(orderDocId, order) {
    activeRefundOrder = { id: orderDocId, order, email: (order.email || order.user_email || "").trim() };
    const dlg = byId("wallet-refund-dialog");
    if (!dlg) return;

    const emailEl = byId("wallet-refund-customer-email");
    const orderTagEl = byId("wallet-refund-order-tag");
    const amountInput = byId("wallet-refund-amount");
    const reasonInput = byId("wallet-refund-reason");
    const submitBtn = byId("wallet-refund-submit");

    const orderNum = (order.order_id || orderDocId || "").replace(/^#/, "");
    const orderTotal = Number(order.total || 0);

    if (emailEl) emailEl.textContent = activeRefundOrder.email || `Customer: ${order.name || "Unknown"} (No email provided)`;
    if (orderTagEl) orderTagEl.textContent = `Order: #${orderNum} · Total: ${formatOrderMoney(orderTotal)}`;
    if (amountInput) amountInput.value = orderTotal;
    if (reasonInput) reasonInput.value = `Refund for Order #${orderNum}`;

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = `✓ Credit ₹${orderTotal} to Wallet`;
    }

    // Modal quick percentage chips
    const btn100 = byId("modal-refund-100");
    if (btn100) {
      btn100.onclick = () => {
        if (amountInput) {
          amountInput.value = orderTotal;
          updateRefundModalButton(orderTotal);
        }
      };
    }
    const btn50 = byId("modal-refund-50");
    if (btn50) {
      btn50.onclick = () => {
        if (amountInput) {
          const half = Math.round(orderTotal / 2);
          amountInput.value = half;
          updateRefundModalButton(half);
        }
      };
    }
    const btn25 = byId("modal-refund-25");
    if (btn25) {
      btn25.onclick = () => {
        if (amountInput) {
          const qtr = Math.round(orderTotal / 4);
          amountInput.value = qtr;
          updateRefundModalButton(qtr);
        }
      };
    }

    // Modal reason preset tags
    dlg.querySelectorAll("[data-modal-reason]").forEach(btn => {
      btn.onclick = () => {
        const tag = btn.getAttribute("data-modal-reason");
        if (reasonInput) reasonInput.value = `${tag} (Order #${orderNum})`;
      };
    });

    dlg.showModal();
  }

  function updateRefundModalButton(amt) {
    const submitBtn = byId("wallet-refund-submit");
    if (submitBtn) {
      const val = parseFloat(amt) || 0;
      submitBtn.textContent = `✓ Credit ₹${val.toFixed(0)} to Wallet`;
    }
  }

  // Update refund button text on amount input change
  byId("wallet-refund-amount")?.addEventListener("input", e => {
    updateRefundModalButton(e.target.value);
  });

  byId("wallet-refund-close")?.addEventListener("click", () => byId("wallet-refund-dialog")?.close());
  byId("wallet-refund-cancel")?.addEventListener("click", () => byId("wallet-refund-dialog")?.close());

  byId("wallet-refund-modal-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    if (!activeRefundOrder) return;

    const amountInput = byId("wallet-refund-amount");
    const reasonInput = byId("wallet-refund-reason");
    const submitBtn = byId("wallet-refund-submit");
    const amount = parseFloat(amountInput?.value);
    const reason = reasonInput?.value?.trim() || "Refund";
    const userEmail = activeRefundOrder.email;

    if (!userEmail) {
      alert("Cannot issue wallet refund: Customer has no email address associated with this order.");
      return;
    }
    if (!amount || amount <= 0) {
      alert("Please enter a valid refund amount greater than 0.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Processing Refund…";

    try {
      await executeWalletTransaction({
        userEmail,
        customerName: activeRefundOrder.order?.name || "",
        amount,
        type: "credit",
        reason,
        orderId: activeRefundOrder.order?.order_id || activeRefundOrder.id
      });

      // Update order status/refund note in order document
      try {
        await db.collection("orders").doc(activeRefundOrder.id).update({
          refund_status: `Refunded ₹${amount} to wallet (${reason}) on ${new Date().toLocaleDateString("en-IN")}`
        });
        if (activeRefundOrder.order) {
          activeRefundOrder.order.refund_status = `Refunded ₹${amount}`;
        }
      } catch (orderUpdateErr) {
        console.warn("Could not attach refund note to order:", orderUpdateErr);
      }

      window.showAdminToast?.(`✓ Successfully refunded ₹${amount} to ${userEmail}'s wallet!`, "success");
      byId("wallet-refund-dialog")?.close();
      await loadOrders();
      if (document.querySelector("#section-wallets.active")) {
        loadWalletsSection();
      }
    } catch (err) {
      reportError(err);
      submitBtn.disabled = false;
      submitBtn.textContent = "Try Again";
    }
  });

  async function executeWalletTransaction({ userEmail, customerName, amount, type, reason, orderId, isPoints = false }) {
    const cleanUserEmail = String(userEmail || "").trim().toLowerCase();
    if (!cleanUserEmail) throw new Error("A valid customer email is required.");
    const numericAmount = Math.abs(parseFloat(amount));
    if (!numericAmount || numericAmount <= 0) throw new Error("A positive amount is required.");

    const userRef = db.collection("users").doc(cleanUserEmail);
    const historyRef = userRef.collection("wallet_history").doc();
    const globalLogRef = db.collection("wallet_logs").doc();
    const adminEmail = String(auth.currentUser?.email || "admin");

    const batch = db.batch();

    if (isPoints || type === "points") {
      const delta = type === "debit" ? -Math.round(numericAmount) : Math.round(numericAmount);
      batch.set(userRef, {
        walletPoints: firebase.firestore.FieldValue.increment(delta),
        email: cleanUserEmail,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(historyRef, {
        amount: Math.round(numericAmount),
        type: delta >= 0 ? "credit" : "debit",
        isPoints: true,
        title: reason || (delta >= 0 ? "Loyalty Reward Points Credited" : "Loyalty Points Deducted"),
        orderId: orderId || null,
        processedBy: adminEmail,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      batch.set(globalLogRef, {
        userEmail: cleanUserEmail,
        customerName: customerName || "",
        amount: Math.round(numericAmount),
        type: delta >= 0 ? "credit" : "debit",
        isPoints: true,
        reason: reason || (delta >= 0 ? "Points Credit" : "Points Debit"),
        orderId: orderId || null,
        processedBy: adminEmail,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const delta = type === "debit" ? -numericAmount : numericAmount;
      batch.set(userRef, {
        wallet_balance: firebase.firestore.FieldValue.increment(delta),
        email: cleanUserEmail,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batch.set(historyRef, {
        amount: numericAmount,
        type: type, // 'credit' | 'debit'
        title: reason,
        orderId: orderId || null,
        processedBy: adminEmail,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      batch.set(globalLogRef, {
        userEmail: cleanUserEmail,
        customerName: customerName || "",
        amount: numericAmount,
        type: type,
        reason: reason,
        orderId: orderId || null,
        processedBy: adminEmail,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();
  }

  // ── Load Wallets Section ───────────────────────────────────────────────
  async function loadWalletsSection() {
    // If orders haven't been loaded yet (e.g. navigated directly to wallets
    // before the concurrent loadOrders() resolved), fetch them now so the
    // customer directory has real data instead of an empty array.
    if (orderDocuments.length === 0) {
      await loadOrders();
    }
    buildAllKnownCustomersDirectory();
    populateWalletCustomerDropdown();
    await loadGlobalWalletLogs();
    if (activeWalletCustomer) {
      await loadCustomerWallet(activeWalletCustomer);
    }
  }

  function buildAllKnownCustomersDirectory() {
    allKnownWalletCustomers.clear();

    // 1. From order documents
    (orderDocuments || []).forEach(doc => {
      const o = doc.data();
      const email = String(o.email || o.user_email || "").trim().toLowerCase();
      if (!email) return;

      if (!allKnownWalletCustomers.has(email)) {
        allKnownWalletCustomers.set(email, {
          email,
          name: o.name || "Customer",
          phone: o.phone || "",
          orderCount: 0,
          totalSpent: 0,
          hasOrders: true,
          recentOrder: o
        });
      }

      const rec = allKnownWalletCustomers.get(email);
      rec.orderCount += 1;
      rec.totalSpent += Number(o.total || 0);
      if (o.name && (!rec.name || rec.name === "Customer")) rec.name = o.name;
      if (o.phone && !rec.phone) rec.phone = o.phone;
    });

    // 2. From customerRecords if any
    (customerRecords || []).forEach(cr => {
      const email = String(cr.email || "").trim().toLowerCase();
      if (email && !allKnownWalletCustomers.has(email)) {
        allKnownWalletCustomers.set(email, {
          email,
          name: cr.name || "Customer",
          phone: cr.phone || "",
          orderCount: 0,
          totalSpent: 0,
          hasOrders: false
        });
      }
    });

    const totalUsers = allKnownWalletCustomers.size;
    const withOrders = [...allKnownWalletCustomers.values()].filter(c => c.hasOrders).length;

    const countAllEl = byId("wallet-filter-all-count");
    if (countAllEl) countAllEl.textContent = totalUsers;
    const countOrdersEl = byId("wallet-filter-orders-count");
    if (countOrdersEl) countOrdersEl.textContent = withOrders;

    const kpiUsersEl = byId("wallet-kpi-users");
    if (kpiUsersEl) kpiUsersEl.textContent = totalUsers;
  }

  // ── Wallet Customer Autocomplete Search ───────────────────────────────
  // Keeps the hidden <select> in sync for JS compat but drives UX via
  // a live suggestion panel rendered under the search input.

  let walletSuggestActiveIdx = -1; // keyboard-highlighted suggestion index

  /** Escape text for safe innerHTML insertion */
  function escWalletHtml(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  /**
   * Wrap every occurrence of `query` in `text` with <mark>.
   * Returns safe HTML string.
   */
  function highlightMatch(text, query) {
    if (!query) return escWalletHtml(text);
    const safe = escWalletHtml(text);
    const safeQ = escWalletHtml(query);
    // Case-insensitive replace, preserving original casing
    return safe.replace(new RegExp(safeQ.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), "gi"),
      m => `<mark>${m}</mark>`);
  }

  /** Score a customer record against the query for ranking. */
  function walletSearchScore(c, query) {
    if (!query) return c.orderCount;
    const q = query.toLowerCase();
    const name  = (c.name  || "").toLowerCase();
    const email = (c.email || "").toLowerCase();
    const phone = (c.phone || "").toLowerCase();
    let score = 0;
    if (email === q)                   score += 100;
    if (email.startsWith(q))           score += 50;
    if (name === q)                    score += 90;
    if (name.startsWith(q))            score += 40;
    if (phone.startsWith(q))           score += 35;
    if (email.includes(q))             score += 20;
    if (name.includes(q))              score += 15;
    if (phone.includes(q))             score += 10;
    score += c.orderCount;             // tiebreak by order count
    return score;
  }

  /** Return the filtered + sorted customer list for current state/query. */
  function getWalletSuggestionList(query = "") {
    const q = query.trim().toLowerCase();
    let list = [...allKnownWalletCustomers.values()];

    if (walletCustFilterState === "orders") {
      list = list.filter(c => c.hasOrders);
    }

    if (q) {
      list = list.filter(c =>
        (c.name  || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => walletSearchScore(b, q) - walletSearchScore(a, q));
    return list;
  }

  /** Sync the hidden <select> (keeps existing compat code working). */
  function populateWalletCustomerDropdown(filter = walletCustFilterState, searchQuery = "") {
    // Update state so getWalletSuggestionList picks it up
    walletCustFilterState = filter;
    const select = byId("wallet-quick-customer-select");
    if (!select) return;
    const list = getWalletSuggestionList(searchQuery);
    select.innerHTML = `<option value="">— (${list.length} customers) —</option>`;
    list.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.email;
      const orderTag = c.orderCount > 0 ? ` (${c.orderCount} order${c.orderCount === 1 ? "" : "s"})` : "";
      opt.textContent = `${c.name} · ${c.email}${orderTag}`;
      if (activeWalletCustomer && c.email === activeWalletCustomer) opt.selected = true;
      select.appendChild(opt);
    });
  }

  /** Close the autocomplete suggestion panel. */
  function closeWalletSuggestions() {
    const list = byId("wallet-suggestions-list");
    if (list) {
      list.style.display = "none";
      list.innerHTML = "";
    }
    walletSuggestActiveIdx = -1;
  }

  /** Render suggestion panel under the search input. */
  function renderWalletSuggestions(query) {
    const list = byId("wallet-suggestions-list");
    if (!list) return;

    const q = query.trim();

    // Show full list on focus even with no query, up to 50
    const matches = getWalletSuggestionList(q).slice(0, 50);
    walletSuggestActiveIdx = -1;

    if (!matches.length) {
      list.innerHTML = `<li class="wallet-suggestion-empty">${q ? `No customers match "<strong>${escWalletHtml(q)}</strong>"` : "No customers loaded yet."}</li>`;
      list.style.display = "block";
      return;
    }

    list.innerHTML = matches.map((c, i) => {
      const initials = (c.name || c.email || "?").charAt(0).toUpperCase();
      const orderTag = c.orderCount > 0
        ? `<span class="wallet-suggestion-orders">${c.orderCount} order${c.orderCount === 1 ? "" : "s"}</span>`
        : `<span class="wallet-suggestion-orders" style="opacity:.5">No orders</span>`;
      const spendTag = c.totalSpent > 0
        ? `₹${c.totalSpent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
        : "";
      return `<li class="wallet-suggestion-item" role="option" aria-selected="false"
                  data-email="${escWalletHtml(c.email)}" data-idx="${i}" tabindex="-1">
        <div class="wallet-suggestion-avatar">${initials}</div>
        <div class="wallet-suggestion-info">
          <div class="wallet-suggestion-name">${highlightMatch(c.name || "Unknown", q)}</div>
          <div class="wallet-suggestion-sub">${highlightMatch(c.email, q)}${c.phone ? ` · ${highlightMatch(c.phone, q)}` : ""}</div>
        </div>
        <div class="wallet-suggestion-meta">
          ${orderTag}
          ${spendTag ? `<div style="font-size:0.72rem;margin-top:2px;color:var(--text-2);">${spendTag}</div>` : ""}
        </div>
      </li>`;
    }).join("");

    list.style.display = "block";

    // Click to load
    list.querySelectorAll(".wallet-suggestion-item").forEach(item => {
      item.addEventListener("mousedown", e => {
        e.preventDefault(); // prevent blur before click
        const email = item.dataset.email;
        if (email) selectWalletCustomerFromSuggest(email);
      });
    });
  }

  /** Move keyboard highlight up/down in suggestion panel. */
  function moveWalletSuggestHighlight(dir) {
    const list = byId("wallet-suggestions-list");
    if (!list || list.style.display === "none") return;
    const items = list.querySelectorAll(".wallet-suggestion-item");
    if (!items.length) return;
    items.forEach(el => el.setAttribute("aria-selected", "false"));
    walletSuggestActiveIdx = Math.max(0, Math.min(items.length - 1, walletSuggestActiveIdx + dir));
    const active = items[walletSuggestActiveIdx];
    if (active) {
      active.setAttribute("aria-selected", "true");
      active.scrollIntoView({ block: "nearest" });
    }
  }

  /** Pick a customer from the suggestion list and load their wallet. */
  function selectWalletCustomerFromSuggest(email) {
    const input = byId("wallet-customer-search");
    // Fill input with the email so it shows what was selected
    if (input) input.value = email;
    const clearBtn = byId("wallet-customer-search-clear");
    if (clearBtn) clearBtn.style.display = "flex";
    closeWalletSuggestions();
    loadCustomerWallet(email);
  }

  // ── Search input wiring ────────────────────────────────────────────
  const _walletSearchInput = byId("wallet-customer-search");
  if (_walletSearchInput) {
    _walletSearchInput.addEventListener("input", e => {
      const val = e.target.value;
      const clearBtn = byId("wallet-customer-search-clear");
      if (clearBtn) clearBtn.style.display = val.trim() ? "flex" : "none";
      renderWalletSuggestions(val);
      populateWalletCustomerDropdown(walletCustFilterState, val);
    });

    _walletSearchInput.addEventListener("focus", e => {
      renderWalletSuggestions(e.target.value);
    });

    _walletSearchInput.addEventListener("keydown", e => {
      const list = byId("wallet-suggestions-list");
      const isOpen = list && list.style.display !== "none";
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!isOpen) renderWalletSuggestions(_walletSearchInput.value);
        moveWalletSuggestHighlight(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveWalletSuggestHighlight(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        // If a suggestion is highlighted, pick it
        if (isOpen && walletSuggestActiveIdx >= 0) {
          const active = list.querySelector(".wallet-suggestion-item[aria-selected='true']");
          if (active) { selectWalletCustomerFromSuggest(active.dataset.email); return; }
        }
        // Otherwise load whatever is typed (direct email entry)
        const val = _walletSearchInput.value.trim();
        if (val) { closeWalletSuggestions(); loadCustomerWallet(val); }
        else window.showAdminToast?.("Type a customer name, email or phone to search.", "warning");
      } else if (e.key === "Escape") {
        closeWalletSuggestions();
      }
    });

    // Close on click outside
    document.addEventListener("click", e => {
      if (!byId("wallet-search-container")?.contains(e.target)) {
        closeWalletSuggestions();
      }
    });
  }

  byId("wallet-customer-search-clear")?.addEventListener("click", () => {
    const input = byId("wallet-customer-search");
    if (input) { input.value = ""; input.focus(); }
    const clearBtn = byId("wallet-customer-search-clear");
    if (clearBtn) clearBtn.style.display = "none";
    closeWalletSuggestions();
    populateWalletCustomerDropdown(walletCustFilterState, "");
  });

  byId("wallet-load-customer-btn")?.addEventListener("click", () => {
    const val = byId("wallet-customer-search")?.value.trim();
    const selectVal = byId("wallet-quick-customer-select")?.value.trim();
    const target = val || selectVal;
    if (!target) {
      window.showAdminToast?.("Type a customer name, email or phone to search.", "warning");
      return;
    }
    // If typed value matches a known customer name, resolve to their email
    const q = target.toLowerCase();
    const match = [...allKnownWalletCustomers.values()].find(c =>
      c.email.toLowerCase() === q ||
      (c.name || "").toLowerCase() === q ||
      (c.phone || "") === q
    );
    closeWalletSuggestions();
    loadCustomerWallet(match ? match.email : target);
  });

  byId("wallet-quick-customer-select")?.addEventListener("change", e => {
    const email = e.target.value.trim();
    if (email) loadCustomerWallet(email);
  });

  // Filter pills
  byId("wallet-cust-filter-all")?.addEventListener("click", () => {
    walletCustFilterState = "all";
    updateCustFilterPillStyles("wallet-cust-filter-all");
    const q = byId("wallet-customer-search")?.value || "";
    populateWalletCustomerDropdown("all", q);
    renderWalletSuggestions(q);
  });
  byId("wallet-cust-filter-orders")?.addEventListener("click", () => {
    walletCustFilterState = "orders";
    updateCustFilterPillStyles("wallet-cust-filter-orders");
    const q = byId("wallet-customer-search")?.value || "";
    populateWalletCustomerDropdown("orders", q);
    renderWalletSuggestions(q);
  });
  byId("wallet-cust-filter-balance")?.addEventListener("click", () => {
    walletCustFilterState = "balance";
    updateCustFilterPillStyles("wallet-cust-filter-balance");
    window.showAdminToast?.("Search or select customer to inspect balance", "info");
    const q = byId("wallet-customer-search")?.value || "";
    populateWalletCustomerDropdown("all", q);
    renderWalletSuggestions(q);
  });

  function updateCustFilterPillStyles(activeId) {
    ["wallet-cust-filter-all", "wallet-cust-filter-orders", "wallet-cust-filter-balance"].forEach(id => {
      const el = byId(id);
      if (el) el.classList.toggle("active", id === activeId);
    });
  }

  byId("wallet-clear-customer-btn")?.addEventListener("click", () => {
    activeWalletCustomer = null;
    const wrap = byId("wallet-workspace-wrap");
    if (wrap) wrap.style.display = "none";
    byId("wallet-clear-customer-btn").style.display = "none";
    const input = byId("wallet-customer-search");
    if (input) { input.value = ""; }
    const clearBtn = byId("wallet-customer-search-clear");
    if (clearBtn) clearBtn.style.display = "none";
    closeWalletSuggestions();
    const select = byId("wallet-quick-customer-select");
    if (select) select.value = "";
  });

  byId("refresh-wallets-btn")?.addEventListener("click", async () => {
    const btn = byId("refresh-wallets-btn");
    btn.disabled = true;
    try {
      await loadWalletsSection();
      window.showAdminToast?.("Wallets ledger and balances refreshed", "success");
    } finally {
      btn.disabled = false;
    }
  });

  // ── Load Customer Wallet Profile ───────────────────────────────────────
  async function loadCustomerWallet(email) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) return;

    activeWalletCustomer = cleanEmail;
    const wrap = byId("wallet-workspace-wrap");
    if (wrap) wrap.style.display = "block";
    const closeBtn = byId("wallet-clear-customer-btn");
    if (closeBtn) closeBtn.style.display = "inline-flex";

    // Header info
    byId("wallet-customer-email").textContent = cleanEmail;
    byId("wallet-customer-name").textContent = "Loading customer…";
    byId("wallet-customer-avatar").textContent = cleanEmail.charAt(0).toUpperCase();

    // Copy email handler
    const copyBtn = byId("wallet-copy-email-btn");
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard?.writeText(cleanEmail).then(() => {
          const txt = byId("wallet-copy-email-text");
          if (txt) {
            txt.textContent = "Copied!";
            setTimeout(() => { txt.textContent = "Copy"; }, 1500);
          }
        }).catch(() => {
          window.showAdminToast?.("Email copied: " + cleanEmail, "info");
        });
      };
    }

    // Match known info from orders
    const matchedOrders = (orderDocuments || []).filter(d => {
      const data = d.data();
      const oEmail = String(data.email || data.user_email || "").trim().toLowerCase();
      return oEmail === cleanEmail;
    });

    let customerDisplayName = cleanEmail;
    let customerPhone = "No phone";
    let lifetimeSpend = 0;

    if (matchedOrders.length > 0) {
      matchedOrders.forEach(doc => {
        const od = doc.data();
        if (od.name && customerDisplayName === cleanEmail) customerDisplayName = od.name;
        if (od.phone && customerPhone === "No phone") customerPhone = od.phone;
        lifetimeSpend += Number(od.total || 0);
      });
    }

    byId("wallet-customer-name").textContent = customerDisplayName;
    byId("wallet-customer-phone-badge").textContent = customerPhone;
    byId("wallet-customer-spend").textContent = `₹${lifetimeSpend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    byId("wallet-customer-orders-count").textContent = `${matchedOrders.length} order${matchedOrders.length === 1 ? "" : "s"}`;

    // "View Orders" button handler: switch to Orders tab and pre-fill search with this customer email
    const viewOrdersBtn = byId("wallet-customer-view-orders-btn");
    if (viewOrdersBtn) {
      viewOrdersBtn.onclick = () => {
        if (typeof window.navigateTo === "function") {
          window.navigateTo("orders");
          setTimeout(() => {
            const ordSearch = byId("order-search");
            if (ordSearch) {
              ordSearch.value = cleanEmail;
              ordSearch.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }, 150);
        }
      };
    }

    // Populate Customer's Recent Orders dropdown for instant refund autofill
    populateCustomerOrdersAutofill(matchedOrders);

    // Fetch user doc for wallet balance and points
    try {
      const userDoc = await db.collection("users").doc(cleanEmail).get();
      let balance = 0;
      let points = 0;

      if (userDoc.exists) {
        const udata = userDoc.data();
        balance = Number(udata.wallet_balance || 0);
        points = Number(udata.walletPoints || 0);
        if (udata.name) byId("wallet-customer-name").textContent = udata.name;
        if (udata.phone) byId("wallet-customer-phone-badge").textContent = udata.phone;
      } else if (matchedOrders.length === 0) {
        byId("wallet-customer-name").textContent = "Unregistered Customer";
        byId("wallet-customer-phone-badge").textContent = "New wallet";
      }

      walletCurrentBalanceVal = balance;
      walletCurrentPointsVal = points;

      byId("wallet-customer-balance").textContent = `₹${balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      byId("wallet-customer-points").textContent = `${points} pts`;
      const ptsSub = byId("wallet-customer-points-sub");
      if (ptsSub) ptsSub.textContent = `Worth ₹${points} at store checkout`;

      // Update full balance chip visibility
      const fullChip = byId("wallet-chip-full-balance");
      if (fullChip) {
        fullChip.style.display = balance > 0 ? "inline-flex" : "none";
        fullChip.textContent = `Full Balance (₹${balance.toFixed(0)})`;
      }

      // Update submit button text preview
      updateWalletSubmitButtonText();

      // Load customer history records
      const historySnap = await db.collection("users").doc(cleanEmail).collection("wallet_history")
        .orderBy("createdAt", "desc").limit(50).get();

      customerWalletHistoryData = historySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderCustomerWalletHistory();
    } catch (err) {
      console.error("Error loading customer wallet:", err);
      window.showAdminToast?.("Error loading customer wallet details.", "danger");
    }
  }

  function populateCustomerOrdersAutofill(orders) {
    const sel = byId("wallet-customer-orders-select");
    if (!sel) return;

    if (!orders || orders.length === 0) {
      sel.innerHTML = '<option value="">— No previous orders found for this customer —</option>';
      sel.disabled = true;
      return;
    }

    sel.disabled = false;
    sel.innerHTML = '<option value="">— Select an order to autofill amount &amp; reason (' + orders.length + ') —</option>';
    orders.forEach(doc => {
      const od = doc.data();
      const orderNum = (od.order_id || doc.id || "").replace(/^#/, "");
      const total = Number(od.total || 0);
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.dataset.orderId = orderNum;
      opt.dataset.total = total;
      opt.textContent = `#${orderNum} · ₹${total} · ${od.status || "Order"} (${od.items?.length || 1} item${(od.items?.length || 1) === 1 ? "" : "s"})`;
      sel.appendChild(opt);
    });
  }

  byId("wallet-customer-orders-select")?.addEventListener("change", e => {
    const sel = e.target;
    const selectedOpt = sel.options[sel.selectedIndex];
    if (!selectedOpt || !selectedOpt.value) return;

    const total = parseFloat(selectedOpt.dataset.total) || 0;
    const orderId = selectedOpt.dataset.orderId || "";

    const amtInput = byId("wallet-action-amount");
    if (amtInput) amtInput.value = total;

    const ordInput = byId("wallet-action-order-id");
    if (ordInput) ordInput.value = `#${orderId}`;

    const reasonInput = byId("wallet-action-reason");
    if (reasonInput) reasonInput.value = `Refund for Order #${orderId}`;

    // Switch to credit mode if not already
    setWalletActionMode("credit");
    updateWalletSubmitButtonText();
    window.showAdminToast?.(`Autofilled Order #${orderId} details (₹${total})`, "info");
  });

  // Mode switcher tabs (Credit / Debit / Points)
  function setWalletActionMode(mode) {
    const typeInput = byId("wallet-action-type");
    if (typeInput) typeInput.value = mode;

    ["credit", "debit", "points"].forEach(m => {
      const btn = byId(`tab-mode-${m}`);
      if (btn) btn.classList.toggle("active", m === mode);
    });

    const amtLabel = byId("wallet-action-amount-label");
    const amtInput = byId("wallet-action-amount");
    const submitBtn = byId("wallet-action-submit-btn");

    if (mode === "points") {
      if (amtLabel) amtLabel.textContent = "Points to Adjust (★)";
      if (amtInput) {
        amtInput.placeholder = "e.g. 50";
        amtInput.step = "1";
      }
    } else {
      if (amtLabel) amtLabel.textContent = "Amount (₹)";
      if (amtInput) {
        amtInput.placeholder = "e.g. 150";
        amtInput.step = "any";
      }
    }

    if (submitBtn) {
      submitBtn.className = `wallet-submit-btn btn-${mode}`;
    }

    updateWalletSubmitButtonText();
  }

  byId("tab-mode-credit")?.addEventListener("click", () => setWalletActionMode("credit"));
  byId("tab-mode-debit")?.addEventListener("click", () => setWalletActionMode("debit"));
  byId("tab-mode-points")?.addEventListener("click", () => setWalletActionMode("points"));

  // Quick Amount preset chips
  document.querySelectorAll("#wallet-amount-chips [data-chip-amount]").forEach(btn => {
    btn.addEventListener("click", () => {
      const addVal = parseFloat(btn.getAttribute("data-chip-amount")) || 0;
      const amtInput = byId("wallet-action-amount");
      if (amtInput) {
        const cur = parseFloat(amtInput.value) || 0;
        amtInput.value = cur + addVal;
        updateWalletSubmitButtonText();
      }
    });
  });

  byId("wallet-chip-full-balance")?.addEventListener("click", () => {
    const amtInput = byId("wallet-action-amount");
    if (amtInput && walletCurrentBalanceVal > 0) {
      amtInput.value = walletCurrentBalanceVal;
      setWalletActionMode("debit");
      updateWalletSubmitButtonText();
    }
  });

  // Quick Reason preset chips
  document.querySelectorAll("#wallet-reason-chips [data-chip-reason]").forEach(btn => {
    btn.addEventListener("click", () => {
      const reason = btn.getAttribute("data-chip-reason");
      const rInput = byId("wallet-action-reason");
      if (rInput) rInput.value = reason;
    });
  });

  // Update submit button text dynamically
  function updateWalletSubmitButtonText() {
    const submitBtn = byId("wallet-action-submit-btn");
    if (!submitBtn) return;

    const mode = byId("wallet-action-type")?.value || "credit";
    const amt = parseFloat(byId("wallet-action-amount")?.value) || 0;
    const custEmail = activeWalletCustomer ? activeWalletCustomer.split("@")[0] : "Customer";

    if (mode === "credit") {
      submitBtn.textContent = amt > 0
        ? `✓ Credit ₹${amt.toFixed(2)} to ${custEmail}`
        : `✓ Process Credit / Refund`;
    } else if (mode === "debit") {
      submitBtn.textContent = amt > 0
        ? `⚠ Debit ₹${amt.toFixed(2)} from ${custEmail}`
        : `⚠ Process Debit Deduction`;
    } else if (mode === "points") {
      submitBtn.textContent = amt > 0
        ? `★ Credit ${Math.round(amt)} Reward Points to ${custEmail}`
        : `★ Adjust Loyalty Points`;
    }
  }

  byId("wallet-action-amount")?.addEventListener("input", updateWalletSubmitButtonText);

  // Render customer ledger table with search & filter
  function renderCustomerWalletHistory() {
    const tbody = byId("wallet-customer-history-tbody");
    if (!tbody) return;

    const searchQuery = String(byId("wallet-customer-history-search")?.value || "").trim().toLowerCase();
    let records = customerWalletHistoryData || [];

    if (walletCustTxFilterState === "credit") {
      records = records.filter(tx => (tx.type || "credit").toLowerCase() === "credit");
    } else if (walletCustTxFilterState === "debit") {
      records = records.filter(tx => (tx.type || "").toLowerCase() === "debit");
    }

    if (searchQuery) {
      records = records.filter(tx =>
        String(tx.title || "").toLowerCase().includes(searchQuery) ||
        String(tx.orderId || "").toLowerCase().includes(searchQuery) ||
        String(tx.processedBy || "").toLowerCase().includes(searchQuery)
      );
    }

    byId("wallet-customer-tx-count").textContent = `${records.length} entries`;

    if (records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="wallet-empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
              <strong>No transaction records found</strong>
              <p>${searchQuery ? "Try refining your search filter." : "Use the adjustment form on the left to issue a refund or credit."}</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = "";
    records.forEach(tx => {
      const isCredit = (tx.type || "credit").toLowerCase() === "credit";
      const isPoints = !!tx.isPoints;
      const amount = Number(tx.amount || 0);
      const tr = document.createElement("tr");

      let dateStr = "—";
      if (tx.createdAt) {
        const d = tx.createdAt.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
        }
      }

      const badgeHtml = isPoints
        ? `<span class="wallet-status-badge wallet-badge-points">★ Points (${isCredit ? "+" : "−"})</span>`
        : isCredit
          ? `<span class="wallet-status-badge wallet-badge-credit">↑ Credit (+)</span>`
          : `<span class="wallet-status-badge wallet-badge-debit">↓ Debit (−)</span>`;

      const amountFormatted = isPoints
        ? `<strong style="color: #b45309;">${isCredit ? "+" : "−"}${Math.round(amount)} pts</strong>`
        : `<strong style="color: ${isCredit ? '#047857;' : '#b91c1c;'}">${isCredit ? "+" : "−"}₹${amount.toFixed(2)}</strong>`;

      tr.innerHTML = `
        <td><span style="font-size: 0.8rem; color: var(--text-2); white-space: nowrap;">${dateStr}</span></td>
        <td>${badgeHtml}</td>
        <td>${amountFormatted}</td>
        <td><span style="font-weight: 600; color: var(--text-1);">${escapeHtml(tx.title || "Adjustment")}</span></td>
        <td>${tx.orderId ? `<button type="button" class="wallet-order-tag-btn" onclick="lookupAndShowOrder('${escapeHtml(tx.orderId)}')">#${escapeHtml(String(tx.orderId).replace(/^#/, ''))}</button>` : '<span style="color:var(--text-4);">—</span>'}</td>
        <td><span style="font-size: 0.76rem; color: var(--text-3); font-family: monospace;">${escapeHtml(tx.processedBy || "admin")}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Customer Ledger filter listeners
  document.querySelectorAll("[data-cust-tx-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      walletCustTxFilterState = btn.getAttribute("data-cust-tx-filter");
      document.querySelectorAll("[data-cust-tx-filter]").forEach(b => b.classList.toggle("active", b === btn));
      renderCustomerWalletHistory();
    });
  });

  byId("wallet-customer-history-search")?.addEventListener("input", renderCustomerWalletHistory);

  // Customer CSV export
  byId("wallet-customer-export-csv")?.addEventListener("click", () => {
    if (!activeWalletCustomer || !customerWalletHistoryData.length) {
      window.showAdminToast?.("No customer transactions to export.", "info");
      return;
    }
    const headers = ["Date", "Type", "Amount", "IsPoints", "Reason", "OrderID", "ProcessedBy"];
    const rows = customerWalletHistoryData.map(tx => {
      const d = tx.createdAt?.toDate ? tx.createdAt.toDate() : new Date(tx.createdAt || Date.now());
      const dateStr = !isNaN(d.getTime()) ? d.toISOString() : "";
      return [
        `"${dateStr}"`,
        `"${tx.type || 'credit'}"`,
        tx.amount || 0,
        tx.isPoints ? "TRUE" : "FALSE",
        `"${(tx.title || '').replace(/"/g, '""')}"`,
        `"${tx.orderId || ''}"`,
        `"${tx.processedBy || ''}"`
      ].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    downloadCsvBlob(csvContent, `wallet-statement-${activeWalletCustomer}.csv`);
    window.showAdminToast?.("Customer wallet statement exported to CSV", "success");
  });

  // Helper to trigger CSV download
  function downloadCsvBlob(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // Quick helper to jump from wallet history to order details
  window.lookupAndShowOrder = function(orderId) {
    const cleanId = String(orderId || "").trim();
    const doc = (orderDocuments || []).find(d => {
      const data = d.data();
      return (data.order_id && data.order_id === cleanId) || d.id === cleanId || ('#' + cleanId.replace(/^#/, '')) === data.order_id;
    });
    if (doc) {
      showOrderDetails(doc.id, doc.data());
    } else {
      window.showAdminToast?.("Order " + cleanId + " not found in current list.", "info");
    }
  };

  // Handle action form (Credit, Debit, or Points for selected customer)
  byId("wallet-action-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    if (!activeWalletCustomer) {
      window.showAdminToast?.("Please select or load a customer first.", "warning");
      return;
    }

    const type = byId("wallet-action-type")?.value || "credit";
    const amount = parseFloat(byId("wallet-action-amount")?.value);
    const orderId = byId("wallet-action-order-id")?.value?.trim() || "";
    const isPointsMode = type === "points";
    const reason = byId("wallet-action-reason")?.value?.trim() || (isPointsMode ? "Loyalty Reward Points" : type === "credit" ? "Store Credit" : "Adjustment");
    const submitBtn = byId("wallet-action-submit-btn");

    if (!amount || amount <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Processing…";

    try {
      await executeWalletTransaction({
        userEmail: activeWalletCustomer,
        customerName: byId("wallet-customer-name")?.textContent || "",
        amount,
        type: isPointsMode ? "credit" : type,
        isPoints: isPointsMode,
        reason,
        orderId
      });

      const successMsg = isPointsMode
        ? `✓ Added ${Math.round(amount)} reward points to ${activeWalletCustomer}!`
        : `✓ Successfully ${type === "credit" ? "credited" : "debited"} ₹${amount} for ${activeWalletCustomer}!`;

      window.showAdminToast?.(successMsg, "success");
      byId("wallet-action-amount").value = "";
      byId("wallet-action-order-id").value = "";
      byId("wallet-action-reason").value = "";

      await loadCustomerWallet(activeWalletCustomer);
      await loadGlobalWalletLogs();
    } catch (err) {
      reportError(err);
    } finally {
      submitBtn.disabled = false;
      updateWalletSubmitButtonText();
    }
  });

  // ── Load Global Storewide Wallet Audit Logs ────────────────────────────
  async function loadGlobalWalletLogs() {
    const tbody = byId("wallet-global-logs-tbody");
    if (!tbody) return;

    try {
      const logsSnap = await db.collection("wallet_logs").orderBy("createdAt", "desc").limit(100).get();
      globalWalletLogsData = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Compute storewide KPIs
      let totalCredited = 0;
      let totalDebited = 0;

      globalWalletLogsData.forEach(log => {
        if (!log.isPoints) {
          const amt = Number(log.amount || 0);
          if ((log.type || "credit").toLowerCase() === "credit") {
            totalCredited += amt;
          } else {
            totalDebited += amt;
          }
        }
      });

      const creditedKpi = byId("wallet-kpi-credited");
      if (creditedKpi) creditedKpi.textContent = `₹${totalCredited.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

      const debitedKpi = byId("wallet-kpi-debited");
      if (debitedKpi) debitedKpi.textContent = `₹${totalDebited.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

      const countKpi = byId("wallet-kpi-count");
      if (countKpi) countKpi.textContent = `${globalWalletLogsData.length} entries`;

      renderGlobalWalletLogs();
    } catch (err) {
      console.error("Error loading global wallet logs:", err);
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 18px;">Failed to load wallet activity ledger.</td></tr>';
    }
  }

  function renderGlobalWalletLogs() {
    const tbody = byId("wallet-global-logs-tbody");
    if (!tbody) return;

    const searchQuery = String(byId("wallet-global-search")?.value || "").trim().toLowerCase();
    let records = globalWalletLogsData || [];

    if (walletGlobalTxFilterState === "credit") {
      records = records.filter(log => (log.type || "credit").toLowerCase() === "credit");
    } else if (walletGlobalTxFilterState === "debit") {
      records = records.filter(log => (log.type || "").toLowerCase() === "debit");
    }

    if (searchQuery) {
      records = records.filter(log =>
        String(log.userEmail || "").toLowerCase().includes(searchQuery) ||
        String(log.customerName || "").toLowerCase().includes(searchQuery) ||
        String(log.reason || "").toLowerCase().includes(searchQuery) ||
        String(log.orderId || "").toLowerCase().includes(searchQuery)
      );
    }

    byId("wallet-global-log-count").textContent = `${records.length} entries`;

    if (records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="wallet-empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
              <strong>No transactions match filter criteria</strong>
              <p>${searchQuery ? "Try adjusting your search terms." : "No wallet or refund activity recorded yet across the store."}</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = "";
    records.forEach(log => {
      const isCredit = (log.type || "credit").toLowerCase() === "credit";
      const isPoints = !!log.isPoints;
      const amount = Number(log.amount || 0);
      const tr = document.createElement("tr");

      let dateStr = "—";
      if (log.createdAt) {
        const d = log.createdAt.toDate ? log.createdAt.toDate() : new Date(log.createdAt);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
        }
      }

      const badgeHtml = isPoints
        ? `<span class="wallet-status-badge wallet-badge-points">★ Points (${isCredit ? "+" : "−"})</span>`
        : isCredit
          ? `<span class="wallet-status-badge wallet-badge-credit">↑ Credit (+)</span>`
          : `<span class="wallet-status-badge wallet-badge-debit">↓ Debit (−)</span>`;

      const amountFormatted = isPoints
        ? `<strong style="color: #b45309;">${isCredit ? "+" : "−"}${Math.round(amount)} pts</strong>`
        : `<strong style="color: ${isCredit ? '#047857;' : '#b91c1c;'}">${isCredit ? "+" : "−"}₹${amount.toFixed(2)}</strong>`;

      tr.innerHTML = `
        <td><span style="font-size: 0.8rem; color: var(--text-2); white-space: nowrap;">${dateStr}</span></td>
        <td>
          <strong style="color: var(--text-1);">${escapeHtml(log.customerName || log.userEmail || "Customer")}</strong>
          <div style="font-size: 0.74rem; color: var(--text-3); font-family: monospace;">${escapeHtml(log.userEmail || "")}</div>
        </td>
        <td>${badgeHtml}</td>
        <td>${amountFormatted}</td>
        <td><span style="font-size: 0.85rem; font-weight: 600; color: var(--text-1);">${escapeHtml(log.reason || "Wallet transaction")}</span></td>
        <td>${log.orderId ? `<button type="button" class="wallet-order-tag-btn" onclick="lookupAndShowOrder('${escapeHtml(log.orderId)}')">#${escapeHtml(String(log.orderId).replace(/^#/, ''))}</button>` : '<span style="color:var(--text-4);">—</span>'}</td>
        <td>
          <button type="button" class="btn-table-action btn-secondary" onclick="loadCustomerWalletFromTable('${escapeHtml(log.userEmail)}')">
            Inspect Wallet
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    const noteEl = byId("wallet-global-pagination-note");
    if (noteEl) {
      noteEl.innerHTML = `<span>Showing <strong>${records.length}</strong> of <strong>${globalWalletLogsData.length}</strong> storewide audit transactions</span>`;
    }
  }

  // Global Activity filter listeners
  document.querySelectorAll("[data-global-tx-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      walletGlobalTxFilterState = btn.getAttribute("data-global-tx-filter");
      document.querySelectorAll("[data-global-tx-filter]").forEach(b => b.classList.toggle("active", b === btn));
      renderGlobalWalletLogs();
    });
  });

  byId("wallet-global-search")?.addEventListener("input", renderGlobalWalletLogs);

  // Global CSV Export handlers
  function exportAllWalletLogsCsv() {
    if (!globalWalletLogsData.length) {
      window.showAdminToast?.("No wallet transactions to export.", "info");
      return;
    }
    const headers = ["Timestamp", "CustomerName", "CustomerEmail", "Type", "Amount", "IsPoints", "Reason", "OrderID", "ProcessedBy"];
    const rows = globalWalletLogsData.map(log => {
      const d = log.createdAt?.toDate ? log.createdAt.toDate() : new Date(log.createdAt || Date.now());
      const dateStr = !isNaN(d.getTime()) ? d.toISOString() : "";
      return [
        `"${dateStr}"`,
        `"${(log.customerName || '').replace(/"/g, '""')}"`,
        `"${log.userEmail || ''}"`,
        `"${log.type || 'credit'}"`,
        log.amount || 0,
        log.isPoints ? "TRUE" : "FALSE",
        `"${(log.reason || '').replace(/"/g, '""')}"`,
        `"${log.orderId || ''}"`,
        `"${log.processedBy || ''}"`
      ].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    downloadCsvBlob(csvContent, `creative-souls-wallet-activity-ledger.csv`);
    window.showAdminToast?.("Storewide wallet audit log exported to CSV", "success");
  }

  byId("wallet-global-export-csv")?.addEventListener("click", exportAllWalletLogsCsv);
  byId("wallet-export-all-btn")?.addEventListener("click", exportAllWalletLogsCsv);

  window.loadCustomerWalletFromTable = function(email) {
    if (!email) return;
    loadCustomerWallet(email);
    byId("wallet-workspace-wrap")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Load catalog when section is activated ──────────────────────────────
  const _origNavigateTo = window.navigateTo;
  window.navigateTo = function(id, options) {
    const sectionId = _origNavigateTo(id, options);
    const isAdmin = ALLOWED_ADMINS.includes(String(auth.currentUser?.email || "").trim().toLowerCase());
    if (isAdmin && sectionId === "products" && catalogDocuments.length === 0) loadCatalogProducts();
    if (isAdmin && sectionId === "tickets") loadTickets();
    if (sectionId === "feedback") loadCustomerFeedback();
    if (isAdmin && sectionId === "wallets") loadWalletsSection();
    if (isAdmin && sectionId === "calculator") window.RateCalculator?.init?.();
    return sectionId;
  };

  auth.onAuthStateChanged(user => {
    const isAdmin = ALLOWED_ADMINS.includes(String(user?.email || "").trim().toLowerCase());
    tools.hidden = !isAdmin;
    login.hidden = !!user;
    if (isAdmin) {
      identity.textContent = `Signed in as ${user.email}`;
      status.textContent = "Loading dashboard…";
      loadOrders(); loadCollection(); loadTickets(); loadCustomerFeedback();
      if (document.querySelector("#section-products.active")) loadCatalogProducts();
      if (document.querySelector("#section-wallets.active")) loadWalletsSection();
      if (document.querySelector("#section-calculator.active")) window.RateCalculator?.init?.();
    } else if (user) {
      identity.textContent = `Signed in as ${user.email}. This account is not authorized for the admin dashboard.`;
      status.textContent = "Access denied.";
    } else {
      identity.textContent = "Sign in with the administrator Google account to continue.";
      status.textContent = "Not signed in.";
    }
  });
})();
