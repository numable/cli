<!-- translated-from: zh-CN/2-reference/78-builtins.md sha256:aa2b51c31669 -->

# builtins — the built-in variables (@app / @i18n / @env / @device / @time / @contentInset / @safeArea / @window / @fetch / @event)

> Audience: people building a source, and the AI working on their behalf. Both read this same page.

## What it is

A set of root variables starting with `@`, injected by the platform so you never pass them yourself: which device this is, which language, what time it is now, how wide the container is, whether what is on screen is fallback data. They live in a different namespace from the package's own data — a field called `time` inside the package and `@time` can never overwrite each other.

You read them like any other variable: `${@time.nowMs}`, `${@window.width}`, and they work inside method arguments too: `$[formatDate::(${@time.nowMs},HH:mm)]`.

Two things to get straight first:

- **Not every root exists in every file type.** Write a root that is not available where you are and it evaluates to empty, with no error — the symptom is a blank slot, or a condition that is permanently false. Every root below states which files it is available in.
- **`@i18n` is readable in both `.df` and `.af`** (the host page's table ⊕ this file's top-level `i18n` table); the language built-ins (`@app.language` / `@device.language` / `@time.locale`) may be read in a `.df` as well. How to fetch by language and produce text in the data layer is in `numable docs i18n`.

## A minimal working example

In a widget's RCN: the time anchor, a fallback hint, and a width that follows the container:

```json
{
  "type": "txt",
  "id": "anchor",
  "x": "16pt", "y": "12pt", "w": "${@window.width}pt",
  "text": "$[if::(eq::(${@fetch.stale},1),${@i18n.stale},formatDate::(${@time.nowMs},HH:mm))]"
}
```

## How to write it (root by root, key by key)

### `@app` — the app itself

| Key | Type | Example | Where it works |
|---|---|---|---|
| `platform` | string | `ios` / `android` / `harmony` / `win` / `web` | `.df` |
| `name` | string | the app name | `.df` |
| `versionName` | string | `1.8.0` | `.df` |
| `buildNumber` | string | `2410` | `.df` |
| `appId` | string | the install identifier | `.df` |
| `language` | string | `zh-CN` | `.rcn` `.xpage` `.xform` `.af` `.df` |
| `locale` | string | `zh-CN`, same value as `language` | `.rcn` `.xpage` `.xform` `.af` `.df` |

⚠️ **`@app` carries different things in the two families of files**: in rendering and event files (`.rcn` / `.xpage` / `.xform` / `.af`), `@app` guarantees only `language` and `locale` — the five environment keys above cannot be read there. To branch on platform, read `${@app.platform}` in the `.df`, land the conclusion in a top-level key and expose it (`isIos = $[eq::(${@app.platform},ios)]`); the rendering layer looks only at that key.

### `@i18n` — the content table for the current language

`${@i18n.<key>}`, and the value is a string. **Which table you can read depends on the file type**; the rules, the fallback chain and the meaning of an empty string are all in `numable docs i18n` and not repeated here. The two people hit most: a key cannot be assembled dynamically, and a reference that cannot be resolved is displayed on screen verbatim.

In a `.df` / `.af` you read the host page's table ⊕ this file's top-level `i18n` table; a flow attached directly to a `.xwidget` has no host table, only its own.

### `@env` — the runtime environment

| Key | Type | Example | Where it works |
|---|---|---|---|
| `name` | string | `debug` / `release` | `.df` `.af` |
| `debug` | boolean | `true` / `false` | `.df` `.af` |

Use it to log while developing, or to point temporarily at a test endpoint. **Do not leave it in a published package as a switch**: what users install is always the `release` branch, so the other branch is dead code.

### `@device` — the device

| Key | Type | Example | Where it works |
|---|---|---|---|
| `osName` | string | `iOS` / `Android` / `HarmonyOS` / `Windows` | `.df` `.af` |
| `osVersion` | string | `17.4` | `.df` `.af` |
| `brand` | string | the manufacturer | `.df` `.af` |
| `model` | string | the model | `.df` `.af` |
| `isTablet` | boolean | `true` / `false` | `.df` `.af` |
| `language` | string | the system language | `.af` `.df` |
| `platform` | string | `ios` / `android` / `harmony` / `win`; supplied by the host, **not guaranteed to be there** | `.df` |

⚠️ The host may replace `@device` wholesale with a root of the same name (in a data flow driven by a page it often carries `platform` and nothing else). So **do not branch on device details inside a data flow**; if you really must branch, land the decision in an explicit top-level key, or have the caller pass it in as a parameter (see `numable docs params`).

### `@time` — time

| Key | Type | Example | Where it works |
|---|---|---|---|
| `nowMs` | number | `1757308800000` (epoch milliseconds) | `.df` `.af` `.rcn` `.xpage` |
| `timeZoneId` | string | `Asia/Shanghai` | `.df` `.af` `.rcn` `.xpage` |
| `locale` | string | the current locale | `.af` `.rcn` `.xpage` `.df` |

