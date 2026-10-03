<!-- translated-from: zh-CN/1-guides/10-first-card.md sha256:f1a7845d6ebc -->

# first-card — build one widget from scratch, end to end

> Audience: the person building a tool, and the AI working on their behalf. Both read this same page.

## Goal

Build a tool (an XBundle package) you can install in the App and put on the dashboard and the home screen: one 158×158 widget showing the current top story on Hacker News with its score, a time anchor, a light and a dark palette, and an empty state instead of a blank widget when the data cannot be fetched.

Data source: `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=1` (public, no key, one GET returning JSON).

By the end of this chapter you will have:

```
hn/
  manifest.json            identity + network allowlist
  xWidget/
    top.xwidget            the widget declaration: size / refresh / click / which flow and which drawing
    rc/top.rcn             the drawing
    flow/top.df            the data flow
  page/                    the home page the starter ships (untouched in this chapter)
  .numable/                local fixtures and render output, never shipped in the package
```

## Prerequisites

1. Node ≥ 18, with the `numable` command available.
2. Chrome / Chromium installed (only `numable render` needs it).
3. An authoring workspace folder that you have already added as a workspace folder in the Numable App's Workbench (Mac / Windows) — every package in that folder shows up in the App's tool list. If you do not have one, run `numable workspace init` first.

One command checks all of it:

```
numable doctor
```

You are ready when all four lines — node, Chrome, the render page, and the engine major version — show `✓`.

---

## Step 1 · Create the package

**What you are doing**: create the package with `numable init`, never `cp -r` another one — the identity (ULID) has to be regenerated, and two packages sharing one id will displace each other.

**Command**

```
numable init hn --title "HN 榜首"
```

**What correct looks like**

CLI output shown in Chinese; with `--lang en` or an English system locale the wording is English but the structure is the same.

```
✓ 新包 HN 榜首  id=01M200QWNNX1RFPNTX5S7M8PGW
  目录: /…/hn
  来源: starter 模板(一张时间卡)
```

The starter ships a ready-made clock widget, `clock`. Rename its three files to the `top` this chapter builds:

```
mv hn/xWidget/clock.xwidget hn/xWidget/top.xwidget
mv hn/xWidget/rc/clock.rcn  hn/xWidget/rc/top.rcn
mv hn/xWidget/flow/clock.df hn/xWidget/flow/top.df
```

Then change `clock` to `top` in both paths inside `hn/xWidget/top.xwidget`: `canvas.source` and `depends[0].flow`. Nothing infers the mapping between file names and paths for you, and the symptom of changing one and missing the other is "resolves to empty, the fetch is never even sent, and nothing reports an error".

---

## Step 2 · Declare the network allowlist

**What you are doing**: which hosts a package may reach is decided by `network` in `manifest.json` and enforced by the App at the network layer. The declaration and actual usage must be **exactly equal** — one too few and the request is blocked; one too many and the install panel discloses a domain the package never touches.

**Edit `hn/manifest.json`** (complete and copyable; use the `id` your own `init` produced, do not copy this one)

```json
{
  "id": "01M200QWNNX1RFPNTX5S7M8PGW",
  "version": 1,
  "title": "HN 榜首",
  "lang": "zh-CN",
  "category": "tech",
  "subtitle": "Hacker News 此刻榜首",
  "domain": "01M200QWNNX1RFPNTX5S7M8PGW",
  "minEngine": "1.0.0",
  "network": ["hn.algolia.com"],
  "i18n": {
    "en-US": { "title": "HN Top", "subtitle": "The #1 story on Hacker News" }
  }
}
```

`network` takes **bare hosts** — no scheme, no path. Field-by-field notes are in `numable docs layout`.

---

## Step 3 · Write the data flow `.df`

**What you are doing**: a `.df` does exactly two things — send requests, and turn the response into a flat set of keys. It does no UI and cannot see the language or theme. The keys listed by the final `resultFilter` step are the entire set of variables the widget can use; a key you leave out is simply empty on the widget, with no error.

Four things it must have:

