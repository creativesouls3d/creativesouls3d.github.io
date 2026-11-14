const ADMIN_EMAILS = new Set([
  "luvs2006@gmail.com",
  "hello.creative.souls3d@gmail.com",
]);

const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "https://creativesouls3d.github.io",
]);

let cachedSigningKeys;
let cachedSigningKeysExpiresAt = 0;
let cachedFirestoreAccessToken;
let cachedFirestoreAccessTokenExpiresAt = 0;

function json(data, status, origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function getSigningKeys() {
  if (cachedSigningKeys && Date.now() < cachedSigningKeysExpiresAt) return cachedSigningKeys;
  const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com", {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!response.ok) throw new Error("Could not load Firebase token signing keys.");
  const data = await response.json();
  cachedSigningKeys = new Map(data.keys.map(key => [key.kid, key]));
  cachedSigningKeysExpiresAt = Date.now() + 50 * 60 * 1000;
  return cachedSigningKeys;
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

async function verifyFirebaseToken(request, projectId) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const parts = match[1].split(".");
  if (parts.length !== 3) return false;
  let header;
  let claims;
  try {
    header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  } catch {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    claims.aud !== projectId ||
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128 ||
    !Number.isFinite(claims.exp) || claims.exp <= now ||
    !Number.isFinite(claims.iat) || claims.iat > now + 60 ||
    !Number.isFinite(claims.auth_time) || claims.auth_time > now + 60
  ) return false;

  const keys = await getSigningKeys();
  const jwk = keys.get(header.kid);
  if (!jwk) return false;
  const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const signature = decodeBase64Url(parts[2]);
  const signedContent = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signedContent);
  return valid ? claims : false;
}

function isAdmin(claims) {
  return !!claims && ADMIN_EMAILS.has(String(claims.email || "").trim().toLowerCase());
}

