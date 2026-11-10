const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const adminJs = fs.readFileSync(path.join(root, "admin.js"), "utf8");
const adminCss = fs.readFileSync(path.join(root, "admin.css"), "utf8");

test("admin.js contains no duplicate let feedbackFilterValue declaration", () => {
  const matches = adminJs.match(/let\s+feedbackFilterValue/g);
  assert.equal(matches ? matches.length : 0, 1, "feedbackFilterValue should only be declared once with let");
});

test("admin.js maps overall_satisfaction to record.rating for legacy/client feedback", () => {
  assert.match(adminJs, /record\.overall_satisfaction\s*\?\?\s*record\.ratings\?\.overall_satisfaction\s*\?\?\s*record\.rating/);
});

test("admin.js normalizes Firestore timestamps and serialized timestamps", () => {
  assert.match(adminJs, /normalizeFeedbackTimestamp/);
});

test("admin.js includes Customer Review and review field in text pairs", () => {
  assert.match(adminJs, /\["Customer Review",\s*"review"\]/);
});

test("admin.js tries direct Firestore collection read before cloud function fallback", () => {
  const loadFnSlice = adminJs.slice(adminJs.indexOf("async function loadCustomerFeedback()"), adminJs.indexOf("function renderCustomerFeedback()"));
  const firestoreIdx = loadFnSlice.indexOf('db.collection("feedback")');
  const cloudFnIdx = loadFnSlice.indexOf('listOrderFeedback');
  assert.ok(firestoreIdx > -1, "Should have direct Firestore read");
  assert.ok(cloudFnIdx > -1, "Should have Cloud Function fallback");
  assert.ok(firestoreIdx < cloudFnIdx, "Firestore read should precede Cloud Function fallback");
});

test("admin.js supports deleting feedback with confirmation and Firestore delete", () => {
  assert.match(adminJs, /async function deleteCustomerFeedback\(/);
  assert.match(adminJs, /window\.confirm\(/);
  assert.match(adminJs, /db\.collection\("feedback"\)\.doc\(record\.id\)\.delete\(\)/);
  assert.match(adminJs, /fb-btn-delete/);
});

test("admin.js provides feedback acknowledgment notification via Gmail and clipboard", () => {
  assert.match(adminJs, /async function notifyCustomerFeedbackAcknowledged\(/);
  assert.match(adminJs, /copyStyledHtmlToClipboard\(/);
  assert.match(adminJs, /openGmailCompose\(/);
  assert.match(adminJs, /acknowledged_at/);
  assert.match(adminJs, /fb-btn-notify/);
  assert.match(adminJs, /fb-ack-badge/);
});

test("admin.css contains styling for feedback actions, acknowledgment badge, and action buttons", () => {
  assert.match(adminCss, /\.fb-card-actions/);
  assert.match(adminCss, /\.fb-ack-badge/);
  assert.match(adminCss, /\.fb-btn-notify/);
  assert.match(adminCss, /\.fb-btn-delete/);
});
