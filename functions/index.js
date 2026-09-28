const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const SITE_ORIGIN = "https://creativesouls3d.github.io";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getFirstImage(imageValue) {
  const firstImage = String(imageValue || "logo_creativesouls.jpg")
    .split(",")[0]
    .trim();

  try {
    return new URL(firstImage, `${SITE_ORIGIN}/`).href;
  } catch {
    return `${SITE_ORIGIN}/logo_creativesouls.jpg`;
  }
}

function productPageUrl(productId) {
  return `${SITE_ORIGIN}/product.html?id=${encodeURIComponent(productId)}`;
}

function productPreviewUrl(productId) {
  return `https://us-central1-creative-souls-3d.cloudfunctions.net/productPreview?id=${encodeURIComponent(productId)}`;
}

exports.productPreview = onRequest(
  { region: "us-central1", maxInstances: 5 },
  async (request, response) => {
    const productId = String(request.query.id || "").trim();
    if (!productId || productId.length > 150 || productId.includes("/")) {
      response.status(400).send("A valid product ID is required.");
      return;
    }

    try {
      const snapshot = await getFirestore().collection("products").doc(productId).get();
      if (!snapshot.exists) {
        response.status(404).send("Product not found.");
        return;
      }

      const product = snapshot.data();
      const name = String(product.productName || "Creative Souls 3D Product").trim();
      const description = String(
        product.description || "Personalized 3D printed creation from Creative Souls 3D."
      ).replace(/\s+/g, " ").trim().slice(0, 240);
      const image = getFirstImage(product.imageUrl);
      const destination = productPageUrl(productId);
      const previewUrl = productPreviewUrl(productId);
      const title = `${name} | Creative Souls 3D`;

      response.set("Cache-Control", "public, max-age=300, s-maxage=3600");
      response.set("X-Content-Type-Options", "nosniff");
      response.status(200).type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Creative Souls 3D">
  <meta property="og:title" content="${escapeHtml(name)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:alt" content="${escapeHtml(name)}">
  <meta property="og:url" content="${escapeHtml(previewUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(name)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(destination)}">
</head>
<body>
  <p>Opening <a href="${escapeHtml(destination)}">${escapeHtml(name)}</a>…</p>
  <script>window.location.replace(${JSON.stringify(destination)});</script>
</body>
</html>`);
    } catch (error) {
      console.error("Could not render product preview:", error);
      response.status(500).send("Could not load this product right now.");
    }
  }
);
