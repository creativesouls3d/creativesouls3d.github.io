let currentUser = null;
const productList = document.getElementById("product-list");
const categoryButtons = document.querySelectorAll(".filters button");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const userNameEl = document.getElementById("user-name");
const userPhotoEl = document.getElementById("user-photo");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const dropdownMenu = document.getElementById("dropdown-menu");

const CACHE_DURATION_MS = 15 * 60 * 1000;
const INTEREST_COOKIE = "cs3d_interests";
const SEEN_COOKIE = "cs3d_seen";
const COOKIE_MAX_AGE_DAYS = 180;
const PRODUCTS_PER_PAGE = 15;

let currentProductResults = [];
let visibleProductCount = 0;
let renderedProductKeys = new Set();
let isAppendingProducts = false;

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(number);
}

function getProductKey(product) {
  return String(
    product.productId ||
    product.id ||
    `${product.productName || "product"}-${product.imageUrl || ""}-${product.price || 0}`
  );
}

function dedupeProducts(products) {
  const seen = new Set();

  return products.filter(product => {
    const key = getProductKey(product);
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem("cart")) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function getCartItem(product) {
  const id = getProductKey(product);
  return getCart().find(item => item.id === id);
}

function setCartQuantity(product, quantity) {
  const id = getProductKey(product);
  const cart = getCart();
  const existing = cart.find(item => item.id === id);

  if (quantity <= 0) {
    saveCart(cart.filter(item => item.id !== id));
    return;
  }

  if (existing) {
    existing.quantity = quantity;
  } else {
    cart.push({
      id,
      productName: product.productName || "Untitled product",
      imageUrl: product.imageUrl || "",
      price: Number(product.price || 0),
      quantity
    });
  }

  saveCart(cart);
}

function renderCardCartControls(container, product) {
  const cartItem = getCartItem(product);
  const quantity = cartItem?.quantity || 0;

  if (quantity > 0) {
    container.classList.add("has-qty");
    container.innerHTML = `
      <button type="button" class="qty-btn" data-cart-action="decrease" aria-label="Decrease quantity">-</button>
      <span class="qty-value">${quantity}</span>
      <button type="button" class="qty-btn" data-cart-action="increase" aria-label="Increase quantity">+</button>
    `;
    return;
  }

  container.classList.remove("has-qty");
  container.innerHTML = `<button type="button" class="add-card-btn" data-cart-action="add">Add to Cart</button>`;
}

function setCookie(name, value, days = COOKIE_MAX_AGE_DAYS) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const match = document.cookie
    .split("; ")
    .find(row => row.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "";
}

function getInterestMap() {
  const raw = getCookie(INTEREST_COOKIE);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveInterestMap(map) {
  const compact = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  setCookie(INTEREST_COOKIE, JSON.stringify(compact));
}

function normalizeTerm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeCategory(value) {
  return normalizeTerm(value).replace(/s$/, "");
}

function getProductInterestTerms(product) {
  const terms = [];

  if (product.category) terms.push(product.category);

  if (Array.isArray(product.tags)) {
    terms.push(...product.tags);
  } else if (typeof product.tags === "string") {
    terms.push(...product.tags.split(","));
  }

  return [...new Set(terms.map(normalizeTerm).filter(Boolean))];
}

function saveProductInterest(product) {
  const terms = getProductInterestTerms(product);
  if (terms.length === 0) return;

  const interests = getInterestMap();
  terms.forEach(term => {
    interests[term] = (interests[term] || 0) + 1;
  });

  saveInterestMap(interests);
}

function getProductInterestScore(product, interests = getInterestMap()) {
  return getProductInterestTerms(product)
    .reduce((score, term) => score + (interests[term] || 0), 0);
}

function shuffleProducts(products) {
  const shuffled = [...products];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function orderProductsForVisitor(products) {
  const interests = getInterestMap();
  const hasInterests = Object.keys(interests).length > 0;

  if (hasInterests) {
    return [...products].sort((a, b) => {
      const scoreDiff = getProductInterestScore(b, interests) - getProductInterestScore(a, interests);
      return scoreDiff || String(a.productName || "").localeCompare(String(b.productName || ""));
    });
  }

  if (!getCookie(SEEN_COOKIE)) {
    setCookie(SEEN_COOKIE, "1");
    return shuffleProducts(products);
  }

  return products;
}

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

loginBtn.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(err => alert("Login failed: " + err.message));
};

logoutBtn.onclick = () => {
  firebase.auth().signOut();
};

userPhotoEl.onclick = (e) => {
  e.stopPropagation();
  dropdownMenu.style.display = dropdownMenu.style.display === "flex" ? "none" : "flex";
};

document.body.addEventListener("click", (e) => {
  if (!userPhotoEl.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.style.display = "none";
  }
});

function renderProduct(data) {
  const key = getProductKey(data);
  if (renderedProductKeys.has(key)) return;

  renderedProductKeys.add(key);

  const card = document.createElement("div");
  card.className = "product-card";

  const id = encodeURIComponent(data.productId || data.id || "");
  const name = escapeHTML(data.productName || "Untitled product");
  const image = escapeHTML(data.imageUrl || "logo_creativesouls.jpg");
  const category = escapeHTML(data.category || "Uncategorized");

  card.innerHTML = `
    <a class="product-card-link" href="product.html?id=${id}">
      <img src="${image}" alt="${name}" loading="lazy"/>
      <div class="product-card-body">
        <span class="category">${category}</span>
        <h3>${name}</h3>
        <div class="rating-row" aria-label="Product rating">
          <span>Top pick</span>
          <small>Made to order</small>
        </div>
        <div class="product-meta">
          <span class="price">${formatPrice(data.price)}</span>
        </div>
        <p class="delivery-note">Free custom preview before printing</p>
      </div>
    </a>
    <div class="card-cart-actions" aria-label="Cart controls"></div>
  `;

  card.querySelector(".product-card-link").addEventListener("click", () => {
    saveProductInterest(data);
  });

  const cartControls = card.querySelector(".card-cart-actions");
  renderCardCartControls(cartControls, data);

  cartControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cart-action]");
    if (!button) return;

    const currentQuantity = getCartItem(data)?.quantity || 0;
    const action = button.dataset.cartAction;

    if (action === "add") {
      setCartQuantity(data, 1);
      saveProductInterest(data);
    } else if (action === "increase") {
      setCartQuantity(data, currentQuantity + 1);
    } else if (action === "decrease") {
      setCartQuantity(data, currentQuantity - 1);
    }

    renderCardCartControls(cartControls, data);
  });

  productList.appendChild(card);
}

