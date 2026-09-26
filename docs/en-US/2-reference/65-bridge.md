<!-- translated-from: zh-CN/2-reference/65-bridge.md sha256:dad5d7e853d8 -->

# bridge — the JS bridge contract for H5 pages

> Audience: people building a source (an XBundle package), and the AI working on their behalf. Both read the same document.

## What it is

`window.xbridge` is the only opening an html page has onto the host. The page runs in a sandbox whose CSP the container injects: **direct `fetch` / `XMLHttpRequest` are sealed off** (`connect-src 'none'`, images excepted), so fetching data, navigating, showing prompts, adding widgets and writing parameters all go through this object.

It is the second face of the ActionFlow capability surface — most methods are backed by the same implementation as the matching action, so "what the bridge can do" is essentially "what an `.af` can do" (full table in `numable docs af`). Only xpage / xform pages have no use for it: those two kinds bind `.df` / `.af` directly.

Use it only in html pages. Check the environment before you call anything — in an ordinary browser `window.xbridge` is `undefined`.

## Minimal working example

```html
<script>
  // 1. Check the environment: previewing straight in a browser must not blow up
  const inApp = !!(window.xbridge && xbridge.isXBundleEnv());

  // Call-type methods resolve an envelope { code, msg, data }: only code === 0 is success, and the result sits in data. Unwrap it in one place
  async function call(p) {
    const r = await p;
    if (!r || r.code !== 0) throw new Error((r && r.msg) || "bridge error");
    return r.data;
  }

  async function load() {
    if (!inApp) return;

    // 2. Fetch data: calls page/flow/home.df (runDataFlow only searches .df)
    const data = await call(xbridge.runDataFlow("home", { id: new URLSearchParams(location.search).get("id") || "" }));
    document.getElementById("n").textContent = data.count;

    // 3. Read the app environment: always await it
    const app = await call(xbridge.appInfo());     // { theme, language, locale, … }
    document.documentElement.dataset.lang = app.language;
  }

  async function reset() {
    // 4. Use the bridge for confirmation, not window.confirm
    if (!(await call(xbridge.confirm("Clear the log?", "This cannot be undone")))) return;
    xbridge.haptic("warning");
    await call(xbridge.runActionFlow("reset"));    // side-effect flow, .af
    xbridge.toast("Cleared", "success");
  }

  // 5. Add-widget entry: one button, and the user picks inside the panel
  function addCard() { xbridge.pickWidgets([{ id: "today", params: { habit: "water" } }]); }

  load();
</script>
```

## Grouped examples

The block above covers the paths you will walk most often. Here is one line for each of the remaining methods, ready to copy (`call()` is the envelope-unwrapping helper from above).

**Fetching and local data**

```js
const data = await call(xbridge.runDataFlow("home", { id: "1" }));   // page/flow/home.df
const r    = await call(xbridge.runActionFlow("save", { v: "1" }));  // page/flow/save.af, a side-effect flow
await call(xbridge.setData("watchlist", JSON.stringify(["AAPL", "TSLA"])));   // values must be strings
const list = JSON.parse((await call(xbridge.getData("watchlist"))) || "[]");  // empty if never written, so supply a default
```

The namespace of `getData` / `setData` is always this package and the page cannot choose otherwise. They map onto `data.get` / `data.set` in an `.af`: one and the same storage, so pages and flows see each other's writes.

**Feedback**

```js
xbridge.showLoading("Syncing…");     // notify, do not await
try { await call(xbridge.runActionFlow("sync")); } finally { xbridge.hideLoading(); }
await xbridge.alert("Already checked in today", "Come back tomorrow");
if (await call(xbridge.confirm("Clear all records?", "This cannot be undone"))) { /* … */ }
const r = await call(xbridge.singleValue({
  container: "sheet",
  title: "Pick a city",
  component: { type: "select", value: "bj",
    props: { items: [{ label: "Beijing", value: "bj" }, { label: "Shanghai", value: "sh" }] } }
}));
if (r && !r.cancelled) { /* the value is at r.value.value */ }
```

`showLoading` / `hideLoading` are notify methods: **you have to pair them up yourself**, above all on the path where fetching throws (hence the `finally`). Forget to close it and the page stays under a scrim forever, without an error.

**Widgets**

```js
xbridge.pickWidgets([{ id: "today", params: { habit: "water" } }]);  // ask the user to pick; the panel does the writing
xbridge.removeWidget("today");                                       // writes immediately, removing every instance of that widget
const p = await call(xbridge.updateParams(brickId, { city: "shanghai" })); // only a parameter page receives a brickId
await call(xbridge.refreshWidget());                                       // data = { refreshed: <count> }
```

