<!-- translated-from: zh-CN/1-guides/50-localize.md sha256:c2a8ddce1018 -->

# localize — turning a Chinese-only package bilingual

> Audience: the person building a source, and the AI working on their behalf. Both read this same page.

## Goal

Take a package that exists only in Chinese and make it bilingual: store front, widget titles, page titles, the words on the widget, the toasts it pops. In an English environment, all of it is English. When you are done, `numable render <package> --locales zh-CN,en-US` gives you two sets of renders, and every bilingual check in `numable check <package> --profile publish` is green.

**Start with one rule of thumb**, which decides which table each piece of text belongs in:

> **A field the host reads and displays directly always goes in the metadata table (B). Anything the package itself references through the evaluator always goes in the content table (A).**

| | Content table (A) | Metadata table (B) |
|---|---|---|
| What it looks like | One `i18n: { locale: { key: text } }` at the top of the file (in `.rcn` it is `rc.i18n`) | The bare field is the base language; translations sit beside it in `i18n: { locale: { field: value } }` |
| How it is used | Reference it as `${@i18n.key}` | No reference; the host picks for itself |
| Who uses it | `.rcn` · `.af` · `.xform` · `.xpage` | `manifest.json` · `.xwidget` · every route in `router.json` · credential `label` |
| What an empty string means | **A valid translation** (deliberately blank); no fall back | **Missing**; keep falling back |

Both tables share one fallback chain: `current locale → other locales in the same language → en-US → base language (manifest.lang) → zh-CN → the rest`. In one sentence: use the exact match if there is one, otherwise use English.

## Before you start

- The package already runs (`numable check` / `run` / `render` all pass);
- Decide the **base language**: `manifest.lang`, defaulting to `zh-CN`. It means "which language every bare field is written in".

---

## Step 1 · The manifest store front (table B)

**What to do**: keep the bare fields in Chinese and add an `i18n` block. The translatable fields are exactly `title` / `subtitle` / `category` / `description`.

```json
{
  "lang": "zh-CN",
  "title": "GitHub 示例",
  "subtitle": "某个用户最近的公开动态",
  "category": "developer",
  "i18n": {
    "en-US": {
      "title": "GitHub Sample",
      "subtitle": "A user's recent public activity"
    }
  }
}
```

- Use a platform enum key for `category` (`finance` `developer` `productivity` `life` `health` `system` `tech` `news` `tools` `dashboard` `testing`); the app localizes it for you, so **do not translate it**. Only free-form text needs an English override.
- In the store grid, the title is a two-line tile: **the width limit per language is 24** (a full-width character counts as 2, a half-width one as 1), and ≤16 is a good target. English titles are often longer than Chinese ones, and anything over the limit is truncated.

**Command**

```
numable check <package> --profile publish
```

**What "right" looks like**: no G19 (missing `manifest.i18n["en-US"].title/subtitle` = E), no G21 (title too wide = E).

## Step 2 · Widget titles (table B)

**What to do**: add English `title` / `sub` to every `.xwidget`.

```json
{
  "version": 2,
  "title": "现在天气",
  "sub": "温度 · 体感 · 今日高低",
  "i18n": {
    "en-US": { "title": "Now", "sub": "Temperature, feels like, today's range" }
  },
  "layout": 22
}
```

These two fields show up in the "add widget" panel and in the long-press menu; skip them and the widget title stays Chinese in an English environment. `check` reports G20 as a W.

## Step 3 · Page titles (table B)

**What to do**: hang a translation beside the `title` of every route in `router.json`.

```json
{
  "routes": [
    { "path": "/", "entry": "html/home/index.html" },
    {
      "path": "/detail",
      "entry": "html/detail/index.html",
      "title": "个股详情",
      "i18n": { "en-US": { "title": "Stock detail" } }
    }
  ]
}
```

⚠️ A route title **cannot** be written as `"title": "${@i18n.detail}"` backed by a top-level word table — route titles are not evaluated, so the title bar shows that template string verbatim. `check` reports G8 as an E.

## Step 4 · The words on the widget (table A)

**What to do**: turn every fixed, human-visible string in `.rcn` into `${@i18n.key}` and put the word table in `rc.i18n`.