function renderNextProducts() {
  if (isAppendingProducts) return;
  if (visibleProductCount >= currentProductResults.length) return;

  isAppendingProducts = true;

  const nextProducts = currentProductResults.slice(
    visibleProductCount,
    visibleProductCount + PRODUCTS_PER_PAGE
  );

  nextProducts.forEach(renderProduct);
  visibleProductCount += nextProducts.length;
  isAppendingProducts = false;
}

function isNearBottom() {
  return window.innerHeight + window.scrollY >= document.body.offsetHeight - 700;
}

window.addEventListener("scroll", () => {
  if (isNearBottom()) {
    renderNextProducts();
  }
}, { passive: true });

function displayProducts(products, filter = "All", query = "", priceMax = null) {
  productList.innerHTML = "";
  const q = query.toLowerCase();
  const maxPrice = priceMax ? Number(priceMax) : null;

  const filtered = products.filter(p => {
    const category = p.category || "";
    const tags = Array.isArray(p.tags) ? p.tags.join(" ") : (p.tags || "");
    const normalizedFilter = normalizeCategory(filter);
    const searchableCategoryText = `${category} ${tags} ${p.productName || ""}`.toLowerCase();
    const matchCategory =
      filter === "All" ||
      normalizeCategory(category) === normalizedFilter ||
      searchableCategoryText.includes(normalizedFilter);
    const matchPrice = !maxPrice || Number(p.price || 0) <= maxPrice;
    const matchSearch =
      !q ||
      p.productName?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      category.toLowerCase().includes(q) ||
      tags.toLowerCase().includes(q);

    return matchCategory && matchPrice && matchSearch;
  });

  const ordered = dedupeProducts(orderProductsForVisitor(filtered));

  if (ordered.length === 0) {
    productList.innerHTML = `<div class="empty-state">No products found. Try a different search or category.</div>`;
    currentProductResults = [];
    visibleProductCount = 0;
    renderedProductKeys = new Set();
    return;
  }

  currentProductResults = ordered;
  visibleProductCount = 0;
  renderedProductKeys = new Set();
  renderNextProducts();

  if (isNearBottom()) {
    renderNextProducts();
  }
}

function loadProducts() {
  const cached = localStorage.getItem("products");
  const cacheTime = localStorage.getItem("products_cache_time");
  const now = Date.now();

  if (!cached || !cacheTime || now - parseInt(cacheTime, 10) > CACHE_DURATION_MS) {
    fetchAndCacheProducts();
    return;
  }

  try {
    const products = JSON.parse(cached);
    displayProducts(products);
  } catch (err) {
    console.warn("Cache corrupted. Refetching...", err);
    fetchAndCacheProducts();
  }
}

function fetchAndCacheProducts() {
  db.collection("products").get().then(snapshot => {
    const all = [];
    snapshot.forEach(doc => all.push({ id: doc.id, productId: doc.id, ...doc.data() }));

    localStorage.setItem("products", JSON.stringify(all));
    localStorage.setItem("products_cache_time", Date.now().toString());
    displayProducts(all);
  }).catch(err => {
    console.error("Firestore error:", err);
    productList.innerHTML = `<div class="empty-state">Failed to load products. Please refresh and try again.</div>`;
  });
}

categoryButtons.forEach(btn => {
  btn.onclick = () => {
    document.querySelector(".filters .active")?.classList.remove("active");
    btn.classList.add("active");

    const category = btn.dataset.cat;
    const priceMax = btn.dataset.priceMax || null;
    const query = searchInput.value.trim();
    const products = JSON.parse(localStorage.getItem("products") || "[]");
    displayProducts(products, category, query, priceMax);
  };
});

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const query = searchInput.value.trim();
  const products = JSON.parse(localStorage.getItem("products") || "[]");
  const activeFilter = document.querySelector(".filters .active");
  const activeCategory = activeFilter?.dataset.cat || "All";
  const priceMax = activeFilter?.dataset.priceMax || null;
  displayProducts(products, activeCategory, query, priceMax);
});

loadProducts();