async function getOrderDocument(projectId, idToken, orderDocId) {
  const rawId = String(orderDocId || "").trim();
  if (!rawId) return null;
  const cleanId = rawId.replace(/^#+/, "");
  const candidates = [...new Set([rawId, `#${cleanId}`, cleanId])];
  for (const candidate of candidates) {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/orders/${encodeURIComponent(candidate)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (response.ok) return (await response.json()).fields || {};
    if (response.status === 404) continue;
    if (response.status === 403 || response.status === 401) throw new Error("Your account cannot verify this order.");
    throw new Error("Could not verify the order for this upload.");
  }
  return null;
}

async function getAdminDocument(env, collection, id) {
  const encodedId = encodeURIComponent(id);
  try { return await firestoreRequest(env, `/${encodeURIComponent(collection)}/${encodedId}`); }
  catch (error) { if (error.status === 404) return null; throw error; }
}

async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value))));
  return [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function handleGetFeedbackOrder(request, env, origin) {
  let input;
  try { input = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400, origin); }
  const rawId = String(input.orderId || input.orderDocId || "").trim();
  if (!rawId) return json({ error: "Enter an order ID." }, 400, origin);
  const cleanId = rawId.replace(/^#+/, "");
  let document = null;
  try {
    for (const candidate of [...new Set([`#${cleanId}`, cleanId])]) {
      document = await getAdminDocument(env, "orders", candidate);
      if (document) break;
    }
  } catch (error) { return json({ error: error.message || "Could not look up this order." }, 500, origin); }
  if (!document) return json({ error: `Order ${rawId} not found.` }, 404, origin);
  const fields = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
  const token = String(input.token || "");
  const tokenHash = token ? await sha256Hex(token) : "";
  const tokenMatch = !!tokenHash && tokenHash === fields.feedback_access?.token_hash;
  let claims = false;
  const authorization = request.headers.get("Authorization") || "";
  if (/^Bearer\s+/i.test(authorization)) {
    try { claims = await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID || "creative-souls-3d"); } catch { claims = false; }
  }
  const email = String(claims?.email || "").trim().toLowerCase();
  const owner = !!claims && ((email && email === String(fields.email || "").trim().toLowerCase()) || claims.user_id === String(fields.user_uid || fields.uid || ""));
  if (!tokenMatch && !owner) return json({ error: "Use the private link from your delivery email or sign in with the account used to order." }, 403, origin);
  const docId = document.name.split("/").pop();
  let feedback = null;
  try { feedback = await getAdminDocument(env, "feedback", docId); } catch (error) { return json({ error: error.message || "Could not check feedback status." }, 500, origin); }
  const feedbackFields = Object.fromEntries(Object.entries(feedback?.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
  const order = {
    id: docId, order_id: fields.order_id || docId, name: fields.name || "", email: fields.email || "", phone: fields.phone || "",
    total: Number(fields.total || 0), timestamp: fields.timestamp || null, status: fields.status || "Order Placed",
    expected_delivery: fields.expected_delivery || "",
    items: Array.isArray(fields.items) ? fields.items.map(item => ({ productName: item.productName || item.name || "Product", quantity: Number(item.quantity || 1), colour: item.colour || item.color || "", size: item.size || "", customization: item.customization || "" })) : [],
  };
  const orderStatusStr = String(order.status || "").toLowerCase();
  const isDeliveredOrPickedUp = orderStatusStr.includes("deliver") || orderStatusStr.includes("picked") || orderStatusStr.includes("collected");
  return json({ order, delivered: isDeliveredOrPickedUp, feedbackSubmitted: !!feedback, feedback: feedback ? { reference_id: feedbackFields.reference_id || "" } : null }, 200, origin);
}

async function handleAdminFeedbackList(request, env, origin) {
  const { claims, response: authResponse } = await workerAdminClaims(request, env, origin);
  if (!claims) return authResponse;
  try {
    const page = await firestoreRequest(env, "/feedback?pageSize=1000");
    const feedback = (page.documents || []).map(document => {
      const data = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
      return { id: document.name.split("/").pop(), ...data };
    });
    return json({ feedback }, 200, origin);
  } catch (error) {
    console.error("Admin feedback list failed:", error?.message || "unknown error");
    return json({ error: error?.message || "Could not load customer feedback." }, 500, origin);
  }
}

async function handleIssueFeedbackToken(request, env, origin) {
  const { claims, response: authResponse } = await workerAdminClaims(request, env, origin);
  if (!claims) return authResponse;
  let input;
  try { input = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400, origin); }
  const cleanId = String(input.orderId || input.orderDocId || "").trim().replace(/^#+/, "");
  if (!cleanId) return json({ error: "An order ID is required." }, 400, origin);
  try {
    let document = null;
    for (const candidate of [...new Set([`#${cleanId}`, cleanId])]) {
      document = await getAdminDocument(env, "orders", candidate);
      if (document) break;
    }
    if (!document) return json({ error: "We could not find that order." }, 404, origin);
    const fields = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
    const statusLower = String(fields.status || "").toLowerCase();
    const isTerminal = statusLower.includes("deliver") || statusLower.includes("picked") || statusLower.includes("collected") || statusLower.includes("pickup");
    if (!isTerminal) return json({ error: "Feedback links are only available once the order has been delivered or picked up." }, 409, origin);
    const token = crypto.randomUUID();
    const access = { token_hash: await sha256Hex(token), issued_at: new Date().toISOString() };
    const documentPath = `/orders/${encodeURIComponent(document.name.split("/").pop())}`;
    const query = new URLSearchParams(); query.set("updateMask.fieldPaths", "feedback_access");
    await firestoreRequest(env, `${documentPath}?${query}`, { method: "PATCH", body: JSON.stringify({ fields: { feedback_access: toFirestoreValue(access) } }) });
    return json({ token, orderId: fields.order_id || cleanId, orderDocId: document.name.split("/").pop() }, 200, origin);
  } catch (error) {
    console.error("Could not issue feedback token:", error?.message || "unknown error");
    return json({ error: error?.message || "Could not issue a private feedback link." }, 500, origin);
  }
}

function firestoreString(fields, key) {
  return fields?.[key]?.stringValue || "";
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function firestoreValue(value) {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(firestoreValue);
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, firestoreValue(item)]));
  return null;
}

