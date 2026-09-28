let cart = JSON.parse(localStorage.getItem("cart")) || [];
let userData = null;
let standardDeliveryCharge = 20;
let fulfillmentType = localStorage.getItem("fulfillment_type") === "pickup" ? "pickup" : "delivery";
let deliveryCharge = fulfillmentType === "pickup" ? 0 : standardDeliveryCharge;
let discountAmount = 0;
let appliedCouponCode = "";
let paymentModes = { cod: true, upi: false, upiID: "" };
let paymentMode = "cod";
let checkoutStep = "details";
const PICKUP_LOCATION = "Creative Souls 3D, Andheri West, Mumbai, Maharashtra, Pin-400053";

const cartItemsContainer = document.getElementById("cart-items");
const cartSummary = document.getElementById("cart-summary");
const couponInput = document.getElementById("coupon");
const couponMessage = document.getElementById("coupon-message");
const orderNoteInput = document.getElementById("order-note");
if (orderNoteInput) {
  orderNoteInput.value = localStorage.getItem("cart_order_note") || "";
  orderNoteInput.addEventListener("input", () => localStorage.setItem("cart_order_note", orderNoteInput.value));
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    cartSummary.innerHTML = `
      <h2>Order Summary</h2>
      <div style="padding: 16px; background: var(--warning-bg); border: 1px solid #fde68a; border-radius: var(--radius-md); text-align: center;">
        <p style="color: #92400e; font-weight: 700; margin-bottom: 10px;">Please login to complete your order and review saved addresses.</p>
        <button onclick="loginUser()" class="add-card-btn" style="max-width: 180px; margin: 0 auto;">Login with Google</button>
      </div>
    `;
    renderCart();
    return;
  }

  try {
    const doc = await db.collection("users").doc(user.email).get();
    if (doc.exists) {
      userData = doc.data();
    } else {
      userData = { email: user.email, name: user.displayName || "User" };
    }

    const chargeDoc = await db.collection("shopping app").doc("charges").get();
    if (chargeDoc.exists) {
      standardDeliveryCharge = Number(chargeDoc.data().delivery_charge ?? 20);
    }
    deliveryCharge = fulfillmentType === "pickup" ? 0 : standardDeliveryCharge;

    const modesDoc = await db.collection("shopping app").doc("payment_modes").get();
    if (modesDoc.exists) {
      const modes = modesDoc.data();
      paymentModes = {
        cod: modes.cod === true,
        upi: modes.upi === true,
        upiID: String(modes.upiID || "").trim()
      };
    }
    paymentModes.upi = paymentModes.upi && Boolean(paymentModes.upiID);
    paymentMode = paymentModes.cod ? "cod" : paymentModes.upi ? "upi" : "";

    renderCart();
  } catch (err) {
    console.error("Error fetching user/charges:", err);
    cartSummary.innerHTML = "<p style='color:var(--danger);font-weight:800;'>Error loading cart data.</p>";
  }
});

function loginUser() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(err => alert("Login failed: " + err.message));
}

window.loginUser = loginUser;