- **A request barrier**: the step **immediately after** a `request` cannot see the response (the result becomes visible one step later). Insert a meaningless `op:set` (the `_b` below) to separate them. Delete it and every value below silently goes empty while the flow still reports success.
- **A failure exit**: if a load-bearing field is missing, throw with `action:"error"` and stop. No exit means a failed fetch reports success, empty data overwrites the last good data, and the fallback that keeps the old image on a home-screen widget is never reached (`check` G26 catches this). Pin the test on the field without which the widget is meaningless, not on "which request failed". Note that the condition field is `props.val`.
- **An explicit flag**: to test "is there a value", always set a 0/1 numeric flag and have the render layer look only at the flag. Never test emptiness with `eq::(x,)` — if both sides can be turned into numbers, `eq` compares them as numbers, and an empty string equals 0.
- **A time anchor**: the story list has no "data timestamp" field, so use the fetch time. Without a time anchor there is no way to tell that the data is hours old.

**Write `hn/xWidget/flow/top.df`**

```json
{
  "version": 1,
  "actions": [
    {
      "id": "resp",
      "action": "request",
      "params": {
        "url": "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=1",
        "method": "GET",
        "formatType": "json"
      }
    },
    {
      "op": "set",
      "props": { "key": "_b", "value": "1" },
      "_note": "Request barrier (do not delete): the step immediately after a request cannot see the response."
    },
    {
      "op": "if",
      "props": { "val": "$[if::(gt::(length::(${resp.hits}),0),0,1)]" },
      "items": [
        { "action": "error", "params": { "errorMsg": "取不到 HN 榜单" } }
      ]
    },
    { "op": "set", "props": { "key": "title", "value": "${resp.hits[0].title}" } },
    { "op": "set", "props": { "key": "points", "value": "${resp.hits[0].points}" } },
    { "op": "set", "props": { "key": "hasTitle", "value": "$[if::(gt::(length::(${title}),0),1,0)]" } },
    { "op": "set", "props": { "key": "at", "value": "$[formatDate::(${@time.nowMs},HH:mm)]" } },
    { "action": "resultFilter", "params": { "keys": ["title", "points", "hasTitle", "at"] } }
  ]
}
```

How you write the emptiness flag **depends on the field type**: `title` is a string, so `gt::(length::(${title}),0)` works. For a **numeric** field (a score, a star count), `length::` always returns 0 and the flag would be stuck at 0 — use `ge::(${points},0)` (0 counts as a value) or `ge::(${points},1)` (0 counts as nothing) instead, whichever matches the business meaning.

`errorMsg` is written in Chinese here, which is fine for personal use; the publish profile (`numable check --profile publish`) flags it with a G8b hint, and before publishing you switch it to `${@i18n.key}` following `numable docs localize` — a `.df` can have its own `i18n` table too.

When an `op:set` references another key, the referenced key must come **earlier** (`hasTitle` references `title`, so it comes after it). The flow has no dependency graph, and the symptom of the wrong order is a branch that always takes the else path while the code looks entirely correct.

**Command**

```
numable run hn --full
```

**What correct looks like**

```
── 01M200QWNNX1RFPNTX5S7M8PGW (HN 榜首) ──
  · 网络白名单已强制: [hn.algolia.com]  · 夹具: /…/hn/.numable/params
  ✓ top                {"title":"216M Spy TVs – The LG Smart TV Problem [video]","points":723,"hasTitle":"1","at":"16:04"}

✓ run 完成: 1 通过 / 0 失败
```

The test is not that `✓` — it is that **the output has as many keys as `resultFilter.keys`**: four keys here, all four present. A wrong value path produces null, null is dropped outright, and the key disappears from the output entirely — while the flow still reports success (see "Common mistakes" item 1 below).

`--full` prints the complete JSON; without it you get a summary (arrays report only their length and first element).

---

## Step 4 · Draw the widget `.rcn`

**What you are doing**: a widget is a set of cells. The `22` size is 158×158.

Five hard rules for this step:

| Rule | How to write it | Symptom when broken |
|---|---|---|
| Units are always `pt` | `"fontSize": "13pt"` | `px` gets converted by render density and the content shrinks into the top-left corner |
| Every color is a `light\|dark` pair | `"#FFFFFF\|#15171A"` | one segment only = the same color in dark mode, black on black |
| Every cell must have a `type` | `"type": "txt"` | one missing and **the whole widget** fails to render |
| Size and coordinate fields only accept `${variable}` and layout expressions | `"w": "{parent.w}"`, `"y": "34pt"` | a `$[method]` there makes the whole widget fail to render |
| Copy goes through `${@i18n.key}` | the `rc.i18n` bilingual table at the bottom of the file | Chinese hard-coded into a cell shows up in an English environment |

