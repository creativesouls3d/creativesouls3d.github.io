// Prevent multiple db declarations
if (typeof db === "undefined") {
  const db = firebase.firestore();
}

let cart = JSON.parse(localStorage.getItem('cart')) || [];
let userData = null;
let deliveryCharge = 20;
let discountAmount = 0;
let appliedCouponCode = "";

const cartItemsContainer = document.getElementById("cart-items");
const cartSummary = document.getElementById("cart-summary");
const couponInput = document.getElementById("coupon");
const couponMessage = document.getElementById("coupon-message");

firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    cartSummary.innerHTML = "<p style='color:red;'>Please login to continue.</p>";
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
    cartSummary.innerHTML = "<p style='color:red;'>Error loading cart.</p>";
  }
});

document.getElementById("place-order").addEventListener("click", async () => {
  const btn = document.getElementById("place-order");
  const msg = document.getElementById("order-message");

  if (!userData || cart.length === 0) {
    msg.style.color = "red";
    msg.textContent = "❌ You must be logged in and have items in your cart.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Placing Order...";

  try {
    // Fetch latest order_id number
    const ordersSnapshot = await db.collection("orders").orderBy("timestamp", "desc").limit(1).get();
    let lastId = 253750;
    if (!ordersSnapshot.empty) {
      const lastOrder = ordersSnapshot.docs[0].data();
      const parsed = parseInt(lastOrder.order_id.replace("#", ""));
      if (!isNaN(parsed)) lastId = parsed;
    }
    const newId = "#"+(lastId + 1);

    const itemTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const finalTotal = Math.max(itemTotal + deliveryCharge - discountAmount, 0);

    const orderData = {
      order_id: newId,
      email: userData.email,
      phone: userData.phone || "null",
      address: userData.address,
      items: cart,
      item_total: itemTotal,
      delivery_charge: deliveryCharge,
      discount: discountAmount,
      total: finalTotal,
      coupon_code: appliedCouponCode,
      status: "Order Placed ✅",
      timestamp: firebase.firestore.Timestamp.now(),
      approved: false,
      mop: "cash", // Default for now
      payment_ref: "cash-on-delivery",
      expected_delivery: getExpectedDeliveryDate()
    };

    await db.collection("orders").doc(newId).set(orderData);

    // Clear cart
    localStorage.removeItem("cart");
    cart = [];
    renderCart();

    msg.style.color = "green";
    msg.innerHTML = `✅ Order placed successfully!<br/>Your Order ID is <strong>${newId}</strong>`;
    btn.style.display = "none";
  } catch (err) {
    console.error("Order Error:", err);
    msg.style.color = "red";
    msg.textContent = "❌ Failed to place order. Please try again.";
    btn.disabled = false;
    btn.textContent = "Place Order";
  }
});

function getExpectedDeliveryDate() {
  const today = new Date();
  today.setDate(today.getDate() + 3); // 3 days later
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return today.toLocaleDateString('en-IN', options);
}


function renderCart() {
  cartItemsContainer.innerHTML = "";

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = "<p style='text-align:center;'>Your cart is empty.</p>";
    cartSummary.innerHTML = "";
    return;
  }

  let itemTotal = 0;
  cart.forEach((item, index) => {
    const total = item.price * item.quantity;
    itemTotal += total;

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <span>${item.productName}</span>
      <span>₹${item.price}</span>
      <span>× ${item.quantity}</span>
      <span>₹${total}</span>
      <button onclick="removeItem(${index})">🗑</button>
    `;
    cartItemsContainer.appendChild(div);
  });

  const finalTotal = Math.max(itemTotal + deliveryCharge - discountAmount, 0);

  cartSummary.innerHTML = `
    <p><strong>Name:</strong> ${userData?.name || "-"}</p>
    <p><strong>Email:</strong> ${userData?.email || "-"}</p>
    <p><strong>Phone:</strong> ${userData?.phone || "-"}</p>
    <p><strong>Address:</strong> ${userData?.address || "-"}</p>
    <hr/>
    <p><strong>Item Total:</strong> ₹${itemTotal}</p>
    <p><strong>Delivery Charge:</strong> ₹${deliveryCharge}</p>
    <p><strong>Discount:</strong> ₹${discountAmount} ${appliedCouponCode ? `(${appliedCouponCode})` : ""}</p>
    <hr/>
    <p><strong>Total Amount:</strong> ₹${finalTotal}</p>
  `;
}

function removeItem(index) {
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
}

// Expose to window so inline onclick works
window.removeItem = removeItem;

window.applyCoupon = async () => {
  const code = couponInput?.value?.trim().toUpperCase();
  couponMessage.textContent = "";
  couponMessage.style.color = "red";

  if (!code) {
    couponMessage.textContent = "❌ Please enter a coupon code.";
    return;
  }

  try {
    const doc = await db.collection("shopping app").doc("coupon_code").get();
    if (!doc.exists) {
      couponMessage.textContent = "❌ Invalid Coupon Code";
      return;
    }

    const couponRaw = doc.data()[code];
    if (!couponRaw) {
      couponMessage.textContent = "❌ Invalid Coupon Code";
      return;
    }

    const [discountText, expiry, minVal, maxVal, emailFilter] = couponRaw.split(",").map(e => e.trim());

    // Check expiry
    const today = new Date();
    const expiryDate = new Date(expiry.split("-").reverse().join("-"));
    if (today > expiryDate) {
      couponMessage.textContent = "❌ Coupon expired.";
      return;
    }

    // Calculate current item total
    const itemTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Check min order value
    if (minVal && itemTotal < parseFloat(minVal)) {
      couponMessage.textContent = `❌ Minimum order ₹${minVal} required.`;
      return;
    }

    // Check max value (for flat discount)
    const maxDiscountLimit = maxVal ? parseFloat(maxVal) : null;

    // Check email restriction
    if (emailFilter && userData?.email !== emailFilter) {
      couponMessage.textContent = `❌ Coupon is not valid for your email.`;
      return;
    }

    // Calculate discount
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

    couponMessage.textContent = `✅ ${discountText} applied.`;
    couponMessage.style.color = "green";

  } catch (err) {
    console.error("Coupon error:", err);
    couponMessage.textContent = "❌ Error applying coupon.";
  }
};
