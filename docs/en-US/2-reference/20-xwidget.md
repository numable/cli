<!-- translated-from: zh-CN/2-reference/20-xwidget.md sha256:a2c9c7db1bfa -->

# xwidget — the widget declaration (.xwidget)

> For the full field table (what is required, where it is edited, what each one does) see `numable docs xwidget-fields` — that table is generated from the editor contract and cannot drift from the code. This chapter is about the rules and the idioms.

> Audience: people building a tool, and the AI working on their behalf. Both read this same page.

## What it is

One widget = one `xWidget/<name>.xwidget` file. It is a **shell plus one pure rendering recipe**: the shell decides what this widget is called in the dashboard and the widget panel, how big it is, where a tap goes, and whether its parameters can be edited; the recipe (`canvas`) decides how it fetches data, how it is drawn, and how often it refreshes.

The same `.xwidget` is consumed in three places at once: the in-app dashboard, the picker list in the widget panel, and the home-screen widget. That is why the size code is not an arbitrary number — it decides whether this widget can go on the home screen at all.

A package holds **several** widgets, not one: `22` is the common small square, and publishing requires at least 3 widgets including one `22` and one `42`/`44`.

## A minimal working example

The complete declaration of a quote widget — copy it and edit:

```json
{
  "version": 2,
  "title": "Stock",
  "sub": "Price and its 2-month shape",
  "i18n": { "en-US": { "title": "Stock", "sub": "Price and its 2-month shape" } },
  "layout": 22,
  "params": { "secid": "1.600519" },
  "events": {
    "onClick": "/detail?secid=${secid}",
    "onEdit": "/edit?ref=quote&secid=${secid}"
  },
  "canvas": {
    "source": "@[file://rc/quote.rcn]",
    "depends": [
      { "flow": "@[file://flow/quote.df]", "params": { "secid": "${secid}" } }
    ],
    "refresh": {
      "interval": ["09:30-16:10@60", "21:30-05:00@60", "3600"],
      "at": ["15:05", "16:05", "05:05"],
      "tz": "Asia/Shanghai"
    }
  }
}
```

## How to write it

### Fields

| Field | Required | Type | Values / one-line caveat |
|---|---|---|---|
| `version` | yes | int | always `2` |
| `title` | yes | string | widget name (shown in the dashboard, the widget panel, and the home-screen widget configuration list). The bare value is in the language given by `manifest.lang` |
| `sub` | yes | string | subtitle, must fit on one line. Follows the title in the widget panel |
| `i18n` | recommended | object | `{ "<locale>": { "title": …, "sub": … } }`; only these two keys are read |
| `layout` | yes | int | two-digit grid code, see below |
| `params` | no | object | default values for the widget's instance parameters, **scalars only** |
| `events` | no | object | only the two keys `onClick` / `onEdit` |
| `canvas` | yes | object | `{ source, depends?, refresh? }`, only these three keys |
| `jobs` | no | array | Which reminders a long-press on this widget can create, each `{ id, params? }`. `id` is the file name of `xJob/<id>.xjob` in this package; `params` maps widget instance parameters onto reminder parameters, and a value **may only be `${widgetParam}` or a literal** (fetch output is a result, not an identity, and does not exist at the moment of the long press). Leave the key out and the long-press menu has no "Add reminder". See `numable docs alerts` (G46) |

