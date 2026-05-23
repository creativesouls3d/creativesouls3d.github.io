function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

const productId = getQueryParam("id");
const container = document.getElementById("product-details");

if (productId) {
  const openAppSection = document.getElementById("open-in-app");
  const manualLink = document.getElementById("manualLink");
  const manualLinkFallback = document.getElementById("manualLinkFallback");

  if (openAppSection && manualLink && manualLinkFallback) {
    const intentUrl = `intent://product/${productId}#Intent;scheme=creativesouls3d;package=com.ls.creativesouls3d;end`;
    manualLink.href = intentUrl;
    manualLinkFallback.href = intentUrl;
    openAppSection.style.display = "block";

    manualLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = intentUrl;

      setTimeout(() => {
        const fallback = document.getElementById("fallback");
        if (fallback) fallback.style.display = "block";
      }, 2500);
    });
  }
}

function getCachedProduct(id) {
  const cached = localStorage.getItem("products");
  if (!cached) return null;

  try {
    const products = JSON.parse(cached);
    return products.find(p => p.productId === id || p.id === id) || null;
  } catch {
    return null;
  }
}

function renderProduct(data) {
  if (!container) return;

  container.innerHTML = `
    <h1>${data.productName || "Untitled product"}</h1>
    <img src="${data.imageUrl || "logo_creativesouls.jpg"}" alt="${data.productName || "Product image"}" />
    <p><strong>Price:</strong> ${formatPrice(data.price)}</p>
    <p><strong>Category:</strong> ${data.category || "Uncategorized"}</p>
    <p><strong>Color:</strong> ${data.color || "N/A"}</p>
    <p><strong>Customizable:</strong> ${data.customizable ? "Yes" : "No"}</p>
    <p><strong>Stock:</strong> ${data.stock || "Made to order"}</p>
    <p><strong>Description:</strong> ${data.description || ""}</p>
    <div class="actions">
      <input type="number" id="qty" value="1" min="1" />
      <button id="addCart">Add to Cart</button>
      <button id="buyNow">Buy Now</button>
    </div>
    <a href="index.html" class="back-button">Back to Products</a>
  `;

  function addToCart(item) {
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    const existing = cart.find(i => i.id === item.id);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      cart.push(item);
    }

    localStorage.setItem("cart", JSON.stringify(cart));
  }

  document.getElementById("addCart").onclick = () => {
    const qty = parseInt(document.getElementById("qty").value, 10);
    if (qty < 1) return alert("Enter a valid quantity.");

    addToCart({
      id: data.productId || data.id || productId,
      productName: data.productName || "Untitled product",
      imageUrl: data.imageUrl || "",
      price: Number(data.price || 0),
      quantity: qty
    });

    alert("Added to cart.");
  };

  document.getElementById("buyNow").onclick = () => {
    const qty = parseInt(document.getElementById("qty").value, 10);
    if (qty < 1) return alert("Enter a valid quantity.");

    addToCart({
      id: data.productId || data.id || productId,
      productName: data.productName || "Untitled product",
      imageUrl: data.imageUrl || "",
      price: Number(data.price || 0),
      quantity: qty
    });

    window.location.href = "cart.html";
  };
}

if (container) {
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
            renderProduct({ id: doc.id, productId: doc.id, ...doc.data() });
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
}
