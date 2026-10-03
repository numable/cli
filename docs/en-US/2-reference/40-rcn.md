<!-- translated-from: zh-CN/2-reference/40-rcn.md sha256:2cfe37f1a683 -->

# rcn — how a widget is drawn (.rcn)

> Audience: people building a tool, and the AI working on their behalf. Both read this same page.

## What it is

`.rcn` is the drawing of one widget. It fetches nothing and navigates nowhere; it answers exactly one question: **given these values, what does it look like**. The data comes from `.df` (see `numable docs df`), the size class comes from the `layout` field of `.xwidget` (see `numable docs xwidget`), and `.rcn` only places values onto pixels.

It is a flat array of nodes: every object in `cells` is one node, drawn in array order, so **later nodes paint on top**. Nodes position themselves against each other through `id` and anchor expressions — there is no auto layout, no flex, no animation. The result is a **bitmap**: the app caches it and pastes it onto the dashboard and the home-screen widget, so it has to hold up in light, in dark, and when **not a single field came back**.

A widget needs at least one `.rcn`. Several widgets in the same package each write their own `.rcn`; they share no nodes and never reference one another.

## A minimal working example

The drawing of a `22`-class (158×158pt) top-stories widget:

```json
{
  "rc": {
    "cells": [
      {
        "id": "bg",
        "type": "layer",
        "x": "0pt", "y": "0pt",
        "w": "{parent.w}", "h": "{parent.h}",
        "bgColor": "#FFFFFF|#15171A"
      },
      {
        "id": "brand",
        "type": "txt",
        "x": "12pt", "y": "12pt",
        "w": "90pt", "h": "-1",
        "maxLines": "1",
        "text": "${@i18n.brand}",
        "fontSize": "9pt",
        "typeface": "System-Bold",
        "textColor": "#6B7280|#8E939B"
      },
      {
        "id": "title",
        "type": "txt",
        "x": "12pt", "y": "32pt",
        "w": "134pt", "h": "-1",
        "maxLines": "3",
        "lineSpacing": "3pt",
        "text": "$[findNotEmpty::(${t0},${@i18n.empty})]",
        "fontSize": "13pt",
        "typeface": "System-Bold",
        "textColor": "#0E1116|#F3F4F6"
      },
      {
        "id": "heatTr",
        "type": "line",
        "points": "[1.5,1.5,132.5,1.5]",
        "x": "12pt", "y": "108pt",
        "w": "134pt", "h": "3pt",
        "lineWidth": "3pt", "lineCap": "round",
        "strokeColor": "#D6DAE1|#2C313A"
      },
      {
        "id": "heat",
        "type": "line",
        "points": "[1.5,1.5,$[findNotEmpty::(${b0},1.5)],1.5]",
        "x": "12pt", "y": "108pt",
        "w": "134pt", "h": "3pt",
        "lineWidth": "3pt", "lineCap": "round",
        "strokeColor": "#FF6600|#FF8A3D"
      },
      {
        "id": "pts",
        "type": "richText",
        "x": "12pt", "y": "118pt",
        "w": "80pt", "h": "-1",
        "maxLines": "1",
        "spans": [
          { "text": "$[findNotEmpty::(${p0},--)]", "fontSize": "19pt", "typeface": "System-Bold", "textColor": "#0E1116|#F3F4F6" },
          { "text": "${@i18n.pts}", "fontSize": "10pt", "textColor": "#6B7280|#8E939B" }
        ]
      }
    ],
    "i18n": {
      "zh-CN": { "brand": "HACKER NEWS", "pts": " 分", "empty": "暂无热榜数据" },
      "en-US": { "brand": "HACKER NEWS", "pts": " pts", "empty": "No stories" }
    }
  }
}
```

Notes on the lines above: `layer` fills the whole widget as its background · `h: "-1"` = size to content · `${@i18n.brand}` reads the strings in this file's own `rc.i18n` · `$[findNotEmpty::(…)]` gives the fetched value a fallback · `line.points` is a coordinate string relative to this node's own `x/y` · dynamic values inside `points` need a fallback too, otherwise the whole widget fails to render when empty · `richText` keeps "19pt number + 10pt unit" aligned on one line · `i18n` is this file's own string table.

The top level has exactly one key, `rc` (you may add `_note` for prose), and `rc` holds only `cells` and `i18n`. **There is no `scene`** — the canvas size is not written here; it comes from the widget's `layout` class.

## Three kinds of expression, strictly separated

This is where `.rcn` goes wrong most often. The three notations are handled by **three different evaluators** that cannot see each other:

| Notation | What it is | Allowed only in |
|---|---|---|
| `{title.b}` `{parent.w}` | **Layout anchor**: refers to another node's geometry | Geometry fields: `x` `y` `w` `h` `maxWidth` `maxHeight` |
| `${key}` `${@i18n.k}` `${@app.language}` | **Value lookup**: data-flow output, string table, built-in variables | Any string field |
| `$[method::(…)]` | **Method call** | Content / color / `hide` and similar fields; **not usable in geometry fields** |

### `{}` layout anchors

Six anchors: `x` (left) `y` (top) `w` (width) `h` (height) `r` (right edge) `b` (bottom edge). `parent` has only `x/y/w/h`.

Arithmetic **is** allowed in geometry fields: `+ - * / %` and parentheses.

```
"x": "{icon.r}+6pt"
"y": "{title.b}+8pt"
"x": "({parent.w}-{badge.w})/2"
"w": "{parent.w}-24pt"
```

`h: "-1"` = height sizes to content (most common on `txt`); `w: "-1"` is the same idea, and it is the key to a pill whose width follows its text.

### `${}` value lookup

The render scope = **the keys this widget's `.df` exposes through `resultFilter`** ⊕ the built-ins `@app.*` / `@i18n.*`.

The `params` you pass to `depends` in `.xwidget` are **not in the render scope**: they are input parameters for fetching, not render variables. To show a parameter on the widget, route it through `.df` — pass it in via `depends.params`, land it as a key inside `.df`, expose it through `resultFilter`, and only then can `.rcn` read it. `check` catches this (G28).