⚠️ **`removeWidget` skips the panel and writes straight to disk**, and it removes **every** instance of that widget (the user may have placed three, each with its own parameters). Put an `xbridge.confirm` in front of it yourself.

**Environment**

```js
const app  = await call(xbridge.appInfo());           // always await this: { platform, appVersion, theme, language, locale }
const mine = await xbridge.installedBundles();        // system packages only; your own package gets a non-zero code
const cred = await call(xbridge.credentialState("github"));  // { state: bound|unbound|expired, fp }
```

`installedBundles()` returns nothing in your own package, so do not design an "installed / not installed" UI around it. To test whether a method exists, use `typeof xbridge.x === "function"` — whatever is on the object is exactly what the page can call, and there is no second list to reconcile it against.

## Call shapes

- **call methods** (marked call in the table) return a Promise; **notify methods** are one-way notifications with no return value — do not `await` their result to decide whether they succeeded.
- **A call-type method resolves an envelope `{ code, msg, data }` and never rejects**: `code === 0` means success and the result is in `data`; a failure is a non-zero `code` (with `msg` saying why), and a timeout on phones is `code: -2`. Using the return value directly as the data is the most common silent bug: `(await xbridge.runDataFlow(…)).count` is always `undefined`, and `if (await xbridge.confirm(…))` is worse — the envelope object is always truthy, so the code runs on even when the user tapped Cancel. Unwrap it with the `call()` from the example above.
- On phones, a call method times out after 10 seconds by default; the ones that wait for the user (`confirm` / `alert` / `singleValue` / `alertAdd`) have no timeout.
- To probe whether a method exists, use `typeof xbridge.confirm === "function"`; for the whole set, `Object.keys(xbridge)`.
- A name that is not in the table simply **does not exist** — calling it throws a TypeError, and calls like that are almost always swallowed by the page's own `try/catch` (nothing crashes, nothing is reported, the feature is just quietly absent). `numable check` catches it as G42.

## The full method table (26)

Every platform gets this same table — same names, same signatures, same behaviour. A name that is not in it does not exist.

| Method | Shape | Signature | Returns | Matching AF action |
|---|---|---|---|---|
| `isXBundleEnv` | — | `()` | `true` (in a browser the whole `xbridge` is undefined) | — |
| `runDataFlow` | call | `(flow, params?, timeout?)` | the flow's `resultFilter` output | — |
| `runActionFlow` | call | `(flow, params?, timeout?)` | the flow's result | — |
| `runFlow` | call | `(flow, params?, timeout?)` | the flow's result; equivalent to `runActionFlow`, searches `.af` only | — |
| `getData` | call | `(key)` | the value (a string) | `data.get` |
| `setData` | call | `(key, value)` | — | `data.set` |
| `credentialState` | call | `(declId)` | `{ state, fp }` — `state` is `bound` / `unbound` / `expired`, and `fp` changes whenever the binding does (usable as one dimension of a cache key) | `credential.state` |
| `route` | notify | `(url)` | — | `nav.open` |
| `closePage` | notify | `()` | — | `page.close` |
| `setResult` | notify | `(payload)` | — | `page.setResult` |
| `toast` | notify | `(msg, type?)` | — | `ui.toast`; `type` is `success` / `error`, anything else renders as a plain notice |
| `haptic` | notify | `(type?)` | — | `ui.haptic` |
| `alert` | call | `(title, message?, okText?)` | `void` | `ui.alert` |
| `confirm` | call | `(title, message?, opts?)` | `boolean` | `ui.confirm` |
| `showLoading` | notify | `(text?)` | — | `ui.showLoading` |
| `hideLoading` | notify | `()` | — | `ui.hideLoading` |
| `singleValue` | call | `(config)` | `{ value: { value }, cancelled }` | `singleValue` |
| `pickWidgets` | notify | `(items?)` | — | `widget.pick` |
| `removeWidget` | notify | `(widgetId)` | — | deletes **every** instance of that widget and writes to disk immediately |
| `updateParams` | call | `(brickId, params)` | the merged `params` | `widget.updateParams` |
| `refreshWidget` | call | `(pid?)` | `{ refreshed }` | `widget.refresh` |
| `alertAdd` | call | `({ id, params? })` | `ok` / `cancel` / `quota` | `alert.add` |
| `alertRemove` | call | `({ id, params? })` | `{ removed }` | `alert.remove`; **needs `manifest.minEngine` 3 or higher** — older apps do not have it on the bridge |
| `appInfo` | call | `()` | `{ platform, appVersion, theme, language, locale }` (`language` and `locale` hold the same value) | — |
| `installBundle` | notify | `(id, version?, ref?)` | — | — |
| `installedBundles` | call | `()` | the list of installed packages (system packages only) | — |

