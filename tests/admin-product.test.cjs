const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "admin.js"), "utf8");
const example = {
  productId: "25827151", productName: "Mumbai Cha Raja 2025", price: 399,
  color: "White, Multicolored", stock: 99, customizable: true,
  colourOptions: { Multicoloured: { order: 0 }, White: { order: 1 } },
  colourPrices: { Multicoloured: 150, White: 0 },
  sizes: { "7 inch": { order: 0 }, "8 inch": { order: 1 }, "5 inch": { order: 2 }, "6 inch": { order: 3 }, "4 inch": { order: 4 } },
  sizePrices: { "7 inch": 699, "8 inch": 799, "5 inch": 499, "6 inch": 599, "4 inch": 399 }
};
const plain = value => JSON.parse(JSON.stringify(value));
function setup() {
  const nodes = {};
  const uploads = [];
  const writes = [];
  const context = vm.createContext({
    IMAGEKIT_MAX_FILE_BYTES: 25 * 1024 * 1024,
    productMediaUploads: new WeakMap(), productImageUrls: [], productGifUrl: "",
    byId: id => nodes[id] ||= { files: [], textContent: "Save Changes", value: "", disabled: false, querySelectorAll: () => [] },
    uploadFileToImageKit: async (file, folder) => { uploads.push({ file, folder }); return { url: `https://ik.imagekit.io/test/Product/${file.name}` }; },
    restoreTypes: value => value, readEditorFields: () => plain(example),
    activeDocument: { collection: "products", id: example.productId, creating: true },
    advancedEditorUsed: false, jsonInput: {},
    db: { collection: () => ({ doc: id => ({ set: async data => writes.push({ id, data }) }) }) },
    dialog: { close() {} }, status: {}, window: {},
    File: globalThis.File, Blob: globalThis.Blob, URL: globalThis.URL,
    errorText: error => error.message,
    loadCatalogProducts: async () => {}, loadCollection: async () => {}
  });
  vm.runInContext(source.slice(source.indexOf("  function renderProductMedia("), source.indexOf("  function populateOrderProductSelect(")), context);
  vm.runInContext(source.slice(source.indexOf("  async function saveEditor("), source.indexOf('  jsonInput.addEventListener("input"')), context);
  const setRows = (id, entries) => {
    context.byId(id).querySelectorAll = () => entries.map(({ label, price }) => ({
      querySelector: selector => ({ value: selector.includes("label") ? label : String(price) })
    }));
  };
  setRows("product-colour-rows", context.readColourVariantSource(example));
  setRows("product-size-rows", context.readSizeVariantSource(example));
  return { context, uploads, writes, setRows };
}

test("variant readers retain prices and display order from the supplied schema", () => {
  const { context } = setup();
  assert.deepEqual(plain(context.readColourVariantSource(example)), [{ label: "Multicoloured", price: 150 }, { label: "White", price: 0 }]);
  assert.deepEqual(plain(context.readSizeVariantSource(example)).map(x => x.price), [699, 799, 499, 599, 399]);
  const reversed = { ...example, sizes: Object.fromEntries(Object.entries(example.sizes).reverse()) };
  assert.equal(context.readSizeVariantSource(reversed)[0].label, "7 inch");
});

test("variant serialization matches the supplied option and price maps exactly", () => {
  const { context } = setup();
  const product = plain(example);
  context.applyProductVariants(product);
  assert.deepEqual(product, example);
});

test("duplicate names, incomplete variants and invalid prices are rejected", () => {
  const { context, setRows } = setup();
  for (const rows of [[{ label: "White", price: 0 }, { label: "white", price: 10 }], [{ label: "", price: 0 }], [{ label: "White", price: -1 }], [{ label: "White", price: "" }]]) {
    setRows("product-colour-rows", rows);
    assert.throws(() => context.applyProductVariants({}));
  }
});