### `$[]` methods

```
"text": "$[findNotEmpty::(${p0},--)]"
"hide": "$[if::(eq::(${apiOk},1),0,1)]"
```

Three hard constraints:

1. **Geometry fields cannot contain `$[]`.** If they do, the whole widget renders blank with no error. To compute a size with a method, compute it into a variable in `.df` and write `"${_w}pt"` here.
2. **`{}` and `$[]` do not nest into each other.** `$[calc::({parent.w}-20)]` makes that node silently disappear — anchors belong to a different evaluator, and methods cannot see them.
3. **Nested methods are written bare**, with no inner `$[`: in `"$[if::(eq::(${a},1),X,Y)]"` there is no `$[` in front of `eq::`. Nest two levels and `$[` gets painted literally. `check` catches this (G28).

The full method list is in `numable docs methods`. **Unregistered methods evaluate to empty silently** (there is no `abs::`, for instance), so a misspelled method name simply shows nothing in that spot.

## Node types

Ten of them. The full field list is in `numable docs rcn-nodes`; here we give only "what it is + the field that, if missing, makes it paint nothing".

| type | Purpose | Minimum fields |
|---|---|---|
| `layer` | Solid block: widget background, section plate, pill background, divider | `bgColor` (or `color`) |
| `group` | Container: put children in `children`, pair with `clip` for rounded-corner clipping | — |
| `txt` | One run of text | `text` `fontSize` `textColor` |
| `richText` | Mixed sizes / colors on one line | `spans[]`, each span needs at least `text` `fontSize` `textColor` |
| `img` | Remote or in-package image | `url` (omit `scaleType` and you get `centerCrop`; to fit the whole image in, write `fitCenter` explicitly) |
| `line` | Polyline, progress bar, mini trend | `points` `lineWidth` `strokeColor` |
| `curves` | Same as `line`, smoothed into a curve | Same as above |
| `arc` | Ring / pie progress | `startAngle` `sweepAngle` `lineWidth` + a color |
| `path` | SVG path — use it for icons | `d` `viewBox` + `fillColor` or `strokeColor` |
| `op` | Control flow, paints nothing | `action` + `props` |

Common fields you will use constantly:

| Field | Type / unit | Notes |
|---|---|---|
| `type` | Enum, **required** | Missing it does not skip that cell — **the whole widget fails** |
| `id` | String | Unique within the canvas; other nodes anchor to it via `{id.r}`. Nodes nobody references can omit it |
| `x` `y` `w` `h` | Size string, `pt` | `-1` = size to content |
| `maxWidth` `maxHeight` | `pt` | Caps a self-sizing node |
| `paddingLeft/Right/Top/Bottom` | `pt` | This is what gives a pill its inner padding |
| `hide` | `"0"` visible / `"1"` hidden but still occupies space / `"2"` hidden and takes no space | Always use this for data-driven visibility, **not `visibility`** |
| `bgColor` | Paint | Every node has it |
| `cornerRadius` | An **object** `{"leftT","leftB","rightT","rightB"}` | Writing it as a string fails the whole widget |
| `borderColor` + `borderWidth` | Paint + `pt` | Miss either one and the entire border is invisible |
| `alpha` | `0`–`1`, default `1` | |
| `clip` | `"1"` clip / `"0"` don't | Rounded corners only clip children if you write `"1"`; `"true"` is not recognized and behaves as off |
| `zIndex` | Numeric string | Rarely needed — array order is usually enough |
| `events.onClick` | Navigation string / `{"flow":"@[file://flow/x.af]"}` | See `numable docs af` |
| `_note` | Any string | Prose for humans and AI; **this field is the only place a comment may live inside a node** |

How to write an `op` node, and all six `action` values, are covered below under "Drawing · control flow".

## Units

**Always `pt`.** `pt` is a 1:1 design unit; `px` gets scaled by render density, and the symptom is a widget squeezed into the top-left corner with visibly small type — and no error.

`-1` is the only special value (size to content). `0pt` is a legitimate zero. A number must be followed by exactly one unit suffix: `"14.0ptpt"` makes the whole widget fail to render, and `check` catches it (G28).

## Colors

The value of a color field is called a **Paint**, written `light|dark`:

```
"bgColor": "#FFFFFF|#15171A"
"textColor": "#0E1116|#F3F4F6"
```

- Light takes the **first segment**, dark takes the **last**. Write three segments and the middle one never applies.
- A single value (no `|`) is not theme-aware: the same color in light and dark.

**Only these 10 fields take a Paint**: `bgColor` · `borderColor` · `shadowColor` · `textColor` (or `color`) · `fillColor` (or `color`) · `strokeColor` · `coverageColor` · `mask.paint` · `spans[].textColor` · `spans[].bgColor`. Writing `light|dark` anywhere else has no effect.

**Every color needs both segments**, enforced by `check` (G7). The only exceptions are fully transparent and pure-black scrims: `#00000000` / `#000000` / `#FFFFFF00` — these three have no light/dark distinction.

### The full Paint syntax

One segment of a Paint (one side of the `|`) is either one of four literal forms or one of two gradients; anything else fails to parse. **The failure is silent**: the whole Paint is void, that area paints nothing, and there is neither a fallback to black nor an error.

| Form | Example | Notes |
|---|---|---|
| `#RGB` | `#F63` | Each digit doubled — same as `#FF6633` |
| `#ARGB` | `#8F63` | With four digits, **the first one is alpha** |
| `#RRGGBB` | `#FF6633` | Opaque |
| `#AARRGGBB` | `#15FF5C4D` | With eight digits, **the first two are alpha**: `#15` ≈ red at 8% opacity |
| `linear(c1\,c2\,…)@angle` | `linear(#2F7FC4\,#A9D2EC)@90` | Linear gradient, two stops minimum |
| `radial(c1\,c2\,…)@cx\,cy\,r` | `radial(#8CFFFFFF\,#00FFFFFF)@0.8\,0.16\,0.6` | Radial gradient |

