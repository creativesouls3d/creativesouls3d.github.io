/* ============================================================
   feedback.js – Order-linked feedback flow for Creative Souls 3D
   ============================================================ */

const $ = id => document.getElementById(id);

// ── DOM refs ──────────────────────────────────────────────────
const loginPrompt     = $("feedback-login-prompt");
const loginBtn        = $("feedback-login-btn");
const mainContent     = $("feedback-main-content");
const orderIdInput    = $("order-id-input");
const lookupBtn       = $("lookup-btn");
const lookupError     = $("lookup-error");
const orderPreview    = $("order-preview");
const previewOrderId  = $("preview-order-id");
const previewMeta     = $("preview-order-meta");
const feedbackForm    = $("feedback-form");
const feedbackSuccess = $("feedback-success");
const feedbackMessage = $("feedback-message");
const submitBtn       = $("feedback-submit-btn");
const ratingHint      = $("rating-hint");

// Auto-fill fields
const fbName  = $("fb-name");
const fbEmail = $("fb-email");
const fbPhone = $("fb-phone");
const fbDate  = $("fb-date");

const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";

// State
let currentUser  = null;
let currentOrder = null;
let orderDocId   = "";

const ratingLabels = {
  1: "😞 Terrible",
  2: "😕 Poor",
  3: "😐 Average",
  4: "😊 Good",
  5: "🤩 Excellent!"
};

async function getFeedbackOrder(input) {
  const workerUrl = window.PRODUCT_MARKETING_WORKER_URL;
  if (!workerUrl) throw new Error("The order verification service is not configured.");
  const user = currentUser || (typeof firebase !== "undefined" && firebase.auth ? firebase.auth().currentUser : null);
  const headers = { "Content-Type": "application/json" };
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  const response = await fetch(`${workerUrl}/feedback/get-order`, { method: "POST", headers, body: JSON.stringify(input) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Could not verify this order.");
  return { data: payload };
}

// ── Helpers ──────────────────────────────────────────────────

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function maskEmail(email = "") {
  const [user, domain] = String(email).split("@");
  if (!domain) return email;
  if (user.length <= 2) return `${user[0]}*@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

function setLookupError(text = "") {
  if (lookupError) lookupError.textContent = text;
}

function showMessage(text, isError = false) {
  if (!feedbackMessage) return;
  feedbackMessage.textContent = text;
  feedbackMessage.style.color = isError ? "var(--danger)" : "var(--accent-emerald-text)";
}

// ── Auth Handling ─────────────────────────────────────────────

loginBtn?.addEventListener("click", async () => {
  try {
    const authInst = (typeof auth !== "undefined" && auth) || (typeof firebase !== "undefined" && firebase.auth ? firebase.auth() : null);
    if (!authInst) throw new Error("Authentication service is not available.");
    const provider = new firebase.auth.GoogleAuthProvider();
    await authInst.signInWithPopup(provider);
  } catch (error) {
    setLookupError(error.message || "Sign-in failed. Please try again.");
  }
});

const feedbackAuth = (typeof auth !== "undefined" && auth) || (typeof firebase !== "undefined" && firebase.auth && firebase.apps?.length ? firebase.auth() : null);
if (feedbackAuth) {
  feedbackAuth.onAuthStateChanged(user => {
    currentUser = user;

    if (loginPrompt) loginPrompt.style.display = user || token ? "none" : "block";

    // Keep main lookup content visible regardless of auth status
    if (mainContent) {
      mainContent.style.display = "block";
    }

    // Pre-fill if ?id= is in URL
    const prefill = params.get("id") || params.get("order");
    if (prefill && !currentOrder) {
      orderIdInput.value = prefill.startsWith("#") ? prefill : `#${prefill}`;
      lookupOrder();
    }
  });
}

// ── Order Lookup ──────────────────────────────────────────────

lookupBtn.addEventListener("click", lookupOrder);
orderIdInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    lookupOrder();
  }
});

