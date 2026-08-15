/*
 * ybw-label-article-frames.jsx
 * InDesign ExtendScript (CC 2019 / 2020 / 2021 / 2022 / 2023 / 2024 compatible).
 *
 * What it does
 * ------------
 * Renames FRAME METADATA on every item you currently have selected on the
 * active spread using a strict 3-part colon convention:
 *
 *      article:<ARTICLE-SLUG>:<ROLE>[.<INDEX>]
 *
 * Examples of produced names:
 *      article:sophie-lux:title
 *      article:sophie-lux:body.1
 *      article:sophie-lux:body.2
 *      article:sophie-lux:hero
 *      article:sophie-lux:gallery.1
 *      article:sophie-lux:gallery.2
 *      article:sophie-lux:logo.1
 *
 * The same convention works for ads and chrome (masthead/barcode/page
 * number/folios). Change the prefix when asked (or set it up manually in
 * the Layers panel after running):
 *
 *      ad:kf-elbow:hero
 *      ad:kf-elbow:body
 *      chrome:ybw-masthead:logo
 *
 * Why frame-NAMES not image-FILENAMES
 * -----------------------------------
 * The ybw-frontend idml-parser does NOT guess article ownership from image
 * filenames. It reads the explicit Name / Script Label attributes written
 * onto each frame in the spread XML. Renaming the FILES on disk (hours of
 * relinking) is never necessary. Renaming the FRAMES takes seconds.
 *
 * Image files can stay named 1000123111.jpg, story-library/whatever etc.
 * because the frame slug buckets them in the parser/mapper pipeline.
 *
 * Installation (one time)
 * -----------------------
 *   1. InDesign -> Window -> Utilities -> Scripts (Ctrl+Opt+F11 on Mac).
 *   2. Right-click "User" folder in the panel -> Reveal in Finder.
 *   3. Drop this file in.
 *   4. Restart InDesign OR Right-click Scripts panel -> Recompile All.
 *   5. It appears under `User/ybw-label-article-frames.jsx`.
 *
 * How to use (per article spread)
 * -------------------------------
 *   1. Open your .indd.
 *   2. Navigate to the article spread (e.g. pages 8-9 Sophie Lux cover spread,
 *      or 10-11 St Peter's continuation, etc).
 *   3. MARQUEE SELECT (click-drag empty area of spread) over EVERY frame
 *      that belongs to this ONE article — text frames (title/body), placed
 *      image frames (hero/gallery/logo), group containers, sponsor logo
 *      frames. Do NOT select frames from other articles that happen to be
 *      on the same spread (e.g. the continuation thread of the previous
 *      article on the right-hand side when you're doing the left half).
 *   4. Double-click `ybw-label-article-frames.jsx` in the Scripts panel.
 *   5. A dialog asks for the article slug. Type ONLY lowercase letters,
 *      digits, hyphens. Examples:
 *          sophie-lux
 *          st-peters-50-years
 *          fiducia-mga-new-underwriter
 *          editors-note-august-2026
 *   6. Click OK.
 *   7. The dialog shows a confirmation alert with per-role counters. Done.
 *
 * What gets written (verifiable in InDesign):
 *      - item.name       (Layers panel column "Name"; IDML `Name="..."` attr)
 *      - item.label      (Script Label field; IDML <Label KeyValuePair Key="Label" Value="...">)
 *
 * Role auto-detection (you can override afterwards by hand in the Layers
 * panel; the parser reads both name fields so manual edits work too):
 *
 *      Text frame  -> wc <= 14 words + headline style? => "title"
 *                  -> logo/url/@ pattern?              => "logo"
 *                  -> author/byline pattern?           => "author"
 *                  -> kicker/category pattern?         => "kicker"
 *                  -> otherwise                         => "body"
 *
 *      Graphic frame (placed image)
 *                  -> contains partner/logo in its old name? => "logo"
 *                  -> area > 15% of spread?            => "hero"
 *                  -> otherwise                         => "gallery"
 *
 * Nested groups are walked automatically so all members inside are tagged.
 *
 * After labeling all articles
 * ---------------------------
 *   1. (Optional) File -> Package to copy all linked graphics to a clean
 *      Links folder with a manifest (for backup / Dropbox hand-off). NOT
 *      required for correctness.
 *   2. File -> Export -> Format: InDesign CS4 or later (IDML) -> Save.
 *   3. Upload the .idml in the Admin panel as usual. The parser builds
 *      articles STRICTLY from the slug buckets — zero cross-story bleed,
 *      zero wrong-hero-on-continuation pages.
 *
 * Rollback
 * --------
 * InDesign Layers panel: select frames, change the "Name" field back to
 * empty (or any string). The parser treats names without article:/ad:/
 * chrome: prefix as legacy and runs the original heuristics, 100%
 * backward compatible.
 */

