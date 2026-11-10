const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "admin.js"), "utf8");
const helpers = source.slice(source.indexOf("  const ticketMediaUploads ="), source.indexOf("  async function showTicketDetails("));
const create = source.slice(source.indexOf("  async function saveAdminTicket("), source.indexOf('  byId("create-ticket-btn")'));

function setup() {
  const fields = {};
  const writes = [];
  const uploads = [];
  const context = vm.createContext({
    IMAGEKIT_FOLDER: "/order-tickets",
    IMAGEKIT_MAX_FILE_BYTES: 25 * 1024 * 1024,
    ADMIN_EMAIL: "admin@example.com",
    console: { error() {} },
    window: {},
    byId(id) {
      return fields[id] ||= { value: "", files: [], textContent: "", disabled: false, querySelectorAll: () => [] };
    },
    uploadFileToImageKit: async (file, folder) => {
      uploads.push({ file, folder });
      return { url: `https://ik.imagekit.io/test/${file.name}`, name: file.name, fileType: file.type, fileId: file.name };
    },
    firebase: {
      auth: () => ({ currentUser: { email: "admin@example.com" } }),
      firestore: { FieldValue: { arrayUnion: (...values) => ({ values }), serverTimestamp: () => "timestamp" } }
    },
    db: { collection: () => ({ doc: id => ({
      update: async data => writes.push({ id, data }),
      set: async data => writes.push({ id, data })
    }) }) },
    loadTickets: async () => {},
    showTicketDetails: async () => {},
    generateUniqueTicketId: async () => "TKT-123456",
    ticketCreateOrder: null,
    ticketCreateDialog: { close() {} },
    setTicketCreateError: message => { fields.error = message; },
    errorText: error => error.message,
    reportError: () => {},
    updateTicketEmailPreview: () => {},
    ticketItemImage: () => "logo_creativesouls.jpg"
  });
  vm.runInContext(helpers + create, context);
  return { context, fields, writes, uploads };
}

const photo = { name: "photo.jpg", type: "image/jpeg", size: 1024 };
const video = { name: "video.mp4", type: "video/mp4", size: 2048 };

test("validates photos/videos and rejects oversized or non-media files", () => {
  const { context } = setup();
  context.validateTicketMedia([photo, video]);
  context.validateTicketMedia([{ ...photo, size: 25 * 1024 * 1024 }]);
  assert.throws(() => context.validateTicketMedia([{ ...photo, size: 25 * 1024 * 1024 + 1 }]), /larger than 25 MB/);
  assert.throws(() => context.validateTicketMedia([{ ...photo, type: "application/pdf" }]), /not a photo or video/);
});

test("uploads into the customer order folder and reuses completed uploads on retry", async () => {
  const { context, uploads } = setup();
  const button = {};
  const result = await context.uploadAdminTicketMedia([photo, video], "#123456", button);
  assert.equal(result.length, 2);
  assert.equal(uploads[0].folder, "/order-tickets/123456");
  await context.uploadAdminTicketMedia([photo, video], "#123456", button);
  assert.equal(uploads.length, 2);
});

test("existing ticket uploads atomically append attachments without changing status or replies", async () => {
  const { context, writes, uploads } = setup();
  context.activeTicket = { id: "TKT-123456", data: { order_id: "#123456", status: "Resolved" } };
  context.byId("ticket-media-input").files = [photo, video];
  await context.addAdminTicketMedia();
  assert.equal(uploads.length, 2);
  assert.equal(writes[0].id, "TKT-123456");
  assert.deepEqual(Object.keys(writes[0].data), ["attachments"]);
  assert.equal(writes[0].data.attachments.values.length, 2);
  assert.equal(context.byId("ticket-media-input").disabled, false);
  assert.equal(context.byId("ticket-media-save").disabled, false);
});

test("failed uploads do not write attachments and keep the selection available to retry", async () => {
  const { context, writes } = setup();
  context.activeTicket = { id: "TKT-123456", data: {} };
  context.byId("ticket-media-input").files = [photo];
  context.uploadFileToImageKit = async () => { throw new Error("Upload failed"); };
  await context.addAdminTicketMedia();
  assert.equal(writes.length, 0);
  assert.equal(context.byId("ticket-media-status").textContent, "Upload failed");
  assert.equal(context.byId("ticket-media-input").files.length, 1);
  assert.equal(context.byId("ticket-media-save").disabled, false);
});

test("admin-created tickets store ImageKit attachment metadata", async () => {
  const { context, writes, uploads } = setup();
  context.byId("tc-email").value = "customer@example.com";
  context.byId("tc-issue").value = "Damaged product";
  context.byId("tc-order").value = "#123456";
  context.byId("tc-media").files = [photo, video];
  await context.saveAdminTicket();
  assert.equal(uploads.length, 2);
  assert.equal(writes[0].data.attachments.length, 2);
  assert.match(writes[0].data.attachments[0].url, /^https:\/\/ik.imagekit.io\//);
  assert.equal(writes[0].data.created_by, "admin");
  assert.equal(context.byId("tc-media").disabled, false);
});

test("admin ticket creation still works without media", async () => {
  const { context, writes, uploads } = setup();
  context.byId("tc-email").value = "customer@example.com";
  context.byId("tc-issue").value = "Question about an order";
  await context.saveAdminTicket();
  assert.equal(uploads.length, 0);
  assert.equal(writes[0].data.attachments.length, 0);
});

test("admin page loads ImageKit dependencies before the dashboard and offers media selection", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  assert.ok(html.indexOf("crypto-js.min.js") < html.indexOf('src="imagekit-config.js"'));
  assert.ok(html.indexOf('src="imagekit-config.js"') < html.indexOf('src="admin.js"'));
  assert.match(html, /id="tc-media" type="file" accept="image\/\*,video\/\*" multiple/);
  const css = fs.readFileSync(path.join(root, "admin.css"), "utf8");
  assert.ok(css.includes(".ticket-media-upload"));
});