(The `\,` in the table is an escape — the reason is in the next section; inside JSON you write `\\,`.)

Four rules for gradients:

1. **The angle is a bare number of degrees**, with no unit. `@90` is right; `@90deg` raises no error and is silently treated as `0`. Omitting `@…` also means `0`.
2. Angle directions: `0` = left→right, `90` = top→bottom, `180` = right→left, `270` = bottom→top. The angle is computed in a coordinate space that **treats the node as a square**, so on a long thin node the visual angle is skewed by the aspect ratio — if you need a true 45°, make the node square.
3. The three numbers in `radial`'s `@cx,cy,r` are all ratios from `0` to `1`: `cx` is the center horizontally (a fraction of node width), `cy` the center vertically (a fraction of node height), `r` the radius (a fraction of the node's **shorter side**; anything above 1 is clamped to 1). Omitting `@…` means `0.5,0.5,0.5`.
4. **Stops are always evenly spaced.** Two stops sit at 0 and 1, three at 0 / 0.5 / 1; there is no syntax for a custom position. To give one color a longer run, repeat it to approximate that — `linear(#FFF,#FFF,#0FFF)` gives white the first half.

### Structural characters must be escaped inside expressions

The six characters `:` `(` `)` `[` `]` `,` are **the structural characters of method expressions**. When one of them appears inside the arguments of `$[…]` and is meant as an ordinary character, it must be preceded by a backslash — which in a JSON string means writing two:

```json
{
  "id": "area",
  "type": "curves",
  "x": "12pt", "y": "40pt",
  "w": "134pt", "h": "48pt",
  "lineWidth": "1.5pt",
  "points": "[0,40,44,22,88,26,132,6]",
  "strokeColor": "#FF5C4D|#FF5C4D",
  "coverageColor": "$[if::(eq::(${up},1),linear(#4AFF5C4D\\,#00FF5C4D)@90,linear(#4A1FC77D\\,#001FC77D)@90)]"
}
```

What happens without the escape: the commas in `linear(#4AFF5C4D,#00FF5C4D)@90` are read as argument separators for `if::`, so `if::` receives four arguments, the gradient is cut in half, and **that cell silently paints nothing** with a clean log. Gradients, `points` strings, and strings containing a colon (`"12:30"`) all run into this.

Outside `$[…]` a backslash is simply swallowed (`\,` evaluates to `,`), so a purely literal gradient works with or without the escape. Escape everywhere and you only have to remember one rule.

A complete fragment with all three together (gradient + light/dark pair + escaping): a sky background plus a soft glow layer.

```json
{
  "id": "sky",
  "type": "layer",
  "x": "0pt", "y": "0pt",
  "w": "{parent.w}", "h": "{parent.h}",
  "bgColor": "linear(#2F7FC4\\,#6FB4E0\\,#A9D2EC)@90|linear(#1F5C90\\,#487F9E\\,#6E9AB0)@90"
}
```

```json
{
  "id": "glow",
  "type": "layer",
  "x": "0pt", "y": "0pt",
  "w": "{parent.w}", "h": "{parent.h}",
  "bgColor": "radial(#2BFFFFFF\\,#00FFFFFF)@0.5\\,0.34\\,0.78|radial(#1EFFFFFF\\,#00FFFFFF)@0.5\\,0.34\\,0.78"
}
```

For an overlay like this glow, use `radial` rather than "a narrow `layer` carrying a horizontal gradient": a narrow strip with a horizontal gradient has **hard edges vertically**, and it renders as a flat white bar. `radial` is soft on every side, so no edge reads as a line.

## Drawing

The ten node types above decide *what* is drawn; this section is about *how it looks*: shadows, strokes, transforms, clipping, images, text detail, and the fields specific to individual shapes. Each subsection gives a minimal fragment plus the trap it most often falls into; the full field tables are in `numable docs rcn-nodes`.

### Shadows

`shadowColor` + `shadowRadius` + `shadowDx` / `shadowDy`, available on any node.

```json
{
  "id": "card",
  "type": "layer",
  "x": "12pt", "y": "12pt",
  "w": "{parent.w}-24pt", "h": "72pt",
  "bgColor": "#FFFFFF|#20232A",
  "cornerRadius": { "leftT": "12pt", "leftB": "12pt", "rightT": "12pt", "rightB": "12pt" },
  "shadowColor": "#14000000|#40000000",
  "shadowRadius": "8pt",
  "shadowDy": "2pt"
}
```

- **`shadowColor` alone shows nothing**: when `shadowRadius`, `shadowDx` and `shadowDy` are all 0, the shadow pass is skipped entirely. Give at least one of them.
- `shadowRadius` is the blur radius; `0pt` plus an offset gives a hard-edged block of color (useful for a "thick base").
- The shadow color is a Paint, so both `light|dark` segments are required — and a gradient is allowed there too.

### Strokes, corners and clipping

```json
{
  "id": "avatarBox",
  "type": "group",
  "x": "12pt", "y": "12pt", "w": "40pt", "h": "40pt",
  "cornerRadius": { "leftT": "20pt", "leftB": "20pt", "rightT": "20pt", "rightB": "20pt" },
  "borderColor": "#E4E7EC|#262A31",
  "borderWidth": "1pt",
  "clip": "1",
  "children": [
    { "id": "avatar", "type": "img", "x": "0pt", "y": "0pt", "w": "40pt", "h": "40pt", "url": "${avatar}", "scaleType": "centerCrop" }
  ]
}
```

- `borderColor` and `borderWidth` come as a pair; miss either and the entire border is invisible.
- `cornerRadius` is a **four-corner object**; written as a string it fails the whole widget. A circular avatar = all four corners set to half the side length.
- To make rounded corners clip the **children** too, the parent must carry `"clip": "1"`. Only the string `"1"` counts — `true`, the number `1`, `"yes"` all behave as off, and the symptom is a square-cornered image showing through a rounded frame.

