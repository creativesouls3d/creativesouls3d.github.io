let currentUser = null;
const productList = document.getElementById("product-list");
const categoryButtons = document.querySelectorAll(".filters button");
const searchInput = document.getElementById("search-input");
const userNameEl = document.getElementById("user-name");
const userPhotoEl = document.getElementById("user-photo");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const dropdownMenu = document.getElementById("dropdown-menu");

// ========================
// 🔐 AUTH STATE MANAGEMENT
// ========================
firebase.auth().onAuthStateChanged((user) => {
  currentUser = user;

  if (user) {
    userNameEl.textContent = user.displayName || "User";
    userPhotoEl.src = user.photoURL || "default-user.png";
    loginBtn.style.display = "none";
    logoutBtn.style.display = "block";
  } else {
    userNameEl.textContent = "Guest";
    userPhotoEl.src = "https://www.svgrepo.com/show/384674/account-avatar-profile-user-11.svg";
    loginBtn.style.display = "block";
    logoutBtn.style.display = "none";
  }
});

// ==================
// 🔁 LOGIN / LOGOUT
// ==================
loginBtn.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(err => alert("Login failed: " + err.message));
};

logoutBtn.onclick = () => {
  firebase.auth().signOut();
};

// =====================
// 👤 PROFILE MENU TOGGLE
// =====================
userPhotoEl.onclick = (e) => {
  e.stopPropagation();
  dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
};

document.body.addEventListener("click", (e) => {
  if (!userPhotoEl.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.style.display = "none";
  }
});

// ========================
// 🧱 RENDER PRODUCT CARD
// ========================
function renderProduct(data) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.innerHTML = `
    <a href="product.html?id=${data.productId}">
      <img src="${data.imageUrl}" alt="${data.productName}" loading="lazy"/>
      <h3>${data.productName}</h3>
      <p>₹${data.price}</p>
      <p>${data.category || "Uncategorized"}</p>
    </a>
  `;
  productList.appendChild(card);
}

// ========================
// 🧼 DISPLAY PRODUCT LIST
// ========================
function displayProducts(products, filter = "All", query = "") {
  productList.innerHTML = "";
  const q = query.toLowerCase();

  const filtered = products.filter(p => {
    const matchCategory = filter === "All" || (p.category?.toLowerCase() === filter.toLowerCase());
    const matchSearch =
      p.productName?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      (Array.isArray(p.tags)
        ? p.tags.join(" ").toLowerCase().includes(q)
        : (typeof p.tags === "string" && p.tags.toLowerCase().includes(q))
      );

    return matchCategory && matchSearch;
  });

  if (filtered.length === 0) {
    productList.innerHTML = `<p style="text-align:center;">No products found.</p>`;
    return;
  }

  filtered.forEach(renderProduct);
}

// =============================
// 💾 LOAD FROM CACHE OR CLOUD
// =============================
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function loadProducts() {
  const cached = localStorage.getItem("products");
  const cacheTime = localStorage.getItem("products_cache_time");

  const now = Date.now();

  // If no cache or cache is older than 15 minutes
  if (!cached || !cacheTime || now - parseInt(cacheTime) > CACHE_DURATION_MS) {
    console.log("🔁 Cache expired or not found. Fetching new products...");
    fetchAndCacheProducts();
    return;
  }

  try {
    const products = JSON.parse(cached);
    displayProducts(products);
    console.log("✅ Loaded products from cache");
  } catch (err) {
    console.warn("❌ Cache corrupted. Refetching...");
    fetchAndCacheProducts();
  }
}

function fetchAndCacheProducts() {
  db.collection("products").get().then(snapshot => {
    const all = [];
    snapshot.forEach(doc => all.push(doc.data()));

    localStorage.setItem("products", JSON.stringify(all));
    localStorage.setItem("products_cache_time", Date.now().toString());

    displayProducts(all);
    console.log("✅ Products fetched and cached");
  }).catch(err => {
    console.error("❌ Firestore error:", err);
    productList.innerHTML = `<p style="color: red; text-align:center;">Failed to load products.</p>`;
  });
}


// ==========================
// 🧩 CATEGORY BUTTON FILTER
// ==========================
categoryButtons.forEach(btn => {
  btn.onclick = () => {
    document.querySelector(".filters .active")?.classList.remove("active");
    btn.classList.add("active");

    const category = btn.dataset.cat;
    searchInput.value = category; // Optional: sync category into search

    const products = JSON.parse(localStorage.getItem("products") || "[]");
    displayProducts(products, "All", category); // Only apply search logic
  };
});

// =======================
// 🔍 SEARCH PRODUCTS
// =======================
searchInput?.addEventListener("input", () => {
  const query = searchInput.value.trim();
  const products = JSON.parse(localStorage.getItem("products") || "[]");
  const activeCategory = document.querySelector(".filters .active")?.dataset.cat || "All";
  displayProducts(products, activeCategory, query);
});

document.getElementById("refresh-products-btn").onclick = function () {
  this.innerText = "⏳ Refreshing...";
  this.disabled = true;

  localStorage.removeItem("products");
  localStorage.removeItem("products_cache_time");

  fetchAndCacheProducts();

  // Re-enable after short delay
  setTimeout(() => {
    this.innerText = "🔄 Refresh Products";
    this.disabled = false;
  }, 2000);
};



// ===================
// 🚀 INITIAL LOAD
// ===================
loadProducts();
