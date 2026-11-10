const crypto = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

initializeApp();
const db = getFirestore();
const IMAGEKIT_PRIVATE_KEY = defineSecret("IMAGEKIT_PRIVATE_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const callableCors = ["http://127.0.0.1:5500", "http://localhost:5500", "https://creativesouls3d.github.io"];
const callable = (options, handler) => onCall({ region: "us-central1", cors: callableCors, ...options }, handler);
const ADMIN_EMAILS = new Set(["luvs2006@gmail.com", "hello.creative.souls3d@gmail.com"]);
const norm = value => String(value || "").trim().replace(/^#+/, "");
const cleanEmail = value => String(value || "").trim().toLowerCase();
const hashToken = token => crypto.createHash("sha256").update(String(token)).digest("hex");
const requireAdmin = request => {
  const email = cleanEmail(request.auth?.token?.email);
  if (!request.auth || !ADMIN_EMAILS.has(email)) throw new HttpsError("permission-denied", "Administrator access is required.");
};
async function findOrder(id) {
  const cleanId = norm(id);
  if (!cleanId) throw new HttpsError("invalid-argument", "Enter an order ID.");
  const candidates = [`#${cleanId}`, cleanId];
  for (const candidate of candidates) {
    const snap = await db.collection("orders").doc(candidate).get();
    if (snap.exists) return snap;
  }
  const match = await db.collection("orders").where("order_id", "in", candidates).limit(1).get();
  if (!match.empty) return match.docs[0];
  throw new HttpsError("not-found", "We could not find that order.");
}
function isDelivered(order) { return String(order.status || "").toLowerCase().includes("deliver"); }
function verifiedOwner(request, order) {
  const email = cleanEmail(request.auth?.token?.email);
  return !!request.auth && (email && email === cleanEmail(order.email) || request.auth.uid === order.user_uid);
}
function feedbackSubmitted(orderDocId) { return db.collection("feedback").doc(orderDocId).get(); }

exports.issueFeedbackToken = callable({}, async request => {
  requireAdmin(request);
  const orderDoc = await findOrder(request.data?.orderId || request.data?.orderDocId);
  const order = orderDoc.data();
  if (!isDelivered(order)) throw new HttpsError("failed-precondition", "Feedback links can be issued after delivery.");
  const token = crypto.randomBytes(32).toString("base64url");
  await orderDoc.ref.update({ feedback_access: { token_hash: hashToken(token), issued_at: FieldValue.serverTimestamp() } });


  return { token, orderId: order.order_id || orderDoc.id, orderDocId: orderDoc.id };
});



exports.getTrackingOrder = callable({}, async request => {
  const orderDoc = await findOrder(request.data?.orderId || request.data?.orderDocId);
  const order = orderDoc.data();
  const feedbackDoc = await db.collection("feedback").doc(orderDoc.id).get();
  return { order: {
    id: orderDoc.id, order_id: order.order_id || orderDoc.id, status: order.status || "Order Placed",
    timestamp: order.timestamp?.toDate?.()?.toISOString?.() || null, status_info: order.status_info || "",
    fulfillment_type: order.fulfillment_type || "delivery", expected_delivery: order.expected_delivery || "",
    payment_status: order.payment_status || "", payment_ref: order.payment_ref || "Cash on Delivery",
    item_total: Number(order.item_total || 0), delivery_charge: Number(order.delivery_charge || 0), discount: Number(order.discount || 0), total: Number(order.total || 0),
    feedback_submitted: feedbackDoc.exists,
    items: Array.isArray(order.items) ? order.items.map(item => ({
      productName: item.productName || item.name || "Product", quantity: Number(item.quantity || 1), price: Number(item.price || 0),
      imageUrl: item.imageUrl || item.image_url || item.image || "", productId: item.productId || item.product_id || "",
      colour: item.colour || item.color || "", size: item.size || ""
    })) : []
  } };
});



exports.getFeedbackOrder = callable({}, async request => {
  const orderDoc = await findOrder(request.data?.orderId || request.data?.orderDocId);
  const order = orderDoc.data();
  const token = String(request.data?.token || "");
  const tokenMatch = !!token && order.feedback_access?.token_hash === hashToken(token);
  if (!tokenMatch && !verifiedOwner(request, order)) throw new HttpsError("permission-denied", "Open the private feedback link from your delivery email or sign in to the account used for this order.");
  const existing = await feedbackSubmitted(orderDoc.id);
  return {
    order: {
      id: orderDoc.id, order_id: order.order_id || orderDoc.id, name: order.name || "", email: order.email || "", phone: order.phone || "", total: Number(order.total || 0),
      timestamp: order.timestamp?.toDate?.()?.toISOString?.() || null, status: order.status || "Order Placed",
      expected_delivery: order.expected_delivery || "", items: Array.isArray(order.items) ? order.items.map(item => ({
        productName: item.productName || item.name || "Product", quantity: Number(item.quantity || 1),
        colour: item.colour || item.color || "", size: item.size || "", customization: item.customization || ""
      })) : []
    },
    delivered: isDelivered(order),
    feedbackSubmitted: existing.exists,
    feedback: existing.exists ? { reference_id: existing.data().reference_id || "" } : null
  };
});



exports.submitOrderFeedback = callable({}, async request => {
  const orderDoc = await findOrder(request.data?.orderDocId || request.data?.orderId);
  const order = orderDoc.data();
  const token = String(request.data?.token || "");
  const tokenMatch = !!token && order.feedback_access?.token_hash === hashToken(token);
  if (!tokenMatch && !verifiedOwner(request, order)) throw new HttpsError("permission-denied", "Please open your private feedback link or sign in to your order account.");
  if (!isDelivered(order)) throw new HttpsError("failed-precondition", "Feedback unlocks after the order is delivered.");
  const answers = request.data?.feedback;
  if (!answers || typeof answers !== "object") throw new HttpsError("invalid-argument", "Feedback responses are missing.");
  const requiredRatings = ["overall_satisfaction", "printing_quality", "colour_quality", "packaging_quality", "delivery_rating", "support_rating", "timing_rating"];
  for (const key of requiredRatings) if (!Number.isInteger(Number(answers[key])) || Number(answers[key]) < 1 || Number(answers[key]) > 5) throw new HttpsError("invalid-argument", `A valid ${key} rating is required.`);
  if (!Number.isInteger(Number(answers.recommendation_nps)) || Number(answers.recommendation_nps) < 0 || Number(answers.recommendation_nps) > 10) throw new HttpsError("invalid-argument", "Recommendation score must be from 0 to 10.");
  const textFields = ["ordering_ease", "matched_images", "arrived_without_defects", "damage_details", "quality_details", "product_liked", "arrived_safely", "within_estimate", "delay_details", "questions_answered", "notifications_helpful", "website_navigation", "product_information", "checkout_experience", "improvements", "product_ideas", "purchase_again", "comments", "review", "contact_permission"];
  const safeAnswers = Object.fromEntries(textFields.filter(key => answers[key] !== undefined).map(key => [key, String(answers[key]).slice(0, key === "comments" || key === "improvements" ? 2000 : 1500)]));
  safeAnswers.categories = (Array.isArray(answers.categories) ? answers.categories : []).slice(0, 12).map(value => String(value).slice(0, 80));
  for (const key of requiredRatings) safeAnswers[key] = Number(answers[key]);
  safeAnswers.rating = safeAnswers.overall_satisfaction;
  safeAnswers.recommendation_nps = Number(answers.recommendation_nps);
  safeAnswers.damage_reported = !!answers.damage_reported;
  safeAnswers.poor_quality_reported = !!answers.poor_quality_reported;
  safeAnswers.delivery_delayed = !!answers.delivery_delayed;
  safeAnswers.attachments = (Array.isArray(answers.attachments) ? answers.attachments : []).slice(0, 4).filter(item => /^https:\/\//i.test(String(item?.url || "")) && /imagekit\.io$/i.test(new URL(item.url).hostname)).map(item => ({ url: item.url, name: String(item.name || "Photo").slice(0, 200), fileId: String(item.fileId || "").slice(0, 200) }));
  const ref = db.collection("feedback").doc(orderDoc.id);
  const referenceId = `CS3D-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  const record = {
    ...safeAnswers, reference_id: referenceId, order_id: order.order_id || orderDoc.id, order_doc_id: orderDoc.id,
    name: order.name || "", email: order.email || "", created_at: FieldValue.serverTimestamp(), status: "new"
  };
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.exists) throw new HttpsError("already-exists", "Feedback has already been submitted for this order.");
    tx.create(ref, record);
  });


  return { referenceId };
});



exports.listOrderFeedback = callable({}, async request => {
  requireAdmin(request);
  // Fetch all feedback docs; use submitted_at as fallback for legacy records that
  // were written by the client-side feedback.js form (which stores submitted_at, not created_at).
  // We cannot orderBy a field that is missing on some docs, so fetch unordered and sort in memory.
  const snapshot = await db.collection("feedback").limit(1000).get();
  const records = snapshot.docs.map(doc => {
    const data = doc.data();
    const ts = data.created_at ?? data.submitted_at ?? null;
    return {
      id: doc.id,
      ...data,
      created_at: ts?.toDate?.()?.toISOString?.() ?? (typeof ts === "string" ? ts : null),
    };
  });


  // Sort newest-first in memory
  records.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });


  return { feedback: records };
});



exports.createImageKitAuth = callable({ secrets: [IMAGEKIT_PRIVATE_KEY] }, async request => {
  const folder = String(request.data?.folder || "");
  const allowed = ["/feedback", "/Product", "/order-tickets"].includes(folder) || folder.startsWith("/order-tickets/");
  if (!allowed || folder.split("/").some(part => part === "..")) throw new HttpsError("invalid-argument", "Unsupported upload folder.");
  if (folder === "/feedback" || folder.startsWith("/order-tickets/")) {
    const orderDoc = request.data?.orderDocId ? await findOrder(request.data.orderDocId) : null;
    if (!orderDoc) { requireAdmin(request); }
    else {
    const order = orderDoc.data();
    const suppliedToken = String(request.data?.feedbackToken || "");
    const tokenMatch = !!suppliedToken && order.feedback_access?.token_hash === hashToken(suppliedToken);
    const feedbackUpload = folder === "/feedback";
    if (feedbackUpload && !isDelivered(order)) throw new HttpsError("failed-precondition", "Feedback photos are available after delivery.");
    if (!tokenMatch && !verifiedOwner(request, order) && !(request.auth && ADMIN_EMAILS.has(cleanEmail(request.auth.token.email)))) throw new HttpsError("permission-denied", "A verified order is required to upload files.");
    }
  } else requireAdmin(request);
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 600;
  const signature = crypto.createHmac("sha1", IMAGEKIT_PRIVATE_KEY.value()).update(token + String(expire)).digest("hex");
  return { token, expire, signature };
});



exports.generateProductMarketing = callable({
  secrets: [GEMINI_API_KEY],
  timeoutSeconds: 60,
  cors: callableCors,
  invoker: "public"
}, async request => {
  requireAdmin(request);
  const input = request.data || {};
  const productName = String(input.productName || "").trim().slice(0, 180);
  if (!productName) throw new HttpsError("invalid-argument", "Enter a product name before generating copy.");
  const details = {
    productName,
    category: String(input.category || "").trim().slice(0, 120),
    audience: String(input.bestFor || input.best_for || "").trim().slice(0, 120),
    colour: String(input.colour || input.color || "").trim().slice(0, 120),
    price: input.price === undefined || input.price === "" ? "" : String(input.price).slice(0, 40),
    existingDescription: String(input.description || "").replace(/<[^>]*>/g, " ").trim().slice(0, 1800),
    searchKeywords: String(input.searchKeywords || "").trim().slice(0, 1200)
  };
  const prompt = [
    "Write helpful, search-friendly ecommerce product copy for Creative Souls 3D, a custom 3D printed gifts and decor shop.",
    "Use only the supplied facts. Do not invent materials, dimensions, printing methods, compatibility, safety claims, delivery promises, or certifications.",
    "Return concise natural language, no markdown or HTML in description, and 8 to 12 distinct SEO search tags as short phrases.",
    "Avoid keyword stuffing, repeated terms, brand names not supplied, and unsupported superlatives.",
    "Return JSON with exactly two fields: description (string) and tags (array of strings). Description should be 2 short paragraphs, about 60 to 100 words total.",
    `Product details: ${JSON.stringify(details)}`
  ].join("\n");

  let response;
  try {
    response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY.value() },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              description: { type: "STRING" },
              tags: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["description", "tags"]
          }
        }
      }),
      signal: AbortSignal.timeout(45000)
    });


  } catch (error) {
    console.error("Gemini product copy request failed:", error?.name || "request error");
    throw new HttpsError("unavailable", "Gemini could not be reached. Please try again shortly.");
  }
  if (!response.ok) {
    console.error("Gemini product copy returned HTTP", response.status);
    if (response.status === 429) throw new HttpsError("resource-exhausted", "Gemini is rate-limited. Please wait a moment and try again.");
    throw new HttpsError("unavailable", "Gemini could not generate product copy. Check the Gemini API secret and try again.");
  }
  let result;
  try {
    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
    result = JSON.parse(text || "{}");
  } catch (error) {
    console.error("Gemini product copy response was not valid JSON.");
    throw new HttpsError("internal", "Gemini returned an unreadable result. Please try again.");
  }
  const description = String(result.description || "").trim().slice(0, 3000);
  const tags = [...new Set((Array.isArray(result.tags) ? result.tags : [])
    .map(tag => String(tag || "").trim().replace(/^#/, "").replace(/\s+/g, " ").slice(0, 60))
    .filter(Boolean))].slice(0, 12);
  if (!description || !tags.length) throw new HttpsError("internal", "Gemini returned incomplete product copy. Please try again.");
  return { description, tags };
});

// ==========================================
// Wallet & Refund Cloud Functions
// ==========================================

/**
 * Admin callable to credit a user's wallet as a refund or adjustment.
 * Expects data: { userId: string, amount: number, orderId?: string, reason?: string }
 * Updates the user's wallet_balance (increment) and creates a wallet_history record.
 */
exports.adminRefundToWallet = callable({ secrets: [] }, async request => {
  requireAdmin(request);

  const { userId, amount, orderId, reason } = request.data || {};

  if (!userId || typeof amount !== 'number' || amount <= 0) {
    throw new HttpsError('invalid-argument', 'Provide a valid userId (email or UID) and a positive amount.');
  }

  const walletRef = db.collection('users').doc(userId);
  const historyRef = walletRef.collection('wallet_history').doc();

  try {
    await db.runTransaction(async transaction => {
      transaction.set(walletRef, {
        wallet_balance: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      transaction.set(historyRef, {
        amount,
        title: reason || 'Refund / Credit',
        type: 'credit',
        orderId: orderId || null,
        createdAt: FieldValue.serverTimestamp(),
        processedBy: request.auth.uid || request.auth.token?.email || 'admin'
      });
    });

    return { success: true, message: `Refund of ₹${amount} credited to user ${userId}.` };
  } catch (e) {
    console.error('Wallet refund transaction failed:', e);
    throw new HttpsError('internal', 'Failed to process refund: ' + e.message);
  }
});

/**
 * Callable for a user to fetch their wallet info and recent history.
 */
exports.getWalletInfo = callable({}, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const uid = request.auth.uid;
  const email = cleanEmail(request.auth.token?.email);

  // Check both doc(email) and doc(uid) since users might be keyed by email or uid
  let userDoc = null;
  let userRef = null;
  if (email) {
    const doc = await db.collection('users').doc(email).get();
    if (doc.exists) {
      userDoc = doc;
      userRef = doc.ref;
    }
  }
  if (!userDoc && uid) {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      userDoc = doc;
      userRef = doc.ref;
    }
  }
  if (!userDoc) {
    // If not found yet, default to doc(email || uid)
    userRef = db.collection('users').doc(email || uid);
  }

  const userData = (userDoc && userDoc.exists) ? userDoc.data() : {};
  const historySnap = await userRef.collection('wallet_history')
    .orderBy('createdAt', 'desc').limit(30).get().catch(() => ({ docs: [] }));
  const history = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));

  return {
    balance: userData.wallet_balance || 0,
    points: userData.walletPoints || 0,
    history
  };
});