async function lookupOrder() {
  const raw = orderIdInput.value.trim();
  if (!raw) {
    setLookupError("Please enter an Order ID.");
    return;
  }

  lookupBtn.disabled = true;
  lookupBtn.textContent = "Looking up…";
  setLookupError("");
  orderPreview.classList.remove("visible");
  feedbackForm.hidden = true;
  feedbackSuccess.classList.remove("visible");
  currentOrder = null;
  orderDocId = "";

  try {
    const activeUser = currentUser || (typeof auth !== "undefined" ? auth.currentUser : (typeof firebase !== "undefined" && firebase.auth ? firebase.auth().currentUser : null));
    if (!activeUser && !token) throw new Error("Sign in with the account used for this order, or use your private delivery link.");

    const cleanId = raw.replace(/^#+/, "").trim();
    const candidates = [`#${cleanId}`, cleanId];

    let orderDoc = null;
    for (const cand of candidates) {
      try {
        const snap = await db.collection("orders").doc(cand).get();
        if (snap.exists) {
          orderDoc = snap;
          break;
        }
      } catch (e) {}
    }

    if (!orderDoc) {
      try {
        const qSnap = await db.collection("orders").where("order_id", "in", candidates).limit(1).get();
        if (!qSnap.empty) {
          orderDoc = qSnap.docs[0];
        }
      } catch (e) {}
    }

    if (!orderDoc && getFeedbackOrder) {
      try {
        const response = await getFeedbackOrder({ orderId: raw, token });
        const { order, delivered, feedbackSubmitted, feedback } = response.data;
        if (feedbackSubmitted) throw new Error(`Feedback was already submitted${feedback?.reference_id ? ` (reference ${feedback.reference_id})` : ""}. Thank you!`);
        if (!delivered) throw new Error("Feedback becomes available once your order is delivered or picked up.");
        currentOrder = order;
        orderDocId = order.id || raw;
        fillForm(order, raw);
        return;
      } catch (cfErr) {
        if (cfErr.message && (cfErr.message.includes("submitted") || cfErr.message.includes("delivered") || cfErr.message.includes("picked") || cfErr.message.includes("verify"))) {
          throw cfErr;
        }
      }
    }

    if (!orderDoc || !orderDoc.exists) {
      throw new Error(`Order ${raw} not found. Please verify the ID and try again.`);
    }

    const order = { id: orderDoc.id, ...orderDoc.data() };
    const orderStatus = String(order.status || "").toLowerCase();
    const delivered = orderStatus.includes("deliver") || orderStatus.includes("picked") || orderStatus.includes("collected");
    if (!delivered) {
      throw new Error("Feedback becomes available once your order is delivered or picked up.");
    }

    // Verify ownership if signed in without a token
    if (activeUser && !token) {
      const userEmail = String(activeUser.email || "").toLowerCase().trim();
      const orderEmail = String(order.email || "").toLowerCase().trim();
      const orderUid = order.user_uid || order.uid;
      const isOwner = (userEmail && userEmail === orderEmail) || (orderUid && orderUid === activeUser.uid);
      if (!isOwner) {
        throw new Error("We couldn't verify this order. Use the private link from your delivery email or sign in with the account used to order.");
      }
    }

    // Check if feedback already submitted in Firestore
    let alreadySubmitted = false;
    let existingRefId = "";
    try {
      const fbDoc = await db.collection("feedback").doc(orderDoc.id).get();
      if (fbDoc.exists) {
        alreadySubmitted = true;
        existingRefId = fbDoc.data()?.reference_id || "";
      } else {
        const fbSnap = await db.collection("feedback").where("order_id", "in", candidates).limit(1).get();
        if (!fbSnap.empty) {
          alreadySubmitted = true;
          existingRefId = fbSnap.docs[0].data()?.reference_id || "";
        }
      }
    } catch (e) {}

    if (alreadySubmitted) {
      throw new Error(`Feedback was already submitted${existingRefId ? ` (reference ${existingRefId})` : ""}. Thank you!`);
    }

    currentOrder = order;
    orderDocId = order.id;
    fillForm(order, raw);

  } catch (error) {
    console.error("Feedback order lookup failed:", error);
    const code = error.code || "";
    setLookupError(code.includes("permission-denied") ? "We couldn't verify this order. Use the private link from your delivery email or sign in with the account used to order." : error.message || "Could not look up the order. Please try again.");
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.textContent = "Look up Order";
  }
}

function fillForm(data, fallbackId) {
  const displayId = data.order_id || fallbackId;
  const items = Array.isArray(data.items) ? data.items : [];
  const placedOn = formatDate(data.timestamp);
  const total = data.total != null ? formatPrice(data.total) : "—";

  previewOrderId.textContent = `Order ${displayId}`;
  previewMeta.textContent = `${items.length} item${items.length !== 1 ? "s" : ""} · ${total} · Placed ${placedOn}`;

  fbName.value  = data.name  || currentUser?.displayName || "";
  fbEmail.value = data.email || currentUser?.email        || "";
  fbPhone.value = data.phone || "";
  fbDate.value  = placedOn;

  orderPreview.classList.add("visible");
  feedbackForm.hidden = false;
  feedbackForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ── Star rating hint ──────────────────────────────────────────

document.querySelectorAll('.star-rating input[type="radio"]').forEach(radio => {
  radio.addEventListener("change", () => {
    ratingHint.textContent = ratingLabels[radio.value] || "";
  });
});

[["damage-reported", "damage-details-wrap"], ["quality-reported", "quality-details-wrap"], ["delivery-delayed", "delay-details-wrap"]].forEach(([toggleId, panelId]) => {
  const toggle = $(toggleId), panel = $(panelId);
  toggle.addEventListener("change", () => { panel.hidden = !toggle.checked; });
});
$("fb-review").addEventListener("input", event => { $("review-count").textContent = `${event.target.value.length.toLocaleString()} / 2,000`; });

// ── Form Submission ───────────────────────────────────────────

feedbackForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentOrder || !orderDocId) return;

  const ratingInput = feedbackForm.querySelector('input[name="rating"]:checked');
  if (!ratingInput) {
    showMessage("Please select a star rating.", true);
    return;
  }

  const rating = Number(ratingInput.value);
  const reviewText = $("fb-review").value.trim();
  if (reviewText.length < 8) {
    showMessage("Please write a short review (at least 8 characters).", true);
    return;
  }

  const categories = [...feedbackForm.querySelectorAll('input[name="category"]:checked')]
    .map(cb => cb.value);
  const additionalRatings = Object.fromEntries([...feedbackForm.querySelectorAll("[data-rating-key]")].map(input => [input.dataset.ratingKey, Number(input.value)]));
  if (Object.values(additionalRatings).some(value => !Number.isInteger(value) || value < 1 || value > 5)) return showMessage("Please complete each product and service rating.", true);
  const nps = feedbackForm.querySelector('input[name="recommendation_nps"]:checked');
  if (!nps) return showMessage("Please choose how likely you are to recommend us.", true);

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  showMessage("");

  try {
    const rawOrderId = currentOrder.order_id || currentOrder.id || orderDocId || "";
    const cleanId = String(rawOrderId).replace(/^#+/, "").trim();
    const feedbackDocId = cleanId ? `#${cleanId}` : String(rawOrderId).trim();
    const referenceId = `CS3D-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const isoNow = new Date().toISOString();
    const serverTs = (typeof firebase !== "undefined" && firebase.firestore?.FieldValue?.serverTimestamp)
      ? firebase.firestore.FieldValue.serverTimestamp()
      : isoNow;

    const feedbackEntry = {
      ...additionalRatings,
      overall_satisfaction: rating,
      rating: rating,
      recommendation_nps: Number(nps.value),
      comments: reviewText,
      review: reviewText,
      categories,
      product_liked: categories.join(", "),
      damage_reported: Boolean($("damage-reported")?.checked),
      damage_details: String($("damage-details")?.value || "").trim(),
      poor_quality_reported: Boolean($("quality-reported")?.checked),
      quality_details: String($("quality-details")?.value || "").trim(),
      delivery_delayed: Boolean($("delivery-delayed")?.checked),
      delay_details: String($("delay-details")?.value || "").trim(),
      reference_id: referenceId,
      order_id: feedbackDocId,
      order_doc_id: orderDocId,
      name: currentOrder.name || fbName.value.trim() || currentUser?.displayName || "",
      email: currentOrder.email || fbEmail.value.trim() || currentUser?.email || "",
      phone: currentOrder.phone || fbPhone.value.trim() || "",
      status: "new",
      created_at: isoNow
    };

    const feedbackDocRef = db.collection("feedback").doc(feedbackDocId);

    const arrayUnion = (typeof firebase !== "undefined" && firebase.firestore?.FieldValue?.arrayUnion)
      ? firebase.firestore.FieldValue.arrayUnion
      : null;

    const docData = {
      ...feedbackEntry,
      id: feedbackDocId,
      created_at: serverTs,
      updated_at: serverTs,
      ...(arrayUnion ? {
        feedbacks: arrayUnion(feedbackEntry),
        submissions: arrayUnion(feedbackEntry)
      } : {
        feedbacks: [feedbackEntry],
        submissions: [feedbackEntry]
      })
    };

    // Store directly at feedback/#123456
    await feedbackDocRef.set(docData, { merge: true });

    // Store under subcollection feedback/#123456/feedbacks
    try {
      await feedbackDocRef.collection("feedbacks").doc(referenceId).set(feedbackEntry);
    } catch (subErr) {
      console.warn("Could not write to feedbacks subcollection:", subErr);
    }

    try {
      if (orderDocId && typeof db !== "undefined") {
        await db.collection("orders").doc(orderDocId).update({
          feedback_submitted: true,
          feedback_rating: rating
        });
      }
    } catch (orderUpdateErr) {}

    feedbackForm.hidden = true;
    orderPreview.classList.remove("visible");

    const p = feedbackSuccess.querySelector("p");
    if (p) p.textContent = `We really appreciate you taking the time to share your experience. Your reference is ${referenceId}.`;

    feedbackSuccess.classList.add("visible");
    feedbackSuccess.scrollIntoView({ behavior: "smooth", block: "nearest" });

  } catch (error) {
    console.error("Feedback submission error:", error);
    showMessage((error.code || "").includes("already-exists") ? "Feedback has already been submitted for this order. Thank you!" : error.message || "Could not submit feedback. Please try again.", true);
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Feedback";
  }
});