Sizes use only `{parent.w}` / `{parent.h}` or constants; layout fields allow arithmetic and parentheses (`{brand.y}+({brand.h}-5pt)/2`), but **layout anchors cannot go inside `$[calc::()]`** — the two scopes do not connect, and that node silently fails to draw.

`findNotEmpty::` covers the empty state: if the first argument is missing, the second is used. When there is no data the widget shows the empty-state text and `--` instead of a blank white square.

**Write `hn/xWidget/rc/top.rcn`**

```json
{
  "rc": {
    "cells": [
      { "id": "bg", "type": "layer", "x": "0pt", "y": "0pt", "w": "{parent.w}", "h": "{parent.h}", "bgColor": "#FFFFFF|#15171A" },
      { "id": "brand", "type": "txt", "x": "12pt", "y": "12pt", "w": "90pt", "h": "-1", "maxLines": "1",
        "text": "${@i18n.brand}", "fontSize": "9pt", "typeface": "System-Bold", "textColor": "#6B7280|#8E939B" },
      { "id": "at", "type": "txt", "x": "12pt", "y": "12pt", "w": "134pt", "h": "-1", "alignmentH": "2", "maxLines": "1",
        "text": "$[findNotEmpty::(${at},--)]", "fontSize": "9pt", "textColor": "#6B7280|#8E939B" },
      { "id": "title", "type": "txt", "x": "12pt", "y": "34pt", "w": "134pt", "h": "-1", "maxLines": "4", "lineSpacing": "3pt",
        "text": "$[findNotEmpty::(${title},${@i18n.empty})]", "fontSize": "13pt", "typeface": "System-Bold", "textColor": "#0E1116|#F3F4F6" },
      { "id": "pts", "type": "richText", "x": "12pt", "y": "122pt", "w": "134pt", "h": "-1", "maxLines": "1",
        "spans": [
          { "text": "$[findNotEmpty::(${points},--)]", "fontSize": "19pt", "typeface": "System-Bold", "textColor": "#0E1116|#F3F4F6" },
          { "text": "${@i18n.nbsp}", "fontSize": "14pt" },
          { "text": "${@i18n.pts}", "fontSize": "10pt", "textColor": "#6B7280|#8E939B" }
        ] }
    ],
    "i18n": {
      "zh-CN": { "brand": "HACKER NEWS", "pts": "分", "nbsp": " ", "empty": "暂无榜单数据" },
      "en-US": { "brand": "HACKER NEWS", "pts": "pts", "nbsp": " ", "empty": "No stories" }
    }
  }
}
```

A few techniques worth copying:

- `w: "-1"` means size to fit the content; `alignmentH: "2"` is right-aligned, and with `w: "134pt"` (= the 158 widget width − 12pt of padding on each side) that means flush with the right edge.
- `at` and `brand` share one `y`, one left and one right, sharing a line.
- The value and its unit are spans of a `richText`, not two cells — the unit then follows the number, and a longer number does not push things out of alignment.
- The little gap between the value and the unit is a **third span**: its text is `${@i18n.nbsp}` and the locale value is a single U+00A0 (no-break space). Typing a plain space in front of the unit does **nothing** — it is stripped as surrounding whitespace during evaluation, and the widget renders "1842pts". That span's font size (14pt here) is the gap width, independent of the sizes of the value and the unit.

The full table of node types and fields is in `numable docs rcn-nodes`; the full table of expression methods is in `numable docs methods`.

**Command**

```
numable render hn
```

**What correct looks like**

```
── hn ── 1 张卡 × 态[light,dark,empty] × 语言[zh-CN]
  · 先跑数据层(run)…
  ✓ top              158×158 · 3 张 → .numable/render/top.*.png
  · 拼图: /…/hn/.numable/render/index.html
```

Open `.numable/render/index.html` and the three images sit side by side:

- **Light**: the title is legible, the score is at the bottom, the time anchor is top right, and nothing overflows the widget.
- **Dark**: the same widget with a darker ground and lighter text — if the dark image is identical to the light one, your colors only have one segment.
- **Empty** (rendered with empty data): the title slot shows the empty-state text and the score slot shows `--`, and you can still tell at a glance what widget this is. If the empty state is blank white, that blank white is what users see the moment a fetch fails.

