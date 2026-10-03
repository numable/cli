<!-- translated-from: zh-CN/0-start/20-capabilities.md sha256:b333474b2545 -->

# capabilities — what you can build, what you cannot, and where the platforms differ

> Audience: the person building a tool, and the AI working on their behalf. Both read this same page.
> Scan this chapter before you start. Anything marked "not supported" below is not a bug — that platform has no such path, so do not design around it. The platforms below are iPhone / iPad / Mac · Android · HarmonyOS · the Windows desktop app.
> For how to build, see `numable docs workflow`.

## Widgets

The widget is the body of a package: one `.rcn` drawing plus one `.df` data flow, rendered from the same source into the same bitmap everywhere.

| Capability | Status | What it means for you |
|---|---|---|
| RCN rendering (geometry + style + live data) | same everywhere | one `.rcn` works on every platform; do not branch per platform |
| Size code `layout` (two-digit grid code, tens = columns, units = rows) | any code inside the App on every platform; **the sizes allowed on the home screen differ per platform** (see next section) | `w = 90×cols − 22`, `h = 98×rows − 38`. Common ones: `22` = 158×158, `21` = 158×60, `42` = 338×158, `44` = 338×354 |
| Relative layout | same everywhere | size things with `{parent.w}` / `{parent.h}`; a hard-coded 158 breaks the moment the layout code changes |
| Light and dark themes | same everywhere | the theme is a **pure render parameter** — switching only re-renders and never refetches, which is why colors must be written as `light\|dark` pairs and can never come from a data branch (`check` G7) |
| The "follow the system" setting (switching at sunset) | same everywhere; an Android home-screen widget may still show the old theme while the App process is alive | always correct inside the App; nothing for you to do |
| Widget instance parameters | same everywhere | the same widget can sit on the dashboard several times with different parameters (city, ticker); defaults go in `.xwidget.params` |
| Interactive controls on the widget | **not supported** | a widget is a bitmap. Whole-widget clicks exist (`events.onClick`), but there are no in-widget buttons, text fields, or scrolling — if you need interaction, open a page |
| Animation | **not supported** | a widget is one static frame. There is roughly 250ms of no feedback between the tap and the page opening, so the first step of a click flow should be `ui.haptic` (`check` G22) |
| A changed package refreshes the widget automatically | same everywhere | the App caches per package version: the moment `manifest.version` goes up by one, both the old rendered image and the old stored data expire. **So bump the version after every change** — skipping it means "I changed it and nothing happened", with no error |
| A brief blank before the new content appears | same everywhere | that is the version-keyed cache working, not a bug: the new version has no cached image to paint, so it shows the skeleton and fetches for real. Do not reuse the old image to hide it |
| What the App draws when there is no data | same everywhere | the fetch failed but there is data from last time: the App renders that data as is, with no marker (saying it is stale is your time anchor's job). The fetch failed and there is no data at all: the App renders your `.rcn` with **empty data** and lays a pill over the bottom — "Couldn't load · Retry", or "No connection" when offline. So the `.rcn` must render with empty data (the `numable render --states empty` image); do not draw your own error message on top of the empty state |
| Missing credential, over the free allowance | same everywhere | a `required: true` credential the user has not bound: no fetch, and a "Credential needed" pill. When a free user has more than 6 widgets on their dashboards, the 7th onwards stops updating and shows a "Paused" pill. The App draws both; the package does not handle them |
| A new version deletes or renames a `.xwidget` | same everywhere | a widget's file name is its identity. A widget on the user's dashboard that points at the old file name shows "Widget removed" and is cleared when the package updates. To replace a widget, add a new file; do not rename |

## Home-screen widgets

The widget on the home screen is the same `.xwidget` as the one on the App's dashboard, but the **refresh mechanism is completely different** — this is the largest difference between the platforms.

| | iPhone / iPad / Mac | Android | HarmonyOS | Windows |
|---|---|---|---|---|
| Home-screen widgets at all | yes | yes | yes | **no** |
| Sizes allowed on the home screen | `22` / `42` / `44` | 16 sizes inside a 4×4 grid (including `21` / `11`) | 8 sizes (`11` `21` `22` `32` `33` `42` `44` `46`) | — |
| Does the widget **fetch on its own** | yes (it runs the fetch and hits the network when its timeline expires) | yes | **no** (the widget process only reads the image the App rendered last) | — |
| Ceiling on data freshness | whatever the system's timeline budget allows, on the order of 15 minutes | the system heartbeat | **only updates after the user opens the main App and it renders the dashboard** | — |
| Refresh frequency | the system decides | the system decides | the user picks one of three (120 / 60 / 30 minutes), floor of 30 | — |
| Light/dark follows | the App's effective theme, not the system | same | same | — |
| Resource ceiling | **a hard 30MB limit** on the widget process; going over kills it with no error | no such limit | reads an image only, not applicable | — |
| Getting the image for display (first paint, system redraw, picker thumbnail) | cache first, painted instantly | same | the only path there is | — |
| Getting the image for a refresh (a scheduled update) | **skips the image cache and fetches**, falling back to the last image only on failure | same | not applicable | — |
| Switching theme / language | also refreshes the home-screen widget | same | same | not applicable |
| "Wake the main App at expiry so it can fetch" | — | — | **the system does not allow it**; it is not an omission | — |

What this means for you:

- **`refresh.interval` is a floor and a statement of intent, not a promise.** Writing `"60"` will not refresh every minute on the home screen; only the App's dashboard comes close to the cadence you wrote.
- **On HarmonyOS the "refresh setting" is a battery knob, not a data-freshness knob** — it only decides how often the cover image is re-read. Do not promise HarmonyOS users that "data updates every 30 minutes".
- **Do not build a package that only makes sense on the home screen.** The Windows app has no home-screen widgets at all, and on HarmonyOS the home-screen data lags the main App. The widget has to stand on its own on the dashboard.
- **Do not put large images on a home-screen widget** — on iPhone / iPad a widget only gets 30MB.
- **A home-screen widget never goes blank**: when a scheduled fetch fails it repaints the previous image, so the widget **must carry its own time anchor** — otherwise the user cannot tell "just fetched" from "three hours old".
- **Placing a widget on the home screen is the user's action**: the system does not let an App do it for them. What you can do is make a good widget and put an "add to dashboard" button on a page (`widget.pick`).
- **Ship at least one `22` per package**: it is the smallest home-screen size and the densest dashboard size. The publish profile also requires at least 3 widgets including a `42` or a `44` (`check` G6).

## Dashboard refresh

| Capability | Status | What it means for you |
|---|---|---|
| Declarative cadence `refresh` | same everywhere | `interval` accepts a time window `"09:30-16:10@60"` (no spinning after the close) and bare seconds `"3600"`; `at` pins specific times; `tz` sets the time zone |
| Refresh floor | same everywhere | the dashboard wakes when its earliest widget falls due, and two real fetches are at least 3 seconds apart — anything smaller still runs at 3. **For free users, periodic refresh is slowed to every 5 minutes**; Pro users get the cadence you wrote. Manual updates, the first load, a language switch, and `widget.refresh` are not affected. This is the cadence on the in-app dashboard; home-screen widgets have their own per-platform floor (iOS 15 minutes, Android 1 minute, HarmonyOS only shows the image the App last drew). How fast to go depends on what the upstream API's rate limit can take |
| Pull to refresh | on iPhone / iPad · Android · HarmonyOS; **not on Mac** | Mac users update manually with a long-press, so do not write "pull to refresh" instructions into a page |
| Long-press a widget → "update now", with success/failure feedback | same everywhere | the user has a reliable manual escape hatch; you do not need to draw your own refresh button on the widget |
| "Last updated / last failure / how long it has been stalled" | same everywhere | the App already keeps this ledger; your job is to give **the widget its own time anchor** so the user can see at a glance how old the data is |
| The `widget.refresh` primitive | same everywhere | refresh a widget from an action flow: `self` / `widget` / `bundle`, defaulting to `bundle`; it can only refresh widgets from its own package, and a repeat call within 5 seconds returns success without doing anything |
| Reminders whose time and wording are fixed when they are set | on iPhone / iPad · Mac · Android they are handed to the system clock and fire even with the App closed; **HarmonyOS first needs the agent-reminder entitlement** and degrades to "replayed when the App is opened" until it is granted; the Windows build needs its process resident and stays silent after a quit | whenever a reminder can be phrased as "say this sentence at this time", write it this way — it is the most reliable of the four platforms |
| Reminders that fetch and test a condition first, and background jobs | both are **best effort**: the chances to run are opening the App, a home-screen widget refresh, and whatever background slices the system grants; on Android, once the user turns on Live monitoring (a notification that stays in the status bar) it checks right on time; HarmonyOS leans on the home-screen widget tick and the Windows build on a resident timer | write the cadence as `interval`, **floor 30 minutes for free users** (anything smaller is raised to 30), Pro users get the cadence you wrote; never promise "on time every day" or "real time" in your copy — say "at most once a day, caught up when there is a chance". See `numable docs alerts` |

## Pages

A page is what opens when the widget is tapped. Pages live under `page/` and are registered in `router.json`.

| Page type | Status | What it means for you |
|---|---|---|
| `html` (a web page shipped in the package) | same everywhere | HTML/CSS/JS gives you the most freedom, but **`fetch` / `XHR` inside the page are sealed off** by the container (`connect-src 'none'` is injected); all fetching goes through the bridge into a `.df`, see `numable docs bridge` |
| `xpage` (page-level RCN, no web page) | same everywhere | fastest to render and the same DSL as the widget; the only leaves are `Canvas` and `input`, and containers support `list` / `grid` / `flex` / `waterfall` and other layouts |
| `form` (a `.xform` form page) | same everywhere | the standard way to collect user input, with 14 field components |
| External links (http(s) pages outside the package) | **differs**: iPhone / iPad · Android · HarmonyOS open a single-page shell inside the container with the domain and a lock icon; **Mac and the Windows app hand it to the system browser** | do not design navigation as if a third-party site were part of your package — the user may be looking at it in another browser |

Constraints shared by all pages:

| Constraint | How it is caught | What it means for you |
|---|---|---|
| A floating capsule (‹ / `•••` / ✕) sits at the top of the container, always above the content | `check` G17 (xpage) / manual review (html) | write `"paddingTop": "${@contentInset.top}pt"` on the XPage root; in H5 write `padding-top: calc(var(--xb-content-top) + 16px)` on `body`. Not making room means a strip of the top is covered, and no platform reports an error |
| The container draws no title bar | — | the page title goes in `title` in `router.json`; do not draw a fake nav bar yourself |
| Content is always phone width | manual review | on a large screen the page is a centered narrow column; do not add responsive breakpoints |
| Overlays (sheet / dialog) are bounded by the container and have a fixed height ratio | — | a sheet is always 0.8 of the container height and a dialog always 0.6, regardless of content; more content scrolls internally, less content leaves whitespace |
| H5 input controls use a font size ≥ 16px | `check` G15 | below 16px, iOS zooms the whole page on focus |

### The container and its back stack

| Fact | What it means for you |
|---|---|
| A page opens inside a **container**, and the container has its own back stack | open B from A and C from B and they stack up; ‹ pops one level, ✕ closes the whole container at once |
| The container has at most three buttons at the top (‹ / `•••` / ✕) and **draws no title bar** | the title goes in `title` in `router.json`; drawing your own nav bar puts two side by side |
| ‹ appears only when there really is a previous page on the stack | there is no ‹ on the first page — never treat "go back" as an exit the user is guaranteed to have |
| The system back button on Android / HarmonyOS means the same thing as ‹ | you do not have to wire it up, and you must not hijack it with JS in the page |
| Arriving from a widget, a deep link, or from outside may mean there is **no stack yet** | in that case a sub-page presented as `page` first creates a container and then stacks onto it, behaving exactly as it would inside one |
| An external link (http(s) outside the package) opens **a different shell**: ✕ and a domain, no `•••` | do not expect an external page to use your package's navigation; when the user hits ✕ they return to the page they came from |

### What XPage can do

`xpage` is page-level RCN without writing a web page. It shares the widget's DSL and adds interaction and state.

| Capability | What it means for you |
|---|---|
| Eight container layouts | `absolute` `stack` `flex` `flow` `list` `pager` `grid` `waterfall`; `grid` / `waterfall` take the column count from `columnCount` |
| Only two kinds of leaf | `Canvas` (one RCN canvas) and `input` (a bare text field with no visuals — its appearance comes from a Canvas underneath it) |
| Page state pageState | one key-value table per page, read from nodes with `${key}` and changed from a flow with `xpage.patchState` |
| Partial redraw | `xpage.redraw` repaints a single node without refetching; there is a separate action for repainting the page, a soft reload, and a hard re-entry |
| Node events | `onClick` / `longClick` / `onChange` / `onSubmit` / `onReachEnd` and others, each taking an `.af` |
| Node long-press menus | write a `menu` array on the node; if `longClick` is also set, the menu never appears |
| Conditional visibility `visible` | a node that tests false **never enters the page at all**: it takes no space and its fetch does not run |

Field by field in `numable docs page`; the available actions in `numable docs af`.

## Interaction

Interaction is written as an `.af` flow, attached to a widget's `events` or a page node's `events`. **Which actions you can use depends on the carrier:**

| Carrier | Test | Can use | Cannot use |
|---|---|---|---|
| Event flow | a user's finger is involved (tapping a widget, tapping a node, a deep link) | UI primitives, navigation, forms, write back, refresh, `data.*` | — |
| Render flow (the fetch inside `depends`) | the inverse | requests, parsing, `data.*` | anything UI or navigation; `widget.updateParams` / `widget.refresh` are hard-rejected |

An event flow times out after 15 seconds; the few actions that wait for the user (a confirmation dialog, opening a page, jumping to an external App) pause the clock.

Common primitives:

| Capability | Status | What it means for you |
|---|---|---|
| Whole-widget click `events.onClick` | same everywhere | a string value is treated as a navigation string; a structure (`@[file://…af]` or inline) is treated as an action flow. A whole-widget onClick flow **cannot change its own parameters** |
| Parameter editing `events.onEdit` | same everywhere | two forms: open a page (html / xpage / form) for the user to fill in, or attach an `.af` directly. The target must genuinely be able to write back, or `check` G12d / G12e stops you |
| `widget.updateParams` for writing parameters back | same everywhere | merges key by key; a `null` value deletes the key and falls back to the default; scalars only, objects and arrays fail outright |
| `startPageForResult` / `singleValue` | same everywhere | open a sub-page (`page` / `sheet` / `dialog`) for one return value, returning `{value, cancelled}`. `startPageForResult` defaults to `sheet` when `container` is omitted; `singleValue` must state it explicitly |
| `ui.toast` / `ui.alert` / `ui.confirm` / `ui.haptic` / `ui.showLoading` | same everywhere (event flows only) | do not use `window.alert` / `window.confirm` in a page — they escape the container and differ from platform to platform |
| Node long-press menus | same everywhere | write a `menu` array on the XPage node; the menu does not appear if the node also has `longClick` |
| `ui.presentSheet` / `nav.openForResult` | same everywhere (event flows only) | the two low-level primitives behind `startPageForResult`, returning a bare result or `null`. For new flows `startPageForResult` is all you need |
| `input.focus` / `blur` / `clear` / `selectAll` / `setValue` | same everywhere (xpage only) | drive an `input` node from a flow, addressed by node id; calling these from a widget's event flow does nothing |
| `xpage.patchState` / `setState` / `redraw` / `redrawPage` / `reloadPage` / `reenterPage` | same everywhere (xpage only) | change the page data and decide how much gets repainted. Day to day you only need `patchState` + `redraw`; `setState` replaces the whole table and clears any key you left out |
| `installBundle` (proposing another package for installation) | same everywhere | it only opens the install panel — whether to install is the user's action and the flow never learns the outcome. Do not print "installed" afterwards |
| `page.close` / `page.setResult` | same everywhere | close this page / close it with a value. `setResult` closes the page itself, so do not add `page.close` after it |
| `widget.pick` (opens the "add to dashboard" panel) | available on iPhone / iPad / Mac · Android · the Windows app; **calling it from a widget's event flow always fails on HarmonyOS** | put the add-widget entry point on a page, not on the widget, and one button is enough — do not hand-copy a widget catalog (`check` G24 / G27) |
| Jumping to an external App (`nav.open` with a third-party scheme) | same everywhere | the first jump raises a confirmation dialog and the answer is remembered per package; **any jump started by an automatic path (fetching, scheduled refresh) is silently refused** — a user has to have tapped for it |
| Falling back to a web page when the target App is missing (`fallback` on `nav.open`) | available on iPhone / iPad / Mac · Android · the Windows app; **does not fire on HarmonyOS** (the system shows its own prompt) | `fallback` only accepts http(s) (`check` G16), and there is no fallback when the user refuses |

## Fetching

| Capability | Status | What it means for you |
|---|---|---|
| `request` (HTTP + parsing) | same everywhere | supports `queryParams` / `header` / `body` / `formData` / `timeout`; `formatType` defaults to `string`, so write `"json"` explicitly when you want JSON |
| The domain allowlist `manifest.network` | same everywhere, and `run` applies the same test | the set must be **exactly equal** to the hosts the `.df` actually requests (`check` G3). This list is shown to the user at install time |
| Per-hop redirect guard | same everywhere | a request that leaves the allowlist mid-flight is refused. When you use a short link or an endpoint that 302s to a CDN, declare the host it lands on too |
| A server-side proxy | **not supported** | data goes straight from the user's device to the source. A source that is blocked in mainland China cannot be reached there, and sites that need a logged-in cookie cannot be used |
| Picking a source by region `${@app.region}` | same everywhere (`.df` / `.af`) | the value is `cn` (mainland China) / `overseas` / an empty string (unknown). If you have a fallback source that is blocked in mainland China, skip it under `cn` rather than making the user wait out a timeout first |
| `htmlParse` / `xmlParse` | the parser differs per platform | do not rely on `xmlParse`; for XML use `formatType:"string"` to get the raw text and cut it with `split::` |
| `data.get / set / remove / has / merge / keys / getAll / clear` | same everywhere | package-local persistence across launches; the namespace is always your own package. **There is no `scope` parameter** — writing one is silently ignored |
| First-paint cache (render from cache, then check for new data in the background) | same everywhere | a `.df` consumed by a page should be cached, or every entry into the page burns a network round trip first (the publish profile's `check` G23 reminds you). **A widget's `.df` is not cached by default** — a cached widget means refreshing does nothing. For a source that needs a credential, fold the `fp` returned by `credential.state` into the cache key, so the old cache lapses on its own when the user rebinds |
| An exit for a failed fetch | `check` G26 | any widget `.df` with a request must have an `action:"error"` exit, or a failure reports success and empty data overwrites good data |
| The expression method set | same everywhere, but smaller than you expect | there is no `abs` / `avg` / `filter` / `groupBy` / `push`, and **an unknown method silently evaluates to empty** without an error. Full table in `numable docs methods` |

Six tests for the first-paint cache, to walk through for every `.df` a page consumes:

| Test | What it means for you |
|---|---|
| Cached data paints first | if there is any data that is not hopelessly stale, paint the first frame from it — **do not show a skeleton just because it is not fresh** |
| Pull to refresh really fetches | the pull-to-refresh path has to delete the cache key before fetching, or the pull hits the cache again and the numbers do not budge |
| A time anchor is mandatory | data shown from cache has to say on screen how old it is. **A stale number with no time anchor is worse than a blank** |
| A failure never overwrites | check that the load-bearing fields are non-empty before writing to the cache; on a failed fetch, write nothing and keep painting the old values. One timeout that writes an empty payload leaves the widget empty until the next lucky success |
| A widget's `.df` is never cached | a widget refresh means "skip the cache and fetch", so another cache layer underneath makes refreshing a no-op. When a page and a widget share one `.df`, **let an input parameter switch the cache on, and default it off** |
| Structure changes are detectable | store your own structure version in the cache and compare structure before age when reading. A mismatch counts as no cache — otherwise the first view after an upgrade is broken and the second is fine, the hardest kind of bug to track down |

The TTL is two numbers: `ttl` decides "how old counts as stale and needs a background check", `hardTTL` decides "how old is too old to show at all, fall back to the skeleton". Pick them from how often the data in that domain actually changes:

| Kind of data | `ttl` | `hardTTL` |
|---|---|---|
| Continuous quotes (24/7) | 60 seconds | 6 hours |
| Weather | 10 minutes | 12 hours |
| Content rankings | 5 minutes | 24 hours |
| Platform stats / personal dashboards | 15 minutes | 24 hours |
| Daily / weekday updates | 1 hour | 48 hours |

How to write it: `numable docs df`.

## Localization

Two tables, and one sentence decides between them: **fields the host reads and displays directly go in the metadata table (B); text the package itself references goes in the content table (A)**.

| Table | Where it lives | How it is used | Used for |
|---|---|---|---|
| Content table (A) | the asset's own top-level `i18n: {locale: {key: text}}` | write `${@i18n.key}` in the body | `.rcn` · `.xform` · `.af` · `.df` · `.xpage` |
| Metadata table (B) | the bare field is the base language, with `i18n: {locale: {field: value}}` alongside | the host picks for itself | title / subtitle / description / category in `manifest` · title / sub in `.xwidget` · `title` in `router.json` · title / sub / message / form in `.xjob` |

| Fact | What it means for you |
|---|---|
| **Switching language refetches** | the dashboard runs one `widget.refresh` per package; for data in two languages, read `${@app.language}` directly in the `.df`. The data cache is split by language: a skeleton shows first and the data appears once fetched. A `.df` may also carry a top-level `i18n` table and write `${@i18n.key}` to produce finished text directly |
| Fallback chain: exact match → language prefix → `en-US` → base language | `manifest.lang` declares which language the bare fields are in |
| **An empty string in table A means deliberately blank and does not fall back**; an empty string in table B means missing | to display nothing, write an empty string — do not delete the key |
| The publish profile requires `zh` + `en` | missing coverage in other languages is only a warning |
| `${@i18n.x}` at the XPage node level resolves only against **that page's own top-level `i18n` table**; keys in a `.rcn` table are invisible at the node level | put keys used on nodes into the `.xpage` top-level `i18n`; widget text still lives in the `.rcn` table (`check` G35 catches a missing key) |
| The system picker list for iOS home-screen widgets | text at that level can only follow the system language, not the App language |

Details in `numable docs i18n`.

## Publishing

| Form | How it is installed | Signature verification | What it means for you |
|---|---|---|---|
| Personal use | drop the files into the App's workspace folder | no verification, read as plaintext | edit and watch; one character changes the result; the widget is labelled as a local package |
| Store distribution | downloaded from the store | Ed25519 signature + per-file sha256; rendering is refused outright if verification fails | you cannot hand-edit files inside a published package — edit the source and ship a new version |

- **Both are the same package with the same ULID**: after you publish a package you were using yourself, a long-press on the widget upgrades it to the published version, data intact.
- **An account is all you need to publish** — there is no extra application to file.
- The `community` / `featured` store tiers are a curation signal, not a capability gate — packages in both tiers can do exactly the same things.
- `numable check --profile publish` must report zero errors before you publish; the process is in `numable docs publish`.

## Backup and restore

| Fact | What it means for you |
|---|---|
| The App exports and imports `.nbk` backup files, interchangeable between platforms | users switching devices will not lose your package |
| What is backed up: locally authored packages, downloaded packages, everything in `data.*`, the dashboard layout and instance parameters, App settings | user data you stored with `data.*` (check-in history, a watchlist) travels with it |
| What is not: login tokens, credentials, remembered external-App permissions, caches, home-screen widget system bindings | after a restore the user has to place widgets on the home screen again; never design as if "granted once" were permanent |
| When the same package already exists, the default is not to overwrite | a restore will not roll back a newer version the user already has |
| With multi-device sync on, `data.*` merges between devices **by top-level key**; when both sides changed the same key, the later write wins | Records the user enters by hand and cannot recreate (check-ins, doses, weight): one record per key (`log.2026-09-23`, `dose.<timestamp>`), so when two devices each log an entry both survive; put them all under one key and one of the two entries is lost. Values a background task logs by date can share one key (`data.merge`, one slot per day): both devices write the same data for the same day, and at worst a device that rarely syncs leaves a one-day gap |

## Planned, not available today

The following are being designed and **writing them into a package has no effect yet**. Do not promise them to users and do not design a workflow around them.

| Capability | What you can do instead today |
|---|---|
| Genuine background refresh for HarmonyOS home-screen widgets | write your copy around "it updates when the main App is opened" |
| `.xmenu` as a writable menu file inside the package | write the menu as an inline `menu` array on the node |
