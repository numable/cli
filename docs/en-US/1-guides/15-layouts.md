<!-- translated-from: zh-CN/1-guides/15-layouts.md sha256:8a17cefa70db -->

# layouts — start from an official layout: pick one, wire the data, write the copy

> Readers: people making tools, and the AI working for them. Both read the same text.

## Goal

Make a widget that looks like an official one without drawing anything: pick one of twelve official layouts and connect its **slots** to your data and copy. Positions, font sizes, colours, the light and dark variants, number formatting and the empty state when data can't be fetched are all handled by the layout; you touch one section of one file.

Who it's for: you want a widget that "shows some number" and no existing tool has it (to build a dashboard from existing widgets, see `numable docs board`). To design the picture yourself, follow `numable docs first-card`.

## The twelve layouts

| Name | What it is | Good for | Sizes |
|---|---|---|---|
| `big-number` | One big number + unit + one supporting line | Steps, balance, followers, temperature | `22` · `11` |
| `change` | Price + change pill, coloured by the user's up/down convention | Stocks, exchange rates, indices | `22` · `21` |
| `sparkline` | A number + its recent shape | Weight, traffic, prices | `22` · `21` |
| `list` | 3–5 rows, a name and a value per row | Watchlist, tasks, a few services | `42` · `44` |
| `progress` | Done vs. goal: a ring on the square size, a bar on the mini size | Steps today, budget, quota | `22` · `21` |
| `countdown` | N days until a date (switches wording on the day and afterwards) | Anniversaries, holidays, deadlines | `22` · `21` |
| `checkin-grid` | A cell per day, done or not; bottom-right is today | Habits, workouts, study | `22` · `42` |
| `compare` | One measure side by side across 2–3 things, the largest marked | Mileage per person, downloads per channel | `42` |
| `status` | One light: ok / warn / down / unknown | Sites, services, devices | `22` · `11` |
| `ranking` | Top N with rank numbers; the large size adds a relative bar per row | Spending categories, top posts | `44` · `22` |
| `agenda` | What's next: the event, when, how long until, where | Meetings, classes, medication | `22` · `21` |
| `dual-metric` | Two different measures, one block each | Distance and climb, revenue and orders | `42` · `22` |

Sizes are explained in `numable docs xwidget` (`22` = 158×158, `42` = 338×158, `44` = 338×354, `21` = 158×60, `11` = 68×60). All sizes of a layout share **one data flow**: fill the slots once and every size gets them.

List every layout:

```
numable init --layout
```

## Before you start

1. The `numable` command works; rendering images also needs Chrome / Chromium (check with `numable doctor`).
2. You know where the data comes from: a public API, data stored by the bundle, or just a few fixed lines of copy.

## Step 1 · Create a bundle from a layout

**What**: put the layout name after `--layout`. What you get is an ordinary bundle with a fresh identity (ULID).

**Command**

```
numable init weight --layout sparkline --title Weight
```

**What success looks like**

```
✓ New bundle Weight  id=01M4A4GN96F18T671BSM14R5T4
  directory: /…/weight
  from: layout sparkline (slots described in slots.json)
```

The directory contains:

```
weight/
  manifest.json
  slots.json                  slot reference (for people and AI only; not used at runtime)
  xWidget/
    sparkline.xwidget         size 22
    sparkline-21.xwidget      size 21
    rc/sparkline.rcn          drawing: do not edit
    rc/sparkline-21.rcn       drawing: do not edit
    flow/sparkline.df         data: edit only the "① slots" section
```

It renders straight away — every layout ships sample data and makes no network calls:

```
numable render weight
```

## Step 2 · Read slots.json

**What**: check what each slot expects before you start. A slot looks like this:

```json
{
  "key": "series",
  "kind": "data",
  "type": "series",
  "required": true,
  "meaning": {
    "zh-CN": "走势:数字数组,按时间从旧到新,最后一个 = 现在。取最后 16 个点;不足 16 个时左边补平",
    "en-US": "History: an array of numbers, oldest first, last = now. The last 16 points are drawn; fewer are padded flat on the left"
  },
  "example": [920, 980, 1010, "…", 1284],
  "whenEmpty": { "zh-CN": "图位画一块骨架", "en-US": "A skeleton block in the chart area" }
}
```

