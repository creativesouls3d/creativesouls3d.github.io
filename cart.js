const itemsDiv = document.getElementById('cart-items');
const totalEl = document.getElementById('total');
const checkoutBtn = document.getElementById('checkout');

let currentUser = null;

// Render cart items from localStorage
function renderCart() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  itemsDiv.innerHTML = '';
  let total = 0;

  cart.forEach((i, idx) => {
    total += i.price * i.quantity;
    itemsDiv.innerHTML += `
      <div class="cart-item">
        <span>${i.productName}</span>
        <span>₹${i.price} × ${i.quantity}</span>
        <button data-idx="${idx}" class="remove">Remove</button>
      </div>`;
  });

  totalEl.textContent = `Total: ₹${total}`;

  // Remove button functionality
  document.querySelectorAll('.remove').forEach(btn => {
    btn.onclick = () => {
      const cart = JSON.parse(localStorage.getItem('cart'));
      cart.splice(btn.dataset.idx, 1);
      localStorage.setItem('cart', JSON.stringify(cart));
      renderCart();
    };
  });
}

// Run this after page load
renderCart();

// Auth check
firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    alert("Please sign in to proceed.");
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
});

// Checkout logic
checkoutBtn.onclick = async () => {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  if (!cart.length) return alert('Cart is empty!');

  if (!currentUser) {
    alert("Please sign in.");
    return;
  }

  try {
    // Use email-based doc ID
    const doc = await db.collection("users").doc(currentUser.email).get();

    if (!doc.exists) {
      alert("Please complete your profile before placing an order.");
      return window.location.href = "account.html";
    }

    const profile = doc.data();
    if (!profile.address || !profile.phone) {
      alert("Please complete your profile with address and phone number before placing an order.");
      return window.location.href = "account.html";
    }

    // Create order
    const order_id = '#' + Math.floor(100000 + Math.random() * 900000);
    const item_total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const order = {
      order_id,
      items: cart,
      item_total,
      total: item_total + 30 - 32,
      delivery_charge: 30,
      discount: 32,
      address: profile.address,
      phone: profile.phone,
      name: profile.name || currentUser.displayName,
      email: currentUser.email,
      coupon_code: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      mop: 'cash',
      payment_ref: 'cash-on-delivery',
      approved: false,
      status: 'Placed',
      timestamp: new Date()
    };

    await db.collection('orders').doc(order_id).set(order);

    alert(`Order ${order_id} placed successfully!`);
    localStorage.removeItem('cart');
    window.location.href = 'index.html';

  } catch (err) {
    console.error("Error placing order:", err);
    alert("Something went wrong while placing the order.");
  }
};
