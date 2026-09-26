<!-- translated-from: zh-CN/1-guides/90-publish.md sha256:bf2d4e24bb91 -->

# publish — from personal use to publishing to the store

> Audience: the person building a source, and the AI working on their behalf. Both read this same page.

## Goal

Take a package you use yourself and turn it into one other people can install from the store, understand at a glance, and not be puzzled by after installing — then ship it.

Publishing itself **does not happen in the CLI**: the CLI only gets the package into a shippable state (`check --profile publish` with zero errors). Signing and upload happen in the publish panel of the Workbench in the desktop app (Mac / Windows), which is where your login identity and signing capability live.

## Before you start

1. The package is already error-free on the `personal` profile (you have been through `numable docs first-card`).
2. You are logged in to the desktop app — otherwise the publish panel just says you need to log in first.
3. The package is the one you authored in your workspace folder, not someone else's package installed from the store.

---

## Step 1 · Know what the two profiles differ on

`numable check` has two profiles. The `personal` profile skips nine sections, all of them things that do not affect whether the package runs, only whether other people can use it — left to good intentions, none of them ever get done, so only a check can enforce them.

| Section | What the publish profile additionally requires | What happens if you skip it |
|---|---|---|
| **G6** widget sizes | ≥3 `.xwidget` files per package, including one at size `22` and one at `42` or `44` | `22` is the smallest home-screen widget size, so without it the package cannot go on the home screen; a package with only small widgets cannot fill a dashboard screen |
| **G11 / G11b** identity assets | A `logo.png` at the package root, 512×512 square, **full-bleed**, with no rounded corners baked in | Missing image falls back to an initial-letter icon; bake in your own corners and the host rounds it again, so the two arcs disagree and an opaque background leaks a ring of color at the corners |
| **G19** store front | `manifest.subtitle` is required and ≤22 characters; `manifest.i18n["en-US"].title` and `.subtitle` are required | With no subtitle, the store row can only read "name + version"; with no English, English users see a column of Chinese |
| **G24** add-widget entry (same section as G19) | The add-widget entry is **one button** (`pickWidgets`), not a hand-copied widget catalog inside the page; do not write "Added" | A hand-copied catalog is a second source of truth: forget to update the page after adding a widget and users can never add it; only the panel knows whether adding succeeded, so an "Added" label inside the package will lie |
| **G20** English widget titles | `i18n["en-US"].title` and `.sub` on every `.xwidget` | In an English environment, dashboard widget titles, the widget panel, and the home-screen widget configuration list all show Chinese |
| **G21** title width | Display width of `title` ≤24 per locale (full-width counts 2, half-width 1), ≤16 recommended; `manifest.i18n` structurally valid, `category` using a platform enum key | The source grid tile title is always two lines, and the overflow **is not hidden, it is eaten by an ellipsis**, so users see half a name they cannot recognize |
| **G8 / G8b** bilingual content | The text tables in the package (`rc.i18n` in `.rcn`, top-level `i18n` in `.xpage` / `.af` / `.xform`) have matching keys in both `zh-CN` and `en-US`; hard-coded Chinese in user-visible fields is lifted out into keys | Chinese leaks onto widgets in an English environment; wherever a key is missing, the literal is rendered |
| **G23** first-paint cache | For packages with a detail page: the `.df` a page consumes needs three-state `data.get` / `data.set` caching (render from cache first, revalidate in the background, bypass on pull-to-refresh, never overwrite on failure); a cached page's root node needs `events.onRefresh`; **cache write-back in the `.df` a widget consumes must be gated by an input parameter that defaults to off**; no credentials in the cache | Every first paint waits a full network round trip; pull-to-refresh hits the cache again, so refreshing changes nothing; on the widget side the whole point of a refresh is "skip the cache and fetch", and another cache layer underneath makes the entire refresh chain spin idle |
| **G25** direct credential entry | A package that declares a `required: true` credential needs an entry point in `page/` going straight to `numable://app/mine?section=credentials` | Users install it, see an empty widget, and have no idea where to bind a key; "add the widget first, then follow the hint on it" is a detour, not an entry point |
| **G27** add-widget button styling | The add-widget button uses the platform baseline styling (height, width, shape and color are not customized) | Adding a widget is a platform action and users should recognize it instantly in any package; letting each package draw its own gives the same button six different looks |

