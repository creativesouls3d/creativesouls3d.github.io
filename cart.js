let cart = JSON.parse(localStorage.getItem("cart")) || [];
let userData = null;
let deliveryCharge = 20;
let discountAmount = 0;
let appliedCouponCode = "";

const cartItemsContainer = document.getElementById("cart-items");
const cartSummary = document.getElementById("cart-summary");
const couponInput = document.getElementById("coupon");
const couponMessage = document.getElementById("coupon-message");

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    cartSummary.innerHTML = "<p style='color:#c0392b;font-weight:800;'>Please login to continue.</p>";
    return;
  }

  try {
    const doc = await db.collection("users").doc(user.email).get();
    if (doc.exists) {
      userData = doc.data();
    }

    const chargeDoc = await db.collection("shopping app").doc("charges").get();
    if (chargeDoc.exists) {
      deliveryCharge = chargeDoc.data().delivery_charge || 20;
    }

    renderCart();
  } catch (err) {
    console.error("Error fetching user/charges:", err);
    cartSummary.innerHTML = "<p style='color:#c0392b;font-weight:800;'>Error loading cart.</p>";
  }
});

document.getElementById("place-order").addEventListener("click", async () => {
  const btn = document.getElementById("place-order");
  const msg = document.getElementById("order-message");

  if (!userData || cart.length === 0) {
    msg.style.color = "#c0392b";
    msg.textContent = "You must be logged in and have items in your cart.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Placing Order...";

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
      address: userData.address,
      items: cart,
      item_total: itemTotal,
      delivery_charge: deliveryCharge,
      discount: discountAmount,
      total: finalTotal,
      coupon_code: appliedCouponCode,
      status: "Order Placed",
      timestamp: firebase.firestore.Timestamp.now(),
      approved: false,
      mop: "cash",
      payment_ref: "cash-on-delivery",
      expected_delivery: getExpectedDeliveryDate()
    };

    await db.collection("orders").doc(newId).set(orderData);

    localStorage.removeItem("cart");
    cart = [];
    renderCart();

    msg.style.color = "#2f7d68";
    msg.innerHTML = `Order placed successfully.<br>Your Order ID is <strong>${newId}</strong>`;
    btn.style.display = "none";
  } catch (err) {
    console.error("Order Error:", err);
    msg.style.color = "#c0392b";
    msg.textContent = "Failed to place order. Please try again.";
    btn.disabled = false;
    btn.textContent = "Place Order";
  }
});

function getExpectedDeliveryDate() {
  const today = new Date();
  today.setDate(today.getDate() + 3);
  return today.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function renderCart() {
  cartItemsContainer.innerHTML = "";

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = "<div class='empty-state'>Your cart is empty.</div>";
    cartSummary.innerHTML = "";
    return;
  }

  let itemTotal = 0;

  cart.forEach((item, index) => {
    const total = Number(item.price || 0) * Number(item.quantity || 0);
    itemTotal += total;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <span>${item.productName || "Untitled product"}</span>
      <span>${formatPrice(item.price)}</span>
      <span>&times; ${item.quantity}</span>
      <span>${formatPrice(total)}</span>
      <button onclick="removeItem(${index})" aria-label="Remove item">X</button>
    `;
    cartItemsContainer.appendChild(div);
  });

  const finalTotal = Math.max(itemTotal + deliveryCharge - discountAmount, 0);

  cartSummary.innerHTML = `
    <p><strong>Name:</strong> ${userData?.name || "-"}</p>
    <p><strong>Email:</strong> ${userData?.email || "-"}</p>
    <p><strong>Phone:</strong> ${userData?.phone || "-"}</p>
    <p><strong>Address:</strong> ${userData?.address || "-"}</p>
    <hr>
    <p><strong>Item Total:</strong> ${formatPrice(itemTotal)}</p>
    <p><strong>Delivery Charge:</strong> ${formatPrice(deliveryCharge)}</p>
    <p><strong>Discount:</strong> ${formatPrice(discountAmount)} ${appliedCouponCode ? `(${appliedCouponCode})` : ""}</p>
    <hr>
    <p><strong>Total Amount:</strong> ${formatPrice(finalTotal)}</p>
  `;
}

function removeItem(index) {
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
}

window.removeItem = removeItem;

window.applyCoupon = async () => {
  const code = couponInput?.value?.trim().toUpperCase();
  couponMessage.textContent = "";
  couponMessage.style.color = "#c0392b";

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
      couponMessage.textContent = "Coupon expired.";
      return;
    }

    const itemTotal = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);

    if (minVal && itemTotal < parseFloat(minVal)) {
      couponMessage.textContent = `Minimum order ${formatPrice(minVal)} required.`;
      return;
    }

    if (emailFilter && userData?.email !== emailFilter) {
      couponMessage.textContent = "Coupon is not valid for your email.";
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

    couponMessage.textContent = `${discountText} applied.`;
    couponMessage.style.color = "#2f7d68";
  } catch (err) {
    console.error("Coupon error:", err);
    couponMessage.textContent = "Error applying coupon.";
  }
};