document.getElementById("place-order").addEventListener("click", async () => {
  const btn = document.getElementById("place-order");
  const msg = document.getElementById("order-message");

  if (!userData || cart.length === 0) {
    msg.style.color = "var(--danger)";
    msg.textContent = "You must be logged in and have items in your cart.";
    return;
  }

  if (!paymentMode || (paymentMode === "cod" && !paymentModes.cod) || (paymentMode === "upi" && !paymentModes.upi)) {
    msg.style.color = "var(--danger)";
    msg.textContent = "No payment method is currently available. Please contact us.";
    return;
  }

  if (paymentMode === "upi" && checkoutStep === "details") {
    checkoutStep = "payment";
    renderCart();
    msg.style.color = "var(--text-secondary)";
    msg.textContent = "Complete the UPI payment shown below, then confirm to place your order for verification.";
    document.getElementById("upi-payment")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (fulfillmentType === "delivery" && (!userData.address || userData.address.trim() === "")) {
    msg.style.color = "var(--danger)";
    msg.innerHTML = `Please add your delivery address in <a href="account.html" style="text-decoration: underline; color: var(--brand-dark);">Your Account</a> before placing an order.`;
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
      <path d="M12 2a10 10 0 0 1 10 10"></path>
    </svg>
    Placing Order...
  `;

  try {
    const ordersSnapshot = await db.collection("orders").orderBy("timestamp", "desc").limit(1).get();
    let lastId = 253750;

    if (!ordersSnapshot.empty) {
      const lastOrder = ordersSnapshot.docs[0].data();
      const parsed = parseInt(String(lastOrder.order_id || "").replace("#", ""), 10);
      if (!isNaN(parsed)) lastId = parsed;
    }

    const newId = "#" + (lastId + 1);
    const itemTotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const finalTotal = Math.max(itemTotal + deliveryCharge - discountAmount, 0);

    const orderData = {
      order_id: newId,
      name: userData.name || "",
      email: userData.email,
      phone: userData.phone || "null",
      address: fulfillmentType === "pickup" ? PICKUP_LOCATION : userData.address || "",
      fulfillment_type: fulfillmentType,
      pickup_location: fulfillmentType === "pickup" ? PICKUP_LOCATION : "",
      items: cart,
      order_note: orderNoteInput?.value.trim() || "",
      item_total: itemTotal,
      delivery_charge: deliveryCharge,
      discount: discountAmount,
      total: finalTotal,
      coupon_code: appliedCouponCode,
      status: paymentMode === "upi" ? "Payment Verification Pending" : "Order Placed",
      timestamp: firebase.firestore.Timestamp.now(),
      approved: false,
      payment_status: paymentMode === "upi" ? "pending" : "cash on delivery",
      mop: paymentMode === "upi" ? "upi" : "cash",
      payment_ref: paymentMode === "upi" ? "UPI" : fulfillmentType === "pickup" ? "cash-on-pickup" : "cash-on-delivery",
      upi_id: paymentMode === "upi" ? paymentModes.upiID : "",
      expected_delivery: fulfillmentType === "pickup"
        ? "We will contact you when your order is ready for pickup."
        : "Estimated delivery within 5–7 days. The exact date will be updated once your order is confirmed."
    };

    await db.collection("orders").doc(newId).set(orderData);

    localStorage.removeItem("cart");
    localStorage.removeItem("cart_order_note");
    if (orderNoteInput) orderNoteInput.value = "";
    cart = [];
    if (typeof window.updateHeaderCartCount === "function") {
      window.updateHeaderCartCount();
    }
    renderCart();

    const cleanId = newId.replace("#", "");
    document.querySelector("main").innerHTML = `
      <section style="width:min(620px,calc(100% - 32px));margin:64px auto;padding:clamp(24px,6vw,48px);background:#fff;border:1px solid var(--accent-emerald-border);border-radius:var(--radius-xl);box-shadow:var(--shadow-md);text-align:center;">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">🎉</div>
        <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--accent-emerald-text); margin-bottom: 6px;">${paymentMode === "upi" ? "Order placed — payment verification pending" : "Order Placed Successfully!"}</h3>
        ${paymentMode === "upi" ? `<p style="margin-bottom:12px;color:var(--text-secondary);">We’ll update your order status after verifying your UPI payment.</p>` : ""}
        <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 16px;">Your Order ID is <strong style="color: var(--text-primary); font-size: 1.1rem;">${newId}</strong></p>
        <a href="track-order.html?id=${encodeURIComponent(cleanId)}" class="add-card-btn" style="max-width: 220px; margin: 0 auto; display: inline-flex;">Track Order Status ➔</a>
      </section>
    `;
  } catch (err) {
    console.error("Order Error:", err);
    msg.style.color = "var(--danger)";
    msg.textContent = "Failed to place order. Please try again.";
    btn.disabled = false;
    btn.textContent = getPlaceOrderLabel();
  }
});

function renderCart() {
  cartItemsContainer.innerHTML = "";

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-top: 6px;">Your cart is empty</h3>
        <p style="color: var(--text-muted); max-width: 320px; font-size: 0.95rem;">Explore our catalog of custom 3D keychains, lithophanes, and decor to add items.</p>
        <a href="index.html" class="add-card-btn" style="max-width: 180px; margin-top: 14px; display: inline-flex;">Explore Catalog</a>
      </div>
    `;
    cartSummary.innerHTML = `
      <h2>Order Summary</h2>
      <p style="color: var(--text-muted); font-size: 0.92rem;">No items in cart yet.</p>
    `;
    document.getElementById("place-order").style.display = "none";
    return;
  }

  document.getElementById("place-order").style.display = "flex";

  let itemTotal = 0;

  cart.forEach((item, index) => {
    const total = Number(item.price || 0) * Number(item.quantity || 0);
    itemTotal += total;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <img src="${item.imageUrl || 'logo_creativesouls.jpg'}" alt="${item.productName || 'Product'}" class="cart-item-img" />
      <div class="cart-item-info">
        <span class="cart-item-title">${item.productName || "Untitled product"}</span>
        ${item.colour ? `<span class="cart-item-colour">Colour: ${escapeHTML(item.colour)}</span>` : ""}
        <span class="cart-item-unit-price">${formatPrice(item.price)} each</span>
        ${item.customizable ? `<label class="cart-customization-field">Customization details<textarea data-cart-customization="${index}" rows="2" maxlength="500" placeholder="Name, text, colors, or other details">${escapeHTML(item.customization || "")}</textarea></label>` : item.customization ? `<span class="cart-item-colour">Customization: ${escapeHTML(item.customization)}</span>` : ""}
      </div>
      <div class="qty-stepper" style="padding: 2px;">
        <button type="button" onclick="changeQuantity(${index}, -1)" aria-label="Decrease quantity" style="width: 28px; height: 28px; font-size: 0.95rem;">−</button>
        <span style="min-width: 28px; font-size: 0.92rem;">${item.quantity}</span>
        <button type="button" onclick="changeQuantity(${index}, 1)" aria-label="Increase quantity" style="width: 28px; height: 28px; font-size: 0.95rem;">+</button>
      </div>
      <span class="cart-item-total">${formatPrice(total)}</span>
      <button class="cart-item-remove-btn" onclick="removeItem(${index})" title="Remove item" aria-label="Remove item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;
    cartItemsContainer.appendChild(div);
  });

  cartItemsContainer.querySelectorAll("[data-cart-customization]").forEach(input => {
    input.addEventListener("input", () => {
      const index = Number(input.dataset.cartCustomization);
      if (!cart[index]) return;
      cart[index].customization = input.value;
      localStorage.setItem("cart", JSON.stringify(cart));
    });
  });

  const finalTotal = Math.max(itemTotal + deliveryCharge - discountAmount, 0);

  const qrWrap = document.getElementById("upi-payment");
  const qrNode = document.getElementById("upi-qr");
  const amountNode = document.getElementById("upi-amount");
  if (qrWrap && qrNode && amountNode) {
    const showQr = paymentMode === "upi" && paymentModes.upi && checkoutStep === "payment";
    qrWrap.hidden = !showQr;
    if (showQr) {
      const upiUrl = `upi://pay?pa=${encodeURIComponent(paymentModes.upiID)}&pn=${encodeURIComponent("Creative Souls 3D")}&am=${finalTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Creative Souls 3D order")}`;
      amountNode.textContent = `Amount: ${formatPrice(finalTotal)} · UPI ID: ${paymentModes.upiID}`;
      qrNode.replaceChildren();
      if (window.QRCode) new QRCode(qrNode, { text: upiUrl, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
      else qrNode.textContent = "QR generator unavailable. Please refresh the page.";
    }
  }

  cartSummary.innerHTML = `
    <h2>Order Summary</h2>
    <fieldset class="fulfillment-selector">
      <legend>Choose how to receive your order</legend>
      <label><input type="radio" name="fulfillment-type" value="delivery" ${fulfillmentType === "delivery" ? "checked" : ""}> Home delivery</label>
      <label><input type="radio" name="fulfillment-type" value="pickup" ${fulfillmentType === "pickup" ? "checked" : ""}> Store pickup</label>
    </fieldset>
    <fieldset class="fulfillment-selector" style="margin-top:14px;">
      <legend>Payment method</legend>
      ${paymentModes.cod ? `<label><input type="radio" name="payment-mode" value="cod" ${paymentMode === "cod" ? "checked" : ""}> Cash ${fulfillmentType === "pickup" ? "on pickup" : "on delivery"}</label>` : ""}
      ${paymentModes.upi ? `<label><input type="radio" name="payment-mode" value="upi" ${paymentMode === "upi" ? "checked" : ""}> UPI (pay now)</label>` : ""}
      ${!paymentModes.cod && !paymentModes.upi ? `<p style="color:var(--danger);">No payment methods are enabled. Please contact us.</p>` : ""}
    </fieldset>
    <div class="user-box">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <strong>${fulfillmentType === "pickup" ? "Pickup Details:" : "Delivery Details:"}</strong>
        ${fulfillmentType === "delivery" ? `<a href="account.html" style="font-size: 0.8rem; color: var(--brand-dark); font-weight: 800; text-decoration: underline;">Change</a>` : ""}
      </div>
      <p><strong>${userData?.name || "Customer"}</strong> ${userData?.phone ? `&bull; ${userData.phone}` : ""}</p>
      <p style="color: var(--text-secondary); font-size: 0.84rem;">${fulfillmentType === "pickup" ? PICKUP_LOCATION : userData?.address || "<span style='color:var(--danger);'>Please set delivery address in Account</span>"}</p>
      ${fulfillmentType === "pickup" ? `<p style="font-size:0.82rem;">We’ll contact you when your order is ready to collect.</p>` : ""}
    </div>

    <p class="cart-delivery-estimate"><strong>${fulfillmentType === "pickup" ? "Pickup estimate:" : "Estimated delivery:"}</strong> ${fulfillmentType === "pickup" ? "We’ll confirm the pickup date once your order is confirmed." : "Within 5–7 days. The exact date will be updated once your order is confirmed."}</p>

    <div class="summary-row">
      <span>Items Subtotal</span>
      <span>${formatPrice(itemTotal)}</span>
    </div>
    <div class="summary-row">
      <span>${fulfillmentType === "pickup" ? "Pickup" : "Delivery Charge"}</span>
      <span style="color: var(--text-primary); font-weight: 700;">${fulfillmentType === "pickup" ? "Free" : formatPrice(deliveryCharge)}</span>
    </div>
    ${discountAmount > 0 ? `
      <div class="summary-row" style="color: var(--accent-emerald);">
        <span>Discount (${appliedCouponCode || "Promo"})</span>
        <span>-${formatPrice(discountAmount)}</span>
      </div>
    ` : ""}
    <div class="summary-row total">
      <span>Total to Pay</span>
      <span>${formatPrice(finalTotal)}</span>
    </div>
  `;

  cartSummary.querySelectorAll('input[name="fulfillment-type"]').forEach(input => {
    input.addEventListener("change", () => {
      fulfillmentType = input.value;
      checkoutStep = "details";
      localStorage.setItem("fulfillment_type", fulfillmentType);
      deliveryCharge = fulfillmentType === "pickup" ? 0 : standardDeliveryCharge;
      renderCart();
    });
  });
  cartSummary.querySelectorAll('input[name="payment-mode"]').forEach(input => {
    input.addEventListener("change", () => { paymentMode = input.value; checkoutStep = "details"; renderCart(); });
  });
  document.getElementById("place-order").textContent = getPlaceOrderLabel();
  document.getElementById("place-order").disabled = !paymentMode;
}

function getPlaceOrderLabel() {
  if (paymentMode === "upi") return checkoutStep === "payment" ? "I’ve paid — Place Order for Verification" : "Proceed to UPI Payment";
  return fulfillmentType === "pickup" ? "Place Pickup Order" : "Place Order (Cash on Delivery)";
}

function changeQuantity(index, delta) {
  if (!cart[index]) return;
  cart[index].quantity = Number(cart[index].quantity || 1) + delta;

  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  if (typeof window.updateHeaderCartCount === "function") {
    window.updateHeaderCartCount();
  }
  renderCart();
}

function removeItem(index) {
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  if (typeof window.updateHeaderCartCount === "function") {
    window.updateHeaderCartCount();
  }
  renderCart();
}

window.removeItem = removeItem;
window.changeQuantity = changeQuantity;

window.applyCoupon = async () => {
  const code = couponInput?.value?.trim().toUpperCase();
  couponMessage.textContent = "";
  couponMessage.style.color = "var(--danger)";

  if (!code) {
    couponMessage.textContent = "Please enter a coupon code.";
    return;
  }

  try {
    const doc = await db.collection("shopping app").doc("coupon_code").get();
    if (!doc.exists) {
      couponMessage.textContent = "Invalid coupon code.";
      return;
    }

    const couponRaw = doc.data()[code];
    if (!couponRaw) {
      couponMessage.textContent = "Invalid coupon code.";
      return;
    }

    const [discountText, expiry, minVal, maxVal, emailFilter] = couponRaw.split(",").map(e => e.trim());
    const today = new Date();
    const expiryDate = new Date(expiry.split("-").reverse().join("-"));

    if (today > expiryDate) {
      couponMessage.textContent = "Coupon has expired.";
      return;
    }

    const itemTotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);

    if (minVal && itemTotal < parseFloat(minVal)) {
      couponMessage.textContent = `Minimum order amount ${formatPrice(minVal)} required.`;
      return;
    }

    if (emailFilter && userData?.email !== emailFilter) {
      couponMessage.textContent = "This coupon is not valid for your account.";
      return;
    }

    const maxDiscountLimit = maxVal ? parseFloat(maxVal) : null;
    let discount = 0;

    if (discountText.includes("%")) {
      const percentage = parseFloat(discountText.split("%")[0]);
      discount = (percentage / 100) * itemTotal;
    } else if (discountText.toLowerCase().includes("rs")) {
      discount = parseFloat(discountText);
    }

    if (maxDiscountLimit) {
      discount = Math.min(discount, maxDiscountLimit);
    }

    discountAmount = Math.floor(discount);
    appliedCouponCode = code;
    renderCart();

    couponMessage.textContent = `✓ ${discountText} coupon applied!`;
    couponMessage.style.color = "var(--accent-emerald)";
  } catch (err) {
    console.error("Coupon error:", err);
    couponMessage.textContent = "Error applying coupon.";
  }
};
