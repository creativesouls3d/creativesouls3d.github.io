(() => {
  function initQuickStatusFilters() {
    const filterWrap = byId("orders-quick-filters");
    if (!filterWrap) return;
    filterWrap.replaceChildren(...ORDER_WORKFLOW_STATUSES.map(stage => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-filter-pill";
      button.dataset.quickStatus = stage;
      button.textContent = stage;
      return button;
    }));
    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "admin-filter-pill active";
    allButton.dataset.quickStatus = "all";
    allButton.textContent = "All Orders";
    filterWrap.prepend(allButton);
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
          const actionSet = new Set(["Order Placed", "Order Approved", "Printing Product", "Order Dispatched", "Out For Delivery"]);
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
      const canonical = canonicalOrderStatus(order.status);
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
  let productColourDraft = [];
  let productSizeDraft = [];
  let productImageUrls = [];
  let productGifUrl = "";
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
  const ORDER_STATUS_CATEGORIES = [...ORDER_WORKFLOW_STATUSES, "Cancelled", "Rejected", "Other"];
  const orderStatusOptions = current => [...ORDER_WORKFLOW_STATUSES, "Cancelled", "Rejected"].map(item => `<option value="${item}"${item === current ? " selected" : ""}>${item}</option>`).join("");
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
    orderItemsDraft = Array.isArray(data.items) ? data.items.map(item => ({ ...item })) : [];
    byId("product-variant-builder").hidden = !isProduct;
    productColourDraft = isProduct ? readColourVariantSource(data) : [];
    productSizeDraft = isProduct ? readSizeVariantSource(data) : [];
    if (isOrder && creating) {
      renderOrderItemRows();
      populateOrderProductSelect();
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
    const preview = byId("product-image-preview");
    preview.replaceChildren();
    productImageUrls.forEach((url, index) => {
      const figure = document.createElement("figure");
      const image = document.createElement("img"); image.src = url; image.alt = `Product image ${index + 1}`;
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "btn-secondary"; remove.textContent = "Remove image";
      remove.addEventListener("click", () => { productImageUrls.splice(index, 1); renderProductMedia(); });
      figure.append(image, remove); preview.append(figure);
    });
    byId("product-gif-selection").textContent = productGifUrl ? "A GIF is saved for this product. Upload a file to replace it." : "No GIF selected.";
    byId("product-remove-gif").hidden = !productGifUrl;
  }
  function validateProductMedia(files, gif = false) {
    for (const file of files) {
      if (gif ? file.type !== "image/gif" : !file.type.startsWith("image/")) throw new Error(`${file.name}: choose ${gif ? "a GIF" : "an image"} file.`);
      if (file.size > IMAGEKIT_MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 25 MB.`);
    }
  }
  async function saveProductMedia(data, button) {
    const images = [...byId("product-image-files").files];
    const gifs = [...byId("product-gif-file").files];
    validateProductMedia(images);
    validateProductMedia(gifs, true);
    const upload = async file => {
      if (!productMediaUploads.has(file)) {
        const result = await uploadFileToImageKit(file, "/Product");
        if (!result.url) throw new Error("ImageKit did not return an image URL. Please retry.");
        productMediaUploads.set(file, result.url);
      }
      return productMediaUploads.get(file);
    };
    const urls = [...productImageUrls];
    for (let i = 0; i < images.length; i++) {
      button.textContent = `Uploading image ${i + 1} of ${images.length}…`;
      urls.push(await upload(images[i]));
    }
    data.imageUrl = urls.join(", ");
    button.textContent = gifs.length ? "Uploading GIF…" : "Saving product…";
    data.gifUrl = gifs.length ? await upload(gifs[0]) : productGifUrl;
    delete data.image_url; delete data.image;
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

    data.colourOptions = {};
    data.colourPrices = {};
    data.sizes = {};
    data.sizePrices = {};
    data.color = String(data.color ?? data.colour ?? "").trim() || colours.map(entry => entry.label).join(", ");
    delete data.colour;
    if (colours.length) {
      const colourOptions = {}; const colourPrices = {};
      colours.forEach(({ label, price }) => { colourOptions[label] = { order: Object.keys(colourOptions).length }; colourPrices[label] = price; });
      data.colourOptions = colourOptions;
      data.colourPrices = colourPrices;
    }
    if (sizes.length) {
      const sizeOptions = {}; const sizePrices = {};
      sizes.forEach(({ label, price }) => { sizeOptions[label] = { order: Object.keys(sizeOptions).length }; sizePrices[label] = price; });
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
      const fields = document.createElement("div"); fields.className = "order-item-row-fields";
      const quantityLabel = document.createElement("label"); quantityLabel.textContent = "Qty";
      const quantity = document.createElement("input"); quantity.type = "number"; quantity.min = "1"; quantity.step = "1"; quantity.value = Math.max(1, Number(item.quantity) || 1); quantity.dataset.itemQuantity = "true"; quantityLabel.append(quantity);
      const priceLabel = document.createElement("label"); priceLabel.textContent = "Unit price (INR)";
      const price = document.createElement("input"); price.type = "number"; price.min = "0"; price.step = "1"; price.value = Math.max(0, Number(item.price) || 0); price.dataset.itemPrice = "true"; priceLabel.append(price);
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "order-item-remove"; remove.textContent = "Remove"; remove.setAttribute("aria-label", `Remove ${row.dataset.productName}`);
      remove.addEventListener("click", () => { orderItemsDraft = readOrderItemRows(); orderItemsDraft.splice(index, 1); renderOrderItemRows(); });
      fields.append(quantityLabel, priceLabel, remove); row.append(name, fields); container.append(row);
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
      } else if (/status/i.test(key) && activeDocument.collection === "orders") {
        const select = document.createElement("select"); select.dataset.field = key;
        select.innerHTML = orderStatusOptions(canonicalOrderStatus(value));
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
      } else if (activeDocument.collection === "products" && (key === "description" || key === "tags")) {
        wrapper.classList.add("admin-field-full");
        const textarea = document.createElement("textarea");
        textarea.dataset.field = key;
        textarea.value = value ?? "";
        textarea.rows = key === "description" ? 4 : 3;
        if (key === "tags") textarea.placeholder = "Comma-separated tags";
        wrapper.append(textarea);
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
    const control = wrapper.querySelector("input, select, textarea");
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
    const canonical = canonicalOrderStatus(curStatus);
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
    statusInput.innerHTML = orderStatusOptions(canonical);
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
    const additional = Object.keys(order).filter(key => !shown.has(key));
    if (additional.length) {
      const section = document.createElement("section");
      section.className = "admin-detail-section section-additional-details";
      const heading = document.createElement("h3"); heading.textContent = "Additional details"; section.append(heading);
      const grid = document.createElement("div"); grid.className = "admin-detail-grid";
      additional.forEach(key => appendDetailValue(grid, key, order[key])); section.append(grid); layout.append(section);
    }
    content.append(layout);
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
  function canonicalOrderStatus(value) {
    const status = String(value || "Order Placed").trim().toLowerCase();
    if (/\b(delivered|product delivered)\b|delivery complete/.test(status)) return "Product Delivered";
    if (/out for delivery|delivery/.test(status)) return "Out For Delivery";
    if (/reject/.test(status)) return "Rejected";
    if (/cancel/.test(status)) return "Cancelled";
    if (/payment|due|request/.test(status)) return "Order Placed";
    if (/ship|dispatch/.test(status)) return "Order Dispatched";
    if (/print|production/.test(status)) return "Printing Product";
    if (/approve|confirm/.test(status)) return "Order Approved";
    if (/place|order placed/.test(status)) return "Order Placed";
    return "Other";
  }
  window.canonicalOrderStatus = canonicalOrderStatus;
  function updateOrderOverview(docs) {
    const cleanDocs = (docs || []).filter(doc => !isCustomerIgnored(doc.data(), doc.id));
    const orders = cleanDocs.map(doc => doc.data());
    const delivered = orders.filter(order => canonicalOrderStatus(order.status) === "Product Delivered").length;
    const actionStatuses = new Set(["Order Placed", "Order Approved", "Printing Product", "Order Dispatched", "Out For Delivery", "Other"]);
    const needsAction = orders.filter(order => actionStatuses.has(canonicalOrderStatus(order.status))).length;
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
    const terminal = new Set(["Product Delivered", "Cancelled", "Rejected"]);
    const attention = orderDocuments.map(doc => {
      const order = doc.data();
      if (isCustomerIgnored(order, doc.id)) return null;
      const canonicalStatus = canonicalOrderStatus(order.status);
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
      const detail = document.createElement("span"); detail.textContent = `${canonicalOrderStatus(order.status)} · ${reasons.join(" · ")}`;
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
      if (selectedStatuses.length && !selectedStatuses.includes(canonicalOrderStatus(order.status))) return false;
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
      if (chartSelection.kind === "status") return canonicalOrderStatus(order.status) === chartSelection.value;
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
      const canonical = canonicalOrderStatus(order.status);
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
      const snapshot = await db.collection("products").get();
      adminProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(product => product.productName && Number.isFinite(Number(product.price)));
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
          payment_status: "cash on delivery",
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
      clone.payment_status = clone.payment_status === "paid" ? "pending" : (clone.payment_status || "cash on delivery");
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
  byId("add-order-product").addEventListener("click", () => {
    orderItemsDraft = readOrderItemRows();
    const product = adminProducts.find(item => item.id === byId("order-product-select").value);
    if (!product) { byId("editor-error").textContent = "Choose a product to add."; return; }
    const existing = orderItemsDraft.find(item => item.id === product.id && !item.colour && !item.size);
    if (existing) existing.quantity = Math.max(1, Number(existing.quantity) || 1) + 1;
    else orderItemsDraft.push({
      id: product.id,
      productName: product.productName || "Untitled product",
      imageUrl: firstProductImage(product.imageUrl || product.image_url || product.image),
      price: Math.max(0, Number(product.price) || 0),
      quantity: 1,
      colour: "",
      size: "",
      customizable: product.customizable === true,
      customization: ""
    });
    byId("order-product-select").value = "";
    byId("editor-error").textContent = "";
    renderOrderItemRows();
  });
  byId("order-item-rows").addEventListener("input", updateOrderItemPreview);
  byId("create-product").addEventListener("click", createAdminProduct);
  byId("product-image-files").addEventListener("change", () => renderTicketMediaSelection(byId("product-image-files"), byId("product-image-selection")));
  byId("product-gif-file").addEventListener("change", () => renderTicketMediaSelection(byId("product-gif-file"), byId("product-gif-selection")));
  byId("product-remove-gif").addEventListener("click", () => { productGifUrl = ""; byId("product-gif-file").value = ""; renderProductMedia(); });
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
  byId("editor-close").addEventListener("click", () => dialog.close());
  byId("editor-cancel").addEventListener("click", () => dialog.close());
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
    return catalogDocuments.filter(doc => {
      const p = doc.data();
      if (category && String(p.category || "").toLowerCase() !== category.toLowerCase()) return false;
      if (availability && String(p.availability || "In Stock").toLowerCase() !== availability.toLowerCase()) return false;
      if (query) {
        const searchable = [p.productName, p.description, p.category, p.tags, p.colour, p.color, p.bestFor].map(v => String(v || "")).join(" ").toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return true;
    });
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
        const desc = document.createElement("div"); desc.className = "catalog-product-desc"; desc.textContent = p.description; body.append(desc);
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
              ${opts.showDescription && p.description ? `<div class="product-desc">${esc(p.description)}</div>` : ""}
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
            ${opts.showDescription && p.description ? `<div class="product-desc">${esc(p.description)}</div>` : ""}
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
    const canonical = canonicalOrderStatus(status);
    if (ORDER_WORKFLOW_STATUSES.includes(canonical)) return `${canonical} ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();

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
      case "Order Dispatched":
        return `Order Ready for Dispatch ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
      case "Out For Delivery":
        return `Order Dispatched & Shipped ${idStr} — Creative Souls 3D`.replace(/\s+/g, " ").trim();
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
    const displayId = cleanId ? `#${cleanId}` : "—";
    const status = String(order.status || "Order Placed").trim();
    const canonicalSt = canonicalOrderStatus(status);
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
      "Shipped":            { emoji: "🚚", color: "#ffffff", bg: "#1d4ed8", border: "#3b82f6" },
      "Delivered":          { emoji: "🎉", color: "#ffffff", bg: "#16a34a", border: "#22c55e" },
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
        statusDescription = "We hope your 3D printed creations arrived safely and bring joy to you! We loved making them for you. If you have a moment, we would love to see your items — feel free to tag us on Instagram <strong>@creative.souls3d</strong> or reply to this email with your feedback.";
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
      statusHeadline = "Your order has been dispatched!";
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
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
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
    :root { color-scheme: light only; }
  </style>
</head>
<body style="margin:0; padding:0; color-scheme:light; background-color:#f1f5f9; font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased; color:#334155;">

  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" class="email-bg-wrapper" style="background-color:#f1f5f9; padding:32px 12px; width:100%;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" class="email-main-card" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 6px 24px rgba(0,0,0,0.12); border:1px solid #cbd5e1;">

        <!-- Brand Header -->
        <tr>
          <td bgcolor="#ffffff" class="email-header-cell" style="background-color:#ffffff; padding:36px 36px 30px; text-align:center; color:#0f172a;">
            <div style="font-size:11px; font-weight:800; letter-spacing:0.18em; text-transform:uppercase; color:#f59e0b; margin-bottom:8px;">CREATIVE SOULS 3D</div>
            <div style="font-size:23px; font-weight:900; color:#ffffff; letter-spacing:-0.02em; margin:0 0 14px;">Order Status Update</div>
            <div style="display:inline-block; background-color:${sc.bg}; background-image:linear-gradient(${sc.bg},${sc.bg}); color:${sc.color} !important; border:1.5px solid ${sc.border}; padding:6px 20px; border-radius:999px; font-size:13px; font-weight:800;">
              ${sc.emoji} ${esc(canonicalSt)}
            </div>
          </td>
        </tr>

        <!-- Main Body -->
        <tr>
          <td bgcolor="#ffffff" class="email-body-cell" style="padding:32px 36px; background-color:#ffffff;">

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
    // Use explicit light colors and plain fills. Gradient backgrounds are
    // frequently treated differently by mobile email clients in dark mode.
    const lightColors = {
      "#0b0f19": "#f1f5f9", "#0f172a": "#ffffff", "#1e293b": "#f8fafc",
      "#090d16": "#e2e8f0", "#2a1b08": "#fffbeb", "#064e3b": "#ecfdf5",
      "#451a03": "#fffbeb"
    };
    const darkTextColors = {
      "#ffffff": "#0f172a", "#f8fafc": "#0f172a", "#cbd5e1": "#334155",
      "#e2e8f0": "#1e293b", "#94a3b8": "#475569", "#d1fae5": "#065f46",
      "#fef3c7": "#78350f", "#fde68a": "#78350f", "#fbbf24": "#92400e"
    };
    return html
      .replace(/background-image:\s*linear-gradient\([^;]*\);?/gi, "")
      .replace(/background-color:\s*(#[\da-f]{3,8})/gi, (match, color) => `background-color:${lightColors[color.toLowerCase()] || color}`)
      .replace(/(?<!background-)color:\s*(#[\da-f]{3,8})/gi, (match, color) => `color:${darkTextColors[color.toLowerCase()] || color}`);
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
    const canonicalSt = canonicalOrderStatus(status);
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
    if (titleEl) titleEl.textContent = `Customer Email: ${cleanId ? '#' + cleanId : 'Order'} (${canonicalOrderStatus(order.status)})`;
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
    openOrderNotificationPreview(order);
  }

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
    preview.textContent = typed.trim()
      ? formatTicketReplyEmail(activeTicket.data, typed)
      : "Type a reply to preview the Gmail message.";
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
    preview.replaceChildren();
    [...input.files].forEach(file => {
      const name = document.createElement("div");
      name.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
      preview.append(name);
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
      const grid = document.createElement("div");
      grid.className = "ticket-attachments";
      files.forEach(file => {
        const link = document.createElement("a");
        link.href = file.url || "#";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        const isVideo = String(file.fileType || "").toLowerCase().includes("video") || /\.(mp4|webm|mov|m4v|avi|mkv|ogv)(?:[?#]|$)/i.test(file.url || "");
        const figure = document.createElement("figure");
        if (isVideo) {
          const video = document.createElement("video");
          video.src = file.url;
          video.controls = true;
          video.preload = "metadata";
          figure.append(video);
        } else {
          const img = document.createElement("img");
          img.src = file.thumbnailUrl || file.url;
          img.alt = file.name || "Attachment";
          figure.append(img);
        }
        const caption = document.createElement("figcaption");
        link.textContent = file.name || "Open attachment";
        caption.append(link);
        figure.append(caption);
        grid.append(figure);
      });
      section.append(grid);
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
      const preview = document.createElement("div");
      preview.className = "ticket-media-selection";
      preview.setAttribute("aria-live", "polite");
      input.addEventListener("change", () => renderTicketMediaSelection(input, preview));
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
      box.append(label, input, preview, button, message);
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
      label.textContent = "Type the reply in your own words. We will format it into a professional Gmail draft.";
      const textarea = document.createElement("textarea");
      textarea.id = "ticket-reply-input";
      textarea.placeholder = "Example: We checked the photos and will reprint the keychain. A replacement will be dispatched in 2 days.";
      const preview = document.createElement("div");
      preview.className = "ticket-email-preview";
      preview.innerHTML = "<strong>Gmail message preview</strong>";
      const pre = document.createElement("pre");
      pre.id = "ticket-email-preview";
      preview.append(pre);
      textarea.addEventListener("input", updateTicketEmailPreview);
      box.append(label, textarea, preview);
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
    const formatted = formatTicketReplyEmail(ticket, typed);
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
    byId("tc-media-preview").replaceChildren();
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
  byId("tc-media")?.addEventListener("change", () => renderTicketMediaSelection(byId("tc-media"), byId("tc-media-preview")));
  byId("ticket-create-cancel")?.addEventListener("click", () => ticketCreateDialog.close());
  byId("ticket-create-close")?.addEventListener("click", () => ticketCreateDialog.close());

  // ── Load catalog when section is activated ──────────────────────────────
  const _origNavigateTo = window.navigateTo;
  window.navigateTo = function(id, options) {
    const sectionId = _origNavigateTo(id, options);
    const isAdmin = ALLOWED_ADMINS.includes(String(auth.currentUser?.email || "").trim().toLowerCase());
    if (isAdmin && sectionId === "products" && catalogDocuments.length === 0) loadCatalogProducts();
    if (isAdmin && sectionId === "tickets") loadTickets();
    return sectionId;
  };

  auth.onAuthStateChanged(user => {
    const isAdmin = ALLOWED_ADMINS.includes(String(user?.email || "").trim().toLowerCase());
    tools.hidden = !isAdmin;
    login.hidden = !!user;
    if (isAdmin) {
      identity.textContent = `Signed in as ${user.email}`;
      status.textContent = "Loading dashboard…";
      loadOrders(); loadCollection(); loadTickets();
      if (document.querySelector("#section-products.active")) loadCatalogProducts();
    } else if (user) {
      identity.textContent = `Signed in as ${user.email}. This account is not authorized for the admin dashboard.`;
      status.textContent = "Access denied.";
    } else {
      identity.textContent = "Sign in with the administrator Google account to continue.";
      status.textContent = "Not signed in.";
    }
  });
})();