- `nowMs` **is cached within a single evaluation**: reference it several times in one expression (or even across one render pass) and you get the same value every time. To work out "how long ago", subtract the timestamp in the data from `nowMs`; do not expect two reads to differ.
- Remember to guard the time anchor against empty; the pattern is in "The six rules you must keep" in `numable docs df`.

### `@contentInset` / `@safeArea` / `@window` — container geometry

| Root | Keys | Type | Notes |
|---|---|---|---|
| `@contentInset` | `top` `right` `bottom` `left` | number (pt) | the safe area **plus** the container's own floating chrome (the capsule, the top bar, the ✕, the bottom navigation) and the keyboard |
| `@safeArea` | `top` `right` `bottom` `left` | number (pt) | the system safe area only. Any edge where the container does not touch the screen is always 0 |
| `@window` | `width` `height` | number (pt) | the size of the **container**, not of the physical window |

Where they work: XPage nodes, the `.rcn` of a canvas inside a page, and the `params` of an `.af` event binding. **A data flow (`.df`) has none of the three** — write one there and it evaluates to empty, so every size you compute comes out as 0.

- **To stay clear of the UI, always use `@contentInset`.** Reading `@safeArea` runs you into the floating capsule: on a large screen the container does not touch the edge of the screen, so all four sides of `@safeArea` are 0 while the capsule still floats right there.
- All three are **values that change** (folding, rotation, split screen and the keyboard all re-issue them), so do not cache them into a key of your own as if they were first-frame constants.
- A page normally needs **none of them**: the container already lays the content out in the right place. Only a page that needs fine control (a hero image running up under the status bar, say) reads them.
- `@window.width` is the container width, not the screen width. On a large screen the container is a single phone-width column of widgets, and drawing to the screen width draws outside it.

### `@fetch` — is the data on this screen fresh

| Key | Type | Value | Where it works |
|---|---|---|---|
| `stale` | number | `1` = this fetch attempt failed and what is rendered is the last successful data; `0` = what is on screen was just fetched | `.rcn` |

It always has a value and is never absent, which makes `eq::(${@fetch.stale},1)` a reliable test. The typical use is to swap the time anchor for a "last updated …" line, rather than leaving the user to read a stale number as if it were live:

```json
{ "type": "txt", "id": "tip", "x": "16pt", "y": "40pt",
  "text": "$[if::(eq::(${@fetch.stale},1),${@i18n.stale},${at})]" }
```

⚠️ It means **the fetch failed and fell back**, not "this data came from a cache". Switching theme is a pure re-render that by design does not fetch, and there it is `0`; switching language refetches, and after a successful fetch it is `0` as well. The data cache is split by language: after a switch there is no old data for the new language to fall back to, so a failed fetch shows the widget's empty or error state rather than `stale=1`.

### `@event` — what this interaction brought with it

Only an `.af` action flow has it, and the keys differ by touchpoint (which element was tapped / what was typed / which page was swiped to). The full table is in `numable docs af` and is not repeated here.

## Rules (breaking one means rework)

| Rule | How it is checked | Symptom when broken | Fix |
|---|---|---|---|
| Use `@contentInset` to stay clear of the UI, not `@safeArea` | manual review / the render layer | content sits under the floating capsule, visible only on a large screen or on a page that has one | switch to `@contentInset` |
| Size against `@window`, not the screen width | the render layer | on a large screen content is drawn outside the container | switch to `${@window.width}` |
| The rendering layer does not read environment keys such as `@app.platform` | at the run layer (that slot is empty / the condition is permanently false) | the branch always goes the same way | decide it in the `.df` and expose a flag |
| A `@i18n` key is never assembled dynamically | the render layer (the template string is displayed as is) | that slot shows `${@i18n.xxx}` | split it into fixed keys |
| Built-in variables never take part in a cache key | manual review | the cache splits by language/theme, or never hits because of a timestamp | key the cache on a stable business identifier only |

## When something goes wrong

| Symptom | Most likely cause | What to do first |
|---|---|---|
| `${@window.width}` computes to 0 | container geometry was read inside a `.df` | move it onto an XPage node or a canvas |
| `${@app.platform}` is empty on the widget | the rendering layer's `@app` has only the two language keys | read it in the `.df` and expose it as a top-level key |
| `${@i18n.xxx}` shows up on screen | that key is missing from this table, or the key was assembled | add it to that file's `i18n` table |
| "how long ago" is always 0 | `@time.nowMs` is the same value within one evaluation | subtract the timestamp in the data from `nowMs` |
| content sits under the bottom capsule | `@safeArea` was used | switch to `@contentInset` |
| `eq::(${@fetch.stale},1)` is never true | this value exists only in `.rcn` and was written elsewhere | move it back into the `.rcn` |

## See also

`numable docs i18n` · `numable docs af` · `numable docs df`