Beyond that, every check that runs on both profiles (structure, allowlist must match exactly, DSL silent failures, route and credential declarations) still applies. The complete code table is in `numable docs lint-codes`.

---

## Step 2 · Run the full checks and fix them one by one

**Command**

```
numable check hn --profile publish
```

**What "right" looks like**: the goal is `0 error`. Coming straight from the `personal` profile, it usually looks like this:

```
Static checks · profile publish (full store-standard set)

── HN Top Story (hn) ──
✗ [01M200QWNNX1RFPNTX5S7M8PGW] only 1 widget, the standard requires ≥3
✗ [01M200QWNNX1RFPNTX5S7M8PGW] no 42/44 widget (the standard requires at least one wide widget)
! [01M200QWNNX1RFPNTX5S7M8PGW] no logo.png — will fall back to an initial-letter icon
· [01M200QWNNX1RFPNTX5S7M8PGW] 1 widget · layout[22] · 5KB · net[hn.algolia.com]

✗ check finished: 2 error / 1 warn
```

A suggested order for fixing them:

1. **Add widgets** (G6). Do not just resize the same widget — a wide widget should answer more (the top few entries, a trend bar), not be a small widget stretched out. After each new widget, go through `run` → `render` → the three-state renders again.
2. **Export a logo** (G11). 512×512, content filling the whole canvas, no margin and no rounded corners of your own at the four corners.
3. **Fill in the store front** (G19 / G21). `subtitle` says in one sentence what the package gives me, ≤22 characters; `title` short enough to read in one line. The English is not a machine translation of the Chinese, it is a fresh sentence an English user understands.
4. **Fill in the English** (G20 / G8). One `title` / `sub` pair per `.xwidget`; matching keys in both locales in each `.rcn`'s `rc.i18n`. How to do it: `numable docs localize`.
5. **First-paint cache** (G23), **credential entry** (G25), **add-widget button** (G24 / G27) — only packages with a detail page / with credentials / with an add-widget entry will run into these.

**Warnings (`!`) do not block publishing, but read every one of them.** Several of them mean "it works today, but English users / small-screen users are not seeing what you think they are".

After fixing, re-verify on two layers:

```
numable run hn
numable render hn --locales zh-CN,en-US
```

If the English column still renders Chinese, the text table is not wired up; if a literal `${@i18n.xxx}` appears on a widget, that key is missing in that locale.

## Before you publish · Read your on-screen text once more

`check` tells you whether things run, not whether the words are any good. Before handing the package to other people, go through every line users can see — in widgets, pages and reminders — against these points:

- **Write for users, not for yourself.** Users only want to know what happened, what it means for them, and what they can do. Implementation reasons (why it is 30 minutes, which endpoint broke) stay off the screen.
- **Use words users recognise.** The visual unit is a "widget" (组件 in Chinese), not a "card"; to users your package is a "source" (信息源), not a "package" or "bundle"; words like fetch / host / token / render become "get data" / "site" / "update". In Chinese, count widgets and sources with 个 and reminders with 条.
- **In Chinese, use full-width punctuation** (`，。：？（）`), put a space between Chinese and Latin text or digits ("每 5 分钟", "在 Mac 上"), and use the single `…` for an ellipsis.
- **Error messages come in parts**: what happened → what you can do. Write "Couldn't get data. Check your connection and try again.", not "Request failed 500"; **never ask users to do developer work** (read logs, change an API URL).
- **Don't promise what you can't deliver.** Not a word of "real time" or "on the dot every day" (see `numable docs alerts` for why).
- In English use sentence case (only the first word capitalised) and start buttons with a verb; write each language as natural sentences of its own rather than word-for-word translations.

