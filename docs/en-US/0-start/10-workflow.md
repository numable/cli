<!-- translated-from: zh-CN/0-start/10-workflow.md sha256:e14580c90d4b -->

# workflow — the authoring sequence and the rules you cannot break

> Audience: the person building a tool, and the AI working on their behalf. Both read this same page.
> Read this chapter first — it defines the order in which a tool gets built and the lines you must not cross. For what is possible at all, see `numable docs capabilities`; for individual file formats, see the layout / xwidget / df / rcn chapters.

## What a tool is

A tool (an XBundle package) is **a folder**. Everything in it is plain JSON / HTML — no build output, no compile step. The App treats the workspace folder as its root: write the files and the package shows up in the App; change one character and a re-render picks it up.

The smallest package looks like this (the starter produced by `numable init`):

```
my-source/
  manifest.json                # identity and metadata: id (ULID) / version / title / category / network / i18n
  xWidget/
    clock.xwidget              # one widget declaration: size, instance parameters, data binding, refresh cadence, click behavior
    rc/clock.rcn               # the drawing for that widget (geometry + color + text, rasterized to one bitmap)
    flow/clock.df              # the data flow for that widget (request + processing, emits the keys the .rcn uses)
  page/
    router.json                # page route table (optional: no pages means no page/ folder)
    html/home/index.html       # the detail page the widget opens
  .numable/                    # local fixtures and output, never shipped in the package (numable init adds it to .gitignore)
```

Four kinds of files, one job each, and **they do not overlap**:

| File | Owns | Does not own |
|---|---|---|
| `manifest.json` | package identity, store front, network allowlist, credential declarations, base language | no business data at all |
| `.xwidget` | ties drawing + data + size + refresh + click together, and gives the default instance parameters | no drawing, no data logic |
| `.df` | fetching and processing: request, parse, derive, then emit a set of keys through `resultFilter` | never touches UI, never reads the theme (it may read `${@app.language}` and carry its own `i18n` table, see `numable docs i18n`) |
| `.rcn` | drawing: renders one widget from the keys the `.df` emitted | never makes requests, never does heavy computation |

Two more kinds are optional: detail pages under `page/` (html / xpage / form page types, see `numable docs page`), and `.af` action flows (clicks, parameter write back, refresh, see `numable docs af`).

## The authoring sequence

Seven steps. **Every step has a command that verifies it** — do not skip ahead. Jumping straight to drawing the widget and skipping step 2 is the single most common cause of rework: you finish the widget, then discover the value paths were wrong and the geometry and emptiness logic all have to be rewritten.

### 1. Clone to start

```
numable init my-source
numable init my-source --from ../an-existing-package
```

Clone from the template or from a package you already have; never hand-build a folder. The CLI generates the identity `id` (a 26-character ULID) and writes it into `manifest.id` / `manifest.domain`, and the folder layout and file extensions come out correct. `✓ 新包 …  id=…` means it worked.

### 2. Data first, widget second

Write the `.df` first and get the data flowing:

```
numable run my-source --flow clock --full
```

`--full` prints the complete output. **The keys you get back are the entire set of variables available on the widget** — including the flag you will use to test for emptiness, the time anchor you will display, and the fixed-length array that drives a line chart. The list of key names this step produces is the input to step 3.

`✓ clock {...}` with the key names you expected means it worked; on `✗`, fix the flow before going further. `run` enforces the network allowlist and prints `· 网络白名单已强制: [...]` — a host missing here is a host blocked at exactly the same place on a real device.

### 3. Draw the widget

Write the `.rcn` and render it:

```
numable render my-source --widget clock
```

Output lands under `my-source/.numable/render/`: one PNG per widget × light / dark / empty state × language, plus an `index.html` contact sheet. `render` runs `run` first, and any widget whose fetch failed is rendered with empty data — so the empty-state image is not decoration, it is exactly what users see on the day the source goes down. When you are only tuning layout and do not want a round of network calls every time (save it for sources with a daily quota), add `--no-run` to reuse the data from the last run. Next to the images, `<widget>.json` records each image's size and its tappable regions (`hits`: which area fires which event; empty means no cell has its own tap action, so a tap anywhere goes to the `.xwidget` `onClick`) — handy for checking tap targets.

If the package has pages (`page/`, the layer a widget opens when tapped), render those too:

```
numable render my-source --page
```

Every route in `router.json` gets a light and a dark full-page screenshot at phone width, saved as `page*.png` in the same folder. Data fetched by the pages goes through the same allowlist and fixtures as `run`, and blocked requests, page script errors and bridge methods that are not simulated are all printed. `form` pages and remote pages are not supported yet; open them in the app. Details in `numable docs page`.

### 4. Declare

Write the `.xwidget` to bind rc / df / size / refresh cadence / click behavior together. Two things go wrong most often:

