<!-- translated-from: zh-CN/2-reference/60-page.md sha256:cabb518a8c92 -->

# page — pages (router.json / html / xpage / xform)

> Audience: people building a source (an XBundle package), and the AI working on their behalf. Both read the same document.

## What it is

`page/` is the layer you tap into. A widget declaration (`.xwidget`) is a single static screen; tapping it — or long-pressing it and choosing "Edit parameters" — opens one of the pages under `page/`. A package may have no `page/` at all (home-screen widgets only), but as soon as a widget's `events.onClick` points at `numable://self/page/...`, that route must exist in `page/router.json`, or the app shows "page not found".

There are three kinds of page, chosen by the `type` of the route in `router.json`:

- **html** (default): offline HTML running in the container's WebView / iframe. Best for lists, forms and management screens — anything faster to write with the DOM. The network is sealed off; data can only come through `window.xbridge` (see `numable docs bridge`).
- **xpage**: the whole page drawn declaratively with RCN — one page is one JSON node tree. Best for detail and chart pages that share the visual language of the widgets.
- **form**: an `.xform` file, rendered by the platform's form component, which hands back one object. Best for settings screens that just collect a few values.

The three kinds are dispatched by an allowlist: a missing or unrecognized `type` is treated as html. So a typo in `type` (say `"xform"`) raises no error — you just get a blank page, and a wrong render is harder to track down than an error.

The container carries its own permanently floating chrome pill (‹ and ···|✕). It does **not** reserve space for the page; every page has to make room for the container chrome (top inset) itself. This is the most common silent failure at the page layer.

## Minimal working example

`page/router.json` (the one `numable init` generates, with a second route added):

```json
{
  "routes": [
    {
      "path": "/",
      "entry": "html/home/index.html",
      "title": "我的信息源",
      "i18n": { "en-US": { "title": "My Source" } }
    },
    {
      "path": "/detail",
      "entry": "html/detail/index.html",
      "title": "详情",
      "i18n": { "en-US": { "title": "Detail" } }
    }
  ]
}
```

## Folder layout

```
page/
  router.json                  # route table, always directly under page/
  html/<route>/index.html      # html page
  xpage/<name>.xpage           # xpage page
  form/<name>.xform            # form page
  rc/<name>.rcn                # RCN drawings used by pages
  flow/<name>.df | <name>.af   # data flows / action flows used by pages
  assets/…                     # page images and other assets
```

Fixed convention: a flow called from a page is always looked up at `page/flow/<name>.<ext>` (`runDataFlow` only searches `.df`; `runFlow` / `runActionFlow` only search `.af`). `page/html/<route>/page.json` is a legacy format that no longer exists — if it appears in the package, `check` reports G1.

## router.json field by field

| Field | Required | Type | Values / one thing to watch |
|---|---|---|---|
| `routes` | ✓ | array | The route table. **The home page is always `"path": "/"` and comes first** — some platforms find the home page by `path == "/"`, others take the first entry; satisfy both and it agrees everywhere |
| `routes[].path` | ✓ | string | Starts with `/`. **No path parameters** — pass values in the query (`/detail?secid=1.600519`) |
| `routes[].entry` | ✓ (unless only `remote` is used) | string | **The base differs per page kind, and getting it wrong means a blank page**: `html` / `xpage` are relative to `page/` (`"html/home/index.html"`, `"xpage/home.xpage"`); `form` is relative to the package root and **carries its own `page/` prefix** (`"page/form/pick.xform"`) |
| `routes[].type` | optional | `html` \| `xpage` \| `form` | Defaults to `html`; unknown values are also treated as html. There is no fourth value |
| `routes[].title` | optional | string | The title, and part of the **metadata table (B)**: the bare field is the `manifest.lang` locale, translations hang off `routes[].i18n`. It is not evaluated — write `${...}` and it shows up verbatim |
| `routes[].i18n` | optional | `{locale:{title}}` | See `numable docs i18n` |
| `routes[].present` | optional | `page` (default) \| `sheet` | `sheet` = presented as a bottom-anchored widget. Only affects how this route lands when opened via `numable://` |
| `routes[].remote` | optional | https URL | Marks this route as a **remote page declared by the package**; may coexist with `entry` as a fallback |
| top-level `fallback` | optional | https URL | The remote page loaded when a path that does **not** exist is requested. Omit it and the app reports "page not found" |

