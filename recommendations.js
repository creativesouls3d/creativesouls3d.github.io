(function () {
  const STORAGE_KEY = "cs3d_viewed_products";
  const LIMIT = 20;

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.filter(item => item && item.id) : [];
    } catch {
      return [];
    }
  }

  function record(product) {
    const id = String(product.productId || product.id || "");
    if (!id) return;
    const snapshot = {
      id,
      productName: product.productName || "Untitled product",
      category: product.category || "",
      tags: Array.isArray(product.tags) ? product.tags : (typeof product.tags === "string" ? product.tags.split(",") : []),
      imageUrl: product.imageUrl || "",
      price: Number(product.price) || 0,
      viewedAt: Date.now()
    };
    const history = readHistory().filter(item => item.id !== id);
    history.unshift(snapshot);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, LIMIT))); } catch { /* Storage may be unavailable. */ }
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function terms(product) {
    const tags = Array.isArray(product.tags) ? product.tags : (typeof product.tags === "string" ? product.tags.split(",") : []);
    return [...new Set([product.category, ...tags].map(value => String(value || "").trim().toLowerCase()).filter(Boolean))];
  }

  function render(container, products, options = {}) {
    if (!container) return;
    const history = readHistory();
    const currentId = String(options.currentId || "");
    const interest = new Map();
    history.forEach((item, index) => terms(item).forEach(term => interest.set(term, (interest.get(term) || 0) + Math.max(1, history.length - index))));
    const viewedIds = new Set(history.map(item => String(item.id)));
    const candidates = (products || []).filter(product => {
      const id = String(product.productId || product.id || "");
      return id !== currentId && (!options.excludeViewed || !viewedIds.has(id));
    });
    const anchorTerms = new Set(terms(options.anchorProduct || {}));
    const ranked = candidates.map(product => ({
      product,
      score: options.anchorProduct
        ? terms(product).reduce((sum, term) => sum + (anchorTerms.has(term) ? 100 : 0) + (interest.get(term) || 0), 0)
        : terms(product).reduce((sum, term) => sum + (interest.get(term) || 0), 0)
    })).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.product.productName || "").localeCompare(String(b.product.productName || "")))
      .slice(0, options.limit || 4);
    if (!ranked.length) { container.parentElement.hidden = true; return; }
    container.parentElement.hidden = false;
    container.parentElement.querySelector(".section-heading")?.classList.add("revealed");
    container.innerHTML = ranked.map(({ product }) => {
      const id = encodeURIComponent(product.productId || product.id || "");
      const name = esc(product.productName || "Untitled product");
      const category = esc(product.category || "Custom Print");
      const image = esc(String(product.imageUrl || "").split(",").map(value => value.trim()).find(Boolean) || "logo_creativesouls.jpg");
      const price = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(product.price) || 0);
      const rating = Math.max(0, Math.min(5, Number(product.rating ?? product.avgRating ?? product.averageRating ?? 0) || 0));
      const reviewCount = Math.max(0, Number(product.reviewCount ?? product.review_count ?? product.numReviews ?? 0) || 0);
      const originalPrice = Number(product.originalPrice ?? product.original_price ?? product.compareAtPrice ?? product.mrp ?? 0);
      const original = originalPrice > Number(product.price || 0)
        ? `<del class="price-original">${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(originalPrice)}</del>`
        : "";
      return `<article class="product-card"><a class="product-card-link" href="product.html?id=${id}"><div class="img-wrapper"><img src="${image}" alt="${name}" loading="lazy"></div><div class="product-card-body"><span class="category">${category}</span><h3>${name}</h3><div class="rating-row card-rating"><span class="stars-wrap" aria-label="Rated ${rating.toFixed(1)} out of 5">${"★".repeat(Math.floor(rating))}${rating % 1 >= 0.5 ? "½" : ""}</span><span class="rating-score">${rating ? rating.toFixed(1) : "0"}</span><span class="review-count">(${reviewCount} reviews)</span></div><div class="product-meta"><span class="price-current">${price}</span>${original}</div></div></a></article>`;
    }).join("");
  }

  window.ProductRecommendations = { readHistory, record, render };
})();
