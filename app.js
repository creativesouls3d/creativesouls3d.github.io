let currentUser = null;
const productList = document.getElementById("product-list");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const userNameEl = document.getElementById("user-name");
const userPhotoEl = document.getElementById("user-photo");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const dropdownMenu = document.getElementById("dropdown-menu");

const INTEREST_COOKIE = "cs3d_interests";
const SEEN_COOKIE = "cs3d_seen";
const COOKIE_MAX_AGE_DAYS = 180;
const PRODUCTS_PER_PAGE = 12;

let currentProductResults = [];
let currentProductPage = 1;
let renderedProductKeys = new Set();

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderCustomerReviewSlider(reviews) {
  const section = document.getElementById("customer-review-slider");
  const content = document.getElementById("customer-review-content");
  if (!section || !content) return;

  reviews = reviews.filter(review => String(review.comment || "").trim() && review.ownReview !== true);
  if (!reviews.length) return;
  const progressTrack = section.querySelector(".review-progress-track");
  if (progressTrack) progressTrack.hidden = reviews.length <= 1;

  for (let i = reviews.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [reviews[i], reviews[j]] = [reviews[j], reviews[i]];
  }

  let currentIndex = 0;
  const intervalDuration = 6500;
  let remainingTime = intervalDuration;
  let reviewTimer = null;
  let timerStartedAt = 0;
  let isPaused = false;
  let isHovered = false;
  let isPressed = false;
  let isFocused = false;
  const getProgressBar = () => section.querySelector("#review-progress-bar");

  const startReviewTimer = (reset = true) => {
    if (reviews.length <= 1) return;
    window.clearTimeout(reviewTimer);
    if (reset) remainingTime = intervalDuration;
    timerStartedAt = performance.now();
    const progressBar = getProgressBar();
    if (progressBar && reset) {
      progressBar.style.animation = "none";
      void progressBar.offsetWidth;
      progressBar.style.animation = `review-countdown ${intervalDuration}ms linear forwards`;
      progressBar.style.animationPlayState = isPaused ? "paused" : "running";
    } else if (progressBar && !isPaused) {
      progressBar.style.animationPlayState = "running";
    }
    if (!isPaused) reviewTimer = window.setTimeout(() => moveReview(1), remainingTime);
  };

  const updateReviewPauseState = () => {
    const shouldPause = isHovered || isPressed || isFocused;
    if (shouldPause === isPaused || reviews.length <= 1) return;
    isPaused = shouldPause;
    if (isPaused) {
      window.clearTimeout(reviewTimer);
      remainingTime = Math.max(0, remainingTime - (performance.now() - timerStartedAt));
      const progressBar = getProgressBar();
      if (progressBar) progressBar.style.animationPlayState = "paused";
    } else {
      startReviewTimer(false);
    }
  };

  const renderReview = () => {
    const review = reviews[currentIndex];
    const rating = Math.max(1, Math.min(5, Math.round(Number(review.rating || 5))));
    const reviewer = String(review.userName || "Customer").includes("@")
      ? "Verified customer"
      : review.userName || "Customer";
    content.innerHTML = `
      <article class="customer-review-card">
        <div class="customer-review-stars" aria-label="${rating} out of 5 stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
        <blockquote>“${escapeHTML(review.comment)}”</blockquote>
        <div class="customer-review-byline"><strong>${escapeHTML(reviewer)}</strong><span>on ${escapeHTML(review.productName)}</span></div>
        <div class="review-progress-track" aria-hidden="true"><span id="review-progress-bar"></span></div>
      </article>
      <div class="review-slider-position">${currentIndex + 1} / ${reviews.length}</div>
    `;
    startReviewTimer();
  };

  const moveReview = direction => {
    currentIndex = (currentIndex + direction + reviews.length) % reviews.length;
    renderReview();
  };

  document.getElementById("review-prev")?.addEventListener("click", () => moveReview(-1));
  document.getElementById("review-next")?.addEventListener("click", () => moveReview(1));
  content.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") { isHovered = true; updateReviewPauseState(); }
  });
  content.addEventListener("pointerleave", event => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") { isHovered = false; updateReviewPauseState(); }
  });
  content.addEventListener("pointerdown", () => { isPressed = true; updateReviewPauseState(); });
  window.addEventListener("pointerup", () => { isPressed = false; updateReviewPauseState(); });
  window.addEventListener("pointercancel", () => { isPressed = false; updateReviewPauseState(); });
  content.addEventListener("focusin", () => { isFocused = true; updateReviewPauseState(); });
  content.addEventListener("focusout", event => {
    if (!content.contains(event.relatedTarget)) {
      isFocused = false;
      updateReviewPauseState();
    }
  });
  section.style.display = "block";
  renderReview();
}