| Field | Meaning |
|---|---|
| `key` | The slot name; also the `key` of its `op:set` in the `.df` |
| `kind` | `copy` text · `data` data · `style` a switch (pick one of the given names) |
| `type` | The shape of the value, see "Slot conventions" below |
| `required` | Leave a required slot empty and its spot shows `--` |
| `maxLen` | Maximum length per size (in Chinese characters; English is about 1.8× as many letters); longer text is cut with "…" and never pushes other things around |
| `values` | The allowed values of an `enum` slot |
| `example` | A sample value |
| `whenEmpty` | What the widget shows when this slot is empty |

`pick` in `slots.json` says in one line what the layout suits; `sizes` lists its sizes.

## Step 3 · Fill the slots

**What**: open `xWidget/flow/<layout>.df`. It has two sections, separated by two empty `op:set`s (`_slots` / `_derived`):

- **① slots**: one `op:set` per slot. Replace the sample value with your data expression or copy — **edit this section only**.
- **② derived**: turns the slots into what the widget draws (formatted numbers, direction of change, chart coordinates, colour roles). Do not edit it; changes here make the picture shift or go blank.

Copy goes into the `i18n` table at the top of the file, and the slot says `${@i18n.<key>}`; keys starting with `t_` are the layout's own copy, leave them alone. For network data, add a `request` and a barrier before ①, and put the host in `network` in `manifest.json`.

A filled-in ① section (weight, from a public API):

```json
{
  "version": 1,
  "i18n": {
    "zh-CN": { "title": "体重", "unit": "kg", "note": "近 16 次" },
    "en-US": { "title": "Weight", "unit": "kg", "note": "Last 16 weigh-ins" }
  },
  "actions": [
    {
      "id": "resp",
      "action": "request",
      "params": { "url": "https://api.example.com/weight", "method": "GET", "formatType": "json", "timeout": "8000" }
    },
    { "op": "set", "props": { "key": "_b", "value": "1" }, "_note": "barrier: the step right after a request can't see its result yet" },
    { "op": "set", "props": { "key": "_slots", "value": "1" } },
    { "op": "set", "props": { "key": "title", "value": "${@i18n.title}" } },
    { "op": "set", "props": { "key": "value", "value": "${resp.latest}" } },
    { "op": "set", "props": { "key": "format", "value": "1dp" } },
    { "op": "set", "props": { "key": "unit", "value": "${@i18n.unit}" } },
    { "op": "set", "props": { "key": "series", "value": "$[pluck::(${resp.history},kg)]" } },
    { "op": "set", "props": { "key": "change", "value": "" } },
    { "op": "set", "props": { "key": "note", "value": "${@i18n.note}" } },
    { "op": "set", "props": { "key": "at", "value": "$[formatDate::(${@time.nowMs},HH:mm)]" } },
    { "op": "set", "props": { "key": "accent", "value": "teal" } },
    { "op": "set", "props": { "key": "_derived", "value": "1" } }
  ]
}
```

(The ② section after `_derived` and the `resultFilter` stay as they are; they are not copied here.)

- When the API gives an array of objects and the layout wants an array (`series`, `names`, `values`), take one column with `$[pluck::(${resp.list},field)]`.
- Give numbers raw; no need to format them yourself: the `format` slot decides whether it shows as `8,432` / `8.4K` / `8432.0`.
- An optional slot you don't use gets an empty string `""` — don't delete its line, or section ② can't read it.

**Commands**

```
numable check weight
numable run weight
numable render weight
```

**What success looks like**: `check` reports zero errors; `run` shows `✓` for every flow; in the light / dark / empty columns from `render`, numbers and copy sit where you expect, and long copy ends in "…" instead of running into other text.

