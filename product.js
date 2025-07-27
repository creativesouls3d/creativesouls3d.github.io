function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

const productId = getQueryParam("id");
const container = document.getElementById("product-details");

// Show "Open in App" section if productId is valid
if (productId) {
  const openAppSection = document.getElementById("open-in-app");
  const manualLink = document.getElementById("manualLink");
  const manualLinkFallback = document.getElementById("manualLinkFallback");

  const intentUrl = `intent://product/${productId}#Intent;scheme=creativesouls3d;package=com.ls.creativesouls3d;end`;
  manualLink.href = intentUrl;
  manualLinkFallback.href = intentUrl;
  openAppSection.style.display = "block";

  // Only open when button is clicked
  manualLink.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = intentUrl;

    // Show fallback if app doesn't open
    setTimeout(() => {
      document.getElementById("fallback").style.display = "block";
    }, 2500);
  });
}


// Try to load product from localStorage first
function getCachedProduct(id) {
  const cached = localStorage.getItem("products");
  if (!cached) return null;
  try {
    const products = JSON.parse(cached);
    return products.find(p => p.productId === id) || null;
  } catch {
    return null;
  }
}

function renderProduct(data) {
  container.innerHTML = `
    <h1>${data.productName}</h1>
    <img src="${data.imageUrl}" alt="${data.productName}" />
    <p><strong>Price:</strong> ₹${data.price}</p>
    <p><strong>Category:</strong> ${data.category}</p>
    <p><strong>Color:</strong> ${data.color || 'N/A'}</p>
    <p><strong>Customizable:</strong> ${data.customizable ? 'Yes' : 'No'}</p>
    <p><strong>Stock:</strong> ${data.stock}</p>
    <p><strong>Description:</strong> ${data.description}</p>
    <div class="actions">
      <input type="number" id="qty" value="1" min="1" />
      <button id="addCart">Add to Cart</button>
      <button id="buyNow">Buy Now</button>
    </div>
    <a href="index.html" class="back-button">← Back to Products</a>
  `;

  function addToCart(item) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existing = cart.find(i => i.productId === item.productId);
    if (existing) existing.quantity += item.quantity;
    else cart.push(item);
    localStorage.setItem('cart', JSON.stringify(cart));
  }

  document.getElementById('addCart').onclick = () => {
    const qty = parseInt(document.getElementById('qty').value);
    if (qty < 1) return alert("Enter a valid quantity.");
    addToCart({
      productId: data.productId,
      productName: data.productName,
      price: data.price,
      quantity: qty
    });
    alert("Added to cart!");
  };

  document.getElementById('buyNow').onclick = () => {
    const qty = parseInt(document.getElementById('qty').value);
    if (qty < 1) return alert("Enter a valid quantity.");
    addToCart({
      productId: data.productId,
      productName: data.productName,
      price: data.price,
      quantity: qty
    });
    window.location.href = 'cart.html';
  };
}

if (!productId) {
  container.innerHTML = "<p>Invalid product ID.</p>";
} else {
  const cached = getCachedProduct(productId);
  if (cached) {
    renderProduct(cached);
  } else {
    db.collection("products").doc(productId).get()
      .then(doc => {
        if (doc.exists) {
          renderProduct(doc.data());
        } else {
          container.innerHTML = "<p>Product not found.</p>";
        }
      })
      .catch(error => {
        console.error("Error loading product:", error);
        container.innerHTML = "<p>Error loading product details.</p>";
      });
  }
}
