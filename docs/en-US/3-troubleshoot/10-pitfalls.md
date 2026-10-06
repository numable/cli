<!-- translated-from: zh-CN/3-troubleshoot/10-pitfalls.md sha256:469ff37362dc -->

# pitfalls — find it by symptom: how to diagnose a broken widget

> Audience: people building tools, and the AI working on their behalf. Both read this same page.

This chapter is indexed by **what you see on screen**, not by technical category. A widget is a bitmap, and when it breaks it almost never raises an error: the flow reports success, the log is clean, `check` is all green, and the only evidence is a screen full of `--` or a solid white block. So run the three layers below in order first, then match your symptom against the tables.

---

## 1. Do these three things first

The three commands are three different nets, and each one lets different things through. **Run them in order; don't skip a layer.**

### 1.1 `numable check` — the static check

```
numable check
numable check --profile publish
```

Look at the marker at the start of each line: `✗` (error, must fix) / `!` (warn). Messages usually end with a code such as `(G30)`; to look up what a code means:

```
numable docs lint-codes
```

- **What it catches**: JSON syntax errors, missing fields, deprecated fields, bare-string `depends` bindings, `op:if` missing `props.val`, doubled unit suffixes, unsafe `parseDate` patterns, a network allowlist that doesn't match exactly, an `.xpage` root that doesn't make room for the container chrome, routes pointing at pages that don't exist, invalid credential declarations.
- **What it can't catch**: whether a value path is right, whether a method name exists, what the widget looks like, whether it's unreadable in dark, whether the empty state is blank. None of that is visible statically.
- **The default profile is `personal`**, which skips the publishing-oriented sections: store presentation, both languages, widget size coverage, first-paint cache. Before publishing you must run `--profile publish` as well, or you get "green locally, rejected on submission".

Seven of the codes exist purely to catch writing that is **wrong but raises no error anywhere**. They run in both profiles, so a single `check` already covers this pass:

| Code | What you see | What is actually wrong |
|---|---|---|
| G31 | One spot is always empty, or always takes the `findNotEmpty` fallback | You called a method that doesn't exist (there is no `abs` / `avg` / `filter` / `groupBy` / `indexOf` / `push`), and an unregistered method **silently evaluates to empty** |
| G32 | The whole widget won't render, with a clean log | A `$[method]` in `x` / `y` / `w` / `h` / `fontSize` / `lineWidth` / `maxWidth` / `maxHeight`; when it can't be evaluated the whole string is handed to layout, and layout fails outright |
| G33 | One node silently isn't drawn, leaving a hole in the widget | A layout anchor `{parent.w}` / `{id.h}` inside the arguments of `$[method::(…)]` (the two scopes don't mix) |
| G34 | One spot shows a language code or a theme name instead of your value | The `resultFilter.keys` of a `.df` exposes the reserved keys `lang` / `theme`, and the render layer's same-named injection **wins, because it writes last** |
| G35 | A blank area that looks like you forgot to write the string | A `${@i18n.k}` referenced at the `.xpage` node level isn't in that page's top-level table, so the lookup fails and it evaluates to an empty string |
| G36 | Taps do nothing and no error appears | An event value starts with `${` — the dispatcher classifies by first character before interpolating, and a string that starts with an interpolation looks like none of the categories |
| G37 | The user fills in a settings page, comes back, and the widget is unchanged until it heals itself a while later | A `data.set` / `data.merge` / `data.remove` in an `.af` writes to disk with no `widget.refresh`, so the first thing the widget's reload hits is the image rendered from the old data |

### 1.2 `numable run` — the data layer, for real

```
numable run
numable run --full
numable run --flow quote
```

Runs every `.df` through the real ActionFlow engine, **hits the network for real**, and enforces the `manifest.network` allowlist (the same rule the device applies).

- **What it catches**: whether the data source is still alive, whether the value path `${resp.a.b}` is right, whether your processing logic is right, which key is empty. It prints a summary by default; `--full` prints the complete value of every key — **read them key by key**, this is your only chance to find "there is a value, but it's the wrong one" (the summary only reports shape).
- **What it can't catch**: what the widget looks like; whether the key names referenced in `.rcn` line up with the output here (misspell one letter and this layer is still all green).
- `network_blocked:…` in the output means that host is not in `manifest.network`, and it will be silently blocked on the device too. `network_blocked:redirect_escaped:<host>` is the same thing in another shape: the starting URL is on the allowlist, but it redirects to `<host>`, which is not (redirects are checked hop by hop, the same rule as the app).
- Packages that need a key: put the test key at `<package>/.numable/params/_credentials.json` (that folder never ships in the package). See `numable docs credentials`.

### 1.3 `numable render` — three-state renders

```
numable render
numable render --widget quote --states light,dark,empty
```

In the same process it first runs `run` to get real data, then uses the real RCN render core to draw every widget to PNG: **light / dark / empty**, three images, written to `<package>/.numable/render/`, plus a generated `index.html` contact sheet.