### Opacity and blending

- `alpha`: `0`–`1`, clamped back into range if it goes outside. Set it on a parent and the whole subtree fades with it.
- `blendMode`: `normal` (default) · `multiply` · `screen` · `overlay` · `darken` · `lighten` · `plusLighter`. Case-insensitive, and **any value it fails to recognize falls back to the default** — a typo raises no error, the effect just never shows.
- A blend mode that works in light often inverts in dark (`multiply` goes nearly black on a dark background). If you use `blendMode`, look at the render in both.

### Transforms: rotate / scale / translate

```json
{
  "id": "badge",
  "type": "txt",
  "x": "{parent.w}-56pt", "y": "10pt", "w": "-1", "h": "-1",
  "paddingLeft": "6pt", "paddingRight": "6pt", "paddingTop": "2pt", "paddingBottom": "2pt",
  "text": "${@i18n.new}",
  "fontSize": "9pt",
  "textColor": "#FFFFFF|#0E1116",
  "bgColor": "#128F66|#6FE8BE",
  "rotate": "-8",
  "translateY": "-2pt"
}
```

- `rotate` / `scaleX` / `scaleY` are **plain numbers with no unit**. A unit raises no error; the whole value is discarded and the default applies — `rotate` back to `0` (no rotation at all), `scaleX/Y` back to `1` (no scaling at all). "I set a rotation and nothing happened" is almost always `"45deg"`.
- `rotate` is clockwise for positive values and **pivots on the node's center by default**. Only write `pivotX` / `pivotY` (in `pt`, measured from the node's top-left) to move the pivot; `-1` also means back to center.
- `translateX` / `translateY` take `pt` and move the node after layout, so they **do not affect anchors** — other nodes still read `{id.r}` at the pre-translation position. Note also that `-1pt` is the reserved size-to-content value: to move 1pt left write `-1.01pt` or use `x` instead.
- Transforms take no part in measurement: whatever a rotation or a scale pushes outside the parent still gets cut off if that parent has `clip` on.

### Shape clipping and soft fades: clipPath / mask

Two advanced fields on `path`; both take the same shape form: `{"d":"…","viewBox":"0 0 24 24","scaleType":"fitCenter","fillRule":"nonzero","paint":"…"}`.

- `clipPath` = use the shape to **hard-cut** the node down to that outline; nothing outside the shape is shown (irregular avatars, diagonally sliced widgets).
- `mask` = use the shape as a mask, and add `paint` to get a **soft** transition driven by opacity.
- The cheapest way to fade an edge is to **give only `mask.paint` and no `mask.d`**: the mask lands on the node's own rounded rectangle and follows the gradient's alpha from solid to clear.

```json
{
  "id": "fade",
  "type": "path",
  "x": "0pt", "y": "{parent.h}-40pt",
  "w": "{parent.w}", "h": "40pt",
  "d": "M0 0 H100 V40 H0 Z",
  "viewBox": "0 0 100 40",
  "scaleType": "fitXY",
  "fillColor": "#FFFFFF|#15171A",
  "mask": { "paint": "linear(#FF000000\\,#00000000)@90" }
}
```

- A `paint` written inside `clipPath` does nothing (only `mask.paint` is used); a soft transition has to go through `mask`.
- Writing `"fillRule": "evenodd"` inside `clipPath` / `mask` **also switches the node's own fill rule to evenodd**, which can suddenly hollow out a solid shape. Do not write `fillRule` in either place; change the node's own field instead.

### Images: img and background images

```json
{ "id": "logo", "type": "img", "x": "12pt", "y": "12pt", "w": "20pt", "h": "20pt", "url": "@[file://res/logo.png]", "scaleType": "fitCenter" }
```

- **Omitting `scaleType` gives you `centerCrop`** (fill and crop the overflow), not fit-inside. To fit the whole image in you must write `fitCenter` explicitly; a typo also lands on `centerCrop` (caught by `check` G7b). Hyphenated spellings `fit-center` / `center-crop` are accepted too, and matching is case-insensitive.
- `url` can be an in-package resource or a remote address pulled in with `${}`; if the image lives on a server that requires authentication, add `urlHeaders` (`{"name":"value"}`).
- Any node can paint a background image directly with `bgUrl` (plus `bgUrlHeaders` when needed), which saves an `img` child.
- When a remote image cannot be fetched that area is empty, so put a `layer` underneath to hold the color and avoid punching a hole in the widget.

### Rich text: richText

Each span in `spans[]` may set six fields: `text` · `fontSize` · `textColor` (or `color`) · `bgColor` · `typeface` · `baselineOffset`. Spans are concatenated in order into one sentence, while node-level `alignmentH` / `alignmentV` / `maxLines` / `lineSpacing` / `lineBreak` govern the block as a whole.

```json
{
  "id": "pts",
  "type": "richText",
  "x": "12pt", "y": "118pt", "w": "80pt", "h": "-1",
  "maxLines": "1",
  "spans": [
    { "text": "$[findNotEmpty::(${p0},--)]", "fontSize": "19pt", "typeface": "System-Bold", "textColor": "#0E1116|#F3F4F6" },
    { "text": "${@i18n.pts}", "fontSize": "10pt", "textColor": "#6B7280|#8E939B", "baselineOffset": "1pt" }
  ]
}
```

- Span boundaries **do not** insert a space of their own, and simply typing one does not work — see the next section.
- `baselineOffset` takes `pt`; a positive value lifts that span **up**, a negative one pushes it down — that is how you sit a small unit on the baseline of a big number.
- Always use it when a number and its unit differ in size; do not hand-align two separate `txt` nodes: the top of a text box is the top of the glyph ink, so hand-alignment is always off.

### The space between two spans

Span boundaries insert no space of their own, and **typing a space at the start or end of a span does nothing** — evaluation strips whitespace from both ends of the span, and rendering strips it once more. So this:

```json
{ "text": " Clicks", "fontSize": "10pt" }
```