```json
{
  "rc": {
    "cells": [
      { "id": "hl", "type": "txt",
        "text": "${@i18n.high} $[findNotEmpty::(${hi},--)]°   ${@i18n.low} $[findNotEmpty::(${lo},--)]°",
        "x": "12pt", "y": "112pt", "w": "{parent.w}-24pt", "h": "-1",
        "fontSize": "11pt", "textColor": "#1A1A1A|#FFFFFF", "maxLines": "1" },
      { "id": "cond", "type": "txt", "text": "${@i18n.cond_clear} · ${at}",
        "x": "12pt", "y": "130pt", "w": "{parent.w}-24pt", "h": "-1",
        "fontSize": "10pt", "textColor": "#8E939B|#8E939B", "maxLines": "1" }
    ],
    "i18n": {
      "zh-CN": { "high": "高", "low": "低", "cond_clear": "晴" },
      "en-US": { "high": "H", "low": "L", "cond_clear": "Clear" }
    }
  }
}
```

Details for table A:

| Rule | Why |
|---|---|
| One flat level | `{ locale: { key: value } }`, with no extra wrapper such as `values` (`check` reports G8 as an E) |
| Keys use only `[A-Za-z0-9_]` | And they **cannot be built dynamically** (`${@i18n.${k}}` evaluates to nothing) |
| Values must be strings | When a value cannot be resolved, RCN / XPage render the raw string, so the literal ends up on screen |
| Interpolate by joining several keys | "12 degrees high" becomes `${@i18n.high} ${t}${@i18n.deg_post}`; do not turn a whole sentence into a template |
| Plurals use two keys | `key_one` / `key_other`, selected in the text with `$[if::(...)]` |
| Widget text lives in `.rcn`; a `${@i18n.x}` on an XPage node needs its key in the `.xpage` top-level table | Node level reads the page table, where `.rcn` keys are invisible; a missing key renders as blank |

## Step 5 · Messages from action flows (table A)

**What to do**: add an `i18n` block of the same shape at the top of `.af` and `.df` files (and `.xform` / `.xpage` pages), then use `${@i18n.key}` in `ui.toast` / `ui.alert` / form titles and in the finished sentences a data flow assembles.

```json
{
  "version": 1,
  "actions": [
    { "action": "ui.haptic" },
    { "action": "ui.toast", "params": { "message": "${@i18n.logged}", "type": "success" } }
  ],
  "i18n": {
    "zh-CN": { "logged": "已记下今天" },
    "en-US": { "logged": "Logged today" }
  }
}
```

Scope-merging rules (the higher one wins):

| Carrier | Which table applies |
|---|---|
| XPage node | The page table |
| Canvas | The page table ⊕ that `.rcn`'s `rc.i18n` (`.rcn` wins) |
| `.af` | The host table ⊕ the flow's own table (a widget event flow has no host table, only its own) |
| `.df` | The host page's table ⊕ the flow's own table (a widget data flow has no host table, only its own) |
| `.xform` | Its own table |

### An XPage's table sits at the top of the file