#target indesign

/*
 * NOTE: intentionally NO `#targetengine "session"`. The default main engine
 * guarantees a fresh global object on every script run — which prevents the
 * ExtendScript ES3 Object.keys() from receiving a "persistent session host
 * object" (COM-wrapped global) and throwing "Object.keys is not a function".
 * If you add targetengine session, wrap every Object.keys call below with
 * safeObjectKeys().
 */

/* ES3-safe Object.keys polyfill — some InDesign CC builds ship ES3 without
 * native Object.keys; others have native but it throws on host objects.
 * Use this for ALL key enumeration in the script. */
function safeObjectKeys(obj) {
  var result = [];
  if (obj == null) return result;
  // Try native first (fast path for plain native objects).
  try {
    if (typeof Object.keys === "function") {
      var r = Object.keys(obj);
      if (r && r.length != null && Array.prototype.push.apply) return r;
    }
  } catch (e) {
    /* native on host object -> fall back to for-in */
  }
  for (var k in obj) {
    try {
      if (Object.prototype.hasOwnProperty.call(obj, k)) result.push(k);
    } catch (e2) {
      try { result.push(k); } catch (e3) {}
    }
  }
  return result;
}

/* Force a value to be a native ES3 object. If someone passes an InDesign DOM
 * host object (which responds to `for (x in o)` but breaks Object.keys),
 * copy the enumerable props into a fresh native object. */