**Do not write `navStyle`.** The container chrome is always a floating pill and never draws a title bar, so the field has no effect.

One line of example for each of the last three fields:

```json
{
  "routes": [
    { "path": "/", "entry": "html/home/index.html", "title": "Home" },
    { "path": "/pick", "type": "xpage", "entry": "xpage/pick.xpage", "title": "Pick", "present": "sheet" },
    { "path": "/rank", "remote": "https://example.com/rank", "title": "Ranking" }
  ],
  "fallback": "https://example.com/404"
}
```

- `present` **has exactly two settings, `page` (default) and `sheet`**. It is a **different concept** from the `container` of `startPageForResult`: that one has three settings, `page` / `sheet` / `dialog`, and describes "open a page mid-flow to ask something". **`dialog` is not recognized on a route**; if you want the dialog shape, go through `startPageForResult` (see `numable docs af`).
- `remote` is this route's remote page and may coexist with `entry` as a fallback; the top-level `fallback` covers "a path that does not exist was requested".
- The domains of both fields have to be listed in `manifest.network` or the request never leaves (`check` G3). They are pages the package **declares as its own**, so they still push onto the container stack and still carry the `···` menu — the one exception to the rule that external links are handed to the system browser.

Title precedence: `routes[].title` > a title carried in the query > `manifest.title`. A page cannot change it at runtime — the container chrome is always a floating pill and never draws a title bar.

## The three page kinds

### html pages