- `canvas.depends` must be written as `{"flow": "@[file://flow/clock.df]", "params": {...}}` — a bare string swallows the input parameters and passes nothing (G12c);
- keys you want to display but that play no part in fetching still have to be emitted by the `.df` — `.xwidget.params` is not in the render scope (G28).

### 5. Static check

```
numable check my-source
```

Defaults to the `personal` profile and requires zero errors. It catches the class of problem that nobody finds unless a check finds it: an allowlist that does not match, a cell missing `type`, a wrong condition key in `op:if`, a concurrent result arriving one step late, a fetch failure with no `error` exit. The full code table is in `numable docs lint-codes`.

### 6. Show the renders for approval

Show the user the light / dark / empty images under `.numable/render/`. **It is not done until the user says so** — `check` and `run` cannot prove "it looks good" or "this is the widget they wanted".

### 7. Keep iterating

Whether the user edits by hand in the App's editor or asks the AI again, **they are editing the same source files**. After each change, only rerun the affected layer: `run` after changing a `.df`, `render` after a `.rcn`, `check` after a `.xwidget` or `manifest.json`.

## Command reference

These are the commands the seven steps use, plus a few switches you will not reach for every day but that save time when you do:

| Command | What it does |
|---|---|
| `numable workspace init [dir]` | turns a folder into an authoring workspace: writes a guide for the AI to read, after which you can simply state what you want to the AI from inside that folder |
| `numable init <dir> [--from <package dir>\|installed:<id>\|github:<name>]` | creates a new package (regenerating the identity ULID). `--from` takes any local package folder, a package installed in the desktop App (`installed:<id>`, Mac / Windows), or an official tool from the open-source repo [numable/tools](https://github.com/numable/tools) (`github:<folder or id>`, e.g. `github:weather`; `github:` alone lists them) |
| `numable init --job <id> --kind static\|once\|cross\|level\|changed\|task` | adds an alert / background job to the package in the current folder and raises `manifest.minEngine` if needed, see `numable docs alerts` |
| `numable check [package…] [--profile personal\|publish]` | the static gate |
| `numable run [package…] [--flow a,b] [--file x.df] [--full] [--fixtures <dir>]` | really runs the data layer. `--file` runs any single `.df`, including a probe flow no widget is bound to |
| `numable render [package…] [--widget a,b] [--states light,dark,empty] [--locales zh-CN,en-US]` | renders images |
| `numable render [package…] --page [/route,…] [--locales zh-CN,en-US]` | renders pages (html / xpage, light + dark full-page screenshots) |
| `numable docs [topic] [--toc] [--section word] [--search word]` | reads this documentation. For a long chapter, `--toc` shows the outline, `--section` reads one part, `--search` searches every chapter |
| `numable doctor [package…]` | checks the environment, engine version and workspace; also checks npm for a newer CLI (the docs update with the CLI; when you are behind, `numable docs` prints one line at the end too; `NUMABLE_NO_UPDATE_CHECK=1` turns it off) |

Three global switches and three environment variables:

- `--json`: available on every command, switching the output to machine-readable JSON. Use it when a script or an AI consumes the output; do not parse the colored human-readable form.
- `--lang zh|en`: interface language (`numable docs` follows it too).
- `--fixtures <dir>`: runs `run` against a different set of fixtures. The default is `<package>/.numable/params/`; when you want to keep an "empty data" fixture set around for checking empty states, put it somewhere else and point this switch at it.
- `NUMABLE_PROFILE` / `NUMABLE_LANG` / `NUMABLE_CHROME`: save you typing `--profile` and `--lang` every time, and name the browser executable used for rendering.

## What each of the three verification layers covers

The three layers (check / run / render) are not substitutes for one another. A green light in any one of them says nothing about the others.

| Layer | Command | Catches | Cannot catch |
|---|---|---|---|
| Static | `numable check` | structural and field validity, allowlist match, credential declaration match, known silent-failure patterns (`cell` missing `type`, doubled unit suffix, `concurrent` one step late, dirty `parseDate` pattern, a data flow with no `error` exit) | wrong value paths, ugly layout, inverted emptiness logic |
| Data | `numable run` | whether the source is alive, whether the value paths are right, whether the derived values compute correctly, whether the allowlist blocks, whether the credential fixtures are complete | a wrong branch in the render layer (the value is there but the widget took the fallback path) |
| Render | `numable render` | overflow and clipping, dark-mode readability, an empty state that is just a blank widget, an unevaluated `$[...]` literal drawn onto the widget | glyph metrics and method differences on a phone (`render` uses a browser engine) |

Differences that only show up on a phone — glyph widths, number formatting, date methods — have to be looked at on a phone.

## Hard rules

Break any of these and the package is not finished. The "How it is caught" column tells you which layer catches it.

| Rule | How it is caught | Symptom when broken | Fix |
|---|---|---|---|
| **Source files are the single source of truth**: no generator scripts, no fixtures left behind | `check` G1b / G1 | fixtures ship with the package, or files sit where nothing loads them (written but never takes effect) | put fixtures in `.numable/params/`; RCN under `rc/`, flows under `flow/` |
| **The allowlist must match exactly**: the set of hosts requested by the `.df` == `manifest.network`, no more and no less | `check` G3 | too few: silently blocked on device, the widget is stuck at `--`; too many: the install panel lists domains you never use and alarms the user | align with the allowlist that `run` prints |
| **Secrets never ship**: not in `params`, not as a `.df` literal, not in `data.*` | `check` G18 | a plaintext secret is distributed to everyone with the package | declare `manifest.credentials` and use the local fixture `.numable/params/_credentials.json`, see `numable docs credentials` |
| **Never invent data**: if the fetch fails, let the flow fail — do not paper over it with 0, an empty string, or a fake timestamp | `check` G26 | the flow reports success on a failed fetch, empty data overwrites the last good data, and a plausible-looking fake number appears on the widget | test the load-bearing fields for emptiness → `action:"error"`; "the collection is empty" is a success, not a failure |
| **Time anchor**: a widget showing live data must show when the data is from | manual review (look at the `render` output) | the user cannot tell "unchanged" from "not refreshed for three days" | pass the timestamp all the way through to the `.rcn`; test for emptiness before feeding `formatDate`, or an empty value renders as 1970 |
| **light\|dark color pairs**: every hex color field in the `.rcn` is written `light\|dark` | `check` G7 | whole blocks invisible in dark mode, or white text on white | `"textColor": "#1A1A1A\|#FFFFFF"` |
| **Write units as `pt`** | `check` G28 (doubled unit suffix) + visual inspection of the `render` output | `px`: content shrinks into the top-left corner and type is too small; `14.0ptpt`: the whole widget fails to render and nothing reports an error | use `pt` for all geometry and font sizes |
| **Copy goes through i18n**: user-visible text is written `${@i18n.key}` | `check` G8 / G8b (publish profile) | half the widget is in Chinese in an English environment | put the text table in each asset's own `i18n`, see `numable docs i18n` |
| **Test emptiness with an explicit flag**: the sentinel form `$[if::(eq::(findNotEmpty::(${x},__none__),__none__),0,1)]` — never `eq::(x,)` / `eq::(x,0)`, and never `length::` (it always returns 0 for a number) | the `run` layer (point the URL at a 404 and run again) | the empty state renders self-contradictory output like a colored `▼ --%` | set a `hasX` flag in the `.df` and have the `.rcn` test only the flag |

## Personal use vs publishing

`check` has two profiles and defaults to `personal`:

| | personal (default) | publish (`--profile publish`) |
|---|---|---|
| Purpose | your own use / installed on the user's own machine | publishing to the store |
| Which gates run | structure, network, credentials, DSL silent failures, routes and interaction | all of them |
| What is skipped | store front (subtitle / name width / English coverage), logo, add-widget button layout, widget sizes (≥3 widgets, `22` plus `42`/`44` required), the bilingual gate, first-paint cache, direct entry point for credential binding | nothing |

```
numable check my-source --profile publish
```

A package for personal use does not have to satisfy the publishing requirements yet; run the publish profile when you want to ship, and fix whatever it reports — the process is in `numable docs publish`. Both are **the same package with the same ULID**: after you publish a package you were using yourself, a long-press on the widget the user already has upgrades it to the published version, data intact.

## What to read next

| What you want to do | Read |
|---|---|
| Understand what is possible and how the platforms differ | `numable docs capabilities` |
| Build your first widget end to end | `numable docs first-card` |
| Add a detail page to a package | `numable docs add-page` |
| Add clicks, parameter editing, forms | `numable docs add-interaction` |
| Connect a source that needs a secret | `numable docs credentials` |
| Ship in both Chinese and English | `numable docs localize` |
| Add an alert or a background job | `numable docs alerts` |
| Go from personal use to the store | `numable docs publish` |
| Look up how to write a given file | `numable docs layout` · `xwidget` · `df` · `rcn` · `af` · `page` · `bridge` · `i18n` · `params` |
| Build a declarative page (eight layouts, conditional visibility, input fields, infinite scroll) | `numable docs xpage` |
| Look up node fields / methods / error codes | `numable docs rcn-nodes` · `methods` · `lint-codes` |
| Look up which keys the builtins (`@app` / `@device` / `@time` / `@contentInset` …) expose | `numable docs builtins` |
| The widget is empty, the click does nothing, the edit changed nothing | `numable docs pitfalls` |