---

## Step 3 · Publish from the Workbench in the app

The CLI does not publish. Go to the desktop app (Mac / Windows) → Workbench → find the package → Publish.

The panel asks for three decisions:

| Decision | Notes |
|---|---|
| **Version** | "Publish as v(next)" is checked by default. Each `(id, version)` can be published only once, and re-uploading one is rejected. If the content changed, let it go up by one |
| **Distribution region** | Overseas / China / global. Defaults to whatever the already-published version uses; the first publish defaults to overseas |
| **Checks** | Hitting Publish runs the static checks first, **using exactly the `--profile publish` rule set**. Any error blocks the upload and is listed line by line |

After a successful upload the panel shows one of two outcomes:

- **Published and live** — auto-approved, already in the store, visible to all users. This is the normal case.
- **Uploaded, pending review (draft)** — not visible to ordinary users; it reaches the store after platform review and signing.

Publishing is an **outbound action**: every byte in the package is signed and distributed to every user. Before you ship, confirm the package contains no keys, no local fixtures, and no private data — the `.numable/` folder never enters the package by design, and credentials are declared through `manifest.credentials` rather than written into files (see `numable docs credentials`).

---

## Step 4 · After publishing

**How the package reaches users**

At upload time the package is sealed into a signed `.xbundle`. The user taps install in the store → the client downloads it → verifies the signature and file hashes → unpacks it to disk → renders locally. Data is always fetched by the user's own device; it never passes through the server.

**Updates ride on `version` +1**

The app compares the version in the store with the version installed and only offers an update when the former is higher. Re-publishing without bumping `manifest.version` is the same as not publishing: the update is never noticed and installed users stay on the old build forever. Before shipping a new version, re-verify your changes on both the `run` and `render` layers — users install **all** of the package, not just the few files you touched.

**Your source folder and the published version are two copies**

The copy in your workspace folder is the **source**; it is never overwritten by the published version and never appears in the update badge (updates only apply to packages installed from the store). So:

- Keep editing locally and running `check` / `run` / `render` without affecting the version already shipped;
- To get your changes to users you must publish again (version +1);
- To see what users actually installed, install it from the store on another device (or under another account).

**What you can still do after shipping**

The Workbench lets you take down your own published packages; if a package is taken down or reported, you can appeal. Both live on the package list in the Workbench.

---

## Common mistakes

| Symptom | Cause | Fix |
|---|---|---|
| Hitting Publish immediately shows a list of red items and nothing uploads | The static checks found errors | Fix them as listed; running `numable check <package> --profile publish` in the terminal uses the same rule set and iterates faster |
| A message says the version is taken | The version bump was unchecked, so the same `(id, version)` was re-uploaded | Check "Publish as v(next)", or bump `manifest.version` by hand first |
| A new version shipped but users get no update prompt | `manifest.version` was not bumped | Bump it and publish again |
| The store shows half a name plus an ellipsis | The title exceeds what two lines of the grid tile can hold (G21) | Shorten `title` and put the full name in `subtitle` |
| Store row / widget titles are Chinese in an English environment | `manifest.i18n["en-US"]` (G19) or the `.xwidget`'s `i18n["en-US"]` (G20) is missing | Fill them in; `numable docs localize` |
| A white ring at the icon's corners | `logo.png` has rounded corners baked in over an opaque background, and the host rounds it again so the backing leaks (G11b) | Go full-bleed and fill the corners with the backing color |
| After installing there is one empty widget and users do not know a key is needed | A `required` credential is declared but the page has no direct entry point (G25) | Put numbered steps plus a direct button on the home page |
| A message saying the account is restricted from publishing | The account is on the publisher denylist | Contact the platform through in-app feedback |

---

## Next

- Fill in the English and the content text tables: `numable docs localize`
- Connect a data source that needs a key (and the four hard rules for credentials): `numable docs credentials`
- Error codes one by one: `numable docs lint-codes`