- **What it catches**: a widget that won't render at all (error or solid white), text overflowing the widget, unreadable dark mode, a blank empty state, misaligned numbers, missing icons. **The empty column matters most** — the most common failure isn't a crash, it's silent blankness after a failed fetch.
- **What it can't catch**: glyph metric differences on phones, home-screen widget behavior, taps and interaction. Those only show up once it is installed in the App.
- The command prints the first 8 browser-side warnings/errors at the end; when a whole widget won't render, read those lines first.

> If all three layers are green and it's still broken, the problem is in the "only happens in the App" family: home-screen widgets, tap handling, container overlays, language switching. Jump to the matching group below.

---

## 2. Symptom index

### 2.1 Whole widget missing / solid blank / "wasm not ready"

What this group has in common: **if RCN source parsing fails, the whole widget doesn't render** — it isn't one cell going missing. In the editor it shows up as "wasm not ready"; in `render` that widget errors out or comes back white.

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| Whole widget white / renderer returns null | Some cell is missing `type` (usually a comment object or an `op` shorthand mixed into `cells`) | `check` catches it (scans `cells` / `react` / `children`) | Give every cell a `type`; rename comment keys to `_note` | `numable docs rcn` |
| Whole widget white | A `$[method]` in a size/coordinate field (`x/y/w/h/fontSize` only accept `${variable}` and layout expressions) | `render` errors; `check` can't catch it | Compute it with `op:set` in the `.df` first, then write `"${w1}pt"` here | `numable docs rcn` |
| Whole widget white | Doubled unit suffix, e.g. `"14.0ptpt"` | `check` catches it ("doubled unit suffix") | Drop one | `numable docs rcn` |
| Whole widget white | `cornerRadius` written as a string | `render` errors | Write the four-corner object `{"leftT":"8pt","leftB":"8pt","rightT":"8pt","rightB":"8pt"}` | `numable docs rcn-nodes` |
| Whole widget white | A field name that doesn't exist (e.g. `visibility`, `letterSpacing`, `lineDash`) | At the `render` layer; if it isn't in the field table, it doesn't exist | Hide with `hide` (`"0"`/`"1"`/`"2"`); there are no dashed lines and no letter spacing, so don't write them | `numable docs rcn-nodes` |
| Whole widget white, only with certain data | `path.d` is assembled from data and picked up a comma (commas are argument separators) | Re-run `render` with a different data set | Separate everything in `d` with spaces | `numable docs rcn` |
| Whole widget white, only on days the fetch fails | `line.points` has an empty slot, or a size string where `calc` produced null and `pt` was appended to it | `numable render --states empty` | Wrap every value in `$[findNotEmpty::(…, 0)]`; fall back to `-99` for endpoints and `999` for y | `numable docs rcn` |
| Whole widget white, package won't open at all | JSON syntax error (trailing comma, missing quote) | `check` catches it (reports "JSON syntax error") | Fix the JSON. In the App this shows as the widget not rendering with a clean log | `numable docs layout` |
| The banner at the top of the Tools page is one blank block, everything else is fine | `banner.xbanner` has no `scene` (it has no size class to inherit, so it must declare its own dimensions) | Open the Tools page in the App | Add `"scene": {"width": 338, "height": 190, "corner": 18}` | `numable docs layout` |
| Whole widget white on the day a value goes to 0 | A division by zero makes a width NaN; or a progress bar built from a `layer` width, where the corner radius exceeds a width of 0 | `--states empty` | Wrap the denominator in `max::(x,1)`; build progress bars and markers from `line` + `lineCap:"round"` | `numable docs rcn` |