async function getFirestoreAccessToken(env) {
  if (cachedFirestoreAccessToken && Date.now() < cachedFirestoreAccessTokenExpiresAt) return cachedFirestoreAccessToken;
  if (!env.FIREBASE_SERVICE_ACCOUNT_EMAIL || !env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY) throw new Error("Firestore service account secrets are not configured.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const keyBytes = Uint8Array.from(atob(env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/-----[^-]+-----/g, "").replace(/\\n/g, "").replace(/\s/g, "")), character => character.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error("Could not authorize the Firestore tracking request.");
  const token = await response.json();
  cachedFirestoreAccessToken = token.access_token;
  cachedFirestoreAccessTokenExpiresAt = Date.now() + Math.max(60, Number(token.expires_in || 3600) - 120) * 1000;
  return cachedFirestoreAccessToken;
}

function firestoreRestRoot(env) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID || "creative-souls-3d")}/databases/(default)/documents`;
}

function toFirestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (value && typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)])) } };
  return { nullValue: null };
}

function toFirestoreFields(value) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)]));
}

async function firestoreRequest(env, path, init = {}) {
  const token = await getFirestoreAccessToken(env);
  const response = await fetch(`${firestoreRestRoot(env)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || "Firestore request failed.";
    const error = new Error(message); error.status = response.status; throw error;
  }
  return payload;
}

async function workerAdminClaims(request, env, origin) {
  let claims;
  try { claims = await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID || "creative-souls-3d"); }
  catch (error) {
    console.error("Firebase token verification failed:", error?.message || "verification error");
    return { response: json({ error: "Could not verify your Firebase sign-in. Please try again." }, 503, origin) };
  }
  if (!isAdmin(claims)) return { response: json({ error: "Administrator access is required. Sign in again and retry." }, 403, origin) };
  return { claims };
}

async function handleAdminWallets(request, env, origin, action) {
  const { claims, response: authResponse } = await workerAdminClaims(request, env, origin);
  if (!claims) return authResponse;
  let input = {};
  try { input = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400, origin); }
  const root = firestoreRestRoot(env);
  try {
    if (action === "list") {
      const customers = [];
      let pageToken = "";
      do {
        const query = new URLSearchParams({ pageSize: "1000" });
        if (pageToken) query.set("pageToken", pageToken);
        const page = await firestoreRequest(env, `/users?${query}`);
        (page.documents || []).forEach(document => {
          const fields = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
          const id = document.name.split("/").pop();
          const email = String(fields.email || id).trim().toLowerCase();
          if (email.includes("@")) customers.push({ id, email, name: String(fields.name || fields.displayName || fields.fullName || ""), phone: String(fields.phone || ""), wallet_balance: Number(fields.wallet_balance || 0), walletPoints: Number(fields.walletPoints || 0) });
        });
        pageToken = page.nextPageToken || "";
      } while (pageToken);
      customers.sort((a,b) => (a.name || a.email).localeCompare(b.name || b.email));
      let activity = [];
      try {
        const transactions = await firestoreRequest(env, ":runQuery", { method: "POST", body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "wallet_history", allDescendants: true }], orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }], limit: 500 } }) });
        const customersById = new Map(customers.map(customer => [customer.id, customer]));
        activity = (Array.isArray(transactions) ? transactions : []).filter(row => row.document).map(row => {
          const doc = row.document;
          const fields = Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
          const parts = doc.name.split("/");
          const userId = parts[parts.indexOf("users") + 1] || "";
          const customer = customersById.get(userId) || { id: userId, email: userId };
          return { id: doc.name.split("/").pop(), userId, email: customer.email, name: customer.name || "Customer", ...fields };
        });
      } catch (error) { console.warn("Could not load global wallet activity:", error?.message || "query error"); }
      return json({ customers, activity }, 200, origin);
    }

    const userId = String(input.userId || "").trim();
    if (!userId || userId.includes("/")) return json({ error: "A valid customer wallet ID is required." }, 400, origin);
    const userPath = `/users/${encodeURIComponent(userId)}`;
    if (action === "history") {
      const page = await firestoreRequest(env, `${userPath}/wallet_history?pageSize=100`);
      const history = (page.documents || []).map(document => ({ id: document.name.split("/").pop(), ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, firestoreValue(value)])) }));
      history.sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      return json({ history }, 200, origin);
    }
    if (action !== "adjust") return json({ error: "Unknown wallet operation." }, 404, origin);
    const amount = Number(input.amount);
    const type = ["credit", "debit", "points"].includes(input.type) ? input.type : "credit";
    const reason = String(input.reason || "").trim().slice(0, 240);
    if (!Number.isFinite(amount) || amount <= 0 || (type === "points" && !Number.isInteger(amount)) || !reason) return json({ error: "Enter a valid positive amount and reason." }, 400, origin);
    const begin = await firestoreRequest(env, ":beginTransaction", { method: "POST", body: JSON.stringify({ options: { readWrite: {} } }) });
    const transaction = begin.transaction;
    if (!transaction) throw new Error("Firestore did not start a wallet transaction.");
    let userDoc = null;
    try { userDoc = await firestoreRequest(env, `${userPath}?transaction=${encodeURIComponent(transaction)}`); }
    catch (error) { if (error.status !== 404) throw error; }
    const oldFields = Object.fromEntries(Object.entries(userDoc?.fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
    const balance = Number(oldFields.wallet_balance || 0);
    if (type === "debit" && balance < amount) {
      await firestoreRequest(env, ":rollback", { method: "POST", body: JSON.stringify({ transaction }) }).catch(() => {});
      return json({ error: "The customer wallet does not have enough balance for this debit." }, 409, origin);
    }
    const nextBalance = type === "points" ? balance : balance + (type === "debit" ? -amount : amount);
    const nextPoints = type === "points" ? Number(oldFields.walletPoints || 0) + amount : Number(oldFields.walletPoints || 0);
    const now = new Date().toISOString();
    const userData = { ...(userDoc?.fields || {}), ...(userDoc ? {} : { email: toFirestoreValue(oldFields.email || userId) }), updatedAt: toFirestoreValue(now) };
    const updateFields = type === "points" ? { ...userData, walletPoints: toFirestoreValue(nextPoints) } : { ...userData, wallet_balance: toFirestoreValue(nextBalance) };
    const updateMask = type === "points" ? ["walletPoints", "updatedAt", ...(!userDoc ? ["email"] : [])] : ["wallet_balance", "updatedAt", ...(!userDoc ? ["email"] : [])];
    const historyId = crypto.randomUUID();
    const historyName = `${userPath}/wallet_history/${historyId}`;
    const historyData = {
      amount: toFirestoreValue(amount), type: toFirestoreValue(type), title: toFirestoreValue(reason),
      orderId: toFirestoreValue(String(input.orderId || "").trim() || null), createdAt: toFirestoreValue(now), processedBy: toFirestoreValue(String(claims.email || "admin")),
    };
    const writes = [
      { update: { name: `${root}${userPath}`, fields: updateFields }, updateMask: { fieldPaths: updateMask } },
      { update: { name: `${root}${historyName}`, fields: historyData }, currentDocument: { exists: false } },
    ];
    await firestoreRequest(env, ":commit", { method: "POST", body: JSON.stringify({ transaction, writes }) });
    return json({ success: true, balance: nextBalance, points: nextPoints }, 200, origin);
  } catch (error) {
    console.error("Wallet Worker request failed:", action, error?.message || "unknown error");
    return json({ error: error?.message || "Could not load wallet data." }, 500, origin);
  }
}