renders as `1842Clicks`, with the number and the unit glued together. Moving the space to the end of the previous span, or typing a literal no-break space into the file, gives the same result; and **a span that is nothing but whitespace is dropped entirely**, as if you had never written it.

There is exactly one thing that works: make the whitespace **come out of a looked-up value**. Put a key in the locale table whose value is a no-break space, and give it a span of its own:

```json
"spans": [
  { "text": "$[findNotEmpty::(${p0},--)]", "fontSize": "19pt", "typeface": "System-Bold" },
  { "text": "${@i18n.nbsp}", "fontSize": "14pt" },
  { "text": "${@i18n.pts}", "fontSize": "10pt" }
]
```

```json
"i18n": {
  "zh-CN": { "nbsp": "\u00a0", "pts": "\u5206" },
  "en-US": { "nbsp": "\u00a0", "pts": "pts" }
}
```

**What a no-break space is**: Unicode U+00A0, the `&nbsp;` of the web. It is just a space — practically indistinguishable from a normal one in width and appearance — with two differences: the words on either side of it may not be split across lines ("10 kg" never breaks in two); and **routines that "strip surrounding whitespace" do not count it as whitespace**. The second difference is exactly why it survives.

**That span's font size is the gap width**, independent of the sizes on either side: roughly 0.2 times the font size (14pt ≈ 3pt, 20pt ≈ 4pt, 34pt ≈ 7pt). To tune the gap, change only that span's `fontSize`; the size contrast between the number and its unit stays untouched.

- Name the key `nbsp`, not something like `gap` or `sp`: the name says that its value must be a no-break space, and it is unlikely to clash with a key holding real copy. A clash raises no error — it simply renders that sentence where the gap should be.
- Prefix and suffix spaces already living in locale values (`" pts"` and the like) need the same treatment. Such a space is fine in the middle of a plain `txt` sentence, but the moment that key is used at the start of a span, the space is gone.
- `numable check` flags all three of the above as **G38**; fix whatever it reports.

### Text layout details

- `maxLines` set to `"0"` means **unlimited lines**, not "zero lines". For a single line write `"1"`.
- `alignmentH` / `alignmentV` **only accept `"0"` / `"1"` / `"2"`** (start / center / end). `"center"` raises no error and is silently treated as `"0"`, which shows up as "I set centered and it is still left-aligned".
- For alignment to be visible at all the node has to be bigger than the text: inside a self-sizing node with `w` set to `-1`, horizontal alignment is meaningless.
- `lineSpacing` is **extra** leading (in `pt`), not line height.
- `lineBreak` on = allow wrapping; off = one line only, anything past the edge is cut. As long as `maxLines` is set, text still wraps with it off.
- ⚠️ **This field is the ellipsis switch, and "not set" is not the same as "set to `"0"`"**:
  - **Explicitly write `"lineBreak": "0"` together with `maxLines`** → a "…" is appended where the text is cut. This is the only way to get one.
  - **Leave the field out** → a fixed-width node still wraps, but **no dots**.
  - **Write `"1"`** → wraps, no dots.
  - **Auto width** (`w: "-1"`) → grows to fit its content and never truncates, so no "…" either.

  Why "not set" cannot mean the same as "set to 0": the layout stage rewrites fixed-width nodes that never stated a preference, treating them as wrapping (a fixed width has to reflow into multiple lines for auto height to grow). So only an **explicitly written** `"0"` says the author wanted truncation with an ellipsis rather than wrapping.

  Measured (`numable render`; the preview here and the phone run the same rendering core, so what you see is the real result): a fixed 140pt width with `maxLines:"1"` and `lineBreak:"0"` renders `Mid-Autumn…`; the same node with `lineBreak:"1"` renders `Mid-Autumn` with no dots.
- Use only the enum values from the typeface list, and get bold by picking the `-Bold` variant (there is no `bold` field). **With no `typeface` the default is `Inter`**; text containing CJK characters is switched to `NotoSansSC` automatically (bold variants preserved), so mixed scripts never lose glyphs — but **Latin digits and CJK characters will not have the same glyph width**, so pick a monospaced family such as `JetBrainsMono` explicitly for a table that has to align in columns.

### Arcs and ring progress: arc

```json
{
  "id": "ring",
  "type": "arc",
  "x": "12pt", "y": "12pt", "w": "64pt", "h": "64pt",
  "startAngle": "-90",
  "sweepAngle": "$[calc::(${pct}*3.6)]",
  "useCenter": "0",
  "lineWidth": "6pt",
  "lineCap": "round",
  "strokeColor": "#128F66|#6FE8BE"
}
```

- Angle `0` points at three o'clock and increases clockwise; to start at twelve o'clock write `startAngle: "-90"`. `sweepAngle` is **how many degrees are swept**, not the end angle.
- **The radius comes from the width only** (half of `w`): a non-square node still draws a true circle, and the height only shifts the center vertically. For ring progress, always set `w` and `h` equal.
- When the arc is not closed the radius is further reduced by half the `lineWidth`, so the stroke does not spill out of the node.
- `useCenter` only accepts the string `"1"`: `"1"` connects both ends back to the center and draws a pie, any other value (including `true`) draws just the arc.
- The grey track underneath is **a second `arc`** (same size, `sweepAngle: "360"`); draw the track first, the progress second.

**Getting the number in the middle of the ring**: an `arc` only draws the stroke — the text inside it is a separate `txt`. Copy its `x/y/w/h` **verbatim from the `arc`** and turn on centring in both directions; the number then lands exactly on the centre, with no text measuring involved:

```json
{
  "id": "pct",
  "type": "txt",
  "x": "31pt", "y": "36pt", "w": "96pt", "h": "96pt",
  "maxLines": "1",
  "alignmentH": "1",
  "alignmentV": "1",
  "text": "$[findNotEmpty::(${pctText},--%)]",
  "fontSize": "24pt",
  "typeface": "System-Bold",
  "textColor": "#FFFFFF|#FFFFFF"
}
```

