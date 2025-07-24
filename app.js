let currentUser = null;
const productList = document.getElementById("product-list");
const categoryButtons = document.querySelectorAll(".filters button");
const searchInput = document.getElementById("searchInput");

// ==== Auth State ====
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    document.getElementById("user-name").textContent = user.displayName || "User";
    document.getElementById("user-photo").src = user.photoURL || "default-user.png";
    document.getElementById("login-btn").style.display = "none";
    document.getElementById("logout-btn").style.display = "block";
  } else {
    currentUser = null;
    document.getElementById("user-name").textContent = "Guest";
    document.getElementById("user-photo").src = "https://www.svgrepo.com/show/384674/account-avatar-profile-user-11.svg";
    document.getElementById("login-btn").style.display = "block";
    document.getElementById("logout-btn").style.display = "none";
  }
});

// ==== Login / Logout ====
document.getElementById("login-btn").onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithRedirect(provider);
};

firebase.auth().getRedirectResult()
  .then((result) => {
    if (result.user) {
      console.log("User signed in:", result.user.displayName);
      // Update UI as needed
    }
  })
  .catch((error) => {
    console.error("Sign-in error:", error.code, error.message);
    alert("Sign-in failed: " + error.message);
  });


document.getElementById("logout-btn").onclick = () => {
  firebase.auth().signOut();
};

// ==== Handle Redirect Login Result ====
firebase.auth().getRedirectResult()
  .then((result) => {
    if (result.user) {
      console.log("✅ Redirect login successful:", result.user.email);
    }
  })
  .catch((error) => {
    console.error("❌ Login error:", error);
    alert("Login failed: " + error.message);
  });

// ==== Profile Dropdown Toggle ====
const userIcon = document.getElementById("user-photo");
const dropdownMenu = document.getElementById("dropdown-menu");

userIcon.onclick = () => {
  dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
};

document.body.addEventListener("click", (e) => {
  if (!userIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
    dropdownMenu.style.display = "none";
  }
});

// ==== Render Product Card ====
function renderProduct(data) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.innerHTML = `
    <a href="product.html?id=${data.productId}">
      <div class="product-image-wrapper">
        <img src="${data.imageUrl}" alt="${data.productName}" />
      </div>
      <h3>${data.productName}</h3>
      <p>₹${data.price}</p>
      <p>${data.category}</p>
    </a>
  `;
  productList.appendChild(card);
}

// ==== Display Products ====
function displayProducts(products, filter = "All", query = "") {
  productList.innerHTML = "";
  const q = query.toLowerCase();

  const filtered = products.filter(p => {
    const matchCategory = filter === "All" || p.category === filter;
    const matchSearch =
      p.productName?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      (Array.isArray(p.tags) && p.tags.join(" ").toLowerCase().includes(q));
    return matchCategory && matchSearch;
  });

  if (filtered.length === 0) {
    productList.innerHTML = `<p style="text-align:center;">No products found.</p>`;
    return;
  }

  filtered.forEach(p => renderProduct(p));
}

// ==== Load Products (from Cache or DB) ====
function loadProducts() {
  const cached = localStorage.getItem("products");
  if (cached) {
    try {
      const products = JSON.parse(cached);
      displayProducts(products);
    } catch {
      fetchAndCacheProducts();
    }
  } else {
    fetchAndCacheProducts();
  }
}

// ==== Fetch from Firestore & Cache ====
function fetchAndCacheProducts() {
  db.collection("products").get().then(snapshot => {
    const all = [];
    snapshot.forEach(doc => all.push(doc.data()));
    localStorage.setItem("products", JSON.stringify(all));
    displayProducts(all);
  }).catch(err => {
    console.error("❌ Firestore error:", err);
    productList.innerHTML = `<p style="color: red; text-align:center;">Failed to load products.</p>`;
  });
}

// ==== Category Button Events ====
categoryButtons.forEach(btn => {
  btn.onclick = () => {
    document.querySelector(".filters .active")?.classList.remove("active");
    btn.classList.add("active");
    const filter = btn.dataset.cat;
    const products = JSON.parse(localStorage.getItem("products") || "[]");
    displayProducts(products, filter, searchInput.value.trim());
  };
});

// ==== Search Input Live Filter ====
searchInput?.addEventListener("input", () => {
  const products = JSON.parse(localStorage.getItem("products") || "[]");
  const activeCategory = document.querySelector(".filters .active")?.dataset.cat || "All";
  displayProducts(products, activeCategory, searchInput.value.trim());
});

// ==== Initial App Start ====
loadProducts();
