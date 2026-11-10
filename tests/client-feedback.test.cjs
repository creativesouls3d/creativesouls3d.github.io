const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const feedbackJs = fs.readFileSync(path.join(root, "feedback.js"), "utf8");

test("feedback.js does not attempt to invoke non-existent firebase.functions() constructor with string", () => {
  assert.equal(feedbackJs.includes('firebase.functions("us-central1")'), false, "Should not use invalid firebase.functions('us-central1')");
});

test("feedback.js queries orders directly via Firestore db.collection('orders')", () => {
  assert.ok(feedbackJs.includes('db.collection("orders")'), "Should read orders from Firestore");
});

test("feedback.js saves feedback directly to db.collection('feedback')", () => {
  assert.ok(feedbackJs.includes('db.collection("feedback").doc'), "Should write feedback to Firestore under order doc ID");
});

test("feedback.js populates both legacy rating and overall_satisfaction ratings for admin compatibility", () => {
  assert.ok(feedbackJs.includes("overall_satisfaction: rating"), "Should populate overall_satisfaction");
  assert.ok(feedbackJs.includes("comments: reviewText"), "Should populate comments");
  assert.ok(feedbackJs.includes("created_at:"), "Should populate created_at");
});

test("feedback.js attaches event listener to lookupBtn", () => {
  assert.match(feedbackJs, /lookupBtn\.addEventListener\("click",\s*lookupOrder\)/);
});