test("product images upload to ImageKit and save as comma-separated URLs with numeric attributes", async () => {
  const { context, uploads, writes } = setup();
  context.productImageUrls = ["https://ik.imagekit.io/test/existing.jpg"];
  context.byId("product-image-files").files = [{ name: "front.png", type: "image/png", size: 100 }, { name: "back.jpg", type: "image/jpeg", size: 100 }];
  context.byId("product-gif-file").files = [{ name: "spin.gif", type: "image/gif", size: 100 }];
  await context.saveEditor();
  assert.equal(writes.length, 1);
  assert.ok(uploads.every(upload => upload.folder === "/Product"));
  assert.equal(writes[0].data.imageUrl, "https://ik.imagekit.io/test/existing.jpg, https://ik.imagekit.io/test/Product/front.png, https://ik.imagekit.io/test/Product/back.jpg");
  assert.equal(writes[0].data.gifUrl, "https://ik.imagekit.io/test/Product/spin.gif");
  assert.equal(writes[0].data.stock, 99);
  assert.equal(writes[0].data.sizePrices["7 inch"], 699);
  assert.equal(writes[0].data.colourPrices.Multicoloured, 150);
  assert.equal(writes[0].data.customizable, true);
});

test("failed product uploads do not save a document and restore the Save button", async () => {
  const { context, writes } = setup();
  context.byId("product-image-files").files = [{ name: "front.png", type: "image/png", size: 100 }];
  context.uploadFileToImageKit = async () => { throw new Error("Upload failed"); };
  await context.saveEditor();
  assert.equal(writes.length, 0);
  assert.equal(context.byId("editor-error").textContent, "Upload failed");
  assert.equal(context.byId("editor-save").disabled, false);
});

test("stock validation and media validation reject incorrect data", async () => {
  const { context, writes } = setup();
  context.readEditorFields = () => ({ ...plain(example), stock: "Made to order" });
  await context.saveEditor();
  assert.equal(writes.length, 0);
  assert.match(context.byId("editor-error").textContent, /Stock/);
  assert.throws(() => context.validateProductMedia([{ name: "movie.mp4", type: "video/mp4", size: 100 }]), /image/);
  assert.throws(() => context.validateProductMedia([{ name: "big.png", type: "image/png", size: 26 * 1024 * 1024 }]), /25 MB/);
});

test("storefront size reader uses the separate full-price map", () => {
  const html = fs.readFileSync(path.join(root, "product.html"), "utf8");
  const context = vm.createContext({ orderedMapEntries: raw => Object.entries(raw).map(([label, value]) => ({ label, value })) });
  vm.runInContext(html.slice(html.indexOf("    function getSizeOptions("), html.indexOf("    function renderSizeSelector(")), context);
  assert.equal(context.getSizeOptions(example)[0].price, 699);
  const colourCode = html.slice(html.indexOf("    function renderColourSelector("), html.indexOf("      if (!options.length) return;", html.indexOf("    function renderColourSelector(")));
  const colourContext = vm.createContext({
    document: { getElementById: () => ({}) },
    orderedMapEntries: context.orderedMapEntries
  });
  vm.runInContext(colourCode + "return options; }", colourContext);
  assert.equal(colourContext.renderColourSelector(example.colourOptions, example)[0].price, 150);
});

test("form offers image files instead of URL fields and distinguishes size/colour prices", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  assert.match(html, /id="product-image-files" type="file" accept="image\/\*" multiple/);
  assert.ok(!source.includes("Comma-separated image URLs"));
  assert.ok(source.includes('"Full size price (INR)"'));
  assert.ok(source.includes('"Colour extra charge (INR)"'));
});


test("professional image system allows reordering images, setting cover, and moving left/right", async () => {
  const { context, writes } = setup();
  context.initProductImageItems(["https://ik.imagekit.io/test/a.jpg", "https://ik.imagekit.io/test/b.jpg", "https://ik.imagekit.io/test/c.jpg"]);
  assert.equal(context.productImageItems.length, 3);
  assert.equal(context.productImageItems[0].url, "https://ik.imagekit.io/test/a.jpg");

  // Move image at index 2 (c.jpg) left -> index 1
  context.moveProductImage(2, -1);
  assert.equal(context.productImageItems[1].url, "https://ik.imagekit.io/test/c.jpg");
  assert.equal(context.productImageItems[2].url, "https://ik.imagekit.io/test/b.jpg");

  // Set image at index 1 (c.jpg) as cover image -> index 0
  context.setProductCoverImage(1);
  assert.equal(context.productImageItems[0].url, "https://ik.imagekit.io/test/c.jpg");
  assert.equal(context.productImageItems[1].url, "https://ik.imagekit.io/test/a.jpg");
  assert.equal(context.productImageItems[2].url, "https://ik.imagekit.io/test/b.jpg");

  // Drag-and-drop / arbitrary reorder: move index 2 (b.jpg) to index 0
  context.reorderProductImage(2, 0);
  assert.equal(context.productImageItems[0].url, "https://ik.imagekit.io/test/b.jpg");

  await context.saveEditor();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.imageUrl, "https://ik.imagekit.io/test/b.jpg, https://ik.imagekit.io/test/c.jpg, https://ik.imagekit.io/test/a.jpg");
});