- `h` must be the same real number as the ring and **must not be `-1`**: an auto height shrinks the box to the height of the glyphs, leaving `alignmentV` nothing to centre in, and the text sits at the top of the ring.
- Likewise `w` must not be `-1`, or `alignmentH` does nothing (see "Text layout details" above).
- The number changes width (`9%` → `100%`), so **centring is the only way to position it — do not hand-tune `x`**; `maxLines: "1"` keeps a long value from wrapping and pushing the line off the centre.
- For two lines inside the ring (a big number plus a small label), do not put a line break in one `txt` — use two, each keeping the ring's `x/w` and `alignmentH: "1"`, stacked by `y`; `alignmentV` is then no longer needed.

### Polylines and areas: line / curves

```json
{
  "id": "trend",
  "type": "curves",
  "x": "12pt", "y": "60pt", "w": "134pt", "h": "40pt",
  "points": "[0,34,44,18,88,22,132,4]",
  "lineWidth": "1.5pt",
  "lineCap": "round",
  "strokeColor": "#128F66|#6FE8BE",
  "coverageColor": "linear(#4A128F66\\,#00128F66)@90|linear(#4A6FE8BE\\,#006FE8BE)@90"
}
```

- `points` is a string holding a JSON array, paired as `x,y,x,y…`, with coordinates **relative to the top-left of this node's content box**.
- An element may be a number or a **quoted layout expression** — `"points": "[0,20,\"{parent.w}/2\",4]"` — as long as the whole string is still a valid JSON array.
- Every dynamic value needs a `findNotEmpty` fallback: a null makes the whole string invalid and **whites out the entire widget**, so always look at the empty-state column.
- `coverageColor` fills "the area under the line": the two ends of the polyline are dropped **vertically to the bottom of the content box** to close the region. It is **available only on `line` / `curves`**; on any other node it makes the widget fail validation.
- `curves` has exactly the same fields as `line` and only smooths the polyline into a curve; with fewer than 3 data points the two look identical.

### Vector icons: path

```json
{
  "id": "arrow",
  "type": "path",
  "x": "{title.r}+4pt", "y": "{title.y}+2pt", "w": "10pt", "h": "10pt",
  "d": "M2 6 L5 3 L8 6",
  "viewBox": "0 0 10 10",
  "scaleType": "fitCenter",
  "lineWidth": "1.5pt",
  "lineCap": "round",
  "lineJoin": "round",
  "strokeColor": "#FF5C4D|#FF5C4D"
}
```

- Copy `d` and `viewBox` together out of the graphic file. Without `viewBox` there is nothing to scale the shape against, and the symptom is a wrong size or a shape running past its bounds.
- Stroke only: give `strokeColor` + `lineWidth`. Fill only: give `fillColor`. Give both and you get a filled, stroked shape.
- `fillRule` defaults to `nonzero` (everything filled); write `evenodd` for a doughnut-style hole.
- `scaleType` works exactly as it does on images; icons usually want `fitCenter`.
- **A dynamically assembled `d` must not contain a comma** — the comma is a structural character of expressions and will white out the whole widget. Separate coordinates with spaces (`"M0 0 L10 10"`), or escape them as described in "Structural characters must be escaped" above.

### Grouping and visibility: group / hide

