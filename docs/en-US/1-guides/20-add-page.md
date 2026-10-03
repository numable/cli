<!-- translated-from: zh-CN/1-guides/20-add-page.md sha256:62ede19a0aa8 -->

# add-page — add a detail page to an existing widget

> Audience: people building a tool, and the AI working on their behalf. Both read this same page.

## Goal

Give "tapping the widget" somewhere to go: the widget carries only the conclusion you can read at a glance, the details live on a page inside the package. After this chapter your package gains:

- `page/router.json`, a route table (home page + detail page);
- one detail page (**html** or **xpage**, pick one);
- an `events.onClick` on the widget's `.xwidget` that navigates there carrying that widget's parameters.

How to choose between the two routes:

| | html page | xpage page |
|---|---|---|
| What you write | HTML + CSS + JS; data comes through `xbridge.runDataFlow` | JSON declaring containers and Canvases; data comes through each node's `depends` |
| Good for | Long text, tables, rich interaction, scrolling detail views | Blocks drawn with the same drawing system as the widget, no WebView |
| Cost | You handle theme, language and the top inset yourself | Layout is bounded by what RCN can draw (see `numable docs rcn`) |

When in doubt start with html: it puts no limits on layout, and writing parameters back (`numable docs add-interaction`) works there out of the box.

## Prerequisites

- The package already has one working widget (if not, do `numable docs first-card` first);
- The widget's `.df` already exposes the keys you want to show on the page (`numable run <package> --flow <widget> --full` shows them);
- You know what this widget's instance parameters are called (the `params` in `.xwidget`) — the detail page needs them to know *which one* was tapped.

---

## Route A: an html detail page

### Step 1 · Create the route table

**What to do**: create `page/router.json`. **The home route is always `"path": "/"`, and it goes first** — some platforms find the home page by an exact `path == "/"` match, others take the first entry, so honouring both rules at once is the only way to be consistent everywhere.

```json
{
  "routes": [
    { "path": "/", "entry": "html/home/index.html" },
    {
      "path": "/detail",
      "entry": "html/detail/index.html",
      "title": "个股详情",
      "i18n": { "en-US": { "title": "Stock detail" } }
    }
  ]
}
```

Field by field:

| Field | Required | Notes |
|---|---|---|
| `path` | ✓ | Starts with `/`, **no path parameters**; pass values as query (`/detail?secid=1.600519`) |
| `entry` | ✓ | For html / xpage pages, **relative to `page/`** (`html/detail/index.html`); a form page is relative to the package root and carries its own `page/` prefix |
| `type` | | `html` (default) / `xpage` / `form`; any unknown value is treated as html |
| `title` | | The bare field is in the `manifest.lang` language; translations hang off a sibling `i18n` (see `numable docs i18n`) |
| `present` | | `page` (default) / `sheet` |

The container **does not draw a title bar** at the top — only a floating ‹ / ··· / ✕ pill; `title` is used by the back stack and in external listings. Do not expect it to reserve space for you: making room is the page's own job (step 2).

**Command**

```
numable check <package>
```

**What "correct" looks like**: no errors related to `router.json` (a wrong path or a JSON syntax error surfaces as G0 / G12).

### Step 2 · Write the page

**What to do**: create `page/html/detail/index.html`. What follows is the minimal usable template; none of the four required pieces can be skipped.

