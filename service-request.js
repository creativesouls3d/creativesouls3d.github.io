const requestForm = document.getElementById("service-request-form");
const loginPrompt = document.getElementById("service-login-prompt");
const requestMessage = document.getElementById("service-request-message");
const bulkFields = document.getElementById("bulk-request-fields");
const printingFields = document.getElementById("printing-request-fields");
const requestAddress = document.getElementById("request-address");
const requestAddressWrap = document.getElementById("request-address-wrap");
const pickupAddress = "Creative Souls 3D, Andheri West, Mumbai, Maharashtra, Pin-400053";
let signedInUser = null;
let requestType = new URLSearchParams(location.search).get("type") === "printing"
  ? "printing_service"
  : "bulk_order";

function selectRequestType(type) {
  requestType = type;
  const isBulk = type === "bulk_order";
  bulkFields.hidden = !isBulk;
  bulkFields.disabled = !isBulk;
  printingFields.hidden = isBulk;
  printingFields.disabled = isBulk;
  document.querySelectorAll("[data-service-type]").forEach(button => {
    button.setAttribute("aria-pressed", button.dataset.serviceType === type ? "true" : "false");
  });
}

document.querySelectorAll("[data-service-type]").forEach(button => {
  button.addEventListener("click", () => selectRequestType(button.dataset.serviceType));
});
selectRequestType(requestType);

document.getElementById("request-fulfillment").addEventListener("change", event => {
  const isPickup = event.target.value === "pickup";
  requestAddressWrap.hidden = isPickup;
  requestAddress.required = !isPickup;
  requestAddress.disabled = isPickup;
});

document.getElementById("service-login-button").addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(error => {
    requestMessage.textContent = `Sign in failed: ${error.message}`;
    requestMessage.style.color = "var(--danger)";
  });
});

firebase.auth().onAuthStateChanged(async user => {
  signedInUser = user;
  loginPrompt.style.display = user ? "none" : "block";
  requestForm.hidden = !user;
  if (!user) return;

  document.getElementById("request-name").value = user.displayName || "";
  document.getElementById("request-email").value = user.email || "";
  try {
    const profile = await db.collection("users").doc(user.email).get();
    if (profile.exists) {
      const data = profile.data();
      document.getElementById("request-name").value = data.name || user.displayName || "";
      document.getElementById("request-phone").value = data.phone || "";
      requestAddress.value = data.address || "";
    }
  } catch (error) {
    console.warn("Could not load saved contact details:", error);
  }
});

function cleanOrderNumber(value) {
  return parseInt(String(value || "").replace(/^#/, ""), 10);
}

requestForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!signedInUser) return;

  const fulfillmentType = document.getElementById("request-fulfillment").value;
  const isPickup = fulfillmentType === "pickup";
  const quantity = Number(document.getElementById(requestType === "bulk_order" ? "bulk-quantity" : "print-quantity").value);
  let details;
  let itemName;

  if (requestType === "bulk_order") {
    itemName = "Bulk order quote request";
    details = {
      description: document.getElementById("bulk-description").value.trim(),
      quantity,
      reference_url: document.getElementById("bulk-reference").value.trim(),
      needed_by: document.getElementById("bulk-needed-by").value,
      notes: document.getElementById("bulk-notes").value.trim()
    };
  } else {
    itemName = "3D printing service quote request";
    const fileUrl = document.getElementById("print-file-url").value.trim();
    try {
      const parsedUrl = new URL(fileUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Use an http or https file link.");
    } catch (error) {
      requestMessage.textContent = "Enter a valid shareable link to your 3D file.";
      requestMessage.style.color = "var(--danger)";
      return;
    }
    details = {
      file_url: fileUrl,
      quantity,
      dimensions: document.getElementById("print-dimensions").value.trim(),
      material: document.getElementById("print-material").value.trim(),
      colour: document.getElementById("print-colour").value.trim(),
      notes: document.getElementById("print-notes").value.trim()
    };
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    requestMessage.textContent = "Enter a quantity of at least one.";
    requestMessage.style.color = "var(--danger)";
    return;
  }

  const button = requestForm.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Sending request…";
  requestMessage.textContent = "";

  try {
    const latest = await db.collection("orders").orderBy("timestamp", "desc").limit(1).get();
    const previous = latest.empty ? 253750 : cleanOrderNumber(latest.docs[0].data().order_id) || 253750;
    const orderId = `#${previous + 1}`;
    const name = document.getElementById("request-name").value.trim();
    const phone = document.getElementById("request-phone").value.trim();
    const address = isPickup ? pickupAddress : requestAddress.value.trim();
    const now = firebase.firestore.Timestamp.now();
    const order = {
      order_id: orderId,
      email: signedInUser.email,
      name,
      phone,
      address,
      fulfillment_type: fulfillmentType,
      pickup_location: isPickup ? pickupAddress : "",
      order_type: requestType,
      service_request: details,
      items: [{ id: `request-${orderId}`, productName: itemName, quantity, price: 0 }],
      item_total: 0,
      delivery_charge: 0,
      discount: 0,
      total: 0,
      status: "Request Received",
      payment_ref: "Quote pending",
      mop: "quote",
      expected_delivery: "We’ll confirm timing after reviewing your request.",
      timestamp: now,
      approved: false
    };

    await db.collection("orders").doc(orderId).set(order);
    const cleanId = orderId.replace("#", "");
    requestMessage.innerHTML = `Request submitted. Reference <strong>${orderId}</strong>. <a href="order-details.html?id=${encodeURIComponent(cleanId)}">View request</a>`;
    requestMessage.style.color = "var(--accent-emerald-text)";
    button.textContent = "Request Sent";
  } catch (error) {
    console.error("Could not submit service request:", error);
    requestMessage.textContent = "Could not send the request. Please try again.";
    requestMessage.style.color = "var(--danger)";
    button.disabled = false;
    button.textContent = "Send Request for a Quote";
  }
});