The render layer also exposes a class of error no static check can find: a fragment like `$[if::…]` drawn onto the widget as a literal, meaning the expression was never evaluated.

---

## Step 5 · Complete the widget declaration `.xwidget`

**What you are doing**: the `.xwidget` ties the drawing, the fetch, the size, the refresh cadence, and the click behavior together. It is the only file the host reads.

**Write `hn/xWidget/top.xwidget`**

```json
{
  "version": 2,
  "title": "此刻榜首",
  "sub": "Hacker News 第一条",
  "i18n": { "en-US": { "title": "Top Right Now", "sub": "The #1 story on HN" } },
  "layout": 22,
  "params": {},
  "events": { "onClick": "numable://self" },
  "canvas": {
    "source": "@[file://rc/top.rcn]",
    "depends": [ { "flow": "@[file://flow/top.df]", "params": {} } ],
    "refresh": { "interval": ["1800"] }
  }
}
```

Field by field:

| Field | Notes |
|---|---|
| `title` / `sub` | the widget's name in the widget panel and on the dashboard. The bare fields are in the `manifest.lang` language; English goes in `i18n["en-US"]` |
| `layout` | the two-digit grid code, tens = columns, units = rows. `22` = 158×158, `42` = 338×158, `44` = 338×354 |
| `params` | the default instance parameters for this widget, scalars only. This widget has none, so an empty object |
| `events.onClick` | where a tap goes. `numable://self` opens the package's home page; for a specific page write `numable://self/page/<path>` |
| `canvas.source` | the drawing. In the widget host, `@[file://…]` is resolved relative to `xWidget/`, hence `rc/top.rcn` |
| `canvas.depends` | the data binding. **It must be a `{flow, params}` object**, even when `params` is empty |
| `canvas.refresh` | the refresh cadence. `interval` is bare seconds; two fetches are at least 3 seconds apart, and **free users are slowed to every 5 minutes** while Pro users get what you wrote; how fast to go depends on what the upstream API's rate limit and quota can take |

Writing `depends` as the bare string `"@[file://flow/top.df]"` is the most common silent failure of all: that form passes **empty input parameters**, so a widget that consumes parameters renders a field of `--` and reports nothing. This widget takes no parameters, but write it in object form anyway — then you will not forget on the day you add one.

How parameters are passed down is in `numable docs params`; clicks and editing are in `numable docs add-interaction`.

---

## Step 6 · Pass the static check

**Command**

```
numable check hn
```

**What correct looks like**

```
静态闸 · 档位 personal(个人自用:跳过商店门面/身份资产/双语/卡片档位/首屏缓存等发布向段;发布前用 --profile publish)

── HN 榜首 (hn) ──
· [01M200QWNNX1RFPNTX5S7M8PGW] 1 卡 · layout[22] · 4KB · net[hn.algolia.com]

✓ check 完成: 0 error / 0 warn
```

**Zero errors is non-negotiable**; read each warning and decide deliberately whether to leave it. The default is the `personal` profile, which only asks "does it run, does it fail silently, does it overreach". The full set of gates for the store is in `numable docs publish`, and the error codes are in `numable docs lint-codes`.

---

## Step 7 · Show the renders for approval

The three state images are in `.numable/render/`: `top.light.zh-CN.png`, `top.dark.zh-CN.png`, `top.empty.zh-CN.png`. Show the user those three (or the `index.html` contact sheet) — the widget is done when the user says so.

Give it a pass yourself first: one widget answers one question; a `22` holds at most one headline number plus two supporting details; it must have a time anchor; and are the one-step-weaker greys still visible in dark mode.

---

## Step 8 · Install it in the App and look at the real thing

The package is already visible once the folder sits inside the workspace folder — there is nothing to build.

1. Open the Numable App (Mac / Windows).
2. Go to the tool list and pull to refresh — "HN 榜首" should appear.
3. Open it and add "此刻榜首" to the dashboard.
4. The widget should show the same thing as the light image from `render`.

Edit a file, refresh in the App, and you see it — no reinstall. **Do not skip this step**: `render` uses a browser engine, so glyph metrics and per-platform differences only show up in the App.