Only the top-level keys in the table above are read: keys such as `scene` `preview` `previewData` `kind` `order` `open` have no consumer and raise no error, so do not write them. There is no `params` inside `canvas`, no `events` either, and **no `onEdit`** — `canvas` reads only `source` / `depends` / `refresh`, and an `onEdit` written inside it has no consumer at all (interaction events hang off the shell's `events`). This is the easiest block to drag along when cloning an existing package, and it copies without complaint: long-pressing the widget simply has no "Edit parameters".

### `layout`: the grid code and the resulting size

Two digits: **tens = cells wide, units = cells tall**, each digit from `1` to `9`, so any two-digit code between `11` and `99` is valid — it is not a set of four presets. The pixel size follows from two formulas:

```
w = 90 × cellsWide − 22        h = 98 × cellsTall − 38
```

Out of range (either digit is 0) **silently falls back to `22`** with no error — the widget still shows up, just not at the size you wrote.

| Code | Size (pt) | Typical use |
|---|---|---|
| `11` | 68 × 60 | one icon and one number, nothing more fits |
| `12` | 68 × 158 | a vertical strip, one column of two or three small lines |
| `21` | 158 × 60 | a single minimal line |
| `22` | 158 × 158 | one headline number plus one shape. **Every package must have one** |
| `32` | 248 × 158 | one cell wider than `22`, room for a second column beside the headline number |
| `33` | 248 × 256 | nearly square, a short list of four or five rows |
| `42` | 338 × 158 | a row of side-by-side items / a wide bar with a trend line |
| `44` | 338 × 354 | lists, grids, several blocks of information |
| `46` | 338 × 550 | a long list. Only the HarmonyOS home screen has room for it |
| `62` | 518 × 158 | an extra-wide bar. No home screen fits it; it only works in the dashboard |

The in-app dashboard accepts any code. **Whether a home-screen widget can hold it differs per platform**:

| Platform | Codes the home screen accepts |
|---|---|
| iPhone / iPad / Mac | only `22` / `42` / `44` |
| Android | all 16 codes within 4×4 (`11` `12` `13` `14` `21` `22` `23` `24` `31` `32` `33` `34` `41` `42` `43` `44`) |
| HarmonyOS | 8 codes (`11` `21` `22` `32` `33` `42` `44` `46`) |
| Windows | no home-screen widgets |

For a widget usable on every platform's home screen, stick to `22`/`42`/`44`. The other codes are not forbidden — a widget using one just lives only in the in-app dashboard on some platforms, which is a design choice rather than a mistake. Other home-screen widget differences per platform are in `numable docs capabilities`.

Drawing notes for three of the codes (the same RCN always breaks when moved to another code, so pick the code first, not last):

| Code | Drawing notes |
|---|---|
| `42` (338×158) | split it horizontally: the headline number on the left, a trend shape on the right. Write the split position as arithmetic on `{parent.w}` (`"x": "{parent.w}*0.42"`), **never put an anchor inside a `$[…]` method** (`check` G33), and never put a method in a width or height field (`check` G32) |
| `44` (338×354) | two bands: a title line plus the time anchor on top, then 4–6 rows laid out with `op:forEach`. Fix the row height and derive the row count from the available height, so the last row is not sliced in half |
| `21` (158×60) | one line and no more: an icon, a number and a unit. **Leave the title out** — it is already shown in the long-press menu and the widget panel |

Position things in RCN with `{parent.w}` / `{parent.h}`; never hardcode 158 / 338 — one change of `layout` and the whole widget shifts out of place.

### `params`

```json
"params": { "secid": "1.600519", "alias": "Moutai", "mask": "0" }
```

- **Scalars only** (string / number / boolean); no nested objects or arrays. What you write here are **default values**; once a user adds the widget, each instance carries its own copy.
- **Do not localize the defaults**: params are data, not copy. Literal text that changes with language belongs in the RCN content table (`numable docs i18n`).
- Do not name keys like secrets (`token`/`secret`/`api_key`…) — a static check will reject them; a user's own secret goes through `manifest.credentials`.
- How users change these values and how they are written back: see `numable docs params`.

### `events`

Only two keys, and the value has **two possible types**; the platform dispatches on the parsed type:

| Value type | How to write it | Behavior |
|---|---|---|
| string | `"/detail?secid=${secid}"` · `"numable://self"` · `"numable://self/page/item?id=${itemId}"` | treated as a navigation string, opens that page |
| object | `"@[file://flow/mark-today.af]"`, or an inline flow object | treated as an action flow and run |

- `onClick` = tapping the whole widget. `numable://self` opens the package home page; `numable://self/page/<route>` opens one route (that route must really exist in `router.json`). **A `${}` in a navigation string can only interpolate a top-level scalar** — a path like `${resp.list[0].id}` will not interpolate; lift it to a top-level key in the data flow first.
- `onEdit` = the "Edit parameters" entry from a long-press on the widget. Each of its two forms has one hard requirement:
  - Via a route: **it must be a bare path** (`"/edit?ref=quote"`), never `numable://…` — it is matched literally against `router.json`, and a deeplink here opens a blank page without any error.
  - Via a flow: it must be an in-package `.af` reference (based at `xWidget/`, i.e. `"@[file://flow/edit.af]"`); `..` may not escape the package.
  - In either form, **the target must actually be able to write values back** (an html page calls `xbridge.updateParams`; an `.xform` calls `widget.updateParams` in its `onSubmit` flow; an XPage calls it from `events`). A target that opens but cannot write back means the user fiddles with it and nothing ever changes.
- A widget without `onEdit` locks the user to whatever they picked when they added it — the only way out is to delete it and add it again. Any widget with `params` should have an `onEdit`.

### `canvas`

```json
"canvas": {
  "source": "@[file://rc/quote.rcn]",
  "depends": [ { "flow": "@[file://flow/quote.df]", "params": { "secid": "${secid}" } } ],
  "refresh": { "interval": ["3600"] }
}
```

- `source`: how this widget is drawn. It can be an inline RCN object, but is usually `@[file://rc/<name>.rcn]`.
- `depends`: the list of data flows — several, or none at all (a purely static widget).
- `refresh`: the refresh rhythm, see below.

**Several `depends`**: they run **one after another, serially, in array order**, and their outputs are merged in turn into one dataset for RCN; **on a key collision the later one wins**.

```json
"canvas": {
  "source": "@[file://rc/daily.rcn]",
  "depends": [
    { "flow": "@[file://flow/me.df]", "params": {} },
    { "flow": "@[file://flow/todo.df]", "params": { "login": "${login}" } }
  ],
  "refresh": { "interval": ["1800"] }
}
```

Two rules: (1) a later flow cannot read an earlier one's output, so each writes its own input parameters; (2) **if any one of them fails the whole widget is in a failed state**, not "one block short". So do not give optional, nice-to-have data its own `depends` — when that one dies it takes the main data down with it.

**Static widgets**: a widget that fetches nothing (an explainer widget, an entry widget) drops `depends` too.

```json
{
  "version": 2,
  "title": "About",
  "sub": "what this package gives you",
  "layout": 21,
  "params": {},
  "canvas": { "source": "@[file://rc/about.rcn]" }
}
```

⚠️ **Omitting `refresh` does not mean "use the default interval", it means "fetch once for the first paint and never poll again"**. A widget that really does fetch but has no `refresh` shows data frozen at the moment the app opened, and reports nothing.

**`@[file://…]` is based at `xWidget/`** (for the `.xwidget` itself and for `xWidget/rc/*.rcn`), so write `@[file://rc/quote.rcn]` and `@[file://flow/quote.df]`, without the `xWidget/` prefix. The page domain (`.xpage`, `page/rc/*.rcn`) is based at the package root instead; the two are not interchangeable. The symptom of the wrong base is that the reference resolves to nothing — the fetch is never even sent, and nothing is reported.

### The two shapes of `depends` (the most common trap)

```json
"depends": ["@[file://flow/quote.df]"]
```
A bare string = **no input parameters at all**. A bare reference never picks up parameters by itself, so `${secid}` inside the flow resolves to empty, the request goes out as `?secid=`, and **the flow still reports success** while the widget quietly renders a wall of `--`.

```json
"depends": [ { "flow": "@[file://flow/quote.df]", "params": { "secid": "${secid}" } } ]
```
The object form passes **only the keys you write out**. To hand shell params to the data flow, list them one key at a time. Even a widget that takes no parameters is written as `{ "flow": …, "params": {} }`, for a uniform shape.

One more rule from the same root: **shell params are not in RCN's rendering scope**. RCN only sees the keys exposed by the data flow's `resultFilter`. So a key that takes no part in fetching but still has to show on the widget (a city name, an alias) must also be passed into the `.df`, landed inside the flow, and exposed again before RCN can read it — otherwise that slot is permanently empty or permanently on its fallback, again with no error.

**The preview in the add-widget panel**: for the preview the user sees in the "Add widget" panel, the App adds one reserved key to the instance parameters, `_preview`, with the value `"1"` — for that one render only, never saved; the dashboard, home-screen widgets and sharing never get it. A widget receives it only if its `depends` `params` spells out `"_preview": "${_preview}"`; without that it fetches as usual. The typical use is a widget that needs a credential: while the user has not connected yet, the flow sees `_preview` as `1` and returns a set of made-up sample data, and the widget marks itself "Sample", so the user can see what they would get; once connected, it fetches real data as usual. The sample must be made up — never any user's real data.

### `refresh`

```json
"refresh": { "interval": ["09:30-15:00@15", "3600"], "at": ["15:05"], "tz": "Asia/Shanghai" }
```

| Key | How to write it |
|---|---|
| `interval` | array. `HH:MM-HH:MM@seconds` = once every N **seconds** inside that time window (what follows `@` is seconds, not minutes); a bare number = seconds, used as the fallback outside every window. A window crossing midnight is written directly as `21:30-05:00@60` |
| `at` | fixed times of day, `["15:05"]` |
| `tz` | IANA time zone name. iPhone / iPad / Android compute windows and times against it; HarmonyOS and Windows use the device's local time zone, so users far from that zone see shifted windows on those two platforms |

A refresh is due when any one of these holds: the interval has elapsed, a fixed time was missed, or the widget has never been fetched. Common values: leaderboards `["300"]`, weather `["300"]`, market quotes `["09:30-15:00@10", "3600"]` (every 10 seconds while the market is open, hourly otherwise).

Four details that are easy to get wrong:

1. **With several windows, the first match in array order wins**, not the shortest one. In `["09:00-18:00@600", "09:30-15:00@60"]` the second entry never gets a turn — half past nine also falls inside the first window. Put the narrow window first.
2. **The out-of-window fallback is the first bare number**; any bare number after it is ignored. If no window matches and there is no bare number, the result is **no polling at all**.
3. **A missed `at` time is caught up on**: if `15:05` passes while the app is closed, the condition still holds the next time it opens, so one fetch happens then rather than being skipped.
4. **Anything less than 3 seconds after the last real fetch is skipped**, and no `interval`, however small, gets past that floor.

```json
"refresh": { "interval": ["09:30-15:00@60", "21:00-23:00@300", "3600"], "at": ["15:05"] }
```

Read that as: every 60 seconds while the market is open, every 300 seconds in the evening window, hourly the rest of the time, plus one catch-up at 15:05 after the close.

**The upstream decides the cadence.** The dashboard wakes when its earliest widget falls due rather than on a fixed tick, so 10 seconds means a fetch every 10 seconds. **For free users, periodic refresh is slowed to every 5 minutes** (both the `@N` in a window and bare seconds), while Pro users get the cadence you wrote; manual updates, the first load, a language switch, and `widget.refresh` are not affected. If the data changes and the API can take it, refresh eagerly (quotes every 10 seconds while the market is open, weather and leaderboards every 5 minutes); if the upstream only updates once a day, a faster interval just fetches the same numbers again. The sum to check is "requests per refresh × refreshes per hour" against the upstream rate limit — go over and the widget quietly stays on stale data, with no error. Home-screen widgets do not follow this number: each platform has its own floor (iOS 15 minutes, Android 1 minute, HarmonyOS only shows the image the App last drew). To update once, right now, use `widget.refresh` in an action flow.

## Rules (breaking one means rework)

| Rule | How it is checked | Symptom when broken | Fix |
|---|---|---|---|
| Every binding in `depends` that needs parameters is written as a `{flow, params}` object | `check` G12c | the widget renders a wall of `--` while `run` is all green and the flow reports success | write `"k": "${k}"` for each key |
| Every `${x}` used in RCN comes from the `resultFilter` keys of one of this widget's `.df` files | `check` G28 | that slot renders empty or is permanently on its fallback, as if "the widget was always like this" | pass the parameter into the flow, land it, expose it, then read it in RCN |
| `numable://self/page/<route>` in `onClick` must exist in `router.json`; the id in `numable://self/widget/<id>` must exist | `check` G12 | the app shows "page not found", or an empty add-panel opens | to reach the home page, write `numable://self` |
| An `onEdit` route must be a bare path present in `router.json`; an `onEdit` flow must be an in-package `.af` with no `..` | `check` G12d | nothing happens on tap, or a blank page opens with no error | change it to a bare path like `/edit` |
| The `onEdit` target must be able to write values back | `check` G12e | it opens, and pressing things changes nothing | an html page calls `xbridge.updateParams`; an `.xform` calls `widget.updateParams` in its `onSubmit` flow |
| ≥3 widgets per package, including at least one `22` and one `42` or `44` | `check --profile publish` G6 | publishing is rejected | add widgets |
| `i18n["en-US"].title/sub` are complete | `check --profile publish` G20 | the widget title and the widget panel stay in the base language for English users | add the metadata table (B) translations |
| `params` keys do not look like secrets | `check` G18 | a secret ends up on a plaintext echo surface | use `manifest.credentials` |
| Geometry uses `{parent.w}` / `{parent.h}` instead of hardcoded 158/338 | at the render layer (visible as soon as you render another layout) | everything shifts and overflows after a layout change | switch to relative anchors |
| Cadence within the upstream rate limit | manual review | the API starts throttling and the widget stays on stale data with no error | keep "requests per refresh × refreshes per hour ≤ upstream quota"; to refresh now, use `widget.refresh` |
| Widgets meant for the home screen use only `22`/`42`/`44` | manual review | the widget simply does not appear in the widget list on some platforms | change the size code |
| A widget that fetches must declare `canvas.refresh` | manual review | data freezes at the moment the app opened and never moves again, with no error | add `"refresh": { "interval": ["1800"] }` |
| `onEdit` goes in the shell's `events`, never inside `canvas` | manual review | a long-press has no "Edit parameters" while `check` is all green | move it up to the top-level `events` |
| Narrow time windows come first in the array | manual review | a wider window ahead of it swallows the narrow one, which never gets a turn | reorder the array |

## When something goes wrong

| Symptom | Most likely cause | What to do first |
|---|---|---|
| the widget is all `--`, yet `numable run` is all green | `depends` uses the bare-string form, so no input parameters got through | switch to `{flow, params}` |
| only one slot is empty (a city name, say) while everything else is right | that key is not in the `.df`'s `resultFilter` | pass it in, land it, expose it |
| `numable render` produces an all-white image | a problem at the RCN layer (missing `type`, a method stuffed into a size field…) | see `numable docs rcn` |
| tapping the widget does nothing / says "page not found" | the route `onClick` points at does not exist | check it against `router.json` |
| long-press "Edit parameters" opens, but edits do nothing | the target page never writes back | see `numable docs params` |
| the widget is missing from the home-screen widget list | `layout` is not one of the sizes that platform's home screen supports | switch to `22`/`42`/`44` |
| the widget is not the size I wrote, it came out as `22` | one digit of `layout` is `0` (`20`, `04`), which is out of range and silently falls back | write both digits in `1`–`9` |
| data is only right just after the app opens and never updates afterwards | `canvas.refresh` was omitted entirely = one fetch for the first paint | add `refresh.interval` |
| the whole widget went empty after a second `depends` was added | the new flow fails, and one failure fails the whole widget | run `numable run` on them separately to see which one died |
| the package content changed but the app still shows the old one | `manifest.version` was not incremented | bump it and reinstall |

## See also

`numable docs df` · `numable docs params` · `numable docs rcn`