function formatPrice(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(number);
}

function getOriginalPrice(value) {
  return Math.round(Number(value || 0) * 1.3);
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
  if (typeof window.updateHeaderCartCount === "function") {
    window.updateHeaderCartCount();
  }
}

function getDefaultColour(product) {
  const raw = String(product.colour || product.color || "").trim();
  return raw.includes(",") ? raw.split(",")[0].trim() : raw;
}

function getCartItem(product) {
  const id = getProductKey(product);
  const colour = getDefaultColour(product);
  return getCart().find(item => item.id === id && (item.colour || "") === colour);
}

function setCartQuantity(product, quantity) {
  const id = getProductKey(product);
  const colour = getDefaultColour(product);
  const cart = getCart();
  const existing = cart.find(item => item.id === id && (item.colour || "") === colour);

  if (quantity <= 0) {
    saveCart(cart.filter(item => item.id !== id || (item.colour || "") !== colour));
    return;
  }

  if (existing) {
    existing.quantity = quantity;
    existing.customizable = isProductCustomizable(product);
  } else {
    cart.push({
      id,
      productName: product.productName || "Untitled product",
      imageUrl: String(product.imageUrl || "").split(",").map(url => url.trim()).find(Boolean) || "logo_creativesouls.jpg",
      price: Number(product.price || 0),
      colour,
      customizable: isProductCustomizable(product),
      customization: "",
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
      <button type="button" class="qty-btn" data-cart-action="decrease" aria-label="Decrease quantity">−</button>
      <span class="qty-value">${quantity}</span>
      <button type="button" class="qty-btn" data-cart-action="increase" aria-label="Increase quantity">+</button>
    `;
    return;
  }

  container.classList.remove("has-qty");
  container.innerHTML = `
    <button type="button" class="add-card-btn" data-cart-action="add">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      Add to Cart
    </button>
  `;
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

function getColorValue(product) {
  return String(product.colour || product.color || "").trim();
}

function getProductTags(product) {
  const values = [product.category, product.tags, product.bestFor, product.best_for, product.useCase, product.use_case]
    .flatMap(value => Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,|]/) : []);
  return values.map(normalizeTerm).filter(Boolean);
}

function isProductCustomizable(product) {
  const value = product.customizable ?? product.isCustomizable ?? product.is_customizable;
  if (typeof value === "boolean") return value;
  return /^(yes|true|1|customizable|custom)$/i.test(String(value || "").trim());
}

function isProductInStock(product) {
  const availability = normalizeTerm(product.availability || product.stockStatus || product.stock_status || "");
  if (availability.includes("out of stock") || availability === "sold out") return false;
  if (availability.includes("in stock")) return true;
  if (product.inStock != null) return Boolean(product.inStock);
  const stock = product.stock ?? product.quantity;
  if (typeof stock === "number") return stock > 0;
  const stockText = normalizeTerm(stock);
  if (stockText.includes("out of stock") || stockText === "sold out") return false;
  if (stockText.includes("in stock") || stockText.includes("made to order")) return true;
  if (stock != null && /^\d+$/.test(String(stock).trim())) return Number(stock) > 0;
  return true;
}

function categoryMatches(product, selected) {
  if (!selected) return true;
  const category = normalizeTerm(product.category);
  const categories = getProductTags(product);
  const aliases = {
    "keychains": ["keychain", "keychains"],
    "home decor": ["decor", "home decor", "home décor"],
    "idols": ["idol", "idols", "pooja idols"],
    "desk accessories": ["desk", "desk accessory", "desk accessories", "office", "office accessories"],
    "gifts": ["gift", "gifts", "return gift", "return gifts"],
    "car accessories": ["car", "car accessory", "car accessories"],
    "custom products": ["custom", "custom product", "custom products", "custom print", "custom prints"]
  };
  const knownCategories = Object.values(aliases).flat();
  if (selected === "other") return Boolean(category) && !categories.some(value => knownCategories.includes(value));
  if (selected === "custom products" && isProductCustomizable(product)) return true;
  const target = aliases[selected] || [selected];
  return categories.some(value => target.includes(value));
}

function getProductColorTokens(product) {
  const raw = getColorValue(product).toLowerCase();
  return [...new Set(raw.match(/black|white|red|blue|yellow|green/g) || [])];
}

function isMultiColorProduct(product) {
  const raw = getColorValue(product);
  return raw.includes(",") || getProductColorTokens(product).length > 1 || /\s/.test(raw.trim()) || /multi|custom|assorted/i.test(raw);
}

function updateColorFilterOptions(products) {
  const wrap = document.getElementById("filter-color-wrap");
  const select = document.getElementById("filter-color");
  if (!wrap || !select) return;
  const previous = select.value;
  const counts = new Map();
  products.forEach(product => {
    const colors = getProductColorTokens(product);
    colors.forEach(color => counts.set(color, (counts.get(color) || 0) + 1));
    if (isMultiColorProduct(product)) counts.set("custom-multiple", (counts.get("custom-multiple") || 0) + 1);
  });
  const labels = { black: "Black", white: "White", red: "Red", blue: "Blue", yellow: "Yellow", green: "Green", "custom-multiple": "Custom/Multiple" };
  const available = [...counts].filter(([, count]) => count >= 2);
  wrap.hidden = available.length === 0;
  select.innerHTML = `<option value="">Any Color</option>${available.map(([key]) => `<option value="${key}">${labels[key]}</option>`).join("")}`;
  const requested = new URLSearchParams(location.search).get("color");
  const desired = requested || previous;
  if (available.some(([key]) => key === desired)) select.value = desired;
}

function readCatalogState() {
  return {
    query: searchInput.value.trim(),
    category: normalizeTerm(document.getElementById("filter-category").value),
    price: document.getElementById("filter-price").value,
    minPrice: document.getElementById("filter-price-min").value,
    maxPrice: document.getElementById("filter-price-max").value,
    customizable: document.getElementById("filter-customizable").value,
    bestFor: normalizeTerm(document.getElementById("filter-best-for").value),
    availability: document.getElementById("filter-availability").value,
    color: document.getElementById("filter-color").value,
    sort: document.getElementById("sort-by").value || "featured"
  };
}

function syncCatalogURL(state) {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.category) params.set("category", state.category);
  if (state.price) params.set("price", state.price);
  if (state.minPrice) params.set("min", state.minPrice);
  if (state.maxPrice) params.set("max", state.maxPrice);
  if (state.customizable) params.set("customizable", state.customizable);
  if (state.bestFor) params.set("bestFor", state.bestFor);
  if (state.availability) params.set("availability", state.availability);
  if (state.color) params.set("color", state.color);
  if (state.sort && state.sort !== "featured") params.set("sort", state.sort);
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
}

function loadCatalogStateFromURL() {
  const params = new URLSearchParams(location.search);
  searchInput.value = params.get("q") || "";
  const setIfAvailable = (id, key) => {
    const select = document.getElementById(id);
    const value = params.get(key);
    if (value && [...select.options].some(option => option.value.toLowerCase() === value.toLowerCase() || option.text.toLowerCase() === value.toLowerCase())) {
      select.value = [...select.options].find(option => option.value.toLowerCase() === value.toLowerCase() || option.text.toLowerCase() === value.toLowerCase()).value;
    }
  };
  setIfAvailable("filter-category", "category");
  setIfAvailable("filter-price", "price");
  setIfAvailable("filter-customizable", "customizable");
  setIfAvailable("filter-best-for", "bestFor");
  setIfAvailable("filter-availability", "availability");
  setIfAvailable("filter-color", "color");
  setIfAvailable("sort-by", "sort");
  document.getElementById("filter-price-min").value = params.get("min") || "";
  document.getElementById("filter-price-max").value = params.get("max") || "";
  document.getElementById("custom-price-range").hidden = document.getElementById("filter-price").value !== "custom";
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

  return [...products].sort((a, b) => {
    // Primary: most reviewed first
    const countDiff = (Number(b.reviewCount) || 0) - (Number(a.reviewCount) || 0);
    if (countDiff !== 0) return countDiff;

    // Secondary: highest rated
    const ratingDiff = (Number(b.rating) || 0) - (Number(a.rating) || 0);
    if (ratingDiff !== 0) return ratingDiff;

    // Tertiary: personalised interest score (if returning visitor)
    if (hasInterests) {
      const scoreDiff = getProductInterestScore(b, interests) - getProductInterestScore(a, interests);
      if (scoreDiff !== 0) return scoreDiff;
    }

    // Fallback: alphabetical
    return String(a.productName || "").localeCompare(String(b.productName || ""));
  });
}

firebase.auth().onAuthStateChanged((user) => {
  currentUser = user;

  if (user) {
    userNameEl.textContent = user.displayName || "User";
    userPhotoEl.src = user.photoURL || "default-user.png";
    loginBtn.style.display = "none";
    // Logout lives in the shared profile/account popup, not as a separate header button.
    logoutBtn.style.display = "none";
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
  if (window.toggleAccountPopup) window.toggleAccountPopup();
  else dropdownMenu.style.display = dropdownMenu.style.display === "flex" ? "none" : "flex";
};

document.body.addEventListener("click", (e) => {
  if (!userPhotoEl.contains(e.target) && !dropdownMenu.contains(e.target) && !e.target.closest(".account-nav-link")) {
    if (window.toggleAccountPopup) window.toggleAccountPopup(false);
    else dropdownMenu.style.display = "none";
  }
});

function renderProduct(data) {
  const key = getProductKey(data);
  if (renderedProductKeys.has(key)) return;

  renderedProductKeys.add(key);

  const card = document.createElement("div");
  card.className = "product-card";
  card.productData = data;

  const id = encodeURIComponent(data.productId || data.id || "");
  const name = escapeHTML(data.productName || "Untitled product");
  const firstImage = String(data.imageUrl || "").split(",").map(url => url.trim()).find(Boolean) || "logo_creativesouls.jpg";
  const image = escapeHTML(firstImage || "logo_creativesouls.jpg");
  const category = escapeHTML(data.category || "Custom Print");

  // Read from Firestore — default to 0 if field doesn't exist
  const rawRating = parseFloat(
    data.rating ?? data.avgRating ?? data.averageRating ?? data.avg_rating ?? 0
  ) || 0;
  const reviewCount = parseInt(
    data.reviewCount ?? data.review_count ?? data.numReviews ??
    data.totalReviews ?? data.reviews ?? 0,
    10
  ) || 0;

  // Build star SVGs (filled / half / empty)
  function buildStars(r) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      if (r >= i) {
        html += `<svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      } else if (r >= i - 0.5) {
        html += `<svg width="13" height="13" viewBox="0 0 24 24" stroke="#f59e0b" stroke-width="1"><defs><linearGradient id="hs${i}"><stop offset="50%" stop-color="#f59e0b"/><stop offset="50%" stop-color="#e2e8f0"/></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#hs${i})"/></svg>`;
      } else {
        html += `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      }
    }
    return html;
  }

  // Always show rating row — real data or 0
  const ratingHTML = `
    <div class="rating-row card-rating">
      <span class="stars-wrap">${buildStars(rawRating)}</span>
      <span class="rating-score">${rawRating > 0 ? rawRating.toFixed(1) : '0'}</span>
      <span class="review-count">(${reviewCount} reviews)</span>
    </div>`;

  card.innerHTML = `
    <a class="product-card-link" href="product.html?id=${id}">
      <div class="img-wrapper">
        <img src="${image}" alt="${name}" loading="lazy"/>
      </div>
      <div class="product-card-body">
        ${category ? `<span class="category">${category}</span>` : ""}
        <h3>${name}</h3>
        ${ratingHTML}
        <div class="product-meta">
          <span class="price-current">${formatPrice(data.price)}</span>
          <del class="price-original">${formatPrice(getOriginalPrice(data.price))}</del>
        </div>
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
      if (typeof window.showToast === "function") {
        window.showToast(`Added "${name}" to cart!`, "success", "View Cart", "cart.html");
      }
    } else if (action === "increase") {
      setCartQuantity(data, currentQuantity + 1);
    } else if (action === "decrease") {
      setCartQuantity(data, currentQuantity - 1);
    }

    renderCardCartControls(cartControls, data);
  });

  productList.appendChild(card);
}