The node level of a `.xpage` (a node's `params`, `props.text`, a long-press `menu[].label`) reads **the `i18n` at the top of that page**, which is a different table from a `.rcn`'s `rc.i18n`:

```json
{
  "type": "xpage",
  "id": "channel",
  "root": {
    "layout": "list",
    "items": [
      { "type": "Canvas", "id": "hd", "h": "120pt",
        "canvas": { "source": "@[file://page/rc/head.rcn]" } },
      { "type": "input", "id": "kw", "w": "276pt", "h": "44pt",
        "props": { "hint": "${@i18n.searchHint}" } }
    ]
  },
  "i18n": {
    "zh-CN": { "searchHint": "搜频道…", "openYt": "在 YouTube 打开 ↗" },
    "en-US": { "searchHint": "Search channels…", "openYt": "Open on YouTube ↗" }
  }
}
```

- The table sits at the **top level of the page file**, as a sibling of `type` / `root`, not inside `root`.
- The `.rcn` files the page's `Canvas` nodes reference read "the page table ⊕ their own `rc.i18n`", and on a key collision the `.rcn`'s own entry wins — so text belonging to a `.rcn` stays in that `.rcn`, there is no need to move it up.
- If the node level references a key the page table does not have, that spot evaluates to an **empty string**: no error, no literal left behind, just blank space that looks like forgotten copy. `check` G35 exists for exactly this.

### `.xform` uses its own table

A form page's table is at the top of the file too, as a sibling of `type` / `form`; every string in the file — title, description, confirm button, and each field's `title` and `props.placeholder` — can reference it:

```json
{
  "type": "form",
  "id": "form-pick",
  "title": "${@i18n.title}",
  "desc": "${@i18n.desc}",
  "confirmTxt": "${@i18n.ok}",
  "onSubmit": "@[file://page/flow/save.af]",
  "form": {
    "name": {
      "title": "${@i18n.nameLabel}",
      "component": { "type": "textInput", "props": { "placeholder": "${@i18n.namePh}" } }
    }
  },
  "i18n": {
    "zh-CN": { "title": "选择", "desc": "改完点确定", "ok": "确定",
               "nameLabel": "名称", "namePh": "请输入名称" },
    "en-US": { "title": "Pick", "desc": "Confirm when done", "ok": "OK",
               "nameLabel": "Name", "namePh": "Enter a name" }
  }
}
```

The form shell's own strings (Cancel, Clear, "Please choose" and the like) are supplied by the platform in the app's language; you do not translate those.

## Step 6 · html pages look after themselves

An H5 page does not consume table A — it is a web page. Keep its word table in JS and read the language from the two places the host provides:

```js
var LANG = (document.documentElement.dataset.lang || "zh").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
// or: var info = await xbridge.appInfo(); info.data.language
window.addEventListener("languagechange", function (e) { /* e.detail.language */ });
```

The host writes `data-lang` on the root element before the page loads; switching languages does **not** reload the page, it only dispatches `languagechange`. `appInfo()` is async — forget the `await` and you get a Promise object.

Keep the word table in the page's own JS, in whatever shape you like. A minimal pattern that is good enough:

```js
var T = {
  zh: { title: "近 30 天", empty: "还没有数据", refresh: "刷新" },
  en: { title: "Last 30 days", empty: "Nothing yet", refresh: "Refresh" }
};
var lang = (document.documentElement.dataset.lang || "zh").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
function t(k) { return (T[lang] && T[lang][k]) || T.en[k] || k; }

function paint() {
  document.querySelectorAll("[data-t]").forEach(function (el) { el.textContent = t(el.dataset.t); });
}
paint();
window.addEventListener("languagechange", function (e) {
  lang = String(e.detail && e.detail.language || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  paint();   // the page is not reloaded, so repaint the strings already on screen yourself
});
```

Three things to watch:

- **Switching language does not reload the page**, so reading `data-lang` once at startup is not enough — without a `languagechange` listener the page keeps the old wording until the user leaves and comes back.
- Static attributes such as `<html lang>` do not update themselves; if screen readers need them, write them inside `paint()` as well.
- Page copy and the `.rcn` table A are **two separate sets** with no shared channel. When the same sentence appears both on a widget and on a page, write it in both places.

---

## Step 7 · Look at both sets of renders together

**Command**

```
numable render <package> --locales zh-CN,en-US
```

**What "right" looks like**: under `<package>/.numable/render/` each widget produces `<widget>.<state>.<locale>.png`, plus an `index.html` contact sheet. Open the sheet and compare them one by one:

- The English render must have no leftover Chinese (a missing key falls back to Chinese, and you can see it);
- English is usually longer: check for truncation, for a wrapped line pushing the next one out, for numbers and units drifting out of alignment;
- Look at the empty-state column too — empty-state text has to be bilingual as well.

Without `--locales`, only the base language is rendered. Pages work the same way: `numable render <package> --page --locales zh-CN,en-US` produces a light and a dark image per route per language.

## Step 8 · Pass the checks

**Command**

```
numable check <package> --profile publish
```

The `personal` profile skips the bilingual sections, so **localization work must be verified with the publish profile**.

**What "right" looks like**:

| Code | What it catches | Level |
|---|---|---|
| G8 | Table A is not a flat object / has a `values` wrapper / a referenced key is missing in a required locale / a route title written as `${@i18n.}` backed by a top-level word table | E |
| G8 | Keys do not line up across locales / an empty translation is not declared / an unused key / a locale code that is not BCP-47 | W |
| G8b | Hard-coded Chinese in a user-visible key | W |
| G19 | `manifest.i18n["en-US"].title` or `subtitle` is missing | E |
| G20 | `.xwidget`'s `i18n` is not an object | E |
| G20 | `.xwidget` is missing the English `title` / `sub` | W |
| G21 | A title exceeds width 24 in some language | E |

---

## Three things people get backwards

### 1) An empty string is a valid translation in table A and "missing" in table B

English often drops a Chinese measure word or suffix ("12 度" → "12°"), and there `"deg_post": ""` is **deliberately blank**: at runtime it renders as nothing and does not fall back to Chinese. `check` raises a W on every empty string to ask whether you simply have not finished translating; when it really is deliberate, declare it once on the host object of the same table:

```json
"i18n": {
  "zh-CN": { "deg_post": "度" },
  "en-US": { "deg_post": "" }
},
"i18nEmptyOk": ["deg_post"]
```

(In `.rcn` it goes under `rc`, next to `rc.i18n`.) In table B, on the other hand, `"title": ""` always means "not written for this locale" and the fallback chain continues.

### 2) Fetching by language, and producing text in the data layer

When the user switches language, the dashboard runs one `widget.refresh` per package (clear the fetch timer + a real fetch). So for data the API itself serves in Chinese and English (news headlines, city names), just read the language in the `.df`:

```json
{
  "id": "news",
  "action": "request",
  "params": { "url": "https://api.example.com/news?lang=${@app.language}", "formatType": "json" }
}
```

A `.df` has exactly the same shape as an `.af`: it may carry a top-level `i18n` table, and the body writes `${@i18n.key}` (what you read is the host page's table ⊕ this file's table). To produce finished text in the data layer ("About the same as yesterday", "59% into today's range"), do it right in the `.df`:

```json
{
  "version": 1,
  "actions": [
    { "id": "resp", "action": "request", "params": { "url": "https://api.example.com/today?lang=${@app.language}", "formatType": "json" } },
    { "op": "set", "props": { "key": "_b", "value": "1" } },
    { "op": "set", "props": { "key": "delta", "value": "${resp.delta}" } },
    { "op": "set", "props": { "key": "summary", "value": "$[if::(gt::(${delta},0),${@i18n.up},${@i18n.flat})]" } },
    { "action": "resultFilter", "params": { "keys": ["delta", "summary"] } }
  ],
  "i18n": {
    "zh-CN": { "up": "比昨天高", "flat": "和昨天差不多" },
    "en-US": { "up": "Higher than yesterday", "flat": "About the same as yesterday" }
  }
}
```

Two things to know:

- **Any flow file may have a top-level `i18n` table**; write text as `${@i18n.key}` and branch on language with `${@app.language}`; `check` applies the same G8 checks to a `.df` table as to an `.af`.
- **The data-cache key includes the language.** After a switch, no widget has stored data for the new language yet: a skeleton shows first, then the data once fetched; switching language offline leaves no data to show for that language (the empty or error state appears) — pull to refresh once you are back online.

The theme (light/dark) is different: it is a pure render parameter, switching theme only re-renders and never fetches, and the data cache is not split by theme either, which is why colors must be written as `light|dark` pairs.

### 3) Both caches are split by language

The same widget is two bitmaps and two sets of data under two languages (the rendered-image cache and the data cache are both split by language), and the app already handles that. Whether you assemble the sentence in the `.df` or emit only numbers and codes (`group: "clear"`) and let the `.rcn` join the wording with `${@i18n.cond_clear}` is your call — both paths update after a language switch.

---

## Common mistakes

| Symptom | Most likely cause | What to do first |
|---|---|---|
| A literal `${@i18n.xxx}` or a blank appears on screen | That key does not exist in the table the carrier reads (a `.rcn` reads the rc table, an XPage node reads the page table) | Add the key to the right table and check the spelling; `numable check` points it out through G8 / G35 |
| Widget title is Chinese in an English environment | The `.xwidget` is missing `i18n.en-US.title/sub` | Fill in table B; `check` G20 |
| Store widget is Chinese in an English environment | The manifest is missing `i18n.en-US` | Fill in table B; `check` G19 (E) |
| Page title does not follow the language | The route title is written as `${@i18n.}` + a top-level word table, which is not evaluated | Hang an `i18n` beside the route object; `check` G8 (E) |
| A whole locale table has no effect | The locale code is not BCP-47 (something odd instead of `en`), or the table is not a flat object | `check` G8 reports it; write locale codes as `en-US` / `zh-CN` |
| After switching language the widget shows a skeleton first and the data arrives a moment later; offline it shows the empty state | The data cache is split by language: there is no stored data for the new language yet, it shows once fetched; offline there is no data for that language to show | Expected behavior; pull to refresh once online |
| Widget text does not change after switching language | The text is hard-coded in the `.df` or `.rcn` instead of going through `${@i18n.key}`; or the data does not vary by language at all | Add a top-level `i18n` table and switch the text to `${@i18n.key}`; to fetch by language, read `${@app.language}` in the `.df` |
| English widget text is truncated | English is longer, and widget widths are fixed sizes | Shorten the translation, or give that `txt` a `maxLines` and a smaller `fontSize` in the `.rcn` |
| `check` reports no bilingual errors at all | You are on the default `personal` profile | Add `--profile publish` |

## Next

- The full rules for tables A and B and the fallback chain: `numable docs i18n`
- Widget drawings and text-node fields: `numable docs rcn`
- The full pre-publish checklist: `numable docs publish`