function toNativeObject(o) {
  if (o == null) return {};
  var t = typeof o;
  if (t === "object" && o !== null && o.constructor && o.constructor === Object) return o;
  var copy = {};
  try {
    for (var k in o) {
      try { copy[k] = o[k]; } catch (e) {}
    }
  } catch (e) {}
  return copy;
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function promptSlug() {
  try {
    var dlg = app.dialogs.add({
      name: "YBW: label article frames (frame metadata only)",
      canCancel: true,
    });
    var col = dlg.dialogColumns.add();
    col.staticTexts.add({ staticLabel: "Article slug (lowercase a-z 0-9 hyphens)." });
    col.staticTexts.add({ staticLabel: "Examples: sophie-lux, st-peters-50years, fiducia-mga-new-underwriter" });
    var col2 = dlg.dialogColumns.add();
    var tf = col2.textEditboxes.add({ editContents: "", minWidth: 340 });
    var col3 = dlg.dialogColumns.add();
    col3.staticTexts.add({ staticLabel: "Images/files are NOT renamed on disk — only frames tagged." });
    col3.staticTexts.add({ staticLabel: "Group children are walked automatically. Role detection auto-counters." });
    col3.staticTexts.add({ staticLabel: "See comments at top of jsx for ad:/chrome: prefix usage." });
    var ok = dlg.show();
    var value = tf.editContents || "";
    dlg.destroy();
    return ok ? norm(value) : "";
  } catch (e) {
    var r = prompt(
      "Article slug (a-z 0-9 hyphen only, e.g. sophie-lux):  (ad:/chrome: prefix + same convention also OK)",
      ""
    );
    return r ? norm(r) : "";
  }
}

function pageSpreadArea(item) {
  try {
    var doc = app.activeDocument;
    var w = Number(doc.documentPreferences.pageWidth);
    var h = Number(doc.documentPreferences.pageHeight);
    var facing = Boolean(doc.documentPreferences.facingPages);
    var perSpread = facing ? 2 : 1;
    if (!isFinite(w) || !isFinite(h)) return 0;
    return Number(perSpread * (w * h));
  } catch (e) {
    return 0;
  }
}

function textFrameRole(item) {
  try {
    var style = (item.appliedObjectStyle && item.appliedObjectStyle.name) || "";
    var styleL = String(style).toLowerCase();
    if (/article.?heading|cover.?title|headline|masthead|display|title/i.test(styleL)) return "title";
  } catch (e) {}
  var txt = "";
  try { txt = String(item.contents || ""); } catch (e) { txt = ""; }
  var trimmed = txt.replace(/\s+/g, " ").trim();
  var words = trimmed.split(" ").filter(function (w) { return w.length > 0; });
  var wc = words.length;
  var tl = trimmed.toLowerCase();
  if (/logo|brand|sponsor|advertiser|www\.|\.co\.uk|\.com|@[a-z0-9-]+\./i.test(tl)) return "logo";
  if (/author|byline|written\s+by|words\s+by|interview\s+by|photography\s+by/i.test(tl)) return "author";
  if (/kicker|category|section|tag|pillar/i.test(tl)) return "kicker";
  return wc <= 14 ? "title" : "body";
}

function graphicRole(item, spreadArea, itemName) {
  var n = String(itemName || "").toLowerCase();
  if (/partner|sponsor|brand|logo|advertiser|ybw\s*roundel|magazine\s*logo/i.test(n)) return "logo";
  try {
    var gb = item.geometricBounds;
    var w = gb[3] - gb[1];
    var h = gb[2] - gb[0];
    var area = Math.max(0, w * h);
    if (spreadArea && area / spreadArea > 0.15) return "hero";
  } catch (e) {}
  return "gallery";
}

function writeTags(item, namespace, slug, role, counters) {
  // ExtendScript: passing host objects down call stacks can wrap counters as a
  // COM host object. Re-coerce to native here on every call so Object.keys /
  // property increments stay safe.
  var nativeCounters = toNativeObject(counters || {});
  nativeCounters[role] = (Number(nativeCounters[role]) || 0) + 1;
  var idx = nativeCounters[role];
  // Propagate the incremented values BACK onto the caller's counters reference,
  // so the outer main() sees the totals.
  if (counters) {
    try {
      for (var k in nativeCounters) {
        try { counters[k] = nativeCounters[k]; } catch (e) {}
      }
    } catch (e) {}
  }
  var tag = namespace + ":" + slug + ":" + role + (idx > 1 ? "." + idx : "");
  try { item.name = tag; } catch (e) {}
  try { item.label = tag; } catch (e) {}
  try {
    if (item.graphics && item.graphics.length > 0) {
      for (var g = 0; g < item.graphics.length; g++) {
        try { item.graphics[g].label = tag; } catch (e2) {}
      }
    }
  } catch (e) {}
}

function walk(item, depth, namespace, slug, counters, spreadArea) {
  if (!item || !item.isValid) return;
  try {
    var cname = String(item.constructor.name);
    if (cname === "TextFrame") {
      var role = textFrameRole(item);
      writeTags(item, namespace, slug, role, counters);
      return;
    }
    var hasGraphic = false;
    try { hasGraphic = !!(item.graphics && item.graphics.length > 0); } catch (e) { hasGraphic = false; }
    if (cname === "Rectangle" || cname === "Oval" || cname === "Polygon" || hasGraphic) {
      var gr = graphicRole(item, spreadArea, (item.name || item.label || ""));
      writeTags(item, namespace, slug, gr, counters);
      return;
    }
    if (cname === "Group") {
      // Label container also? Skip container; only label children. Children walk next.
      try {
        for (var i = 0; i < item.pageItems.length; i++) {
          walk(item.pageItems[i], depth + 1, namespace, slug, counters, spreadArea);
        }
      } catch (e) {}
      return;
    }
    // Multi-State Objects, Buttons, ButtonsAndForms, etc. — safe no-op
  } catch (e) {}
}

function main() {
  if (!app.documents.length) {
    alert("No open InDesign document. Open your .indd first.");
    return;
  }
  var sel = app.selection || [];
  if (!sel.length) {
    alert(
      "Select frames first (marquee drag over ALL frames of ONE article on this spread, " +
      "text + graphics + group containers). Then re-run the script."
    );
    return;
  }
  var slug = promptSlug();
  if (!slug) {
    alert("Cancelled (empty slug). Nothing was changed.");
    return;
  }
  var namespace = "article";
  if (/^ad:|^chrome:/.test(slug)) {
    // Allow user to pass full prefix:slug if they want, split it.
    var idxColon = slug.indexOf(":");
    namespace = slug.slice(0, idxColon);
    slug = norm(slug.slice(idxColon + 1));
    if (!slug) { alert("Empty slug after prefix. Nothing changed."); return; }
  }

  var counters = toNativeObject({
    title: 0, body: 0, kicker: 0, author: 0, logo: 0,
    hero: 0, gallery: 0, pdf: 0
  });
  var spreadArea = pageSpreadArea(app.activeDocument);
  var total = 0;
  for (var i = 0; i < sel.length; i++) {
    walk(sel[i], 0, namespace, slug, counters, spreadArea);
    total++;
  }

  // Re-coerce counters ONE MORE TIME before the summary alert just in case
  // any host-object wrapping survived the nested walk() call stack.
  var nativeCounters = toNativeObject(counters);
  var lines = [];
  lines.push("Tagged frames (top-level selection count): " + total);
  lines.push("Namespace:  [" + namespace + "]");
  lines.push("Slug:       [" + slug + "]");
  lines.push("Role counters:");
  var counterKeys = safeObjectKeys(nativeCounters);
  for (var kIdx = 0; kIdx < counterKeys.length; kIdx++) {
    var key = counterKeys[kIdx];
    var count = Number(nativeCounters[key]);
    if (count > 0) lines.push("  " + key + " -> " + count);
  }
  lines.push("");
  lines.push("Manual overrides: change frame Name (Layers panel) / Script Label to article:<slug>:<role>.<idx>");
  lines.push("Ad pages:  prefix `ad:<client>:<role>`    Chrome (masthead/pageno):  prefix `chrome:<name>:<role>`");
  alert(lines.join("\n"));
}

try {
  // Sanity self-test: make sure our safe polyfill is actually callable and
  // works on a plain native object before calling main(). If this still
  // throws on YOUR InDesign build, your ExtendScript engine is in a weird
  // persistent state → restart InDesign (Option key on splash → Reset
  // Preferences) fixes it.
  var _selfTest = safeObjectKeys({ a: 1, b: 2 });
  if (!_selfTest || _selfTest.length !== 2) {
    throw new Error("Safe Object.keys self-test failed. Restart InDesign (Option on splash → Reset Preferences) and try again.");
  }
  main();
} catch (e) {
  var msg = String(e.message || e);
  if (/object\.keys/i.test(msg) || /keys is not a function/i.test(msg)) {
    alert(
      "InDesign Engine Error: Object.keys is unavailable right now.\n\n" +
      "Fix:\n" +
      "1. Close InDesign completely.\n" +
      "2. Launch InDesign while HOLDING DOWN Ctrl+Opt+Cmd+Shift (Mac) OR Ctrl+Alt+Shift (Windows) until you see 'Delete InDesign Preferences?' → click Yes.\n" +
      "3. Open your .indd and re-run this script.\n\n" +
      "If it still fails after reset prefs, copy the latest jsx from scripts/ in ybw-frontend again (Overwrite old copy)."
    );
  } else {
    alert("YBW label script error:\n" + msg);
  }
}