## Semantic discipline

These are not "usage tips" — they are the places where getting it wrong raises no error.

- **The namespace of `getData` / `setData` is always this package**, and the page cannot choose otherwise. Values must be strings; `JSON.stringify` anything more complex yourself.
- **The subject of `pickWidgets` is the user, not the package.** The bridge only opens the panel and hands it the candidates and their parameters; the actual write happens on the native button inside the panel. So after calling it you **must not** say "Added" — the user may well browse and close, and that sentence would be a lie. If you want feedback, say "Submitted", or say nothing at all (the panel gives its own).
  Omitting `items` or passing an empty array lists every widget in this package; passing items where **not one id is recognized → the panel does not open** (it does not silently fall back to "all").
- **`pickWidgets` and `removeWidget` mean opposite things**: the first only opens the panel and asks the user to pick, and the writing happens inside the panel; the second skips every panel, writes straight to disk, and removes **every** instance of that widget in one go. So adding a widget needs no confirmation of your own (the panel is the confirmation), while removing one **must** have your own `confirm` in front of it — once the user presses it, there is no undo anywhere.
- **The subject of `alertAdd` is also the user.** It only opens the native "Add reminder" panel; `params` are merely pre-filled and the user can change them, and the reminder is created only when the user presses the panel's main button. Treat the two non-`ok` results separately: `cancel` means the user did not want it, `quota` means this package's reminders are full (the panel still opens, with the button disabled) — do not word `quota` as "maybe later". `id` can only be an alert rule in this package's `xJob/`; creating a reminder for another package is not possible. A wrong `id` (not found, or not an alert) opens no panel and fails the call (`rule_not_found`) — it never comes back as `cancel`.
- **`alertRemove` takes effect directly, without the user** — the opposite of `alertAdd`: it deletes this package's matching reminders for that rule (along with any fires already scheduled), opens no panel, shows nothing, and returns how many copies it removed. `params` matches as a **subset** — equal values on the keys you give are enough; omitting it means every instance of the rule; no match is `{ removed: 0 }`, not a failure. It removes reminders only, never background jobs. For the pattern of giving an alert a business key when you create it, see `numable docs alerts` step 7. It is only guaranteed in packages with `manifest.minEngine` ≥ 3; to stay compatible with older apps, check `typeof xbridge.alertRemove === "function"` first.
- **Use the bridge's `alert` / `confirm`, not `window.alert` / `window.confirm`.** The latter are the system's own dialogs, they look different on every platform, and they escape the container boundary — on a large screen they land in the middle of the window instead of inside the package's widget.
- **The argument to `haptic` is a semantic level, not a physical parameter**: `tap` (default) / `impact` / `success` / `warning` / `error` / `selection`, with unknown values falling back to `tap`. On desktop, with no haptic hardware, or when the user has haptics switched off, it silently does nothing — **do not try to decide at the call site whether it should vibrate**.
- **The whole config of `singleValue(config)` is the single-value config**, not `{config: …}`: it must carry `container` (`page` / `sheet` / `dialog`) and `component` (`{type, value, props}`). It returns `{ value: { value }, cancelled }` — the value is at `r.value.value`, not `r.value`. For more than one field, always use the `.xform` page kind, see `numable docs params`.
- **`updateParams` merges key by key, and one illegal key fails the whole call**: values must be scalars, and `null` deletes a key and falls back to the default declared on the widget; passing an object or an array errors the entire call rather than "skipping that one key".

## The container environment

The page gets four things from the container, none of which requires a method call.

**CSS variables** (injected by the container; write your own `0` fallbacks in `:root` so browser preview does not collapse):

```css
:root { --xb-content-top: 0px; --xb-content-bottom: 0px; }
body { padding: calc(var(--xb-content-top) + 16px) 16px calc(var(--xb-content-bottom) + 16px); }
```

| Variable | Meaning |
|---|---|
| `--xb-content-top` | The height to leave free at the top (safe area + the floating chrome). **This is the one 99% of pages should read** |
| `--xb-content-bottom` | The height to leave free at the bottom |
| `--xb-safe-bottom` | The bare system safe area at the bottom |
| `--xb-safe-top` | The bare system safe area at the top. **Only present on phones, not on desktop** — never make it your only source of inset |

**Theme and language**: the container sets `data-theme` (`light` / `dark`) and `data-lang` (a language code) on `documentElement`, and on a switch it **changes the attribute and dispatches an event without reloading the page**:

