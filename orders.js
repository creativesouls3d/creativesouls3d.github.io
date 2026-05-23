function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

firebase.auth().onAuthStateChanged(async (user) => {
  const container = document.getElementById("orders-list");

  if (!user) {
    container.innerHTML = "<div class='empty-state'>Please login to view your orders.</div>";
    return;
  }

  try {
    const snapshot = await db.collection("orders")
      .where("email", "==", user.email)
      .orderBy("timestamp", "desc")
      .get();

    if (snapshot.empty) {
      container.innerHTML = "<div class='empty-state'>You have not placed any orders yet.</div>";
      return;
    }

    snapshot.forEach(doc => {
      const order = doc.data();
      const idWithoutHash = String(order.order_id || "").replace("#", "");
      const placedOn = order.timestamp ? order.timestamp.toDate().toLocaleString("en-IN") : "-";
      const card = document.createElement("a");

      card.href = `order-details.html?id=${idWithoutHash}`;
      card.className = "order-card";
      card.innerHTML = `
        <div>
          <h3>Order ${order.order_id || ""}</h3>
          <p><strong>Status:</strong> ${order.status || "Processing"}</p>
          <p><strong>Total Paid:</strong> ${formatPrice(order.total)}</p>
          <p><strong>Placed on:</strong> ${placedOn}</p>
        </div>
        <div class="arrow">View</div>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    container.innerHTML = "<div class='empty-state'>Failed to load orders.</div>";
  }
});