## Slot conventions

| `type` | What to give | Example |
|---|---|---|
| `text` | One line of text | `"1,204 more than yesterday"` |
| `number` | One number (a number or numeric string, grouping commas are fine; non-numbers show as-is) | `8432` |
| `percent` | The percentage itself; `-1.23` means down 1.23% (a trailing `%` is fine) | `1.37` |
| `time` | The freshness stamp: `HH:mm` today, `MM-dd HH:mm` otherwise; leave empty for purely local widgets | `"14:30"` |
| `date` | `yyyy-MM-dd` | `"2027-02-06"` |
| `datetime` | `yyyy-MM-dd HH:mm` | `"2026-10-08 14:30"` |
| `series` | Array of numbers, oldest first | `[920, 980, 1284]` |
| `bits` | A string of `0` / `1` per day, last char = today | `"0110111"` |
| `text[]` / `number[]` | An array, one per row, top to bottom | `["Apple", "NVIDIA"]` |
| `enum` | Exactly one of `values` | `"ok"` |

Three shared slots:

- `title`: the widget name (first line). The object's name if there is one (`Apple`, `Shanghai`), otherwise what it shows (`Steps today`). Not the source name — the user knows which tool it is.
- `accent`: the accent colour, by name only: `indigo` `green` `blue` `purple` `orange` `rose` `teal` `graphite`. It colours the identity dot and the layout's one highlight. Use `graphite` for up/down widgets (red and green already mean up and down).
- `at`: the freshness stamp at the top right. For network data, the time it was fetched; leave it empty and the spot is not shown.

`format` (layouts with numbers): `auto` grouping + up to two decimals · `int` whole number · `1dp` / `2dp` fixed decimals · `compact` 万 / 亿 in Chinese, K / M / B otherwise · `raw` as given. Size `11` always uses the compact form.

Up/down colours are handled for you: `change` / `sparkline` follow the up/down colour the user picked in the app; without a choice, red is up in Chinese and green is up otherwise.

## Rules (break one = redo)

| Rule | Checked by | What you see if broken | Fix |
|---|---|---|---|
| Edit only the "① slots" section of the `.df` and its `i18n` table | Human review | Edited `.rcn` positions or section ②: other data makes it shift, fields go empty | Recreate from the layout; wire data only in ① |
| Delete no slot line; unused ones get `""` | run layer | Section ② can't read it; that spot shows `--` or a whole block is empty | Put the `op:set` back |
| Keep slot names | run layer | That spot on the widget is always empty | Use the `key` from `slots.json` |
| Copy goes into the `i18n` table, Chinese and English | Human review | Still Chinese after switching to English | Write `${@i18n.<key>}` in the slot |
| Declare `network` when fetching | `check` G3 | The request is blocked; the widget stays empty | Add the host to `manifest.json` |

## When things go wrong

| Symptom | Most likely cause | First step |
|---|---|---|
| `run` says "Empty fields: note" | An optional slot left empty on purpose | Declare it in `.numable/params/_dfrun.json`: `{ "optionalEmpty": { "<widget name>": ["note"] } }` |
| The number shows `--` | The slot's expression gets nothing (wrong path / request failed) | Check that flow's output with `numable run <bundle>` |
| The sparkline is flat | `series` is not an array, or has one point | Take an array of numbers with `pluck::` |
| The change pill is grey | `change` is empty or 0 | Make sure it's the percentage, not the price |
| The check-in cells are all grey | `days` is not a `0` / `1` string | Build a per-day bit string whose last char is today |

## Next steps

- Several layouts in one bundle: create one bundle per layout, move the files under `xWidget/` into a single bundle (keep the names distinct), then `numable check`.
- You can delete `slots.json` before publishing (keeping it does no harm); publishing also needs `logo.png` and at least three widgets, see `numable docs publish`.

## Related

- `numable docs df` — writing data flows and the allow-list
- `numable docs board` — dashboards from existing widgets
- `numable docs first-card` — designing the picture yourself