---

## Common mistakes

### 1. `run` reports ✓ but the output is missing keys — a wrong value path

```
✓ top                {hasTitle:0, at:16:05}
```

`title` and `points` are gone entirely. The cause: `${resp.data.hits[0].title}` has one level of `data` more than the real response, so the value is null, and null is dropped — the key never reaches the result while the flow still reports success. On the widget it comes out as a field of `--`.

**Fix**: `curl` the endpoint to see the real nesting, then correct the paths. Pin the test as "number of output keys == length of `resultFilter.keys`".

### 2. A `$[if::…]` fragment appears on the widget

**Symptom**: one slot draws the expression verbatim. **Cause**: that slot's `x` / `y` contains interpolated subtraction (`"${v}pt-24pt"`) — coordinate fields do not evaluate mixed expressions like that.

**Fix**: compute the geometry with `op:set` in the `.df` and have the `.rcn` reference only `"${v}pt"`. `check` cannot catch this; the three `render` images show it immediately.

### 3. The whole widget is blank / fails to render

Two causes, in triage order:

- **A cell is missing `type`** — `check` stops you outright:

  ```
  ✗ […] xWidget/rc/top.rcn .rc.cells[1] 缺 type:键 = id,x,y,w,h,maxLines,text,… 整张卡会渲染失败(编辑器只显「wasm 未就绪」)
  ```

- **A `$[method]` in a size or font-size field** — `check` cannot stop this, the image from `render` may even show it drawn, and in the App the whole widget fails. Fix: land it as a variable with `op:set` in the `.df` and write only `${variable}` in the `.rcn`.

### 4. Unreadable in dark mode / the dark image matches the light one

`check` stops a hard-coded single color:

```
✗ […] xWidget/rc/top.rcn cells[0].bgColor = "#FFFFFF" 是单色硬编码,须写成「浅|深」双分支
```

**Fix**: write every color field as a `light|dark` pair. Note that dark takes **the last segment** — write three and the middle one never applies. Whether the contrast is sufficient can only be judged by eye on the dark image from `render`.

### 5. The allowlist does not match

Declare one host you do not use and `check` reports an error:

```
✗ […] manifest.network 声明了 api.github.com 但没有任何 flow 用它(过度授权,安装面板会吓人)
```

Declare one too few and `run` shows the request being blocked:

```
  ✗ top                error: 失败: 取不到 HN 榜单
      ⚠ network_blocked:not_declared:hn.algolia.com
```

**Fix**: line up the set of hosts requested in the `.df` with `manifest.network` one for one, no more and no less.

### 6. The `.df` has no failure exit

```
✗ […] xWidget/flow/top.df 有 request 却没有任何 `error` 出口 —— 取数失败时流会报成功,平台的兜底(不落盘 / 回落上次成功 / 桌面卡回落旧图)整条走不到,空数据会覆盖掉好数据…
```

**Fix**: test the load-bearing field for emptiness → `action:"error"`. Two easy mistakes: the condition field is `props.val` (not `cond` — get it wrong and the condition is always false, the branch silently never runs, and the flow still reports success); and "the collection is genuinely empty" is a success, so do not throw.

### 7. The time anchor renders as `01-01 07:30`

Feeding `formatDate::` an empty value computes a plausible-looking time from epoch 0. **Fix**: replace the empty value with a sentinel string using `findNotEmpty::` first, then decide whether to format at all.

### 8. An emoji on the widget is a blank box

The RCN glyph pipeline cannot render emoji, and `check` stops you (G30). Use a `path` node with a literal `d` for icons, or a symbol from the BMP (★ ✓ ✕ ›).

More symptom → cause → fix pairs are in `numable docs pitfalls`.

---

## Next

- Add a detail page the widget opens into: `numable docs add-page`; for a declarative page (eight layouts, conditional visibility, input fields, infinite scroll) see `numable docs xpage`
- Look up which keys `${@app.…}` / `${@device.…}` / `${@time.…}` / `${@contentInset.…}` and the other builtins expose: `numable docs builtins`
- Make the widget clickable and its parameters editable: `numable docs add-interaction`
- Connect a source that needs a secret: `numable docs credentials`
- Ship in two languages: `numable docs localize`
- Publish: `numable docs publish`