A minimal template (`page/html/home/index.html`, the home page `numable init` generates with theme, language and data fetching filled in):

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>My Source</title>
<style>
  /* The container injects these two variables; in a browser they fall back to 0, so local preview does not collapse */
  :root { --xb-content-top: 0px; --xb-content-bottom: 0px; }
  body {
    margin: 0;
    font: 15px/1.5 -apple-system, system-ui, sans-serif;
    color: #1c1c1e; background: #f5f6f8;
    /* Make room top and bottom: the chrome pill floats above the content, so the page lays itself out below it */
    padding: calc(var(--xb-content-top) + 16px) 16px calc(var(--xb-content-bottom) + 16px);
  }
  /* Light and dark: the container sets data-theme on <html>, and switching does not reload the page */
  [data-theme="dark"] body { color: #f3f4f6; background: #0b0c0e; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  input, select, textarea { font-size: 16px; }   /* below 16px, iOS zooms the whole page on focus */
</style>
</head>
<body>
  <h1>My Source</h1>
  <p id="out">Loading…</p>
<script>
  // Language: the container sets data-lang on <html> and dispatches languagechange on switch (no reload)
  const lang = () => document.documentElement.getAttribute("data-lang") || "zh-CN";
  addEventListener("languagechange", render);
  addEventListener("themechange", render);

  // Route query: just read location.search
  const q = new URLSearchParams(location.search);

  // Call-type bridge methods resolve an envelope { code, msg, data } (they never reject); the result is in data
  async function call(p) {
    const r = await p;
    if (!r || r.code !== 0) throw new Error((r && r.msg) || "bridge error");
    return r.data;
  }

  async function render() {
    // Network only through the bridge. fetch / XMLHttpRequest inside the page are sealed off by the container CSP (connect-src 'none').
    const data = await call(xbridge.runDataFlow("home", { id: q.get("id") || "" }));
    document.getElementById("out").textContent =
      lang().startsWith("zh") ? `共 ${data.count} 条` : `${data.count} items`;
  }
  render();
</script>
</body>
</html>
```

Four things you have to know:

1. **Making room**: `--xb-content-top` / `--xb-content-bottom` / `--xb-safe-bottom` are injected by the container; ignore them and the pill sits on top of your header, with no error on any platform.
2. **Theme**: write a `[data-theme="dark"]` selector, **not `prefers-color-scheme`** — the page lives in an iframe/WebView, that media query follows the host system, and switching the theme inside the app cannot move it.
3. **Language**: read `document.documentElement.dataset.lang`; a switch only dispatches `languagechange` and does not reload the page, so text rendering has to be re-runnable.
4. **Network**: direct `fetch` / `XHR` are sealed off by CSP (images are the exception). Data always goes through `xbridge.runDataFlow("<flow name>", params)`, side effects through `xbridge.runActionFlow` / `runFlow`; they resolve an envelope `{ code, msg, data }` with the result in `data` (the `call()` above). Full method list in `numable docs bridge`.

Query parameters come from `location.search`, exactly as on an ordinary web page.

The template above uses only one method, the fetch. Here are the other frequent ones (the full table and the semantic rules are in `numable docs bridge`):

```html
<script>
  // Let the user change one value: the whole config is the single-value config, and the value comes back at r.value.value (call() is in the template above)
  async function editCity() {
    const r = await call(xbridge.singleValue({
      title: "City",
      container: "sheet",
      component: { type: "select", value: "sh", props: { items: [{ label: "Shanghai", value: "sh" }] } }
    }));
    if (!r || r.cancelled) return;
    await call(xbridge.setData("city", r.value.value));      // strings only, and the namespace is always this package
    xbridge.toast("Saved", "success");
  }

  // Change the parameters of a widget already on the dashboard: merged key by key, scalars only, null deletes a key
  async function retitle(brickId) {
    await call(xbridge.updateParams(brickId, { title: "Watchlist", days: "30" }));
    await call(xbridge.refreshWidget());                      // fetch again right away, or the widget keeps its old drawing
  }

  // Navigate inside the package, and hand a result back as a child page
  function openDetail(id) { xbridge.route("numable://self/page/detail?id=" + encodeURIComponent(id)); }
  function submit(v) { xbridge.setResult({ picked: v }); xbridge.closePage(); }

  // Show a spinner for a slow action, and make sure hideLoading runs on every branch
  async function sync() {
    xbridge.showLoading("Syncing…");
    try { await call(xbridge.runActionFlow("sync")); } finally { xbridge.hideLoading(); }
  }
</script>
```

### xpage pages

A whole page is declared as one JSON node tree, drawn the same way as a widget and by the same render core. The shell has just three required keys, `{type:"page", id, root}` (plus an optional `i18n`); `root` is the container, and it carries the page-level `depends` (fetching, wired to a `.df`) and `events` (interaction, wired to an `.af`); a container's `layout` is one of eight, and there are only two leaves, `Canvas` and `input`; `@[file://…]` resolves against the **package root**, so write the full `page/flow/x.df`.

```json
{
  "type": "page",
  "id": "demo-home",
  "root": {
    "type": "container",
    "id": "root",
    "layout": "list",
    "direction": "vertical",
    "padding": "12pt",
    "gap": "12pt",
    "paddingTop": "${@contentInset.top}pt",
    "paddingBottom": "${@contentInset.bottom}pt",
    "depends": [{ "flow": "@[file://page/flow/home.df]", "params": {} }],
    "items": [
      {
        "type": "Canvas",
        "id": "hero",
        "h": "56pt",
        "canvas": { "source": "@[file://page/rc/hero.rcn]" }
      }
    ]
  }
}
```

The fields of each of the eight `layout` values, the page scopes (`params` / `state` / `data`), event timing, `visible`, the `input` node, and a set of fields that look useful but do nothing, are all in `numable docs xpage`. Writing data flows is in `numable docs df`; the full action table in `numable docs af`; adding a page from scratch in `numable docs add-page`.

### form pages

`.xform` is the page kind for "I just need a few values": you declare the fields, the platform renders them, and on submit it hands `{ fieldName: value }` to the `.af` that `onSubmit` points at.

```json
{
  "type": "form",
  "id": "pick-city",
  "title": "Choose a city",
  "confirmTxt": "Save",
  "onSubmit": "@[file://page/flow/save-city.af]",
  "form": {
    "city": {
      "title": "City",
      "required": "true",
      "component": {
        "type": "select",
        "value": "sh",
        "props": { "items": [{ "label": "Shanghai", "value": "sh" }, { "label": "Beijing", "value": "bj" }] }
      }
    }
  }
}
```

Key points: field order = declaration order, and the keys are the result keys; **do not write `container`** (the presentation is the container's call); values are only `string` and `string[]`, so booleans are strings. The 14 component types, their `props` field by field, and how the data-driven components (`searchSelect` / `dynamicCascader`) hook up to a `.df` are in `numable docs params`.

## The source poster banner.xbanner

`banner.xbanner` is not a page: it is the 16:9 face your package shows in the source list. It sits at the **package root** (next to `logo.png`) and is **optional** — leave it out and the system default template is used (a solid ground plus the logo or first letter and the package name); write one and the whole thing is yours to draw.

It is a self-contained single file — inline RCN, inline flow, referencing nothing under `xWidget/` or `page/`:

```json
{
  "version": 1,
  "id": "banner",
  "ratio": "16:9",
  "theme": "auto",
  "scene": { "width": 338, "height": 190, "corner": 18 },
  "rcn": {
    "rc": {
      "cells": [
        { "id": "bg", "type": "layer", "x": "0pt", "y": "0pt", "w": "{parent.w}", "h": "{parent.h}", "bgColor": "#8E1F27|#8E1F27" },
        { "id": "t", "type": "txt", "x": "24pt", "y": "114pt", "w": "-1", "h": "-1", "text": "${@i18n.t}", "fontSize": "20pt", "typeface": "System-Bold", "textColor": "#FFFFFF|#FFFFFF", "maxLines": "1", "maxWidth": "290pt" },
        { "id": "s", "type": "txt", "x": "24pt", "y": "{t.b}+6pt", "w": "-1", "h": "-1", "text": "${@i18n.s}", "fontSize": "12pt", "textColor": "#B8FFFFFF|#B8FFFFFF", "maxLines": "1", "maxWidth": "290pt" }
      ],
      "i18n": {
        "zh-CN": { "t": "股票行情", "s": "A股 · 美股 · 港股" },
        "en-US": { "t": "Stocks", "s": "CN · US · HK markets" }
      }
    }
  },
  "flow": { "actions": [] },
  "params": {}
}
```

| Key | Required | Notes |
|---|---|---|
| `scene` | ✓ | `{width, height, corner}`. **It must be written** — this is the biggest difference from a `.rcn`: a `.rcn` gets its canvas size from the host's size class, and a poster has no size class to lean on, so without it nothing is drawn |
| `rcn.rc.cells` | ✓ | Inline RCN, drawn exactly like a `.rcn` (`numable docs rcn`) |
| `rcn.rc.i18n` | | This poster's own word table; `${@i18n.key}` looks here |
| `flow.actions` | | An inline fetch flow with **data-flow semantics** (the same restricted set of actions as a `.df`, so no UI). Write `[]` if there is nothing to fetch |
| `params` | | The inputs handed to `flow` |
| `version` / `id` / `ratio` / `theme` | | Fixed: `1` / `"banner"` / `"16:9"` / `"auto"` |

Three easy ways to trip:

- ⚠️ **A custom poster does not receive the package metadata.** The `${meta.title}` / `${meta.color}` injections belong to the system default template only; written in your own poster they **silently render empty**. Put the title and subtitle text into `rcn.rc.i18n` yourself, in both languages.
- ⚠️ **The localization gates of `numable check` do not reach this file**, so nothing stops you from omitting a locale — you only find out when switching to it turns the poster blank. Write both locales and proof-read them yourself.
- A pure brand image is the least work: leave `flow.actions` empty and there is no failure state and no loading skeleton, so the list always has an image.

## Long-press menus on nodes

A menu is **not** a page kind, and no menu file is written in a package. To give an xpage node a long-press menu, put a `menu` array on that node:

```json
{
  "type": "Canvas",
  "id": "card",
  "h": "120pt",
  "canvas": { "source": "@[file://page/rc/card.rcn]" },
  "menu": [
    { "label": "Add a cup", "icon": "@[file://icons/plus.png]", "flow": "@[file://page/flow/inc.af]" },
    { "label": "Reset to zero", "role": "destructive", "flow": "@[file://page/flow/zero.af]" }
  ]
}
```

| Field | Notes |
|---|---|
| `label` | The item's text; may contain `${...}` / `${@i18n.key}` |
| `icon` | Optional, `@[file://…]` to an image inside the package (base = package root) |
| `role` | Optional; `destructive` = red, dangerous item |
| `flow` | The `.af` run when the item is picked; an inline action array also works |

On the same node, `longClick` wins over `menu` — write `longClick` and `menu` will never appear.

## Navigation and external links

Navigation inside the package uses deeplinks:

| Form | Where it lands |
|---|---|
| `numable://self` | This package's home page (**the only way to reach the home page** — `numable://self/page/home` does not work) |
| `numable://self/page/detail?id=${id}` | This package's `/detail` route; only top-level scalars can be interpolated into the query |
| `numable://app/mine?section=credentials` | The app's credential management screen (a package that needs credentials must offer this direct entry) |

When a widget opens a page other than the home page, the container **pushes the home page as the stack root first**, then the target page — so pressing ‹ takes the user back to the package's home page rather than closing everything. You do not implement this yourself, but design pages assuming there is a home page underneath.

**External links (http/https) always open in the system browser or a standalone external-page shell**, never inside the package's container stack: they are not the package's pages and the package cannot control them. The only exception is a `remote` route or a top-level `fallback` declared in `router.json` — those are pages the package **declares as its own**, and they are handled as such. When writing an external link, start the string with a literal (`"https://" + tail`) rather than beginning it with `${`, or the jump is treated as an in-app route and tapping it does nothing.

To open an external link, each page type has one way (none of them need the target domain in `manifest.network` — the whitelist governs `request` in flows only; opening a web page is not a request):

| Where | How |
|---|---|
| H5 page (`page/html/…`) | `xbridge.route("https://news.ycombinator.com/item?id=" + id)` |
| XPage node / widget `onClick` | Write the string directly: `"https://example.com/${path}"` (starting with a literal scheme) |
| In an `.af` flow | `{ "action": "nav.open", "params": { "url": "https://…" } }` |

## Render it and look

```
numable render <package> --page
numable render <package> --page /detail?id=1,/pick
```

With no routes, every route in `router.json` is rendered; a route may carry a query, which is what an html page reads from `location.search` and an xpage receives as route parameters. Each route is rendered at phone width (390×844) as two full-page screenshots, light and dark, saved as `<package>/.numable/render/page<route>.<light|dark>.<locale>.png` (`/` → `page`, `/detail` → `page-detail`), and added to the "Pages" part of the `index.html` contact sheet in the same folder. Languages come from `--locales`, as for widgets; `--scale` defaults to 2.

**Data comes from the same machinery as `run`**: `xbridge.runDataFlow` calls from an html page and the `depends` of an xpage both run through the real engine on the command-line side, with the network allowlist, the input fixtures in `.numable/params/`, `_credentials.json` and `_datastore.json` all in force; the browser never reaches the internet directly. A host missing from the allowlist is blocked right here: the output shows a `network_blocked` line and the screenshot shows the page's own failure state — exactly what a user would see in the app.

What the bridge methods do while the screenshots are taken:

| Method | During the render |
|---|---|
| `runDataFlow` / `runActionFlow` / `runFlow` | Runs `page/flow/<name>` for real; the result is printed |
| `getData` / `setData` | Read and write the data from `_datastore.json`; reset before every image, so nothing leaks into the next one |
| `credentialState` | `bound` if `_credentials.json` has the key, otherwise `unbound` |
| `appInfo` | The theme and language of the image being rendered |
| `route` / `closePage` / `setResult` | Recorded, not followed; listed in the output |
| `toast` / `haptic` / `showLoading` / `hideLoading` | Nothing is shown; a `showLoading` never followed by `hideLoading` is called out |
| `confirm` / `alert` / `singleValue` / `alertAdd` | Treated as the user cancelling (`confirm` returns `false`); marked "not simulated" in the output |
| `pickWidgets` / `removeWidget` / `updateParams` / `refreshWidget` / `installBundle` | Do nothing; marked "not simulated" in the output |

The output also calls out three more things: reading a method name the bridge doesn't have (it is `undefined` in the app; G42), assets that failed to load, and uncaught errors thrown by the page script (this one makes the command exit non-zero).

Each image has a translucent capsule in the top-right corner marking where the app's container buttons sit: content under it can't be tapped in the app, so a page that doesn't make room at the top shows up at a glance.

Not rendered yet: `form` pages and routes with `remote` are skipped with a note; open those in the app. For a long xpage, the root's available height is stretched to the full content height for the screenshot, so a layout that fills one screen with `{parent.h}` appears stretched in the image. Phone-only differences such as glyph widths are the same as for widgets: only a phone shows them.

## Rules (breaking one means rework)

| Rule | How it is checked | Symptom when broken | Fix |
|---|---|---|---|
| `numable://self/page/<x>` must have a matching route in `router.json`; the id in `numable://self/widget/<id>` must exist | `check` G12 | The App shows "page not found" / opens an empty add-widget panel | Add the route; use `numable://self` for the home page |
| A flow called from H5 must exist and its extension must match the method (`runDataFlow`→`.df`, `runFlow`/`runActionFlow`→`.af`) | `check` G12b | The page shows "load failed (-6)", flow not found | Change the extension or the method — one of the two |
| `depends` in a `.xwidget` / xpage must not be a bare-string binding | `check` G12 | Input parameters are swallowed into nothing, the flow still reports success, and the widget silently renders all `--` | Write `{"flow":"…","params":{"k":"${k}"}}` |
| An `onEdit` route must be a bare path present in `router.json`; an `onEdit` action flow must be an `.af` that exists in the package | `check` G12 | Long-press → "Edit parameters" does nothing / opens a blank page without an error | Line it up with the route table / add the file |
| An `onEdit` target must actually be able to write back (an af containing `widget.updateParams`; a form with `onSubmit`; an xpage with `events`) | `check` G12 | The edit page opens, but nothing you do changes anything | Add the write back inside the target |
| `input` / `select` / `textarea` in H5 must set an explicit `font-size` of ≥ 16px | `check` G15 | On iOS the whole page zooms when the field is focused and does not fully zoom back out | Pin `font-size: 16px` in CSS (a size inside the `font:` shorthand counts too) |
| At most 2 add-widget calls per file; the add-widget page must not say "Added" | `check` G24 (W) | The package hand-copies a widget catalogue, so a new widget that never made it into the HTML can never be added; "Added" lies (the user may just browse and close) | Reduce it to one button plus `pickWidgets(items)`; if you want feedback, say "Submitted" |
| Add-widget buttons use the platform's baseline styling (the standard `.pickb` style block in H5, an xpage node 56pt tall) | `check` G27 (W) | The same platform action looks different in every package and users stop recognizing it | Do not style it yourself; copy the one the `check` error hands you |
| A package declaring `required: true` credentials must have one `numable://app/mine?section=credentials` direct entry inside `page/`, and must not make the user "add a widget first, then look for the entry on the widget" | `check` G25 | The user opens the home page, reads "not connected yet", and has no idea where to connect | Put numbered steps plus one direct button on the home page |
| An `onClick` or external-link string must start with a **literal** scheme | manual review | Tapping does nothing | Write `"https://${tail}"`, not `"${url}"` |

The rules that belong to xpage pages themselves (the top inset G17, node-level localization G35, event values that must not start with `${` G36, root params overriding the route query, and more) are in `numable docs xpage`.

## When something goes wrong

| Symptom | Most likely cause | What to do first |
|---|---|---|
| Tapping a widget shows "page not found" | The `onClick` path is not in `router.json` | Run `numable check` and look at G12 |
| The page is blank with no error at all | A wrong `type` (anything but `xpage`/`form` renders as html) or a wrong base for `entry` | Check `type` against its three legal values; a `form` entry needs the `page/` prefix, html/xpage do not |
| The pill covers the top of the page | The inset was never read | For xpage see G17; for html check whether `body`'s `padding-top` uses `var(--xb-content-top)` |
| Data on the page is always empty | A direct `fetch` was used and CSP blocked it | Switch to `xbridge.runDataFlow`, see `numable docs bridge` |
| The page shows "load failed (-6)" | The flow's file name or extension does not match the method | Run `numable check` and look at G12b |
| The widget renders all `--` while the flow reports success | `depends` was written as a bare string | See G12 |
| Switching app language/theme leaves the page unchanged | `data-lang` / `data-theme` were only read on first render | Listen for `languagechange` / `themechange` and re-render |

## Related

- `numable docs bridge` — every method an H5 page can call, and the container environment
- `numable docs i18n` — how metadata table (B) fields such as `routes[].title` are translated
- `numable docs params` — the 14 `.xform` components and the user-editable fields