```html
<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Detail</title>
<style>
/* The inset values are injected by the container; keep a 0 fallback so the page
   does not collapse when previewed in a plain browser */
:root{ --xb-content-top:0px; --xb-content-bottom:0px;
       --bg:#F5F6F8; --card:#FFFFFF; --fg:#0E1116; --sub:#6B7280; }
html[data-theme="dark"]{ --bg:#0B0C0E; --card:#15171A; --fg:#F3F4F6; --sub:#8E939B; }
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
  font:14px/1.5 -apple-system,system-ui,"Segoe UI",Roboto,sans-serif;
  /* Container chrome floats above the content: read --xb-content-top for the top
     inset, or the pill sits on top of your first row */
  padding:calc(var(--xb-content-top) + 16px) 16px calc(var(--xb-content-bottom) + 16px)}
h1{font-size:20px;margin:0 0 10px}
.card{background:var(--card);border-radius:16px;padding:14px;margin-top:12px}
.k{color:var(--sub);font-size:12px}
.v{font-size:22px;font-weight:700;margin-top:2px}
.state{color:var(--sub);padding:24px 0;text-align:center}
</style></head>
<body>
<h1 id="name">--</h1>
<div class="card"><div class="k">Price</div><div class="v" id="px">--</div></div>
<div id="err" class="state" hidden></div>

<script>
/* 1. Read parameters from the query — the ${secid} in the widget's onClick string
      was resolved at the moment of navigation */
var q = new URLSearchParams(location.search);
var secid = q.get("secid") || "1.600519";

/* 2. The bridge is not ready synchronously: poll for it, and render a non-empty
      fallback screen if it never shows up */
async function ready(){
  for (var i=0;i<24 && !window.xbridge;i++) await new Promise(function(r){setTimeout(r,50)});
  return !!(window.xbridge && xbridge.isXBundleEnv());
}

/* 3. Fetching data must go through the bridge — fetch / XMLHttpRequest in the page are
      welded shut by the container's CSP (connect-src 'none'): no network error is raised,
      the call simply never returns. runDataFlow("quote") looks for page/flow/quote.df
      (the file extension has to match) */
async function load(){
  var r = await xbridge.runDataFlow("quote", { secid: secid }, 30000);
  /* The bridge resolves an envelope {code,msg,data}: code === 0 is success, and the keys the flow's resultFilter exposes are in data.
     A failure does not reject; it is a non-zero code (a timeout is -2), so check it yourself */
  if (!r || r.code !== 0) throw new Error((r && r.msg) || "bridge error");
  var d = r.data || {};
  if (!d.name && !d.price) throw new Error("empty");
  return d;
}

(async function boot(){
  if (!(await ready())) { document.getElementById("err").hidden = false;
    document.getElementById("err").textContent = "Please open this in Numable"; return; }

  /* 4. Theme and language are injected by the host: data-theme=light|dark and
        data-lang=<language code> are on the root element before the page starts loading —
        CSS can just use html[data-theme="dark"], you never set it yourself.
        Switching does not reload the page, it only dispatches themechange /
        languagechange; listen only if you repaint from JS */
  window.addEventListener("themechange", function(e){ /* e.detail.theme = "light"|"dark" */ });
  var info = await xbridge.appInfo();          // forget the await and you get a Promise object
  var app = (info && info.data) || {};         // as above: the result is in data
  var lang = String(app.language || "en").toLowerCase();

  try {
    var data = await load();
    document.getElementById("name").textContent = data.name || "--";
    document.getElementById("px").textContent = data.price || "--";
  } catch (e) {
    document.getElementById("err").hidden = false;
    document.getElementById("err").textContent = "Fetch failed · " + e.message;
  }
})();
</script>
</body></html>
```

Four things you must do; skip any of them and you get the same result everywhere: nothing is reported, it is just wrong.

| Must do | Symptom if you skip it | How to check |
|---|---|---|
| `padding-top` reads `var(--xb-content-top)` | The first row is covered by the container pill and its buttons cannot be tapped | Manual review (open the page and look at the top) |
| Data goes through `xbridge.runDataFlow` / `runActionFlow` | The `fetch` promise never resolves and the page is stuck on its skeleton | Manual review / the page console |
| The flow extension matches the method: `runDataFlow` only searches `.df`, `runFlow` / `runActionFlow` only search `.af` | The app returns `-6 flow not found` and the page shows "failed to load" | `check` G12b |
| Dark mode uses the `html[data-theme="dark"]` selector | The page cannot follow the app's light/dark setting (most visible when the app is locked to light while the system is dark) | Manual review |

Two more that are easy to forget:

- Any `input` / `select` / `textarea` in the page must have `font-size` **≥ 16px**, otherwise iOS zooms the whole page on focus — `check` G15 catches this (E).
- Do not use `window.alert` / `window.confirm`; they escape the container. Use `xbridge.alert` / `xbridge.confirm` (the full bridge table is in `numable docs bridge`).

**Command**

```
numable check <package>
```