### 2.2 A field shows `--`, or a whole area is empty

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| `run` reports success but every field is empty | The value path `${resp.a.b}` is off by one level | `numable run --full` against the real response shape | Fix the path | `numable docs df` |
| The widget is all `--` while `run` is all green | `depends` uses the bare-string form → the input parameters get swallowed | `check` catches it (reports "depends uses a bare-string binding") | Write `{"flow":"@[file://flow/x.df]","params":{"secid":"${secid}"}}`; write `params:{}` even when the flow takes nothing | `numable docs xwidget` |
| `run` and `render` are all green, but on iOS / HarmonyOS the widget always fails or is all `--` | `timeout` on a `request`, a value in `queryParams` / `header`, or `timestamp` on a `sleep` is written as a number: on HarmonyOS parameter parsing fails and the step never runs, and for `queryParams` / `header` the same happens on iOS; the web engine and the CLI run it fine | `check` catches it (G52) | Always write a string, `"8000"`; wrap a computed number in `parseNumber::(…,0)` | `numable docs df` |
| One spot on the widget is always empty / always falls back | A `${x}` in `.rcn` isn't in the `resultFilter` output of that widget's `.df` (shell params aren't in the render scope) | `check` catches it (G28) | Pass the parameter into the `.df` via `depends.params`, then expose it through `resultFilter` | `numable docs xwidget` |
| The fetch never happens at all | The `@[file://…]` path is relative to the wrong base | No network record for that widget in `run` | The widget host's base is `xWidget/` (`@[file://flow/x.df]`); the page host's base is the package root (`@[file://page/flow/x.df]`) | `numable docs xwidget` |
| A field right after `concurrent` is null | Concurrent results only become visible one beat later | `check` catches it | Insert a barrier in between: `{"op":"set","props":{"key":"_barrier","value":"1"}}` | `numable docs af` |
| A `concurrent` block succeeds in 3ms and every field is empty | It was written in the `op` slot | Suspiciously short duration in `run` | Write `"action":"concurrent"` | `numable docs af` |
| Reading a concurrent branch id inside an `op:if` branch gives empty | The nested evaluation scope can't see it | `run --full` | Move the read up to the top level, or go back to serial | `numable docs af` |
| A computed key just disappears | The method name doesn't exist → **an unregistered method silently evaluates to empty** | Look the method name up in `numable docs methods` | There is no `abs` / `avg` / `filter` / `push` / `indexOf`; for absolute value write `$[if::(ge::(${v},0),${v},calc::(0-${v}))]` | `numable docs methods` |
| A hand-written `nav.open` with `fallback` stops falling back after you open and save it in the App's flow editor | The flow editor only saves the parameters it knows about, so `fallback` gets stripped | Open the `.af` and check whether `fallback` is still there | Edit that flow as text; don't save it through the flow editor | `numable docs af` |
| `$[index::(${obj},${key})]` returns empty for an object member | `index::` reads by position; to read an object by key use `get::(${obj},${key})` | `run --full`, see whether the key disappeared | Switch to `get::` | `numable docs methods` |
| `$[get::(${obj},${key})]` finds nothing | A `${}` inside method arguments can't see flow input parameters, only keys already materialized in the flow (an action's `id` result, an `op:set` key) | `run --full` | Materialize the input parameter into a key with `op:set` first | `numable docs df` |
| A branch always takes else even though the code looks right | An `op:set` references a key that is defined after it (there is no dependency graph) | Read the order line by line | Dependencies first, derived values after | `numable docs df` |
| That one `${a[${i}]}` is always empty, and it also wipes out the default params | Nested subscripts aren't supported | `run --full` | The only dynamic subscript is `$[index::(${arr},${i})]` | `numable docs methods` |
| You clearly `set` it but can't read it | `data.get` / `request` are also one beat late; or a key `set` inside an `op:if` branch is gone once the branch ends | `run --full` | Insert a barrier; compute values with nested `if::` in expressions and use `op:if` only to dispatch actions | `numable docs af` |
| `sleep` doesn't wait | The parameter is named `timestamp`, not `duration` | Duration in `run` | Rename it | `numable docs af` |
| Two render-layer keys get mysteriously overwritten | You named business keys `lang` / `theme` (the render layer injects values under those names) | Compare `render` against `run --full` | Rename them, e.g. `srcLang` | `numable docs rcn` |
| The steps you factored out for reuse never run at all, yet the flow reports success | `op:include` always expands to nothing in `.df` / `.af` — it isn't "file not found", that path simply isn't wired up | `run --full`, check whether the keys those steps produce are there | Copy the steps back inline, or split them into a standalone `.df` bound through several `depends` entries | `numable docs af` |
| `htmlParse` / `xmlParse` extracts no keys at all | `rules` was written as an object — it is an **array** | `run --full`, check whether that step's output is `{}` | Write `"rules": [{"key":"…","selector":"…"}]` | `numable docs df` |
| `run` succeeds, `data={}`, and you used `xmlParse` | XML engines differ from platform to platform, and this layer has no XML parser either | `run` | Switch to `formatType:"string"` + `split::` | `numable docs df` |

### 2.3 A literal shows on the widget (the expression is drawn as-is)

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| Half a `$[…]` drawn in one cell | That cell's `x/y/w/h` contains interpolated subtraction, e.g. `"${v}pt-24pt"` | `render` | Compute the geometry in the `.df` and write only `"${v}pt"` here; do layout-anchor arithmetic as `"({parent.w}-{a.w})/2"` | `numable docs rcn` |
| `${@i18n.xxx}` appears on screen, or that spot is blank | The key isn't in the table that carrier reads: an `.rcn` reads the rc table, the XPage node level reads the `.xpage` top-level table | `numable check` (G8 / G35) | Add the key to the matching table | `numable docs i18n` |
| A page title renders as an expression | `route.title` references `${@i18n.…}` (it is a metadata field the host displays directly) | `check` catches it (G8) | Bare `title` plus a sidecar `routes[i].i18n["en-US"].title` | `numable docs i18n` |
| Title renders as `Box ␣␣`, date shows 1970 | `depends.params` references a key that doesn't exist → the literal string is passed through as-is | `run --full`, check whether the first character is `$` | Line the key names up; if it isn't upstream, don't bind it | `numable docs page` |

