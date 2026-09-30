(() => {
  const ADMIN_EMAIL = "luvs2006@gmail.com";
  const byId = id => document.getElementById(id);
  const identity = byId("admin-identity");
  const status = byId("admin-status");
  const tools = byId("admin-tools");
  const login = byId("admin-login");
  const dialog = byId("document-editor");
  const jsonInput = byId("document-json");
  let activeDocument = null;
  let editorModel = {};
  let advancedEditorUsed = false;
  let adminProducts = [];
  let orderItemsDraft = [];
  let orderDocuments = [];
  const selectedOrderIds = new Set();
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
  const ORDER_STATUS_CATEGORIES = ["Order Placed", "Payment Pending", "Request Received", "Confirmed", "In Production", "Ready for Dispatch", "Shipped", "Delivered", "Cancelled", "Rejected", "Other"];

  function errorText(error) {
    if (error?.code === "permission-denied") return "Firestore denied this action. Update Security Rules to authorize this administrator and preserve required customer access.";
    return error?.message || "The database request failed.";
  }
  function reportError(error) { status.textContent = errorText(error); console.error(error); }
  function validCollectionPath(path) {
    const parts = path.split("/");
    return parts.length % 2 === 1 && parts.every(part => part.trim() && part !== "." && part !== "..");
  }
  function plainData(data) {
    function convert(value) {
      if (value && typeof value.toDate === "function") return { __firestoreType: "timestamp", value: value.toDate().toISOString() };
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
  function openEditor({ collection, id, data, creating }) {
    activeDocument = { collection, id, creating };
    byId("editor-title").textContent = creating ? `Create ${collection === "orders" ? "order" : "record"}` : `Edit ${collection === "orders" ? "order" : "record"}`;
    byId("editor-eyebrow").textContent = collection === "orders" ? "ORDER MANAGEMENT" : "RECORD DETAILS";
    byId("editor-location").textContent = `${collection}/${id}`;
    byId("editor-intro").textContent = collection === "orders"
      ? "Update customer, delivery, payment, and status details. Save your changes when finished."
      : "Update the labeled fields below. Changes are saved to this Firestore document.";
    byId("advanced-editor-summary").textContent = collection === "orders" ? "Order items and advanced data" : "Advanced: edit full document data";
    byId("advanced-editor-help").textContent = collection === "orders"
      ? "Edit line items or less common order fields here. Keep the JSON valid before saving."
      : "Use this for nested data such as order items or complex product options.";
    byId("new-field-name").placeholder = collection === "orders" ? "Add an order field" : "New field (e.g. productName)";
    byId("editor-error").textContent = "";
    editorModel = JSON.parse(plainData(data));
    advancedEditorUsed = false;
    byId("advanced-editor").open = false;
    jsonInput.value = plainData(data);
    byId("order-item-builder").hidden = collection !== "orders" || !creating;
    orderItemsDraft = Array.isArray(data.items) ? data.items.map(item => ({ ...item })) : [];
    if (collection === "orders" && creating) {
      renderOrderItemRows();
      populateOrderProductSelect();
    }
    renderEditorFields();
    dialog.showModal();
  }

  function firstProductImage(value) {
    return (Array.isArray(value) ? value : String(value || "").split(","))
      .map(url => String(url || "").trim()).find(Boolean) || "logo_creativesouls.jpg";
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
  function displayField(key, value) {
    const wrapper = document.createElement("div"); wrapper.className = "admin-field";
    const labelRow = document.createElement("div"); labelRow.className = "admin-field-label";
    const label = document.createElement("label"); label.textContent = humanize(key); label.htmlFor = `field-${key}`;
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Remove field";
    remove.addEventListener("click", () => {
      editorModel = readEditorFields(); delete editorModel[key];
      advancedEditorUsed = false; jsonInput.value = plainData(editorModel); renderEditorFields();
    });
    labelRow.append(label, remove); wrapper.append(labelRow);
    if (value && typeof value === "object" && value.__firestoreType === "timestamp") {
      const input = document.createElement("input"); input.type = "datetime-local"; input.dataset.field = key;
      input.value = Number.isNaN(Date.parse(value.value)) ? "" : new Date(value.value).toISOString().slice(0, 16);
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
      if (/status/i.test(key) && activeDocument.collection === "orders") {
        const select = document.createElement("select"); select.dataset.field = key;
        const values = [...ORDER_STATUS_CATEGORIES.filter(item => item !== "Other")];
        if (value && !values.includes(value)) values.unshift(value);
        values.forEach(item => { const option = document.createElement("option"); option.value = item; option.textContent = item; select.append(option); });
        if (value) select.value = String(value);
        wrapper.append(select);
      } else if (key === "fulfillment_type" && activeDocument.collection === "orders") {
        const select = document.createElement("select"); select.dataset.field = key;
        [["delivery", "Delivery"], ["pickup", "Pickup"]].forEach(([optionValue, text]) => {
          const option = document.createElement("option"); option.value = optionValue; option.textContent = text; select.append(option);
        });
        if (value) select.value = String(value).toLowerCase();
        wrapper.append(select);
      } else if (/address|note|expected.?delivery/i.test(key)) {
        const textarea = document.createElement("textarea");
        textarea.dataset.field = key;
        textarea.value = value ?? "";
        textarea.rows = 3;
        wrapper.append(textarea);
      } else wrapper.append(input);
    } else {
      const note = document.createElement("span"); note.className = "admin-field-help"; note.textContent = "Complex value. Edit it in the Advanced section below."; wrapper.append(note);
    }
    const control = wrapper.querySelector("input, select, textarea");
    if (control) { control.id = `field-${key}`; control.name = key; }
    return wrapper;
  }
  function renderEditorFields() {
    const fields = byId("editor-fields"); fields.replaceChildren();
    const entries = Object.entries(editorModel).filter(([key]) => !(activeDocument?.collection === "orders" && key === "items"));
    if (activeDocument?.collection !== "orders") {
      entries.forEach(([key, value]) => fields.append(displayField(key, value)));
      return;
    }

    const groups = [
      { title: "Order status", description: "Order reference, current status, and placement time.", keys: ["order_id", "status", "timestamp", "expected_delivery"] },
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
      const title = document.createElement("h3"); title.textContent = "Other order details";
      const description = document.createElement("p"); description.textContent = "Less common fields. Use the advanced section for nested values such as line items.";
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
        updated[key] = control.value ? { __firestoreType: "timestamp", value: new Date(control.value).toISOString() } : null;
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
      const ref = db.collection(activeDocument.collection).doc(activeDocument.id);
      await ref.set(data);
      dialog.close();
      status.textContent = "Document saved.";
      if (activeDocument.collection === "orders") await loadOrders();
      if (activeDocument.collection === byId("collection-name").value.trim()) await loadCollection();
    } catch (error) {
      byId("editor-error").textContent = error instanceof SyntaxError ? "The JSON is invalid. Check commas, quotes, and braces." : errorText(error);
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
      actions.append(edit, remove); row.append(main, actions); container.append(row);
    });
  }
  function orderDate(value) {
    const date = value && typeof value.toDate === "function" ? value.toDate() : value ? new Date(value) : null;
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
      const heading = document.createElement("strong"); heading.textContent = `${humanize(label)} (${value.length})`; item.append(heading);
      if (!value.length) { const empty = document.createElement("div"); empty.textContent = "No entries"; item.append(empty); }
      value.forEach((entry, index) => {
        const card = document.createElement("div"); card.className = "admin-detail-section";
        if (entry && typeof entry === "object") Object.entries(entry).forEach(([key, child]) => appendDetailValue(card, key, child));
        else card.textContent = String(entry ?? "—");
        item.append(card);
      });
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
      const heading = document.createElement("strong"); heading.textContent = humanize(label); item.append(heading);
      Object.entries(value).forEach(([key, child]) => appendDetailValue(item, key, child));
    } else {
      item.className = "admin-detail-value"; const name = document.createElement("strong"); name.textContent = humanize(label);
      item.append(name, document.createTextNode(value === null || value === "" || value === undefined ? "—" : String(value)));
    }
    parent.append(item);
  }
  function showOrderDetails(id, order) {
    order = JSON.parse(plainData(order));
    byId("order-detail-title").textContent = order.order_id || id;
    const content = byId("order-detail-content"); content.replaceChildren();
    const categories = [
      ["Order and status", ["order_id", "status", "approved", "timestamp", "expected_delivery", "order_type"]],
      ["Customer", ["name", "email", "phone"]],
      ["Delivery or pickup", ["fulfillment_type", "address", "pickup_location"]],
      ["Items and request", ["items", "service_request", "order_note"]],
      ["Payment and totals", ["item_total", "delivery_charge", "discount", "coupon_code", "total", "payment_ref", "payment_status", "mop", "upi_id"]]
    ];
    const shown = new Set();
    categories.forEach(([title, keys]) => {
      const entries = keys.filter(key => Object.hasOwn(order, key));
      if (!entries.length) return;
      const section = document.createElement("section"); section.className = "admin-detail-section";
      const heading = document.createElement("h3"); heading.textContent = title; section.append(heading);
      const grid = document.createElement("div"); grid.className = "admin-detail-grid";
      entries.forEach(key => { shown.add(key); appendDetailValue(grid, key, order[key]); });
      section.append(grid); content.append(section);
    });
    const additional = Object.keys(order).filter(key => !shown.has(key));
    if (additional.length) {
      const section = document.createElement("section"); section.className = "admin-detail-section";
      const heading = document.createElement("h3"); heading.textContent = "Additional details"; section.append(heading);
      const grid = document.createElement("div"); grid.className = "admin-detail-grid";
      additional.forEach(key => appendDetailValue(grid, key, order[key])); section.append(grid); content.append(section);
    }
    byId("order-detail-edit").onclick = () => {
      byId("order-detail-dialog").close();
      openEditor({ collection: "orders", id, data: order, creating: false });
    };
    byId("order-detail-dialog").showModal();
  }
  function formatOrderMoney(value) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
  }
  function canonicalOrderStatus(value) {
    const status = String(value || "Order Placed").trim().toLowerCase();
    if (/deliver/.test(status)) return "Delivered";
    if (/reject/.test(status)) return "Rejected";
    if (/cancel/.test(status)) return "Cancelled";
    if (/payment|due/.test(status)) return "Payment Pending";
    if (/ship|dispatch/.test(status)) return /ready|dispatch/.test(status) ? "Ready for Dispatch" : "Shipped";
    if (/print(ing)? complete|production complete/.test(status)) return "Ready for Dispatch";
    if (/print|production/.test(status)) return "In Production";
    if (/confirm/.test(status)) return "Confirmed";
    if (/request/.test(status)) return "Request Received";
    if (/place|order placed/.test(status)) return "Order Placed";
    return "Other";
  }
  function updateOrderOverview(docs) {
    const orders = docs.map(doc => doc.data());
    const delivered = orders.filter(order => canonicalOrderStatus(order.status) === "Delivered").length;
    const actionStatuses = new Set(["Order Placed", "Payment Pending", "Request Received", "Confirmed", "In Production", "Ready for Dispatch", "Other"]);
    const needsAction = orders.filter(order => actionStatuses.has(canonicalOrderStatus(order.status))).length;
    byId("stat-total-orders").textContent = String(orders.length);
    byId("stat-open-orders").textContent = String(needsAction);
    byId("stat-delivered-orders").textContent = String(delivered);
    byId("stat-order-value").textContent = formatOrderMoney(orders.reduce((sum, order) => sum + Number(order.total || 0), 0));

  }
  function orderTimestamp(value) {
    const date = value && typeof value.toDate === "function" ? value.toDate() : value && typeof value === "object" && value.__firestoreType === "timestamp" ? new Date(value.value) : value ? new Date(value) : null;
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
      const time = orderTimestamp(doc.data().timestamp);
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
      const bar = svgElement("rect", { x, y: baseline - height, width: barWidth, height, rx: Math.min(5, barWidth / 3), class: "admin-chart-bar" });
      const title = svgElement("title"); title.textContent = `${point.label}: ${point.count} order${point.count === 1 ? "" : "s"}`; bar.append(title); svg.append(bar);
      const selection = timeChartSelection(point.date, mode, point.label);
      makeChartMarkInteractive(bar, selection, `Filter orders for ${point.label}`);
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
    const svg = svgElement("svg", { viewBox: `0 0 520 ${Math.max(240, present.length * 34 + 20)}`, role: "group", "aria-label": "Orders by status chart. Select a status to filter the table." });
    const max = Math.max(1, ...present.map(category => counts.get(category)));
    present.forEach((category, index) => {
      const y = 12 + index * 34; const label = svgElement("text", { x: 0, y: y + 14, class: "admin-status-bar-label" }); label.textContent = category; svg.append(label);
      const x = 165, width = 260 * counts.get(category) / max; const bar = svgElement("rect", { x, y, width: Math.max(width, 2), height: 18, rx: 6, class: "admin-status-bar" });
      const title = svgElement("title"); title.textContent = `${category}: ${counts.get(category)} orders`; bar.append(title); svg.append(bar);
      const selection = { kind: "status", value: category, label: `Status: ${category}` };
      makeChartMarkInteractive(label, selection, `Filter orders with status ${category}`); makeChartMarkInteractive(bar, selection, `Filter orders with status ${category}`);
      const value = svgElement("text", { x: x + Math.max(width, 2) + 9, y: y + 14 }); value.textContent = String(counts.get(category)); makeChartMarkInteractive(value, selection, `Filter orders with status ${category}`); svg.append(value);
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
      const bar = svgElement("rect", { x, y: baseline - barHeight, width, height: barHeight, rx: 4, class: "admin-chart-bar" });
      const title = svgElement("title"); title.textContent = `${point.label}: ₹${money(point.amount)}`; bar.append(title);
      const selection = timeChartSelection(point.date, mode, point.label);
      makeChartMarkInteractive(bar, selection, `Filter orders for ${point.label}`); svg.append(bar);
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
    const svg = svgElement("svg", { viewBox: `0 0 560 ${Math.max(220, ranked.length * rowHeight + 12)}`, role: "group", "aria-label": `${selectionKind === "product" ? "Top products" : "Payment methods"} chart. Select a mark to filter the table.` });
    const max = Math.max(1, ...ranked.map(entry => entry.value));
    ranked.forEach((entry, index) => {
      const y = 8 + index * rowHeight;
      const selection = { kind: selectionKind, value: entry.label, label: `${selectionKind === "product" ? "Product" : "Payment method"}: ${entry.label}` };
      const accessibleLabel = `Filter orders by ${selectionKind === "product" ? "product" : "payment method"}: ${entry.label}`;
      const label = svgElement("text", { x: 0, y: y + 14, class: "admin-status-bar-label" }); label.textContent = entry.label.length > 22 ? `${entry.label.slice(0, 20)}…` : entry.label; makeChartMarkInteractive(label, selection, accessibleLabel); svg.append(label);
      const x = 190, width = 270 * entry.value / max;
      const bar = svgElement("rect", { x, y, width: Math.max(width, 2), height: 18, rx: 6, class: "admin-status-bar" });
      const title = svgElement("title"); title.textContent = `${entry.label}: ${formatter(entry.value)}`; bar.append(title); makeChartMarkInteractive(bar, selection, accessibleLabel); svg.append(bar);
      const value = svgElement("text", { x: x + Math.max(width, 2) + 8, y: y + 14 }); value.textContent = formatter(entry.value); makeChartMarkInteractive(value, selection, accessibleLabel); svg.append(value);
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
    const email = String(order.email || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase() || "";
    if (email) return { key: `email:${email}`, label: email, canIgnoreCustomer: true };
    const phone = String(order.phone || "").replace(/\D/g, "");
    if (phone) return { key: `phone:${phone}`, label: phone, canIgnoreCustomer: true };
    const name = String(order.name || "Customer details missing").trim();
    return { key: `order:${documentId}`, label: `${name} · ${order.order_id || documentId} (this order only)`, canIgnoreCustomer: false };
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
      });
      row.append(name, restore); list.append(row);
    });
  }
  function renderAttentionQueue() {
    const target = byId("admin-attention-queue");
    const now = Date.now();
    const terminal = new Set(["Delivered", "Cancelled", "Rejected"]);
    const attention = orderDocuments.map(doc => {
      const order = doc.data();
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
      if (ignoredCustomers.has(customerIdentity(order, doc.id).key)) return false;
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
      const statusCell = cell(order.status || "Order Placed");
      statusCell.firstElementChild.className = "admin-order-status";
      row.append(statusCell);
      const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(order.total || 0));
      row.append(cell(amount, order.coupon_code ? `Coupon: ${order.coupon_code}` : ""));
      const actionCell = document.createElement("td"); const actions = document.createElement("div"); actions.className = "admin-actions";
      const invoice = document.createElement("button"); invoice.type = "button"; invoice.textContent = "Download invoice";
      invoice.setAttribute("aria-label", `Download invoice for order ${orderNumber}`);
      invoice.addEventListener("click", () => downloadInvoice(order));
      const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit";
      edit.addEventListener("click", () => openEditor({ collection: "orders", id: doc.id, data: order, creating: false }));
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Delete"; remove.className = "danger";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return;
        try { await db.collection("orders").doc(doc.id).delete(); status.textContent = "Order deleted."; await loadOrders(); }
        catch (error) { reportError(error); }
      });
      const identity = customerIdentity(order, doc.id);
      const ignore = document.createElement("button"); ignore.type = "button"; ignore.textContent = identity.canIgnoreCustomer ? "Ignore customer" : "Ignore this order";
      ignore.title = identity.canIgnoreCustomer ? "Hide all orders for this customer from the table and CSV export" : "Hide this order because it has no customer email or phone";
      ignore.addEventListener("click", () => {
        ignoredCustomers.set(identity.key, identity.label);
        saveIgnoredCustomers();
        refreshVisibleOrders();
      });
      actions.append(invoice, edit, ignore, remove); actionCell.append(actions); row.append(actionCell); body.append(row);
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
    } catch (error) {
      await loadOrders();
      const detail = errorText(error);
      status.textContent = deleted ? `Deleted ${deleted} order${deleted === 1 ? "" : "s"}; remaining deletes failed. ${detail}` : detail;
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
    } catch (error) {
      await loadOrders();
      status.textContent = updated ? `Updated ${updated} order${updated === 1 ? "" : "s"}; remaining updates failed. ${errorText(error)}` : errorText(error);
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
    const highest = orderDocuments.reduce((current, doc) => {
      const order = doc.data();
      const number = Number.parseInt(String(order.order_id || doc.id).replace(/\D/g, ""), 10);
      return Number.isFinite(number) ? Math.max(current, number) : current;
    }, 253750);
    return `#${highest + 1}`;
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
  byId("refresh-orders").addEventListener("click", loadOrders);
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
  byId("bulk-order-status").addEventListener("change", () => updateBulkSelectionControls());
  byId("apply-bulk-status").addEventListener("click", updateSelectedOrderStatus);
  byId("orders-page-size").addEventListener("change", event => {
    ordersPageSize = Number(event.target.value) || 25;
    currentOrdersPage = 1;
    refreshVisibleOrders();
  });
  byId("orders-previous-page").addEventListener("click", () => { currentOrdersPage = Math.max(1, currentOrdersPage - 1); refreshVisibleOrders(); });
  byId("orders-next-page").addEventListener("click", () => { currentOrdersPage += 1; refreshVisibleOrders(); });
  renderStatusFilterOptions();
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
  byId("create-document").addEventListener("click", () => {
    const collection = byId("collection-name").value.trim();
    if (!validCollectionPath(collection)) { status.textContent = "Enter a valid collection path first."; return; }
    const template = collection === "products" ? { productName: "", price: 0, category: "", description: "", imageUrl: "" } : {};
    openEditor({ collection, id: db.collection(collection).doc().id, data: template, creating: true });
  });
  byId("editor-save").addEventListener("click", saveEditor);
  byId("order-detail-close").addEventListener("click", () => byId("order-detail-dialog").close());
  byId("order-detail-done").addEventListener("click", () => byId("order-detail-dialog").close());
  byId("order-detail-dialog").addEventListener("click", event => {
    if (event.target === byId("order-detail-dialog")) byId("order-detail-dialog").close();
  });
  byId("advanced-editor").addEventListener("toggle", event => {
    if (!event.currentTarget.open) return;
    jsonInput.value = plainData(readEditorFields());
  });
  byId("editor-close").addEventListener("click", () => dialog.close());
  byId("editor-cancel").addEventListener("click", () => dialog.close());
  login.addEventListener("click", () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(reportError));

  auth.onAuthStateChanged(user => {
    const isAdmin = String(user?.email || "").trim().toLowerCase() === ADMIN_EMAIL;
    tools.hidden = !isAdmin;
    login.hidden = !!user;
    if (isAdmin) {
      identity.textContent = `Signed in as ${user.email}`;
      status.textContent = "Loading dashboard…";
      loadOrders(); loadCollection();
    } else if (user) {
      identity.textContent = `Signed in as ${user.email}. This account is not authorized for the admin dashboard.`;
      status.textContent = "Access denied.";
    } else {
      identity.textContent = "Sign in with the administrator Google account to continue.";
      status.textContent = "Not signed in.";
    }
  });
})();