A `group` paints no content of its own; its job is to hold children in `children` and manage them together: move them together (change the `group`'s `x/y`), fade them together (`alpha`), round and clip them together (`cornerRadius` + `clip`), hide them together (`hide`). Child `x/y` are relative to the `group`'s content box.

`hide` has three states, and it is the only way to do data-driven visibility (not `visibility` — that field is discarded wholesale, so what you meant to hide stays visible):

| Value | Effect |
|---|---|
| `"0"` (default) | Drawn normally |
| `"1"` | Not drawn, but **still occupies its slot**; anchors elsewhere are unchanged |
| `"2"` | Not drawn, and **all six anchors collapse to zero** |

```json
{ "id": "tag", "type": "txt", "x": "12pt", "y": "12pt", "w": "-1", "h": "-1", "hide": "$[if::(eq::(${apiOk},1),0,1)]", "text": "${tag}", "fontSize": "11pt", "textColor": "#6B7280|#8E939B" }
```

⚠️ An anchor read from a `hide: "2"` node (`{tag.r}`) comes back as **0**, not its laid-out position — "some other block jumped to the top-left corner" is nearly always this. Use `"2"` when you want the content below to move up, `"1"` when you want the layout to stay put.

### Control flow: op

An `op` node paints nothing; it only decides which nodes render and with what variables. There are six `action` values, and children go in **`react`**:

```json
[
  { "type": "op", "action": "if",      "props": { "val": "$[gt::(${n},0)]" }, "react": [] },
  { "type": "op", "action": "forEach", "props": { "items": "${list}", "key": "_it", "index": "_i" }, "react": [] },
  { "type": "op", "action": "for",     "props": { "count": "${cycle}", "index": "_i" }, "react": [] },
  { "type": "op", "action": "set",     "props": { "key": "_y", "value": "$[calc::(48+${_i}*48)]" } },
  { "type": "op", "action": "remove",  "props": { "key": "_y" } }
]
```

| action | What it does | Key points |
|---|---|---|
| `if` | Renders `react` only when `props.val` is truthy | Truthy means only `true` / `"1"` / `"true"` / `"on"` / `"yes"` / `"y"` and the number 1; every other number is false, so for an "is there any" test convert to a flag first: `$[gt::(${n},0)]` |
| `forEach` | Renders an array as repeated copies | Given an object, values are taken in key order; given a single scalar, it is treated as one element; given nothing, the body never runs. `key` names the current item, `index` the position |
| `for` | Loops a fixed number of times | `count` ≤ 0 renders nothing; with no `index` the default name is `__index` |
| `set` | Lands a variable for later use | A value that evaluates to null is not written; only once landed can it be read with `${}` |
| `remove` | Deletes a variable | Useful when the same name has to be `set` again further down |
| `include` | Expands a list of nodes in place | `props.dsl` takes an array of nodes (or its JSON string). To reuse a piece of layout within a package, copying those few nodes is usually simpler |

- Inside a loop body, `${_it.field}` reads the current item and `${_i}` the index. **Loop variables end with `react`** and never leak the last iteration's value outward.
- Only keys landed by `op:set` are visible to `${}` inside method arguments, so derive a value with `set` before you use it.
- **Draw the empty-state skeleton outside the `forEach`**: the loop only paints rows that have data, and an empty array must not leave a hole in the widget.
- Fields other than `props` and `react` are ignored; `react` must be an array — written as an object it fails the whole widget.


#### Example: an N-row list with `forEach`

Do not write the five rows out one by one (and do not write a script to generate them): expose the array as-is in the `.df` (`{ "op": "set", "props": { "key": "items", "value": "${resp.hits}" } }`, with `items` in the `resultFilter` `keys`), loop once in the `.rcn`, and compute each row's vertical position from the index:

```json
{ "type": "op", "action": "forEach", "props": { "items": "${items}", "key": "_it", "index": "_i" }, "react": [
  { "type": "op", "action": "if", "props": { "val": "$[lt::(${_i},3)]" }, "react": [
    { "type": "txt", "x": "14pt", "y": "14pt+${_i}*44pt", "w": "{parent.w}-28pt", "h": "-1",
      "text": "${_it.title}", "fontSize": "13pt", "textColor": "#0E1116|#F3F4F6", "maxLines": "1", "lineBreak": "0" },
    { "type": "txt", "x": "14pt", "y": "33pt+${_i}*44pt", "w": "{parent.w}-28pt", "h": "-1",
      "text": "▲ ${_it.points} · ${_it.num_comments}", "fontSize": "11pt", "textColor": "#6B7280|#8E939B", "maxLines": "1" }
  ]}
]}
```

- Write the coordinate as a **layout expression**, `14pt+${_i}*44pt` (the interpolation only multiplies; no minus sign, and not inside `$[calc::]`). Keep a fixed row height and cut the title with `maxLines:"1"` + `lineBreak:"0"` to get a "…". If row heights have to follow the content, compute each row's `y` in the `.df` and put it into the array items.
- The outer `if` caps how many rows are drawn, so a longer array never spills out of the widget.
- Draw the empty state (empty array) **outside** the loop (see the points above).

## Strings and i18n

Fixed strings do not get hardcoded into `text`; they go into this file's `rc.i18n` and are referenced with `${@i18n.key}`:

```
"text": "${@i18n.empty}",
…
"i18n": { "zh-CN": { "empty": "暂无数据" }, "en-US": { "empty": "No data" } }
```

- At minimum, provide the language named by `manifest.lang`; publishing requires both Chinese and English.
- **An empty string is a valid translation**, meaning "this language deliberately shows nothing", and it is never filled in from another language. In the publish profile, `check` flags empty strings as a suspected missing translation (G8); if it really is deliberate, declare `"i18nEmptyOk": ["key"]` under `rc`, as a sibling of `i18n`.
- **No emoji**: the RCN glyph pipeline cannot render code points above U+1F000, and the symptom is a blank spot. `check` catches it (G30). For a graphic, draw a `path`, or use a BMP-range symbol: `★ ✓ ✕ › ▲ ▼ ●`.

For strings organized across files, see `numable docs i18n`.

## Layout discipline

Seven rules; follow them and the widget will look right:

1. **Derive sizes from `{parent.w}` / `{parent.h}`**, never hardcode 158/338. The four classes: `22`=158×158 · `42`=338×158 · `44`=338×354 · `21`=158×60.
2. **Write both segments of every color, `light|dark`.**
3. **Widget margin**: `12pt` at width 158, `14pt` at width 338; text to block edge inside a plate is `10pt`.
4. **Whitespace**: bottom margin = widget margin; 6–8pt within one semantic block; 14–20pt between blocks. Text never touches an edge.
5. **Type sizes**: primary number 28pt (multi-metric) / 44pt (single metric) · secondary number 18pt · title 14pt · caption 11pt. Bold comes only from `typeface: "System-Bold"` (there is no `bold` field; if you write one it is dropped).
6. **One widget answers one question.** Class 22 holds at most 1 primary metric + 2 supporting ones; a live-data widget must carry a time anchor (small type, top-right or bottom).
7. **Format numbers with `$[parseNumber::(${x}, 0.00)]`** — never paste the raw value straight onto the widget.

The palette (copy it verbatim):

| Use | Paint |
|---|---|
| Widget background | `#FFFFFF\|#15171A` |
| Primary text | `#0E1116\|#F3F4F6` |
| Secondary text | `#6B7280\|#8E939B` |
| Divider | `#E4E7EC\|#262A31` |
| Accent (dots and lines only) | `#128F66\|#6FE8BE` |
| Section plate | `#E7E9EE\|#20232A` |
| Add-slot plate | `#EEF0F4\|#252930` |
| Up | `#FF5C4D\|#FF5C4D` |
| Down | `#1FC77D\|#1FC77D` |
| Up (tinted plate) | `#15FF5C4D\|#15FF5C4D` |
| Down (tinted plate) | `#151FC77D\|#151FC77D` |

The accent is close to the "down" color, so on a numbers widget use the accent only for things that carry no up/down meaning.

## Rules (break one = rework)

| Rule | Checked by | Symptom when broken | Fix |
|---|---|---|---|
| Every color field containing a hex value writes a `light\|dark` pair | `check` G7 | Glaring white block in dark / invisible text | Add the second segment; use one of the three allowlisted values for fully transparent |
| `img.scaleType` must be one of `fitXY` `fitStart` `fitEnd` `fitCenter` `centerCrop` | `check` G7b | A wrong spelling silently falls back to `centerCrop` and the image is cropped | Use a legal spelling |
| Every cell must have a non-empty `type` | `check` G7c | **The whole widget fails to render**, and the editor only says "wasm not ready" | Fold the comment into a neighboring cell's `_note`; write `op` in full form, `{"type":"op","action":…}` |
| A number takes exactly one unit suffix | `check` G28 | The widget renders nothing, with no error | Delete the extra `pt` |
| No `$[` nested inside `$[…]` | `check` G28 | A literal `$[…]` appears on screen | Write the inner call as a bare method name, `if::(…)` |
| `${x}` must come from this widget's `.df` `resultFilter` output | `check` G28 | That spot renders empty or always takes the fallback | Pass it in via `depends.params` → land it in `.df` → expose it through `resultFilter` |
| Do not write a tap as a `click` string (and never put `@[file://` in one) | `check` G29 | Tapping does nothing | Write `events.onClick` |
| No emoji in visible text (≥U+1F000) | `check` G30 | Blank spot | Draw a `path`, or use a BMP symbol |
| A cell-bound `.af` puts `ui.haptic` first | `check` G22 | ~250ms of no feedback after the tap, so the user taps again | Move it to `actions[0]` |
| Sizes and type sizes are always `pt` | Manual review / render layer | Content squeezed into the top-left corner, type too small | Replace every `px` |
| Geometry fields (`x/y/w/h/fontSize`) never contain `$[method]` | Render layer | The whole widget is a blank block | Compute it into a variable in `.df` and write `"${_w}pt"` |
| Anchors like `{parent.w}` never go into `$[calc::()]` | Render layer | That node silently paints nothing | Use a pure layout expression: `({parent.w}-{a.w})/2` |
| No interpolated subtraction inside coordinates (`"${v}pt-24pt"`) | Render layer | The expression is painted literally | Do the subtraction in `.df` before passing it |
| `cornerRadius` is a four-corner object | Render layer | The whole widget fails | `{"leftT":"8pt","leftB":"8pt","rightT":"8pt","rightB":"8pt"}` |
| Visibility uses `hide`, not `visibility` | Render layer | The unknown field is dropped entirely — the cell you meant to hide stays visible, with no error | Switch to `hide`, values `"0"/"1"/"2"` |
| A dynamically assembled `path.d` must not contain commas | Render layer | The whole widget goes white (a comma reads as an argument separator) | Separate coordinates with spaces |
| Every dynamic value inside `points` needs a `findNotEmpty` fallback | Render layer (empty-state column) | A failed fetch whites out the whole widget | `"$[findNotEmpty::(${b0},1.5)]"` |
| Any `calc::` inside a size string must be wrapped in `findNotEmpty` | Render layer (empty-state column) | In the empty state it computes null, concatenates into a bare `pt`, and the widget fails | `"$[findNotEmpty::(calc::(…),0)]pt"` |
| Build a pill/button as **one** `txt` (with `bgColor` + `padding*` + `cornerRadius`, `w:"-1"`) | Manual review | A hardcoded plate width pushes longer text outside the widget; or tapping the text does nothing (only the plate is hittable) | Merge into a single `txt`, and anchor `x` to itself: `{parent.w}-{id.w}-12pt` |
| You set `maxLines` but get no "…" | Render layer | Fixed-width text that overflows only wraps or is cut off, with no "…" at the end | Leaving `lineBreak` out is not the same as writing `"0"`: for an ellipsis, write `"lineBreak": "0"` explicitly (see "Text layout details" above) |
| The top of a `txt` box = the top of the glyph ink, not the top of the line box | Manual review | Number and unit are misaligned by about 11pt; a gap opens in the lower half | Put number + unit in `richText` `spans`; changing a type size means recomputing the next line's `y` |
| The empty-state skeleton is drawn **outside** the `forEach` | Render layer (empty-state column) | An empty array leaves a hole in the widget | Skeleton/placeholder is its own cell; the loop only paints content |

## When something goes wrong

| Symptom | Most likely cause | Do this first |
|---|---|---|
| The whole widget is blank and the log is clean | Some cell is missing `type`; a geometry field contains `$[method]`; a doubled unit suffix; `cornerRadius` written as a string | Run `numable check` — G7c / G28 name the file and the path directly; if those pass, hunt for `$[` field by field in the geometry |
| Only the empty-state column is white | A dynamic value in a size string or in `points` evaluates to null | Wrap every dynamic value in `findNotEmpty` with a legal number as the fallback |
| A literal `$[…]` or `${…}` appears on screen | `$[]` nested two levels deep; or interpolated subtraction inside a coordinate | Check `numable check` for G28; move the subtraction into `.df` |
| One node paints nothing at all | An `{anchor}` ended up inside `$[calc::()]`; or the method name is misspelled (unregistered methods evaluate to empty silently) | Rewrite the anchor as a pure layout expression; check the name against `numable docs methods` |
| Every value is `--`, but `.df` runs fine on its own | `${x}` is not in the render scope: it is a shell param that never came through `.df` | Check `numable check` for G28; add it to `resultFilter` |
| Unreadable or glaring in dark | A color was written as a single value; or a three-segment Paint's middle segment was ignored | Check `numable check` for G7; exactly two segments per color |
| Text runs together with no space between words | Spaces at the edges of a `richText` span are eaten (including a plain space hidden inside a locale value); `connect::` eats them too | Add a dedicated spacer span: text `${@i18n.nbsp}` with the locale value U+00A0, and its font size is the gap width; when the whole line is one size, a single `txt` with the space inside the interpolation also works |
| The image is cropped when you wanted it to fit | `scaleType` is misspelled and fell back to `centerCrop` | Check `numable check` for G7b, switch to `fitCenter` |

Look at the pixels: `numable render` renders every widget into three PNGs — light, dark, and empty state. **You must look at the empty-state column** — the most common production incident is not a crash but a white widget after a failed fetch.

## See also

- `numable docs rcn-nodes` — the full node and field tables
- `numable docs methods` — every method available inside `$[]`
- `numable docs xwidget` — widget size classes, `depends`, and parameters