async function handleTrackingOrder(request, env, origin) {
  let input;
  try { input = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400, origin); }
  const rawId = String(input.orderId || "").trim();
  const phone = String(input.phone || "").replace(/\D/g, "");
  if (!rawId || phone.length < 10) return json({ error: "Enter your order ID and the phone number used at checkout." }, 400, origin);
  const cleanId = rawId.replace(/^#+/, "");
  const candidates = [...new Set([`#${cleanId}`, cleanId])];
  const token = await getFirestoreAccessToken(env);
  let document = null;
  for (const candidate of candidates) {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID || "creative-souls-3d")}/databases/(default)/documents/orders/${encodeURIComponent(candidate)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) { document = await response.json(); break; }
    if (response.status !== 404) {
      const details = await response.text();
      console.error("Firestore tracking lookup failed:", response.status, details.slice(0, 500));
      throw new Error("Could not retrieve order tracking details.");
    }
  }
  if (!document) return json({ error: "Order ID or phone number was not recognized." }, 404, origin);
  const fields = document.fields || {};
  if (phone !== firestoreString(fields, "phone").replace(/\D/g, "")) return json({ error: "Order ID or phone number was not recognized." }, 404, origin);
  const order = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, firestoreValue(value)]));
  const feedbackResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID || "creative-souls-3d")}/databases/(default)/documents/feedback/${encodeURIComponent(document.name.split("/").pop())}`, { headers: { Authorization: `Bearer ${token}` } });
  const items = Array.isArray(order.items) ? order.items.map(item => ({
    productName: item.productName || item.name || "Product", quantity: Number(item.quantity || 1), price: Number(item.price || 0),
    imageUrl: item.imageUrl || item.image_url || item.image || "", productId: item.productId || item.product_id || "",
    colour: item.colour || item.color || "", size: item.size || "",
  })) : [];
  const finalProductImages = Array.isArray(order.final_product_images) ? order.final_product_images
    .filter(image => image && /^https:\/\//i.test(String(image.url || "")))
    .slice(0, 24)
    .map(image => {
      const url = String(image.url);
      const candidateThumbnail = String(image.thumbnailUrl || "");
      return { url, thumbnailUrl: /^https:\/\//i.test(candidateThumbnail) ? candidateThumbnail : url, name: String(image.name || "Final product photo"), addedAt: String(image.addedAt || "") };
    }) : [];
  return json({ order: {
    id: document.name.split("/").pop(), order_id: order.order_id || document.name.split("/").pop(), status: order.status || "Order Placed",
    timestamp: order.timestamp || null, status_info: order.status_info || "", fulfillment_type: order.fulfillment_type || "delivery",
    expected_delivery: order.expected_delivery || "", payment_status: order.payment_status || "", payment_ref: order.payment_ref || "Cash on Delivery",
    item_total: Number(order.item_total || 0), delivery_charge: Number(order.delivery_charge || 0), discount: Number(order.discount || 0), total: Number(order.total || 0),
    feedback_submitted: feedbackResponse.ok, items, final_product_images: finalProductImages,
  } }, 200, origin);
}

async function handleImageKitAuth(request, env, origin) {
  if (!env.IMAGEKIT_PRIVATE_KEY) return json({ error: "The Worker is missing its IMAGEKIT_PRIVATE_KEY secret." }, 500, origin);

  let input;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 8000) return json({ error: "Upload authorization request is too large." }, 413, origin);
    input = JSON.parse(rawBody);
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400, origin);
  }

  const folder = String(input.folder || "");
  const isProductFolder = folder === "/Product";
  const isTicketFolder = folder === "/order-tickets" || folder.startsWith("/order-tickets/");
  if ((!isProductFolder && !isTicketFolder) || folder.split("/").some(part => part === "..")) {
    return json({ error: "Unsupported upload folder." }, 400, origin);
  }

  let claims;
  try {
    claims = await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID || "creative-souls-3d");
  } catch (error) {
    console.error("Firebase token verification failed:", error?.message || "verification error");
    return json({ error: "Could not verify your Firebase sign-in. Please try again." }, 503, origin);
  }
  if (!claims) return json({ error: "Sign in to your account, then try the upload again." }, 403, origin);

  if (isProductFolder || !input.orderDocId) {
    if (!isAdmin(claims)) return json({ error: "Administrator access is required for this upload." }, 403, origin);
  } else {
    let fields;
    try {
      const idToken = request.headers.get("Authorization").replace(/^Bearer\s+/i, "");
      fields = await getOrderDocument(env.FIREBASE_PROJECT_ID || "creative-souls-3d", idToken, input.orderDocId);
    } catch (error) {
      return json({ error: error?.message || "Could not verify the order for this upload." }, 403, origin);
    }
    if (!fields) return json({ error: "We could not find that order." }, 404, origin);
    const email = String(claims.email || "").trim().toLowerCase();
    const owner = (email && email === firestoreString(fields, "email").trim().toLowerCase()) || claims.user_id === firestoreString(fields, "user_uid");
    if (!owner && !isAdmin(claims)) return json({ error: "A verified order is required to upload files." }, 403, origin);
  }

  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 600;
  const signingKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.IMAGEKIT_PRIVATE_KEY), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signatureBytes = new Uint8Array(await crypto.subtle.sign("HMAC", signingKey, new TextEncoder().encode(token + String(expire))));
  const signature = [...signatureBytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return json({ token, expire, signature }, 200, origin);
}

async function handleImproveTicketReply(request, env, origin) {
  if (!env.GEMINI_API_KEY) return json({ error: "The Worker is missing its GEMINI_API_KEY secret." }, 500, origin);
  let claims;
  try {
    claims = await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID || "creative-souls-3d");
  } catch (error) {
    console.error("Firebase token verification failed:", error?.message || "verification error");
    return json({ error: "Could not verify your Firebase sign-in. Please try again." }, 503, origin);
  }
  if (!isAdmin(claims)) return json({ error: "Administrator access is required. Sign in again and retry." }, 403, origin);

  let input;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 12000) return json({ error: "The reply is too long to improve." }, 413, origin);
    input = JSON.parse(rawBody);
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400, origin);
  }
  const draft = String(input.draft || "").trim().slice(0, 5000);
  if (!draft) return json({ error: "Enter a reply before asking AI to improve it." }, 400, origin);
  const prompt = [
    "Improve only the exact text entered by the administrator in the reply box.",
    "Do not use ticket or customer context, and do not add an introduction, greeting, sign-off, ticket/order reference, suggestion, or any new content that is not already present in the supplied draft.",
    "Make the wording clear, warm, professional, concise, and empathetic while preserving the writer's intent, scope, facts, names, numbers, and level of certainty.",
    "Do not invent actions already taken, order status, refunds, replacements, delivery dates, guarantees, or promises.",
    "Preserve existing paragraph breaks and list structure. If the draft is one long block, split it into natural paragraphs at topic changes. Separate paragraphs with a blank line (two newline characters). Do not turn every sentence into its own paragraph.",
    "Return only the rewritten draft text in the JSON field improvedReply. Do not add commentary or say that AI edited it.",
    `Text entered in the reply box:\n${draft}`,
  ].join("\n\n");

  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || "gemini-3.5-flash-lite"}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { improvedReply: { type: "STRING" } }, required: ["improvedReply"] },
          temperature: 0.4,
        },
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    console.error("Gemini reply improvement failed:", error?.name || "request error");
    return json({ error: "AI could not be reached. Please try again shortly." }, 503, origin);
  }
  if (!response.ok) {
    console.error("Gemini reply improvement returned HTTP", response.status);
    if (response.status === 429) return json({ error: "AI is rate-limited. Please wait a moment and try again." }, 429, origin);
    return json({ error: "AI could not improve this reply. Please try again." }, 503, origin);
  }
  try {
    const payload = await response.json();
    const generatedText = payload.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
    const result = JSON.parse(generatedText || "{}");
    const improvedReply = String(result.improvedReply || "").trim().slice(0, 5000);
    if (!improvedReply) throw new Error("Empty result");
    return json({ improvedReply }, 200, origin);
  } catch {
    return json({ error: "AI returned an unreadable reply. Please try again." }, 502, origin);
  }
}

function buildPrompt(input) {
  const mode = ["description", "tags", "both"].includes(input.mode) ? input.mode : "both";
  const details = {
    productName: String(input.productName || "").trim().slice(0, 180),
    category: String(input.category || "").trim().slice(0, 120),
    audience: String(input.bestFor || input.best_for || "").trim().slice(0, 120),
    colour: String(input.colour || input.color || "").trim().slice(0, 120),
    price: input.price === undefined || input.price === "" ? "" : String(input.price).slice(0, 40),
    existingDescription: String(input.description || "").replace(/<[^>]*>/g, " ").trim().slice(0, 1800),
    searchKeywords: String(input.searchKeywords || "").trim().slice(0, 1200),
  };
  if (!details.productName) return { error: "Enter a product name before generating copy." };
  const taskInstructions = mode === "tags"
    ? [
      "Generate only 8 to 12 distinct, useful SEO search tags as short phrases for this product.",
      "Use the product details and existing description to find relevant search phrases. Avoid keyword stuffing, repeated terms, unsupported claims, and the exact duplicates already present in searchKeywords.",
      "Return valid JSON with exactly one field: tags (array of strings).",
    ]
    : [
      "Return the description as a compact, professionally formatted HTML fragment (not markdown).",
      "For description markup, use only p, h3, strong, em, ul, and li tags. Use an opening paragraph with a clear benefit, then an optional short h3 titled 'Product highlights' and 2 to 4 concise bullets only when the supplied facts support them, followed by a closing paragraph when useful.",
      "Apply line-height:1.7 to paragraphs and lists. Style the h3 with color:#263244; font-size:1.1em; line-height:1.3. Use strong for a few meaningful product benefits. Keep the styling consistent and readable; do not add other colors, font sizes, fonts, or decorative markup.",
      "Keep the description around 60 to 100 words total, with short paragraphs and bullets.",
      mode === "both" ? "Also generate 8 to 12 distinct SEO search tags as short phrases." : "Generate only the description; do not generate SEO tags.",
      mode === "both"
        ? "Return valid JSON with exactly two fields: description (string containing the HTML fragment) and tags (array of strings)."
        : "Return valid JSON with exactly one field: description (string containing the HTML fragment).",
    ];
  const prompt = [
    "Write helpful, search-friendly ecommerce product copy for Creative Souls 3D, a custom 3D printed gifts and decor shop.",
    "Use only the supplied facts. Do not invent materials, dimensions, printing methods, compatibility, safety claims, delivery promises, or certifications.",
    "Avoid keyword stuffing, repeated terms, brand names not supplied, and unsupported superlatives.",
    ...taskInstructions,
    `Product details: ${JSON.stringify(details)}`,
  ].join("\n");
  const properties = {};
  if (mode !== "tags") properties.description = { type: "STRING" };
  if (mode !== "description") properties.tags = { type: "ARRAY", items: { type: "STRING" } };
  return { mode, prompt, responseSchema: { type: "OBJECT", properties, required: Object.keys(properties) } };
}

async function handleRequest(request, env) {
  const origin = request.headers.get("Origin");
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  if (request.method === "OPTIONS") {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    } });
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin is not allowed." }, 403);
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  if (path === "/imagekit-auth") return handleImageKitAuth(request, env, origin);
  if (path === "/improve-ticket-reply") return handleImproveTicketReply(request, env, origin);
  if (path === "/get-tracking-order") return handleTrackingOrder(request, env, origin);
  if (path === "/feedback/get-order") return handleGetFeedbackOrder(request, env, origin);
  if (path === "/feedback/list") return handleAdminFeedbackList(request, env, origin);
  if (path === "/feedback/issue-token") return handleIssueFeedbackToken(request, env, origin);
  if (path === "/wallet/list") return handleAdminWallets(request, env, origin, "list");
  if (path === "/wallet/history") return handleAdminWallets(request, env, origin, "history");
  if (path === "/wallet/adjust") return handleAdminWallets(request, env, origin, "adjust");
  if (path !== "/") return json({ error: "Not found." }, 404, origin);
  if (!env.GEMINI_API_KEY) return json({ error: "The Worker is missing its GEMINI_API_KEY secret." }, 500, origin);

  let authorized;
  try {
    authorized = await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID || "creative-souls-3d");
  } catch (error) {
    console.error("Firebase token verification failed:", error?.message || "verification error");
    return json({ error: "Could not verify your Firebase sign-in. Please try again." }, 503, origin);
  }
  if (!isAdmin(authorized)) return json({ error: "Administrator access is required. Sign in again and retry." }, 403, origin);

  let input;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 12000) return json({ error: "Product details are too large." }, 413, origin);
    input = JSON.parse(rawBody);
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400, origin);
  }
  const built = buildPrompt(input || {});
  if (built.error) return json({ error: built.error }, 400, origin);

  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || "gemini-3.5-flash-lite"}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: built.prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: built.responseSchema,
        },
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    console.error("Gemini request failed:", error?.name || "request error");
    return json({ error: "Gemini could not be reached. Please try again shortly." }, 503, origin);
  }
  if (!response.ok) {
    console.error("Gemini product copy returned HTTP", response.status);
    if (response.status === 429) return json({ error: "Gemini is rate-limited. Please wait a moment and try again." }, 429, origin);
    return json({ error: "Gemini could not generate product copy. Check the API key and model availability." }, 503, origin);
  }

  let result;
  try {
    const payload = await response.json();
    const generatedText = payload.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
    result = JSON.parse(generatedText || "{}");
  } catch {
    return json({ error: "Gemini returned an unreadable result. Please try again." }, 502, origin);
  }
  const description = built.mode === "tags" ? "" : String(result.description || "").trim().slice(0, 3000);
  const tags = [...new Set((Array.isArray(result.tags) ? result.tags : [])
    .map(tag => String(tag || "").trim().replace(/^#/, "").replace(/\s+/g, " ").slice(0, 60))
    .filter(Boolean))].slice(0, 12);
  if ((built.mode !== "tags" && !description) || (built.mode !== "description" && !tags.length)) {
    return json({ error: "Gemini returned incomplete product copy. Please try again." }, 502, origin);
  }
  if (built.mode === "description") return json({ description }, 200, origin);
  if (built.mode === "tags") return json({ tags }, 200, origin);
  return json({ description, tags }, 200, origin);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error("Product marketing Worker failed:", error?.message || "unexpected error");
      const origin = request.headers.get("Origin");
      return json({ error: "The service hit an unexpected error. Please try again." }, 500, origin);
    }
  },
};
