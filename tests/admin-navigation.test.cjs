const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const script = html.split("<!-- Sidebar & section navigation -->")[1].match(/<script>([\s\S]*?)<\/script>/)[1];
const sections = ["dashboard", "analytics", "attention", "tickets", "orders", "products", "explorer"];

function setup(query = "") {
  function element(section) {
    const classes = new Set();
    return {
      dataset: { section }, textContent: "", handlers: {},
      addEventListener(name, callback) { this.handlers[name] = callback; },
      classList: {
        add: value => classes.add(value),
        remove: value => classes.delete(value),
        contains: value => classes.has(value),
        toggle(value, force) {
          if (force === undefined) force = !classes.has(value);
          if (force) classes.add(value); else classes.delete(value);
        }
      }
    };
  }
  const nodes = {};
  const nav = sections.map(element);
  const bottom = sections.map(element);
  const panels = sections.map(id => nodes[`section-${id}`] = element(id));
  const historyCalls = [];
  const events = {};
  const location = { pathname: "/store/admin.html", search: query, hash: "#top" };
  const updateURL = (method, url) => {
    const parsed = new URL(url, "https://example.com");
    location.search = parsed.search;
    historyCalls.push({ method, url });
  };
  const context = vm.createContext({
    document: {
      body: element(),
      getElementById: id => nodes[id] ||= element(),
      querySelectorAll: selector => selector.startsWith(".admin-bottom") ? bottom : selector.startsWith(".admin-nav") ? nav : panels,
      querySelector: selector => nav.find(node => selector.includes(`"${node.dataset.section}"`))
    },
    localStorage: { getItem: () => null, setItem() {} },
    window: {
      location, scrollTo() {},
      addEventListener: (name, callback) => { events[name] = callback; },
      history: {
        pushState: (_state, _title, url) => updateURL("push", url),
        replaceState: (_state, _title, url) => updateURL("replace", url)
      }
    }
  });
  vm.runInContext(script, context);
  return { context, nodes, nav, bottom, panels, location, historyCalls, events };
}

test("all admin sections restore from their query URL on reload", () => {
  for (const id of sections) {
    const { nodes, nav, bottom, panels, historyCalls } = setup(`?${id}`);
    assert.ok(nodes[`section-${id}`].classList.contains("active"));
    assert.equal(panels.filter(node => node.classList.contains("active")).length, 1);
    assert.ok(nav.find(node => node.dataset.section === id).classList.contains("active"));
    assert.ok(bottom.find(node => node.dataset.section === id).classList.contains("active"));
    assert.equal(historyCalls.length, 0);
  }
});

test("missing or unknown sections fall back to dashboard using replaceState", () => {
  for (const query of ["", "?unknown", "?orders=invalid"]) {
    const { nodes, location, historyCalls } = setup(query);
    assert.equal(location.search, "?dashboard");
    assert.ok(nodes["section-dashboard"].classList.contains("active"));
    assert.equal(historyCalls[0].method, "replace");
  }
});

test("section changes update the URL and avoid duplicate history entries", () => {
  const { context, location, historyCalls, nodes } = setup("?dashboard");
  for (const id of sections.slice(1)) {
    context.window.navigateTo(id);
    assert.equal(location.search, `?${id}`);
    assert.ok(nodes[`section-${id}`].classList.contains("active"));
  }
  assert.equal(historyCalls.length, 6);
  context.window.navigateTo("explorer");
  assert.equal(historyCalls.length, 6);
  assert.equal(historyCalls[0].url, "/store/admin.html?analytics#top");
});

test("Back and Forward restore the section without pushing history", () => {
  const { context, location, historyCalls, events, nodes } = setup("?orders");
  context.window.navigateTo("tickets");
  location.search = "?orders";
  events.popstate();
  assert.ok(nodes["section-orders"].classList.contains("active"));
  location.search = "?tickets";
  events.popstate();
  assert.ok(nodes["section-tickets"].classList.contains("active"));
  assert.equal(historyCalls.length, 1);
});

test("dashboard data-loading wrapper forwards navigation options and handles products on sign-in", () => {
  const js = fs.readFileSync(path.join(root, "admin.js"), "utf8");
  assert.match(js, /_origNavigateTo\(id, options\)/);
  assert.match(js, /if \(document\.querySelector\("#section-products\.active"\)\) loadCatalogProducts\(\)/);
});