### 2.4 Numbers / times are wrong

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| Android shows `17.0`, `Day 17.0` | `calc/max/min/floor/ceil` return doubles on Android; joining numbers with `connect::` does the same | Install it in the App and look; the images from `render` won't show it | Wrap in `$[round::(…)]` before it reaches `text` | `numable docs methods` |
| The empty state shows a colored "▼ --%" / "Processing" | `eq::` compares numerically whenever both sides convert to numbers: `eq::("00","")` and `eq::(empty,0)` are true | `render --states empty` | Test emptiness with the sentinel `$[if::(eq::(findNotEmpty::(${x},__none__),__none__),0,1)]` (**not `length::`** — see the next row) | `numable docs methods` |
| The normal state shows `--` instead (only with small data sets) | You used `length::` on **a number you computed yourself** to test presence → numbers always return 0 | `run --full` with a small data set | Switch to a sentinel flag `hasX = $[if::(eq::(findNotEmpty::(${x},__none__),__none__),0,1)]`: it holds for strings, numbers, empty strings and missing keys alike, and the number `0` counts as "has a value" | `numable docs methods` |
| A reminder never fires / a background job's `data.set` never runs once | The guard in `then` is written `$[gt::(length::(${x}),0)]` while `x` is a number (anything out of `calc::` / `length::`, and numeric JSON fields too) → the guard is always false | `run --full` and check whether that flag key is always `0` | Same sentinel form as above; when in doubt assume the value is a number | `numable docs alerts` |
| Time shows `1970-01-01` / `01-01 07:30` | `formatDate` was fed an empty value → treated as epoch 0 | `render --states empty` | Wrap it in a sentinel `$[findNotEmpty::(${atMs},__none__)]` and skip the time when you see the sentinel | `numable docs df` |
| "20673 days ago" on a phone, fine in the images from `render` | The `parseDate` pattern contains non-token letters such as `T`/`Z`: the browser engine lets it through, phones return null | `check` catches it | Use only `yyyy MM dd HH mm ss` plus `- : /` and spaces in the pattern; `subString::` out the pure date segment first | `numable docs methods` |
| The time is off by decades | A second-precision timestamp wasn't multiplied by 1000 | `run --full`, count the digits | For seconds use `$[calc::(${ts}*1000)]` | `numable docs df` |
| The widget says "0%" or "0 items" when nothing was actually fetched | `sum::([])` = 0 and `length::(empty)-1` = -1 get rendered straight out; GraphQL always returns 200 with the error in `errors[]` | `render --states empty` | Gate aggregate values behind an `ok` flag; don't emit the key at all when there is no data | `numable docs df` |
| Numbers aren't zero-padded | The wrong `parseNumber::` pattern | `run --full` | Use `$[parseNumber::(${v}, 0.00)]` | `numable docs methods` |
| The result is slightly off | The output of `if::` is fed straight into `calc::` | `run --full` | Materialize it with `op:set` first, then compute | `numable docs df` |