**What "correct" looks like**: no `G12b` `-6 flow not found` style errors, and no G15 font-size error.

### Step 3 · Wire up the widget's onClick

**What to do**: write a navigation string into `events` in the `.xwidget`. If the value resolves to a **string** it is navigation; if it resolves to a structure (`@[file://...af]` or an inline object) it runs an action flow.

```json
{
  "version": 2,
  "title": "Stock",
  "sub": "Price · two-month shape",
  "layout": 22,
  "params": { "secid": "1.600519" },
  "events": {
    "onClick": "/detail?secid=${secid}"
  },
  "canvas": {
    "source": "@[file://rc/quote.rcn]",
    "depends": [
      { "flow": "@[file://flow/quote.df]", "params": { "secid": "${secid}" } }
    ]
  }
}
```

Three forms of navigation string:

| Form | Where it goes |
|---|---|
| `"/detail?secid=${secid}"` | This route in this package |
| `"numable://self"` | This package's home page (`/`) |
| `"numable://self/page/detail?secid=${secid}"` | This route in this package; equivalent to the first form |

The `${...}` in the string is resolved at the moment of navigation. Scopes, lowest to highest: shell parameters ⊕ this widget's instance parameters ⊕ this package's `data.*` ⊕ the results of `depends`. **Only top-level scalars** — do not expect nested lookups like `${obj.field}` to work.

**Command**

```
numable check <package>
```

**What "correct" looks like**: if you write `numable://self/page/<x>` and `router.json` has no `/x`, G12 reports that "the app will show 'page not found'"; the absence of that error means the route matches. ⚠️ The relative form (`/detail?...`) **is not part of what G12 inspects** — it only looks up `numable://` forms in the table, so a typo in a relative route name is not caught. Either check it against `router.json` yourself, or switch to the `numable://self/page/detail` form and let the static check do the lookup for you.

### Step 4 · See the result

First make sure the page's flow gets its data, then render the page and look at it: `numable render <package> --page` produces light and dark full-page screenshots at phone width, and the page's `runDataFlow` calls go through the same allowlist and fixtures as `run` (details in `numable docs page`).

```
numable check <package>
numable run <package>            # page/flow/*.df used by pages runs for real too, with inputs from .numable/params/<flow>.json
numable render <package> --page /detail?secid=1.600519
```

**What "correct" looks like**: `run` prints `✓ page/quote {...}` for the page's flow, and the key names match the fields the page's JS reads; in the `render --page` output the `runDataFlow("quote")` line is `✓`, and both `.numable/render/page-detail-*.png` images show the data with nothing at the top hidden under the capsule in the top-right corner.

---

## Route B: an xpage detail page

An xpage is "RCN at page scale": no WebView, the page is declared out of containers plus Canvas nodes, each Canvas referencing one `.rcn` and using the same drawing system as the widget.

### Step 1 · Declare the page type in the route

```json
{
  "routes": [
    { "path": "/", "entry": "html/home/index.html" },
    { "path": "/detail", "type": "xpage", "entry": "xpage/detail.xpage", "title": "Detail" }
  ]
}
```

`type` must say `xpage`; leave it out and the client treats the entry as html and tries to load a web page that does not exist.

### Step 2 · Write a minimal xpage

**What to do**: create `page/xpage/detail.xpage`.

```json
{
  "type": "page",
  "id": "demo-detail",
  "root": {
    "type": "container",
    "id": "root",
    "layout": "list",
    "direction": "vertical",
    "gap": "12pt",
    "padding": "16pt",
    "paddingTop": "${@contentInset.top}pt",
    "paddingBottom": "24pt",
    "depends": [
      { "flow": "@[file://page/flow/quote.df]", "params": { "secid": "${secid}" } }
    ],
    "items": [
      {
        "type": "Canvas",
        "id": "hero",
        "h": "120pt",
        "canvas": { "source": "@[file://page/rc/p-hero.rcn]" }
      },
      {
        "type": "Canvas",
        "id": "stats",
        "h": "96pt",
        "canvas": { "source": "@[file://page/rc/p-stats.rcn]" }
      }
    ]
  }
}
```

Five hard requirements:

