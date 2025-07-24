firebase.auth().onAuthStateChanged(async (user) => {
  const container = document.getElementById("orders-list");

  if (!user) {
    container.innerHTML = "<p style='color:red;text-align:center;'>Please login to view your orders.</p>";
    return;
  }

  try {
    const snapshot = await db.collection("orders")
      .where("email", "==", user.email)
      .orderBy("timestamp", "desc")
      .get();

    if (snapshot.empty) {
      container.innerHTML = "<p style='text-align:center;'>You have not placed any orders yet.</p>";
      return;
    }

    snapshot.forEach(doc => {
      const order = doc.data();
      const idWithoutHash = order.order_id.replace('#', '');
      const card = document.createElement("a");
      card.href = `order-details.html?id=${idWithoutHash}`;
      card.className = "order-card";
      card.innerHTML = `
        <div>
          <h3>Order ${order.order_id}</h3>
          <p><strong>Status:</strong> ${order.status}</p>
          <p><strong>Total Paid:</strong> ₹${order.total}</p>
          <p><strong>Placed on:</strong> ${order.timestamp.toDate().toLocaleString()}</p>
        </div>
        <div class="arrow">➡️</div>
      `;
      container.appendChild(card);
    });

  } catch (error) {
    console.error("Error fetching orders:", error);
    container.innerHTML = "<p style='color:red;text-align:center;'>Failed to load orders.</p>";
  }
});