### 2.5 A node isn't drawn / wrong color / unreadable in dark

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| One node silently isn't drawn, everything else is fine | A layout anchor `{parent.w}` was put inside `$[calc::()]` (the two scopes don't mix) | `render` | Write anchors bare, in layout fields only | `numable docs rcn` |
| A node isn't drawn | It anchors to an id that doesn't exist, or uses something outside the six anchors | `render` | The cross-platform safe anchors are only `<id>.x/y/w/h/r/b` and `parent.x/y/w/h` | `numable docs rcn` |
| A white block in dark / unreadable | A single hard-coded color | `check` catches it (G7, both profiles); `render --states dark` | Write every `*color` containing a hex as a `light\|dark` pair | `numable docs rcn` |
| The dark color isn't the one you wrote | You wrote three segments `a\|b\|c` — dark takes the **last** one, the middle never applies | `render --states dark` | Exactly two segments | `numable docs rcn` |
| A whole block of color disappears (transparent) | The color is computed by the flow and unavailable in the empty state → bare empty = transparent | `--states empty` | `$[findNotEmpty::(${c},#8E939B)]` | `numable docs rcn` |
| Border / shadow doesn't show at all | `borderColor` without `borderWidth`, or `shadowColor` without a color | `render` | Always write them as a pair | `numable docs rcn-nodes` |
| A whole paint isn't drawn and nothing errors | One gradient stop failed to parse → the entire paint is discarded | `render` | Check each stop for `#RRGGBB` / `#AARRGGBB` (alpha first) | `numable docs rcn` |
| A whole gradient isn't drawn, yet the same gradient works when written on its own | It sits inside the arguments of a `$[…]`, and the commas between its stops aren't escaped → they are read as argument separators and the stops get cut in half | `render`; pull that string out and hard-code it once to check | Escape the gradient's commas inside method arguments as `\\,`: `"$[if::(eq::(${up},1),linear(#4AFF5C4D\\,#00FF5C4D)@90,…)]"` | `numable docs rcn` |
| The center / radius of a `radial(...)` isn't what you meant | You passed too few arguments after `@` — the missing ones default to `0.5` (centered, half-box radius) with no error | Zoom into the `render` | Write all three: `radial(#2BFFFFFF\\,#00FFFFFF)@0.5\\,0.34\\,0.78` (values 0–1) | `numable docs rcn` |
| A solid grey slab on a flat / unchanged day | The glow-style fallback color has no alpha | `--states empty` | Give the fallback an alpha, e.g. `#15…` | `numable docs rcn` |
| The dot at the end of a curve is clipped | The endpoint sits against the right edge of the cell | Zoom into the `render` | Rule: `point_x + lineWidth/2 <= cell.w`; put the endpoint in its own cell | `numable docs rcn` |
| Icons randomly don't show | The icon's `path.d` is passed in by the flow | Run `render` over several data sets | Write `d` as a literal, one `op:if` per candidate | `numable docs rcn` |
| A one-step-lighter divider is invisible in dark | Less than 10 channel difference from the background | Eyeball `--states dark` | Increase the contrast | `numable docs rcn` |
| A symbol on the widget leaves a blank gap | You used an emoji (the glyph pipeline can't render it) | `check` catches it (G30) | Use BMP symbols `★ ✓ ✕ ›`, or an image asset | `numable docs rcn` |

### 2.6 Text layout problems

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| Words run together, the spaces are gone | `connect::` eats leading and trailing spaces in its arguments; `richText.span.text` loses edge spaces the same way | `render` | Join text by interpolating inside a `txt` `text`: `"${a} ${b}"` | `numable docs rcn` |
| A pill pushes out of the widget when the text gets longer | You built it from a `layer` background plus a `txt`, with a hard-coded background width | `render` with longer text | A pill is one `txt` (it has its own `bgColor` / `padding*` / `cornerRadius`), `w:"-1"`, positioned off its own anchor `{parent.w}-{id.w}-14pt` | `numable docs rcn` |
| You set `maxLines` but get no ellipsis / no wrapping where you want it | `lineBreak:"1"` means wrapping is allowed and the ellipsis is off | `render` | If you want "…", turn `lineBreak` off | `numable docs rcn-nodes` |
| The main number and its unit are a dozen pt out of line / the lower half is empty | `txt` has no vertical centering — the box top is the glyph ink top | Measure pixels in `render` | Lay panels out by the actual line count; changing the font size means recomputing the previous line's baseline | `numable docs rcn` |
| Bold has no effect | There is no cell-level `bold`; writing one gets discarded | `render` | Pick the Bold variant of the `typeface`, e.g. `System-Bold` | `numable docs rcn-nodes` |
| An empty array leaves a hole in the widget | The empty-state skeleton is drawn inside the `forEach` | `--states empty` | Draw the skeleton outside the `forEach` | `numable docs rcn` |

### 2.7 Nothing happens when you tap / nothing changes when you submit

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| Taps do nothing at all | The event string starts with `${` (so it's read as an expression, not a navigation) | In the App; `check` can't catch this form | Write `"https://${tail}"` / `"numable://self/page/detail?id=${id}"` | `numable docs af` |
| Taps do nothing | The target route isn't in `router.json`, or the id in `numable://self/widget/<id>` doesn't exist | `check` catches it (G12) | Add the route; to open your own home page write `numable://self` | `numable docs page` |
| Tapping pops "tool 'self' is not installed" | You used `numable://self` inside `nav.open` (it is only valid for in-package routes) | In the App | Across packages, write the target package's ULID literally | `numable docs af` |
| Tapping the text does nothing, only blank space works | The tappable region is only on the background cell | In the App | Make the button a single `txt` cell and bind the event to it | `numable docs rcn` |
| `${id}` is a literal on the page that opens | Query interpolation only fills top-level scalars, not nested paths | `run --full` | Lift it to a top-level key in the `.df` | `numable docs af` |
| Long-pressing a widget has no "Edit parameters" item | `onEdit` was written inside `canvas` — `canvas` only understands `source` / `depends` / `refresh`, and events always hang off the shell's `events` | Open the `.xwidget` and see which level `onEdit` sits at | Move it to the top level: `"events": {"onEdit": "/edit"}` | `numable docs xwidget` |
| `onEdit` opens but pressing it changes nothing | That `.af` has no `widget.updateParams`, or the target page has no way to write back | `check` catches it (G12) | Add `widget.updateParams`; a form target needs `onSubmit`, an xpage target needs `events` | `numable docs add-interaction` |
| `onEdit` opens a blank page with no error | The af form references a path outside the package, or the file doesn't exist; the route form was written as a bare path | `check` catches it (G12) | The af base for a widget host is `xWidget/` | `numable docs xwidget` |
| The form saves but the widget doesn't budge, then fixes itself later | No `widget.refresh` after the write (the render cache was hit) | In the App | Follow every `data.set` with `{"action":"widget.refresh"}` | `numable docs af` |
| `widget.refresh` returns `{refreshed:0}` | A repeat call inside the 5-second throttle window; or the scope matched 0 widgets (matching 0 counts as success) | The flow's return value | Don't double-tap; check the `widgetId` | `numable docs af` |
| `widget.refresh` does nothing in a data flow | The render flow rejects that primitive outright; it isn't available in `.df` either | In the App | Call it only from `.af` event flows | `numable docs af` |
| A flow stops halfway | Event flows have a hard 15-second timeout, and there's a step waiting on the user | In the App | Mark actions that wait on a person `"interactive": true` | `numable docs af` |
| The spinner never goes away | `ui.hideLoading` is inside a conditional branch | Walk through the failure path | `hideLoading` must be on the main path, one that every branch goes through | `numable docs af` |
| No haptic feedback on tap, so users tap again | The first action in the event flow isn't `ui.haptic` | `check` warns (G22) | Put `ui.haptic` at `actions[0]` | `numable docs af` |
| Jumping to an external app does nothing | Jumps triggered by automatic paths (load, scheduled refresh) are always denied | In the App | The jump has to be triggered by a user gesture | `numable docs capabilities` |

### 2.8 Page problems (html / xpage / xform)

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| The top of the page is covered by the floating capsule | The `.xpage` root doesn't read `${@contentInset.top}`; the H5 page doesn't use `var(--xb-content-top)` | `check` catches it (G17, xpage side) | Write `"paddingTop": "${@contentInset.top}pt"` on the root; in H5 write `padding: calc(var(--xb-content-top) + 16px) …` | `numable docs page` |
| You made room for the chrome but it has no effect | The root is `layout:"pager"` (the pager branch ignores padding) | `check` catches it (G17) | Wrap it in a `list` root that carries the top inset | `numable docs page` |
| Every `fetch` in H5 fails | The container injects `connect-src 'none'` in its CSP; direct connections are welded shut | Look at the page console | Fetch data through `xbridge.runDataFlow` / `runActionFlow` (images aren't restricted) | `numable docs bridge` |
| H5 dialogs escape the container / differ across platforms | You used `window.confirm` / `window.alert` | In the App | Use `await xbridge.confirm(...)` / `xbridge.alert(...)` | `numable docs bridge` |
| `appInfo()` returns a Promise object | You forgot `await` | In the App | `const info = await xbridge.appInfo()`, then read `info.data.language`; only `language` / `locale` / `theme` are safe on all platforms | `numable docs bridge` |
| Every field in an H5 page is `undefined` / Cancel on a confirm dialog still goes ahead | The bridge's return value is used directly as data — call-type methods resolve an envelope `{ code, msg, data }` | In the App | The result is in `.data`; check `code === 0` first; `numable docs bridge` has a ready-made `call()` | `numable docs bridge` |
| An H5 flow call returns `-6 flow not found` | Wrong flow path or extension | `check` catches it (G12) | Use `.df` + `runDataFlow` for fetching, `.af` + `runFlow` for side effects | `numable docs bridge` |
| The page won't open / a different page opens | The `entry` base depends on the page type; the home page isn't first and isn't `/` | `check` catches it (G12) | For `html`/`xpage` the entry is relative to `page/`; a `form` entry includes `page/` itself. The home page is always `"path": "/"` and listed first | `numable docs page` |
| Tapping item A renders item B's content, with no error | The XPage root node declares a `params` fallback with the same name as a route input, overriding the query | Compare A/B in the App | Don't put same-named fallbacks on the root node | `numable docs page` |
| The last list items don't render on iOS | Only per-side padding was written, without keeping the `padding` base | In the App | Keep `padding` alongside the per-side values | `numable docs page` |
| Data doesn't move after going back a page | There is no `root.events.onVisible` event | In the App | Call `xpage.reloadPage` from the continuation of `nav.openForResult` | `numable docs page` |
| A field you wrote on an XPage does nothing at all, and nothing errors | These fields are not implemented: `virtualization`, `preloadCount`, `scrollEnabled` on `list` / `waterfall`, `direction: "vertical"` and `initialPage` on `pager`, and the events `onScroll` / `onVisible` / `onHidden` | Check anything you copied from elsewhere against this blocklist first | Delete them; get the effect another way (the per-layout fields are in the chapter below) | `numable docs xpage` |
| Focusing an input zooms the whole page on iOS | The H5 input control's font size is under 16px | `check` catches it (G15) | Set an explicit `font-size: 16px` or larger | `numable docs page` |
| A single-color page with white seams between blocks | The root's `gap` / `padding` weren't zeroed | In the App | For a single-color page, zero every root spacing and let each Canvas paint its own background | `numable docs page` |
| A small button closes the page when you miss it | The destructive button's hit area is too small | In the App | Hit areas ≥ 44×44 | `numable docs page` |

### 2.9 Network / credentials

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| No data on the device, clean log | The host isn't in `manifest.network` and the network guard blocked it silently | `run` prints `network_blocked:…`; `check` catches it (G3) | The declared hosts and the hosts actually used must match **exactly** | `numable docs layout` |
| `run` gets data locally but the widget shows "failed to load" on the phone (older CLI) / `run` reports `redirect_escaped` | The server 3xx-redirects to a domain outside the allowlist (every hop must be on it) | The `run` log line: `network_blocked:redirect_escaped:<host>` plus "X redirected to Y" | Request the final address directly (preferred); only if the redirect is unavoidable, declare its target in `network` too | `numable docs layout` |
| The API returns 401 even though the credential is filled in | An empty credential still sent half a header (`Bearer ` followed by nothing) | `run --full` with the credential fixture emptied out | Swap the whole header object with `op:if`; when you don't send it, send no key at all | `numable docs credentials` |
| The credential is silently downgraded to anonymous | `request.credential` contains a `${}` expression, or references an undeclared id | `check` catches it (G18) | Write the declId as a literal and declare it in `manifest.credentials` | `numable docs credentials` |
| A secret shows up in the render cache / a shared screenshot | The credential ended up in the `resultFilter` output | Look at the output keys of `run --full` | Expose only flags such as `hasToken` | `numable docs credentials` |
| Publishing rejected: params look like credentials | A key name in `.xwidget.params` contains token / secret / password / api_key | `check` catches it (G18, both profiles) | Use `manifest.credentials`; keep it out of params | `numable docs credentials` |
| `numable run` skips the whole package | A credential is declared `required: true` but there is no fixture | The output says "skipped (required credential declared but no fixture)" | Put a test key in `.numable/params/_credentials.json` (that folder never ships in the package) | `numable docs credentials` |

### 2.10 Nothing changed after an edit

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| You edited `.rcn` / `.df` and the preview is unchanged | The render cache is keyed by package content generation, and local packages detect changes by folder fingerprint | Change something obviously visible and try again | Trigger a reload after saving; reopen the preview if you have to | `numable docs workflow` |
| The images from `numable render` are still the old ones | You're looking at the previous run's PNGs in `.numable/render/` | Check the file timestamps | Re-run `numable render`; the `index.html` contact sheet is rewritten with them | `numable docs workflow` |
| The update doesn't take effect once installed on a phone | `manifest.version` wasn't incremented | Compare it against the published version number | Every release must bump `version` by 1 | `numable docs publish` |
| The data changed but the widget is stuck on the old value | That widget's `refresh` interval hasn't elapsed | Pull to refresh once by hand | For write operations, refresh actively with `widget.refresh` | `numable docs xwidget` |
| After a new release, a widget on the user's dashboard shows "Widget removed" | The new version deleted or renamed that `.xwidget`: the file name is the widget's identity | Compare `xWidget/` between the two versions | Never rename a widget file; to replace a widget, add a new file | `numable docs publish` |

### 2.11 Languages

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| Something is still Chinese in an English environment | The metadata table (B) has no `en-US` override: `manifest.i18n` / `.xwidget.i18n` / `routes[i].i18n` | `check --profile publish` catches it (G19 / G20 / G8) | Fill each one in | `numable docs i18n` |
| One widget mixes both languages | A key is missing from one language in the content table (A), so that key alone fell back to the other language | `check --profile publish` (G8) | Complete the key set in every language | `numable docs i18n` |
| A word that should stay blank shows Chinese | In the content table (A) an empty string is **a legitimate translation and does not fall back**; in the metadata table (B) an empty string means missing and keeps falling back | Compare the two tables | To leave it blank, write `""` in the A table; never write an empty string in the B table | `numable docs i18n` |
| A literal `${@i18n.x}` on screen, or a blank there | The key isn't in the table that carrier reads (the XPage node level reads the page table) | `numable check` (G35) | Add the key to the `.xpage` top-level `i18n` | `numable docs i18n` |
| After switching language the widget shows a skeleton first; offline it shows the empty state | The data cache is split by language: there is no stored data for the new language yet, it shows once fetched; offline there is no data for that language | Expected behavior | Pull to refresh once online | `numable docs i18n` |
| Widget text doesn't change after switching language | The text is hard-coded in the `.df` or `.rcn` instead of going through `${@i18n.key}`; or the API itself does not vary by language | Manual review | Add a top-level `i18n` table and switch the text to `${@i18n.key}`; to fetch by language read `${@app.language}` | `numable docs i18n` |

### 2.12 Refresh problems

| Symptom | Most likely cause | How to confirm | Fix | Chapter |
|---|---|---|---|---|
| Refreshing too often, quota burned through | `interval` is tighter than the upstream rate limit allows | Look at `canvas.refresh` in the `.xwidget` and how many requests its `.df` makes | Keep "requests per refresh × refreshes per hour ≤ upstream quota"; use the window form for time-of-day, `"09:30-15:00@10"` | `numable docs xwidget` |
| You wrote `"60"` and it refreshes only every 5 minutes | For free users, periodic refresh is slowed to every 5 minutes; Pro users get what you wrote | Check whether the account is Pro | That is the membership tier, not a problem in the package; do not promise updates faster than every 5 minutes in your copy | `numable docs xwidget` |
| A home-screen widget's data is frozen at "the last time the App was opened" (HarmonyOS) | The HarmonyOS service card process only reads the cover image — it doesn't render and doesn't go online | In the App | This is a platform capability difference, not a package problem; don't bet critical freshness on HarmonyOS home-screen widgets | `numable docs capabilities` |
| Pull to refresh does nothing (on a cached page) | The root `depends` has a first-paint cache but no `events.onRefresh` | `check --profile publish` catches it (G23) | In `onRefresh`, `data.remove` the cache key first, then `xpage.reloadPage` | `numable docs page` |
| The whole refresh path for a widget spins with no effect | The `.df` the widget consumes writes back to the cache with no switch | `check --profile publish` catches it (G23) | Gate the cache write-back on an input parameter `${_cache}`, off by default (the page passes `"_cache":1`, the `.xwidget` doesn't) | `numable docs df` |
| Good data gets overwritten by empty data after a failed fetch | The widget's `.df` has no `action:"error"` exit, so failures are reported as success | `check` catches it (G26, both profiles) | Test the main fields for emptiness → `error`; "the collection is empty" counts as success | `numable docs df` |

---

## 3. The full silent-failure table

The errors below **raise no error on any platform** and `check` can't catch them either (or only catches them in the publish profile). The only way to find them is reading `run --full` key by key, eyeballing the three `render` states, or human review. Walk this table once when a package is done.

| Only found by | Silent failure |
|---|---|
| Reading `run --full` key by key | A value path off by one level (the flow still reports success) · an unregistered method silently evaluating to empty (`abs` / `avg` / `filter` / `push` / `indexOf` don't exist) · a `${}` inside method arguments not seeing flow input parameters · reversed `op:set` dependency order making a branch always take else · `eq::` numeric comparison making an emptiness test true · `length::` always returning 0 for numbers · nested subscripts `${a[${i}]}` · `sum::([])` = 0 rendered as a real value · GraphQL always returning 200 with the error hidden in `errors[]` · a second-precision timestamp not multiplied by 1000 · `op:include` always expanding to nothing while the flow still reports success · `htmlParse` / `xmlParse` `rules` written as an object |
| `render --states empty` | A blank empty state · empty-state numbers rendered as 0 / 0.0 instead of `--` · `calc` producing null in a size string and killing the whole widget · flow-computed colors going transparent in the empty state · empty slots in `line.points` · an empty-state skeleton drawn inside the `forEach`, leaving a hole |
| `render --states dark` | A single hard-coded color turning into a white block in dark · the middle of three color segments never applying · a one-step-lighter color less than 10 channels from the background |
| Eyeballing pixels in `render` | `px` treated as a unit and scaled by density · `connect::` eating spaces · a pill pushed out by long text · the `txt` box top being the glyph ink top and throwing things out of line · a clipped dot at the end of a curve · a layout anchor inside `$[calc::()]` making a node silently not draw · gradient commas inside method arguments not escaped as `\\,` · `radial` given too few `@` arguments and defaulting to 0.5 |
| Only visible once installed in the App | An event string starting with `${` → taps do nothing · a missing `widget.refresh` after a write → submissions change nothing · `hideLoading` inside a branch → the spinner never stops · `numable://self` used inside `nav.open` · the hard 15-second timeout cutting off a flow that waits on a person · an XPage root `params` overriding the route query · Android rendering numbers as `17.0` · an unsafe `parseDate` pattern returning null on a phone · `xmlParse` engines differing from platform to platform · the batch of XPage fields that are not implemented (`onVisible` / `onScroll` / `virtualization` …) · `onEdit` written inside `canvas` → no edit item in the long-press menu · `banner.xbanner` missing `scene` → a blank banner block |
| Human review | A business key colliding with the reserved keys `lang` / `theme` · a credential in the `resultFilter` · one widget answering two questions · a not-ready state that says "none" instead of "not connected" · an interaction you can get into but not out of · a fixed-size grid drawing "not fetched" as 0 |

---

## Related

`numable docs lint-codes` · `numable docs workflow` · `numable docs methods`
