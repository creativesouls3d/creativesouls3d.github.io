const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const adminHtml = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const accountHtml = fs.readFileSync(path.join(root, "account.html"), "utf8");
const cartJs = fs.readFileSync(path.join(root, "cart.js"), "utf8");
const accountJs = fs.readFileSync(path.join(root, "account.js"), "utf8");
const functionsJs = fs.readFileSync(path.join(root, "functions", "index.js"), "utf8");

test("Client account page displays wallet balance, points, and transaction history", () => {
  assert.ok(accountHtml.includes('id="account-wallet-card"'), "Must include account-wallet-card");
  assert.ok(accountHtml.includes('id="wallet-balance-display"'), "Must include wallet-balance-display");
  assert.ok(accountHtml.includes('id="wallet-points-display"'), "Must include wallet-points-display");
  assert.ok(accountHtml.includes('id="wallet-history-list"'), "Must include wallet-history-list");
  assert.ok(accountHtml.includes('id="wallet-refresh-btn"'), "Must include wallet-refresh-btn");
  assert.ok(accountJs.includes("loadWallet"), "account.js must define loadWallet function");
  assert.ok(accountJs.includes("wallet_history"), "account.js must query wallet_history subcollection");
});

test("Cart checkout supports wallet balance deduction and payment", () => {
  assert.ok(cartJs.includes("useWallet"), "cart.js must track useWallet state");
  assert.ok(cartJs.includes("cart-use-wallet"), "cart.js must render and handle cart-use-wallet checkbox");
  assert.ok(cartJs.includes("wallet_used"), "cart.js must record wallet_used in orders and history");
  assert.ok(cartJs.includes("wallet_history"), "cart.js must log debit to wallet_history subcollection");
});

test("Admin panel provides dedicated Wallets & Refunds section and 1-click refund in order details", () => {
  assert.ok(adminHtml.includes('data-section="wallets"'), "Sidebar must have Wallets & Refunds nav item");
  assert.ok(adminHtml.includes('id="section-wallets"'), "Must include section-wallets");
  assert.ok(adminHtml.includes('id="wallet-customer-search"'), "Must include wallet-customer-search input");
  assert.ok(adminHtml.includes('id="wallet-action-form"'), "Must include wallet-action-form");
  assert.ok(adminHtml.includes('id="order-detail-refund"'), "Order details modal must include refund button");
  assert.ok(adminHtml.includes('id="wallet-refund-dialog"'), "Must include wallet-refund-dialog");
  assert.ok(adminHtml.includes('id="wallet-global-logs-tbody"'), "Must include storewide wallet logs table");
});

test("Cloud functions index.js exports adminRefundToWallet and getWalletInfo cleanly", () => {
  assert.ok(functionsJs.includes("exports.adminRefundToWallet"), "functions/index.js must export adminRefundToWallet");
  assert.ok(functionsJs.includes("exports.getWalletInfo"), "functions/index.js must export getWalletInfo");
  // Ensure no duplications
  const matches = functionsJs.match(/exports\.adminRefundToWallet/g);
  assert.strictEqual(matches.length, 1, "exports.adminRefundToWallet must be defined exactly once");
});