test("professional image system allows deleting an image and incrementally adding more by URL or file", async () => {
  const { context, writes } = setup();
  context.initProductImageItems(["https://ik.imagekit.io/test/one.jpg", "https://ik.imagekit.io/test/two.jpg"]);

  // Delete image at index 0 (one.jpg)
  context.deleteProductImage(0);
  assert.equal(context.productImageItems.length, 1);
  assert.equal(context.productImageItems[0].url, "https://ik.imagekit.io/test/two.jpg");

  // Add another image by URL
  context.addProductImageUrl("https://ik.imagekit.io/test/three.jpg");
  assert.equal(context.productImageItems.length, 2);
  assert.equal(context.productImageItems[1].url, "https://ik.imagekit.io/test/three.jpg");

  // Add another image by file
  context.addProductImageFiles([{ name: "four.png", type: "image/png", size: 1024 }]);
  assert.equal(context.productImageItems.length, 3);
  assert.equal(context.productImageItems[2].type, "file");

  // Reorder file to be first (Cover Image)
  context.setProductCoverImage(2);
  assert.equal(context.productImageItems[0].type, "file");
  assert.equal(context.productImageItems[1].url, "https://ik.imagekit.io/test/two.jpg");

  await context.saveEditor();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.imageUrl, "https://ik.imagekit.io/test/Product/four.png, https://ik.imagekit.io/test/two.jpg, https://ik.imagekit.io/test/three.jpg");
});

test("image studio editor allows applying edits to product pictures and uploads on save", async () => {
  const { context, uploads, writes } = setup();
  context.initProductImageItems(["https://ik.imagekit.io/test/front-shot.jpg", "https://ik.imagekit.io/test/back-shot.jpg"]);

  // Apply edit to index 0
  const fakeEditedBlob = { name: "front-shot-edited.jpg", type: "image/jpeg", size: 2048 };
  context.applyProductImageEdit(0, fakeEditedBlob, "front-shot-edited.jpg");

  assert.equal(context.productImageItems.length, 2);
  assert.equal(context.productImageItems[0].type, "file");
  assert.equal(context.productImageItems[0].isEdited, true);
  assert.equal(context.productImageItems[0].name, "front-shot-edited.jpg");
  assert.equal(context.productImageItems[1].url, "https://ik.imagekit.io/test/back-shot.jpg");

  await context.saveEditor();
  assert.equal(writes.length, 1);
  assert.ok(uploads.some(u => u.folder === "/Product" && u.file.name === "front-shot-edited.jpg"));
  assert.equal(writes[0].data.imageUrl, "https://ik.imagekit.io/test/Product/front-shot-edited.jpg, https://ik.imagekit.io/test/back-shot.jpg");
});

test("admin UI provides professional gallery markup and styling elements", () => {
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "admin.css"), "utf8");
  assert.ok(html.includes('id="product-image-dropzone"'));
  assert.ok(html.includes('id="btn-browse-product-images"'));
  assert.ok(html.includes('id="btn-toggle-url-input"'));
  assert.ok(html.includes('id="product-url-input-bar"'));
  assert.ok(html.includes('id="product-image-count-badge"'));
  assert.ok(css.includes(".product-gallery-grid"));
  assert.ok(css.includes(".product-img-card"));
  assert.ok(css.includes(".badge-cover"));
  assert.ok(css.includes(".product-dropzone"));
  // Image studio editor markup and styles
  assert.ok(html.includes('id="product-image-editor-dialog"'));
  assert.ok(html.includes('id="pie-canvas"'));
  assert.ok(html.includes('id="pie-crop-box"'));
  assert.ok(html.includes('id="pie-rotate-cw"'));
  assert.ok(html.includes('id="pie-flip-h"'));
  assert.ok(html.includes('id="pie-brightness"'));
  assert.ok(html.includes('id="pie-apply"'));
  assert.ok(css.includes(".product-img-editor-modal"));
  assert.ok(css.includes(".pie-canvas-viewport"));
  assert.ok(css.includes(".pie-crop-box"));
  assert.ok(css.includes(".btn-edit-img"));
  assert.ok(css.includes(".badge-edited"));
});
