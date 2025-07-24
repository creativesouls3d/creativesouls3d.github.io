function getOrderId() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  return id ? `#${id}` : null; // Prepend '#' again
}

firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    alert("Please log in to view your order.");
    return window.location.href = "index.html";
  }

  const orderId = getOrderId();
  const container = document.getElementById("order-info");

  if (!orderId) {
    container.innerHTML = "<p style='color:red;'>Invalid Order ID</p>";
    return;
  }

  try {
    const doc = await db.collection("orders").doc(orderId).get();

    if (!doc.exists) {
      container.innerHTML = "<p style='color:red;'>Order not found</p>";
      return;
    }

    const data = doc.data();

    if (data.email !== user.email) {
      container.innerHTML = "<p style='color:red;'>You are not authorized to view this order.</p>";
      return;
    }

    const itemsHTML = data.items.map(item => `
      <li>
        <strong>${item.productName}</strong><br />
        ₹${item.price} × ${item.quantity} = ₹${item.price * item.quantity}
      </li>
    `).join("");

    container.innerHTML = `
      <div class="order-box">
        <h2>Order ${data.order_id}</h2>
        <p><strong>Status:</strong> ${data.status}</p>
        <p><strong>Placed on:</strong> ${data.timestamp.toDate().toLocaleString()}</p>
        <hr/>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>Delivery Address:</strong> ${data.address}</p>
        <hr/>
        <h3>Items</h3>
        <ul>${itemsHTML}</ul>
        <hr/>
        <p><strong>Item Total:</strong> ₹${data.item_total}</p>
        <p><strong>Delivery Charge:</strong> ₹${data.delivery_charge}</p>
        <p><strong>Discount:</strong> ₹${data.discount}</p>
        <p><strong>Total Paid:</strong> ₹${data.total}</p>
        <p><strong>Payment Mode:</strong> ${data.payment_ref}</p>
        <p><strong>Coupon Code:</strong> ${data.coupon_code}</p>
      </div>
    `;

  } catch (err) {
    console.error("Failed to fetch order details:", err);
    container.innerHTML = "<p style='color:red;'>Error loading order. Try again later.</p>";
  }
});