| Requirement | Symptom if you skip it | How to check |
|---|---|---|
| The root container's `paddingTop` must reference `${@contentInset.top}` | The top is covered by the container pill, and no platform complains | `check` G17 (E) |
| The root must not be `layout: "pager"` | The pager branch ignores `padding` on every platform, so the inset you wrote does nothing | `check` G17 (E) |
| Write `depends` as a `{flow, params}` object and list every parameter explicitly | A bare string passes empty inputs: the page renders a wall of `--` while the flow still reports success | `check` G12c (E) |
| For keys that come from the route query (`secid` here), **do not add a same-named `params` fallback on the root node** | Node params outrank the route query, so every widget opens the same content, with no error | Manual review (tap two widgets with different parameters) |
| `@[file://...]` inside `.xpage` and `page/rc/*.rcn` **resolves from the package root** | It resolves to nothing → no fetch is issued, the Canvas draws nothing, and nothing is reported | Manual review (write the full `page/` prefix) |

For contrast: references inside `.xwidget` and `xWidget/rc/*.rcn` resolve from `xWidget/` (you write `@[file://flow/quote.df]`), while page-side references resolve from the package root (you write `@[file://page/flow/quote.df]`). Swapping the two bases is the most common cause of "nothing happened at all".

Container `layout` options: `absolute` `stack` `flex` `flow` `list` `pager` `grid` `waterfall`; the only leaf nodes are `Canvas` and `input`. A node's `depends` takes a `.df` (data flow) and its `events` take an `.af` (action flow). The full protocol is in `numable docs page`.

### Step 3 · Node-level copy uses the page table, in-widget copy uses the rc table

`${@i18n.x}` at the xpage node level (`params` / `props.text` / `menu[].label`) reads **this page's top-level `i18n` table**; keys defined in a `.rcn` table are not visible there, and a missing key renders as blank (`numable check` G35 catches this). Copy drawn inside a Canvas still lives in each block's own `rc.i18n` table inside its `.rcn` (see `numable docs i18n`).

### Step 4 · Verify

```
numable check <package>
numable run <package> --flow quote --full
```

**What "correct" looks like**: `check` reports no G17 / G12c errors, and the keys the page's flow exposes in `run` match the keys the two `.rcn` files reference with `${...}`. Render the page layout with `numable render <package> --page` and look at it.

---

## Common mistakes

| Symptom | Most likely cause | What to do first |
|---|---|---|
| Tapping the widget says "page not found" | `router.json` has no such path, or the path is misspelled | Check the onClick string against `router.json`; rewrite it as `numable://self/page/<x>` so G12 does the lookup |
| Tapping the widget opens a **blank page** with no error | You wrote `onEdit` in the `numable://` form (it matches paths literally and only accepts a bare `/edit`) | Use a bare path for `onEdit`, see `numable docs add-interaction` |
| The first row of the page is covered by the pill | The html page is missing `var(--xb-content-top)`, or the xpage is missing `${@contentInset.top}pt` | Add the inset; for xpage, `check` G17 catches it |
| The page is stuck on the skeleton forever, with no network error in the console | The page used `fetch` / `XHR` | Switch to `xbridge.runDataFlow` |
| The page shows "failed to load (-6)" | The flow extension and the method are mismatched: `runDataFlow` only searches `.df`, `runFlow` only searches `.af` | Rename the file or change the method; `check` G12b reports it |
| Every field on the detail page is `--` | The flow's inputs never arrived (`depends` written as a bare string, or the query key does not match the flow's) | Run `numable run <package> --flow <flow> --full` on its own and look at the keys |
| Two different widgets open the same content | The xpage root node has a `params` fallback with the same name as the route query | Delete the fallback on the root |
| Tapping a search box zooms the whole page on iOS | The input control's font size is < 16px | Set `font-size:16px` explicitly; `check` G15 catches it |
| The page does not follow the app's light/dark setting | The page used `prefers-color-scheme` | Switch to the `html[data-theme="dark"]` selector |

## Next

- Let the page edit widget parameters and collect forms: `numable docs add-interaction`
- The full rules for routes, page types and the three presentation modes: `numable docs page`
- The complete list of bridge methods available to an H5 page: `numable docs bridge`
