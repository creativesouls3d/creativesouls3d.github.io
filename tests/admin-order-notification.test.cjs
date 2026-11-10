const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const adminCode = fs.readFileSync("admin.js", "utf8");

// Extract helper functions
function extractFunction(name) {
  const marker = "function " + name + "(";
  const start = adminCode.indexOf(marker);
  if (start === -1) throw new Error("Could not find function " + name);
  let depth = 0;
  let bodyStart = adminCode.indexOf("{", start);
  for (let i = bodyStart; i < adminCode.length; i++) {
    if (adminCode[i] === "{") depth++;
    else if (adminCode[i] === "}") {
      depth--;
      if (depth === 0) {
        return adminCode.slice(start, i + 1);
      }
    }
  }
  throw new Error("Could not extract function " + name);
}

const toBoldFn = extractFunction("toBold");
const canonicalOrderStatusFn = extractFunction("canonicalOrderStatus");
const orderEmailSubjectFn = extractFunction("orderEmailSubject");
const buildOrderNotificationEmailBodyFn = extractFunction("buildOrderNotificationEmailBody");
const buildOrderNotificationPlainTextFn = extractFunction("buildOrderNotificationPlainText");

const testContext = `
const window = {};
${toBoldFn}
${canonicalOrderStatusFn}
function orderDate(t) { return "25 Oct 2026"; }
${orderEmailSubjectFn}
${buildOrderNotificationEmailBodyFn}
${buildOrderNotificationPlainTextFn}

module.exports = {
  toBold,
  canonicalOrderStatus,
  orderEmailSubject,
  buildOrderNotificationEmailBody,
  buildOrderNotificationPlainText
};
`;

const mod = {};
const fn = new Function("module", testContext);
fn(mod);
const {
  toBold,
  canonicalOrderStatus,
  orderEmailSubject,
  buildOrderNotificationEmailBody,
  buildOrderNotificationPlainText
} = mod.exports;

test("buildOrderNotificationEmailBody contains dark mode proofing against email client color inversion", () => {
  const order = {
    order_id: "#25827151",
    name: "Aarav Gupta",
    status: "In Production",
    timestamp: 1729850000000,
    items: [
      { productName: "3D Custom Lithophane", colour: "White", size: "6 inch", price: 1299, quantity: 1 }
    ],
    total: 1299,
    address: "B-203, Galaxy Heights, Mumbai, MH"
  };

  const html = buildOrderNotificationEmailBody(order);

  // Dark mode proofing meta & CSS
  assert.match(html, /<meta name="color-scheme" content="dark light"\/>/, "Must declare dark light color scheme in meta");
  assert.match(html, /<meta name="supported-color-schemes" content="dark light"\/>/, "Must declare supported-color-schemes");
  assert.match(html, /@media \(prefers-color-scheme: dark\)/, "Must include media query to protect against dark mode inversion");
  assert.match(html, /\[data-ogsb\]/, "Must include Outlook/Samsung dark mode data attribute overrides");

  // Gmail linear-gradient lock on background elements
  assert.match(html, /background-color:#0f172a;\s*background-image:linear-gradient\(#0f172a,#0f172a\);/, "Main card must have linear-gradient background lock");
  assert.match(html, /background-color:#0f172a;\s*background-image:linear-gradient\(135deg,#0f172a 0%,#1e293b 100%\);/, "Header must have linear-gradient background lock");
  assert.match(html, /background-color:#0b0f19;\s*background-image:linear-gradient\(#0b0f19,#0b0f19\);/, "Outer wrapper must have linear-gradient background lock");

  // Brand colors & single hash
  assert.match(html, /#f59e0b/, "Should use warm amber brand accent color");
  assert.match(html, /#25827151/, "Should format with single #");
  assert.ok(!html.includes("##"), "Must never contain double ##");
});

test("buildOrderNotificationEmailBody includes courier tracking link with button for shipped orders", () => {
  const shippedOrder = {
    order_id: "#25827151",
    name: "Aarav Gupta",
    status: "Shipped",
    tracking_url: "https://track.courier.com/12345",
    expected_delivery: "28 Oct 2026",
    total: 999,
    items: [{ productName: "Dragon", price: 999, quantity: 1 }]
  };

  const html = buildOrderNotificationEmailBody(shippedOrder);
  assert.match(html, /Your order has been shipped!/);
  assert.match(html, /https:\/\/track\.courier\.com\/12345/);
  assert.match(html, /Track Package &rarr;/);
});

test("orderEmailSubject generates single hash for order ID regardless of raw input", () => {
  assert.equal(orderEmailSubject({ order_id: "#25827151", status: "In Production" }), "Order In Production #25827151 — Creative Souls 3D");
  assert.equal(orderEmailSubject({ order_id: "25827151", status: "In Production" }), "Order In Production #25827151 — Creative Souls 3D");
  assert.equal(orderEmailSubject({ order_id: "##25827151", status: "In Production" }), "Order In Production #25827151 — Creative Souls 3D");
});

test("buildOrderNotificationPlainText never outputs double hashes in order ID", () => {
  const orderWithHash = {
    order_id: "#25827151",
    name: "Aarav Gupta",
    status: "In Production",
    items: [{ productName: "Moon Lamp", price: 999, quantity: 1 }],
    total: 999
  };
  const body = buildOrderNotificationPlainText(orderWithHash);
  assert.ok(body.includes("Order ID:         #25827151"));
  assert.ok(!body.includes("##"));
});