function refreshProductCartControls() {
  document.querySelectorAll(".product-card").forEach(card => {
    if (!card.productData) return;
    const controls = card.querySelector(".card-cart-actions");
    if (controls) renderCardCartControls(controls, card.productData);
  });
  if (typeof window.updateHeaderCartCount === "function") window.updateHeaderCartCount();
}

window.addEventListener("pageshow", refreshProductCartControls);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshProductCartControls();
});
window.addEventListener("storage", event => {
  if (event.key === "cart") refreshProductCartControls();
});

function renderProductPage() {
  productList.innerHTML = "";
  renderedProductKeys = new Set();
  const start = (currentProductPage - 1) * PRODUCTS_PER_PAGE;
  currentProductResults.slice(start, start + PRODUCTS_PER_PAGE).forEach(renderProduct);
  renderProductPagination();
}

function renderProductPagination() {
  const pagination = document.getElementById("product-pagination");
  if (!pagination) return;
  const pageCount = Math.ceil(currentProductResults.length / PRODUCTS_PER_PAGE);
  if (pageCount <= 1) {
    pagination.innerHTML = "";
    pagination.style.display = "none";
    return;
  }
  pagination.style.display = "flex";

  const pages = new Set([1, pageCount]);
  for (let page = Math.max(2, currentProductPage - 1); page <= Math.min(pageCount - 1, currentProductPage + 1); page++) pages.add(page);
  const sequence = [...pages].sort((a, b) => a - b);
  const entries = [];
  sequence.forEach((page, index) => {
    if (index && page - sequence[index - 1] > 1) entries.push("…");
    entries.push(page);
  });

  pagination.innerHTML = `
    <button type="button" data-page="${Math.max(1, currentProductPage - 1)}" aria-label="Previous page" ${currentProductPage === 1 ? "disabled" : ""}>‹</button>
    ${entries.map(entry => typeof entry === "number"
      ? `<button type="button" data-page="${entry}" aria-label="Page ${entry}" aria-current="${entry === currentProductPage ? "page" : "false"}" class="${entry === currentProductPage ? "active" : ""}">${entry}</button>`
      : `<span class="pagination-ellipsis" aria-hidden="true">${entry}</span>`).join("")}
    <button type="button" data-page="${Math.min(pageCount, currentProductPage + 1)}" aria-label="Next page" ${currentProductPage === pageCount ? "disabled" : ""}>›</button>
  `;

  pagination.querySelectorAll("button:not(:disabled)").forEach(button => {
    button.addEventListener("click", () => {
      const nextPage = Number(button.dataset.page);
      if (!nextPage || nextPage === currentProductPage) return;
      currentProductPage = nextPage;
      renderProductPage();
      document.getElementById("product-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function productDateValue(product) {
  const value = product.createdAt || product.created_at || product.dateAdded || product.timestamp || product.created;
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds || value?._seconds) return (value.seconds || value._seconds) * 1000;
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function displayProducts(products) {
  const recommendationHistory = window.ProductRecommendations?.readHistory() || [];
  if (recommendationHistory.length) {
    const section = document.getElementById("recommended-section");
    if (section) section.hidden = false;
    window.ProductRecommendations?.render(document.getElementById("recommended-products"), products, { limit: 4, excludeViewed: true });
  }
  updateColorFilterOptions(products);
  const state = readCatalogState();
  const homeHero = document.getElementById("home-hero");
  const catalogHeading = document.getElementById("catalog-heading");
  const searchTerm = state.query.trim();
  if (homeHero) homeHero.hidden = Boolean(searchTerm);
  if (catalogHeading) catalogHeading.textContent = searchTerm
    ? `Showing results for “${searchTerm}”`
    : "Handcrafted Collection";
  const q = normalizeTerm(state.query);
  const filtered = products.filter(product => {
    const price = Number(product.price || 0);
    const tags = getProductTags(product);
    const searchable = normalizeTerm([
      product.productName, product.description, product.category, getColorValue(product), ...tags
    ].join(" "));
    let matchesPrice = true;
    switch (state.price) {
      case "under100": matchesPrice = price < 100; break;
      case "100-199": matchesPrice = price >= 100 && price < 200; break;
      case "200-399": matchesPrice = price >= 200 && price < 400; break;
      case "400-699": matchesPrice = price >= 400 && price < 700; break;
      case "700plus": matchesPrice = price >= 700; break;
      case "custom": {
        const minimum = state.minPrice === "" ? null : Number(state.minPrice);
        const maximum = state.maxPrice === "" ? null : Number(state.maxPrice);
        matchesPrice = (minimum === null || price >= minimum) && (maximum === null || price <= maximum);
        break;
      }
    }
    const matchesCustomizable = !state.customizable || isProductCustomizable(product) === (state.customizable === "yes");
    const matchesBestFor = !state.bestFor || tags.some(tag => tag.includes(state.bestFor) || state.bestFor.includes(tag));
    const matchesAvailability = !state.availability || isProductInStock(product) === (state.availability === "in-stock");
    const matchesColor = !state.color || (state.color === "custom-multiple"
      ? isMultiColorProduct(product)
      : getProductColorTokens(product).includes(state.color));
    return categoryMatches(product, state.category) && matchesPrice && matchesCustomizable &&
      matchesBestFor && matchesAvailability && matchesColor && (!q || searchable.includes(q));
  });

  let ordered = dedupeProducts(orderProductsForVisitor(filtered));
  if (state.sort === "newest") ordered.sort((a, b) => productDateValue(b) - productDateValue(a));
  if (state.sort === "price-asc") ordered.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  if (state.sort === "price-desc") ordered.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  if (state.sort === "popular") ordered.sort((a, b) =>
    (Number(b.popularity || b.popularityScore || b.salesCount || b.orderCount || b.viewCount || 0) + Number(b.reviewCount || b.review_count || 0) * 2) -
    (Number(a.popularity || a.popularityScore || a.salesCount || a.orderCount || a.viewCount || 0) + Number(a.reviewCount || a.review_count || 0) * 2)
  );
  if (state.sort === "featured") {
    const isFeatured = product => /^(true|yes|1)$/i.test(String(product.featured ?? product.isFeatured ?? ""));
    ordered.sort((a, b) => Number(isFeatured(b)) - Number(isFeatured(a)));
  }

  if (ordered.length === 0) {
    productList.innerHTML = `<div class="empty-state">No products found. Try a different search or category.</div>`;
    currentProductResults = [];
    currentProductPage = 1;
    renderedProductKeys = new Set();
    const pagination = document.getElementById("product-pagination");
    if (pagination) {
      pagination.replaceChildren();
      pagination.style.display = "none";
    }
    return;
  }

  currentProductResults = ordered;
  currentProductPage = 1;
  renderedProductKeys = new Set();
  renderProductPage();
}

const CACHE_VERSION = "v4"; // bump this whenever product schema changes

function loadProducts() {
  const cached = localStorage.getItem("products");
  const cacheVer = localStorage.getItem("products_cache_ver");
  const cachedOrderCount = localStorage.getItem("public_orders_count");
  const ordersCount = document.getElementById("total-orders-count");
  if (cachedOrderCount && ordersCount) ordersCount.textContent = Number(cachedOrderCount).toLocaleString("en-IN");

  // Invalidate cache if version changed (schema/field names updated)
  if (cacheVer !== CACHE_VERSION) {
    localStorage.removeItem("products");
    localStorage.removeItem("products_cache_time");
    localStorage.setItem("products_cache_ver", CACHE_VERSION);
  } else if (cached) {
    try {
      // Render cached products immediately, then refresh from Firestore so edits
      // made in the admin panel show up on the home page without waiting for TTL.
      const cachedProducts = JSON.parse(cached);
      const productsCount = document.getElementById("total-products-count");
      if (productsCount) productsCount.textContent = cachedProducts.length.toLocaleString("en-IN");
      displayProducts(cachedProducts);
    } catch (err) {
      console.warn("Cache corrupted. Refetching...", err);
      localStorage.removeItem("products");
    }
  }

  fetchAndCacheProducts();
}

function fetchAndCacheProducts() {
  // Step 1: fetch all products
  db.collection("products").get().then(async (productSnap) => {
    const all = [];
    productSnap.forEach(doc => all.push({ id: doc.id, productId: doc.id, ...doc.data() }));
    const productsCount = document.getElementById("total-products-count");
    if (productsCount) productsCount.textContent = productSnap.size.toLocaleString("en-IN");
    displayProducts(all);

    db.collection("orders").get()
      .then(orderSnap => {
        const ordersCount = document.getElementById("total-orders-count");
        const count = orderSnap.docs.filter(doc => !doc.data().order_type).length;
        if (ordersCount) ordersCount.textContent = count.toLocaleString("en-IN");
        localStorage.setItem("public_orders_count", String(count));
      })
      .catch(err => console.warn("Could not load total orders count:", err));

    // Step 2: build reviewStats map  { productId -> { total, count } }
    const reviewStats = {};
    const customerReviews = [];

    // Load the top-level review source concurrently with the product subcollections.
    const topLevelReviewsFetch = db.collection("reviews").get().then(reviewSnap => {
      reviewSnap.forEach(doc => {
        const review = doc.data();
        const productId = review.productId || review.product_id || review.productID || review.itemId || "";
        const stars = parseFloat(review.rating || review.stars || review.score || review.rate || 0);
        if (!productId || !stars) return;
        if (!reviewStats[productId]) reviewStats[productId] = { total: 0, count: 0 };
        reviewStats[productId].total += stars;
        reviewStats[productId].count += 1;
      });
    }).catch(error => console.warn("Could not load top-level reviews:", error.message));

    // --- Also try subcollection: products/{id}/reviews ---
    // Run in parallel for all products
    const subcollectionFetches = all.map(p =>
      db.collection("products").doc(p.id).collection("reviews").get()
        .then(snap => {
          if (snap.empty) return;
          snap.forEach(doc => {
            const r = doc.data();
            customerReviews.push({
              ...r,
              productName: p.productName || "Creative Souls 3D product"
            });
            const stars = parseFloat(r.rating || r.stars || r.score || r.rate || 0);
            if (!stars) return;
            if (!reviewStats[p.id]) reviewStats[p.id] = { total: 0, count: 0 };
            reviewStats[p.id].total += stars;
            reviewStats[p.id].count += 1;
          });
        })
        .catch(() => {}) // silently skip if subcollection doesn't exist
    );

    await Promise.all([...subcollectionFetches, topLevelReviewsFetch]);
    renderCustomerReviewSlider(customerReviews);

    // Step 3: merge stats into products
    const withRatings = all.map(p => {
      const pid = p.productId || p.id || "";
      const stats = reviewStats[pid];
      if (stats && stats.count > 0) {
        return {
          ...p,
          rating: Math.round((stats.total / stats.count) * 10) / 10,
          reviewCount: stats.count
        };
      }
      return p;
    });

    localStorage.setItem("products", JSON.stringify(withRatings));
    localStorage.setItem("products_cache_time", Date.now().toString());
    displayProducts(withRatings);

  }).catch(err => {
    console.error("Firestore error:", err);
    productList.innerHTML = `<div class="empty-state">Failed to load products. Please refresh and try again.</div>`;
  });
}

function applyCatalogFilters() {
  const state = readCatalogState();
  document.getElementById("custom-price-range").hidden = state.price !== "custom";
  syncCatalogURL(state);
  let products = [];
  try { products = JSON.parse(localStorage.getItem("products") || "[]"); } catch { /* refetch below handles bad cache */ }
  displayProducts(products);
}

loadCatalogStateFromURL();
[
  "filter-category", "filter-price", "filter-customizable", "filter-best-for",
  "filter-availability", "filter-color", "sort-by", "filter-price-min", "filter-price-max"
].forEach(id => document.getElementById(id)?.addEventListener("change", applyCatalogFilters));

searchForm?.addEventListener("submit", event => {
  event.preventDefault();
  applyCatalogFilters();
});

document.getElementById("clear-filters")?.addEventListener("click", () => {
  ["filter-category", "filter-price", "filter-customizable", "filter-best-for", "filter-availability", "filter-color"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("filter-price-min").value = "";
  document.getElementById("filter-price-max").value = "";
  document.getElementById("sort-by").value = "featured";
  searchInput.value = "";
  applyCatalogFilters();
});

window.addEventListener("popstate", () => {
  loadCatalogStateFromURL();
  applyCatalogFilters();
});

function startSaleCountdown() {
  const countdown = document.getElementById("sale-countdown");
  if (!countdown) return;

  const storageKey = "sale_countdown_end";
  const defaultDurationMs = 8 * 60 * 60 * 1000;
  let endTime = Number(localStorage.getItem(storageKey));
  if (!Number.isFinite(endTime) || endTime <= Date.now()) {
    endTime = Date.now() + defaultDurationMs;
    localStorage.setItem(storageKey, String(endTime));
  }

  const updateCountdown = () => {
    let remaining = Math.max(0, endTime - Date.now());
    if (remaining === 0) {
      endTime = Date.now() + defaultDurationMs;
      localStorage.setItem(storageKey, String(endTime));
      remaining = defaultDurationMs;
    }
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    countdown.textContent = `${hours}:${minutes}:${seconds}`;
  };

  updateCountdown();
  window.setInterval(updateCountdown, 1000);
}

startSaleCountdown();
loadProducts();