```js
addEventListener("themechange", (e) => {/* e.detail.theme */});
addEventListener("languagechange", (e) => {/* e.detail.language */});
```

Write your CSS as `[data-theme="dark"] …` and **do not rely on `prefers-color-scheme`**: the page lives in an iframe / WebView, that media query follows the host system, and switching the theme inside the app cannot move it.

**Network**: with CSP `connect-src 'none'`, `fetch` / `XHR` never get through — and they fail very quietly (one try/catch and there is no log at all). All data goes through `runDataFlow` / `runActionFlow`.

**Route parameters**: the page reads `location.search`, exactly as on an ordinary web page.

## Rules (breaking one means rework)

| Rule | How it is checked | Symptom when broken | Fix |
|---|---|---|---|
| The flow you call must exist, and its extension must match the method (`runDataFlow`→`page/flow/<name>.df`; `runFlow` / `runActionFlow`→`.af`) | `check` G12b | The page shows "load failed (-6)", flow not found | Change the extension or the method name — one of the two |
| Input controls set an explicit `font-size` of ≥ 16px | `check` G15 | On iOS the whole page zooms when the field is focused and does not fully zoom back out | Write `input, select, textarea { font-size: 16px; }` in CSS |
| At most 2 add-widget calls per file; the add-widget page must not say "Added" | `check` G24 (W) | The page hand-copies a widget catalogue, so a new widget that never made it in can never be added | Reduce it to one button plus `pickWidgets(items)` |
| Only call bridge methods from the full method table | `check` G42 | A bare call is a TypeError (E); one behind an `if (xbridge.x)` guard does not crash, but the fallback branch is then the only one that ever runs (W) | Check the name against the full method table; if there is no such capability, drop the dead branch |
| Add-widget buttons use the platform's baseline styling (the `.pickb` CSS block, character for character) | `check` G27 (W) | The same platform action looks different in every package | Do not hand-edit the styling; regenerate that piece as the error message tells you |
| `appInfo()` must be awaited | manual review | Reading `.theme` / `.language` synchronously gets properties that do not exist on a Promise → the theme is permanently light and the language permanently the base language, **with no error** | `const app = await xbridge.appInfo();` |
| A call-type result is an envelope; the value is in `.data` | `check` G49 (W) | Every field is `undefined`; `confirm` runs on after Cancel — neither raises an error | Write a `call()` that unwraps the envelope (throw when `code !== 0`, otherwise return `data`) and route every call-type method through it |
| No direct `fetch` / `XMLHttpRequest` anywhere in the page | manual review | Data is always empty, and the console is usually swallowed by your own try/catch | Move everything to `runDataFlow` |

## When something goes wrong

| Symptom | Most likely cause | What to do first |
|---|---|---|
| The page shows "load failed (-6)" | The flow name or extension does not match the method | Run `numable check` and look at G12b |
| Data is always empty, with no error | A direct `fetch` was blocked by CSP | Search the whole file for `fetch(` / `XMLHttpRequest` |
| The theme is permanently light and the language permanently Chinese | `appInfo()` was not awaited | Add `await`; or read `documentElement.dataset` instead |
| Switching theme/language leaves the page unchanged | The attributes were read once on first paint | Listen for `themechange` / `languagechange` and re-render |
| A dialog lands in the middle of the window and overflows the container on a large screen | `window.confirm` / `window.alert` was used | Switch to `xbridge.confirm` / `xbridge.alert` |
| Tapping "Add to dashboard" does nothing at all | Not one id in `pickWidgets(items)` is recognized | Check the ids against the file names in `xWidget/*.xwidget` |
| A bridge call looks like it never happened (nothing changed, nothing moved) and the console is clean | The method name is not in the table — either the page's own `try/catch` ate it, or that `if (xbridge.x)` guard went straight to the fallback | Run `numable check` and look at G42 |
| The page stays under a loading scrim forever | Fetching threw after `showLoading` and `hideLoading` was never reached | Put `hideLoading` in a `finally` |
| `getData` reads back empty although you saved something | You saved without `JSON.stringify`, so the object was stored as `[object Object]` | Store strings, then `JSON.parse` with a fallback on the way out |
| The user is missing two widgets and nobody deleted them | A page called `removeWidget`, which removes every instance of that widget | Add an `xbridge.confirm` before the call |

## Related

- `numable docs page` — where html pages sit in the package, routing, and the three page kinds
- `numable docs af` — the layer behind the bridge: the full action table and how to write action flows
- `numable docs params` — the component types and props of `singleValue` / `.xform`
