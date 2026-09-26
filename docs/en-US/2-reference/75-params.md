<!-- translated-from: zh-CN/2-reference/75-params.md sha256:bef2ff443b4d -->

# params — parameters and user-editable fields

> Audience: people building a source, and the AI working on their behalf. Both read this same page.

## What it is

The same widget: one person adds a copy tracking Moutai, another adds a copy tracking Nvidia. The difference is **params** — the widget declaration holds the default values, each widget instance carries its own copy, and the user can change them.

There are three things to wire up: **declaring** them (default values in `.xwidget`), **using** them (handing the values to the data flow and to rendering), and **changing** them (giving the user a way in, and writing the new values back). Miss any one and the symptom looks the same — "not broken, but useless": declared but never passed → the widget renders a wall of `--`; passed but with no way in → once the user adds the widget they can never switch what it tracks, short of deleting it and adding it again.

You do not have to draw the editing UI yourself — the platform ships two ready-made input UIs: single-value selection (`singleValue`) and a multi-field form (`.xform`), with 14 field types between them. You can also write an H5 page and draw it yourself.

## A minimal working example

A widget with parameters that can be edited (the `.xwidget` shell part):

```json
{
  "version": 2,
  "title": "Stock",
  "sub": "Price and its 2-month shape",
  "layout": 22,
  "params": { "secid": "1.600519", "alias": "Kweichow Moutai" },
  "events": {
    "onClick": "/detail?secid=${secid}",
    "onEdit": "/edit?ref=quote&secid=${secid}"
  },
  "canvas": {
    "source": "@[file://rc/quote.rcn]",
    "depends": [
      { "flow": "@[file://flow/quote.df]", "params": { "secid": "${secid}", "alias": "${alias}" } }
    ]
  }
}
```

In the matching editor page (`page/html/edit/index.html`, route `/edit`), writing back is a single line:

```js
var brickId = new URLSearchParams(location.search).get('brickId') || '';
xbridge.updateParams(brickId, { secid: '1.000001', alias: 'Ping An Bank' });
```

## How to write it

### Declaring: `params` in `.xwidget`

```json
"params": { "secid": "1.600519", "alias": "Kweichow Moutai", "mask": "0" }
```

- **Scalars only** (string / number / boolean); no nested objects or arrays. A multi-select result has to be flattened into one string too.
- What you write here are **default values**: a newly added widget starts from them.
- **Do not localize the defaults.** There is no `i18n` side table in `params`, and do not put a `${@i18n.x}` in a default value either: params are **data** (the input to fetching) and are never evaluated against the string table — a `${@i18n.x}` written there is just that literal string. Write business values as defaults (a code, a city id, a `"0"` switch), and keep text that changes with language in the `.rcn` or `.df` content table (`numable docs i18n`); to fetch by language, read `${@app.language}` directly in the `.df` instead of pushing the language into params.
  To make a name on the widget follow the language: keep only a stable code in params, expose that code from the `.df`, and let the `.rcn` choose between two content keys by the code: `"$[if::(eq::(${code},us),${@i18n.nameUs},${@i18n.nameCn})]"`.
- Do not name keys like secrets. A user's own secret goes through `manifest.credentials`, not params (`numable docs layout`).

### Three layers of value: default / instance / flow output

From lowest to highest:

1. **the default in `.xwidget`** — used while the user has not changed anything;
2. **this widget instance's own value** — a key the user changed overrides the default (delete a key and it falls back to the default);
3. **the data flow's output** — the merge of the two layers above is the flow's *input*; what RCN actually sees is this third layer, and that is what `${}` reads.

⚠️ One easy misstep: **shell params are not in RCN's rendering scope**. RCN only sees the keys exposed by the data flow's `resultFilter`. So a key that takes no part in fetching but has to show on the widget (an alias, a city name) must still make the round trip: pass it in → land it in the flow → expose it. Skip that trip and the slot is permanently empty or permanently on its fallback, with no error.

### Using: how params reach the `.df`

**Declare them explicitly at the binding**, one key at a time:

```json
"depends": [ { "flow": "@[file://flow/quote.df]", "params": { "secid": "${secid}" } } ]
```

A bare-string binding (`"depends": ["@[file://flow/quote.df]"]`) passes **no input parameters**: `${secid}` inside the flow resolves to empty, the request goes out as `?secid=`, and the flow still reports success.

Inside the flow you read them by their **bare top-level name**, not `${params.secid}`:

```json
{ "op": "set", "props": { "key": "k", "value": "$[findNotEmpty::(${secid},1.600519)]" } }
```

And the first thing an input parameter does in a flow is land with an `op:set` like the one above — a `${}` inside a method argument cannot see the flow's input parameters, only keys that have already landed.

An XPage's route query going into the root node's params, and an `.xform`'s `onSubmit` parameters, follow exactly the same rule: **pass explicitly whatever you need**.

### Changing: giving the user a way in

There is exactly one entry point: `events.onEdit` in `.xwidget` (long-press the widget → "Edit parameters"). The target can take one of three routes; pick one:

| Route | How to write it | Good for |
|---|---|---|
| ① an H5 page | `"onEdit": "/edit?ref=quote&secid=${secid}"`, and the page calls `xbridge.updateParams` | an editor needing search, lists, or custom layout |
| ② a form page | `"onEdit": "/edit"` pointing at a `type: "form"` route, and the `.xform`'s `onSubmit` flow calls `widget.updateParams` | filling in a few fields and being done |
| ③ an action flow | `"onEdit": "@[file://flow/edit.af]"`, where the flow takes one value via `singleValue` and then calls `widget.updateParams` | changing a single value, without even building a page |

What all three have in common:

- When it goes to a route, `onEdit` **must be a bare path** (`/edit`), never `numable://…` — it is matched literally against `router.json`, and a deeplink opens a blank page with no error. This differs from `onClick`.
- **The current value can only be carried across by interpolation** (`?secid=${secid}`): there is no API for reading instance parameters.
- **`brickId` is appended to the target page's query automatically by the container**; the page just reads it, you never pass it yourself.
- **Only this `onEdit` route can write back.** A flow bound to the whole widget's `onClick` has no bound widget instance, so a `widget.updateParams` inside it fails outright; a data flow refuses structurally (changing parameters inside depends would self-excite: change → re-render → change again).

### Writing back: the contract of `widget.updateParams`

In AF:

```json
{ "action": "widget.updateParams", "params": { "secid": "${picked.value.code}", "alias": null } }
```

In H5 (the same semantics with a different face):

```js
xbridge.updateParams(brickId, { secid: '1.000001', alias: null });
```

| Rule | Notes |
|---|---|
| The top level *is* the params to write | do not wrap them in `{params:{…}}`; in AF the host supplies `brickId`, and you neither need nor may pass it |
| **Merge, not replace** | only the keys you write are touched; the rest are kept as they are |
| `null` = delete the key | once deleted, that key falls back to the default in `.xwidget` = "restore default" |
| Values must be scalars | numbers and booleans convert to strings in standard form (`1.0` → `"1"`, `true` → `"true"`); an object or array fails the whole call |
| Validation precedes writing | if any one key is invalid the whole call fails, and **nothing is written halfway** |
| Returns the merged, complete params | in AF that is `{ params }` |
| Effective immediately | after a write-back the widget re-renders itself; the shell's "Done" only closes the page |

Write all the keys that belong together **in one call**. Changing city means writing `lat`/`lon`/`city` together: write the coordinates without the name and the widget shows the old city name next to the new city's numbers — worse than not taking effect at all.

### Single-value input: `singleValue`

Take one value in one step, without building a page:

```json
{
  "action": "singleValue",
  "id": "r",
  "params": {
    "container": "sheet",
    "title": "Pick a stock",
    "desc": "Takes effect immediately",
    "confirmTxt": "OK",
    "themeColor": "#5DCAA5|#4AB894",
    "component": {
      "type": "select",
      "value": "${secid}",
      "props": { "items": [
        { "label": "Kweichow Moutai", "value": "1.600519" },
        { "label": "Ping An Bank", "value": "0.000001" }
      ] }
    }
  }
}
```

- `container` is **required**: `page` / `sheet` / `dialog`.
- It returns `{ "value": { "value": <string | string[] | null> }, "cancelled": <bool> }`, so what you read is `${r.value.value}`.
- It takes a single value. For several fields, use an `.xform`.

The full shape of `params` (six keys; everything except `container` and `component` is optional):

| Key | Required | Notes |
|---|---|---|
| `container` | yes | `page` / `sheet` / `dialog` |
| `component` | yes | one field, exactly the same shape as a `component` in an `.xform` (the 14 types below) |
| `title` | no | the overlay's title |
| `desc` | no | one line of explanation under the title |
| `confirmTxt` | no | the confirm button's wording; the platform default is used when absent |
| `themeColor` | no | accent color, supports a `light\|dark` pair |

An example with all six keys filled in (taking one switch):

```json
{
  "action": "singleValue",
  "id": "r",
  "params": {
    "container": "dialog",
    "title": "${@i18n.maskTitle}",
    "desc": "${@i18n.maskDesc}",
    "confirmTxt": "${@i18n.ok}",
    "themeColor": "#5DCAA5|#4AB894",
    "component": {
      "type": "switch",
      "label": "${@i18n.maskLabel}",
      "value": "${mask}",
      "props": {}
    }
  }
}
```

### Multi-field form: `.xform`

`page/form/pick.xform`, plus a `"type": "form"` route for it in `router.json`:

```json
{
  "type": "form",
  "id": "form-pick-stock",
  "title": "Pick a stock",
  "desc": "Press OK when you are done",
  "confirmTxt": "OK",
  "themeColor": "#5DCAA5|#4AB894",
  "onSubmit": { "flow": "@[file://page/flow/save.af]", "params": { "brickId": "${brickId}" } },
  "form": {
    "code": {
      "title": "Ticker",
      "required": "1",
      "component": {
        "type": "select",
        "value": "NVDA",
        "props": { "items": [
          { "label": "Nvidia NVDA", "value": "NVDA" },
          { "label": "Apple AAPL", "value": "AAPL" }
        ] }
      }
    },
    "alias": {
      "title": "Name shown on the widget",
      "component": { "type": "textInput", "props": { "placeholder": "Leave blank to use the ticker" } }
    }
  }
}
```

Four hard rules:

1. **Never write `container` in the file** — the presentation is decided by the caller (`startPageForResult`), so one form is reusable as a page, a sheet, or a dialog.
2. In `form`, **the keys are the result keys**, and **declaration order is render order**.
3. `dataSource` accepts only a `.df` reference, with any extra parameters written inside the reference string: `"dataSource": "@[file://page/flow/search.df?market=us]"`.
4. The platform supplies the theming around it; only the accent color follows `themeColor`, which takes a `light|dark` pair (`"#5DCAA5|#4AB894"`), a single value meaning the same color in both. ⚠️ That two-part notation **applies to `themeColor` only**: a `colorPicker`'s `value` / `recommended` are content colors the user is picking, so `#FF0000` stays `#FF0000` and is never split in two.

In the flow bound to `onSubmit`, the values the user filled in arrive in `${@event.value}` (an object mapping field name to value), and you write them back from there:

```json
{ "action": "widget.updateParams", "params": { "secid": "${@event.value.code}", "alias": "${@event.value.alias}" } }
```

### The 14 field types

A field's shell is always `{ required?, title?, desc?, component: { type, label?, desc?, value?, disable?, props? } }`. Boolean values are always the strings `"true"` / `"false"`.

| `type` | Value shape | In one line |
|---|---|---|
| `textInput` | string | Free text; length caps, line caps and regex checks all live here |
| `numberInput` | string | A number with a range and a step |
| `datePicker` | string | A date, stored as a string in `format` |
| `timePicker` | `HH:mm` | A time |
| `colorPicker` | string | Presets plus a custom colour |
| `progressBar` | string | Picks a number by sliding |
| `switch` | `"true"` / `"false"` | A toggle |
| `radio` | string | One out of a set |
| `checkBox` | array | Several out of a set |
| `select` | string (array when several may be picked) | A dropdown |
| `imageSelect` | array | Images — remember `compress` |
| `searchSelect` | string | A picker with search, local or remote |
| `cascader` | string | A hierarchy written out in full |
| `dynamicCascader` | string | A hierarchy fetched level by level |

**Which props each type takes, what each one means and what it defaults to — see `numable docs form-fields`** (that table is generated by the form engine itself, so it cannot drift from the code). What follows is how to use them.


Multi-value fields (`checkBox` / `imageSelect`) come back as real arrays, but params take scalars only — `join::` them into one string before writing back.

#### Validation: caught the moment they submit

The form validates field by field **at the moment of submission**; anything that does not pass stops the submit, marks that field and shows one line of text, so a bad value never gets written out. All of it comes from the props in the table above — you do not write checks in a flow:

| props | Which fields | Rule |
|---|---|---|
| `required` | all of them (on the **field wrapper**, not inside `props`) | an empty value is rejected |
| `maxLength` | `textInput` | maximum number of characters |
| `maxLines` | `textInput` | maximum number of lines (counted by line breaks) |
| `pattern` + `errorMessage` | `textInput` | rejected when the regex does not match; `errorMessage` is the message, and without it the platform's own "wrong format" is used |
| `min` / `max` | `numberInput` · `progressBar` | numeric range, both ends included |
| `decimal` | `numberInput` · `progressBar` | maximum decimal places; `decimal: "0"` means integers only |
| `min` / `max` | `datePicker` | date range, **parsed with that field's own `format`**, so write them the same way |
| `minCount` / `maxCount` | `checkBox` · `select` · `cascader` · `imageSelect` | how many may be selected |

```json
{
  "required": "true",
  "title": "Email",
  "component": {
    "type": "textInput",
    "props": {
      "placeholder": "you@example.com",
      "maxLength": "64",
      "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
      "errorMessage": "That does not look like an email address"
    }
  }
}
```

⚠️ **An empty value passes `pattern`** — it only judges what was typed, never whether anything was typed. For a mandatory field add `"required": "true"` as well: two separate switches for two separate things.

⚠️ **`pattern` accepts two forms**: the bare expression (`"^\\d{6}$"`) or the slash-and-flags form (`"/^abc$/i"`). A broken regex **is not reported as an error — it is treated as "does not match"**, which shows up as "nothing I type is ever accepted", so try the expression on its own first.

⚠️ Validation runs **on submit only**, never while typing; `maxLength` therefore does not stop more characters going in, it stops the submit.

#### Image compression: `compress`

`compress` on `imageSelect` is an object. Leave it out and the original file is used, which for a phone photo means several megabytes going into the write-back:

| Key | Meaning |
|---|---|
| `targetSizeKB` | target size in KB; it compresses until it fits |
| `maxLongSide` | pixel cap on the long edge; **anything under 320 is treated as 320** |
| `minQuality` / `maxQuality` | quality range, decimals 0–1 (defaults `0.55` / `0.9`); if you swap them they are put back in order |
| `format` | `auto` (default) / `jpeg` / `png` |
| `alphaPolicy` | `preserve` (default, keeps transparency) / `drop` (drops it, compresses further) |
| `failPolicy` | when the target size cannot be reached: `use_min_quality` (default, the lowest-quality attempt) / `keep_original` |

```json
{ "type": "imageSelect", "props": {
    "maxCount": "3", "imageAccept": "image/*",
    "compress": { "targetSizeKB": "300", "maxLongSide": "1600", "format": "jpeg" } } }
```

#### One minimal example of each of the 14

Every entry below is a complete `component`, ready to paste into a field of an `.xform` (or into `params.component` of a `singleValue`):

```json
{
  "f01": { "title": "Text", "component": {
    "type": "textInput", "value": "hello", "props": { "placeholder": "Type here" } } },
  "f02": { "title": "Number", "component": {
    "type": "numberInput", "value": "8", "props": { "min": "0", "max": "100", "step": "1" } } },
  "f03": { "title": "Date", "component": {
    "type": "datePicker", "value": "2026-06-30", "props": { "format": "YYYY-MM-DD" } } },
  "f04": { "title": "Time", "component": {
    "type": "timePicker", "value": "09:30" } },
  "f05": { "title": "Color", "component": {
    "type": "colorPicker", "value": "#1677FF",
    "props": { "recommended": ["#1677FF", "#34C759", "#FF9500"] } } },
  "f06": { "title": "Slider", "component": {
    "type": "progressBar", "value": "40", "props": { "min": "0", "max": "100", "step": "1" } } },
  "f07": { "title": "Switch", "component": {
    "type": "switch", "value": "true" } },
  "f08": { "title": "Single choice", "component": {
    "type": "radio", "value": "a",
    "props": { "items": [{ "label": "Option A", "value": "a" }, { "label": "Option B", "value": "b" }] } } },
  "f09": { "title": "Multiple choice", "component": {
    "type": "checkBox", "value": ["a"],
    "props": { "items": [{ "label": "Option A", "value": "a" }, { "label": "Option B", "value": "b" }],
               "minCount": "0", "maxCount": "2" } } },
  "f10": { "title": "Picker list", "component": {
    "type": "select", "value": "b",
    "props": { "items": [{ "label": "Option A", "value": "a" }, { "label": "Option B", "value": "b" }] } } },
  "f11": { "title": "Images", "component": {
    "type": "imageSelect", "value": [], "props": { "maxCount": "2", "imageAccept": "image/*" } } },
  "f12": { "title": "Search and select", "component": {
    "type": "searchSelect", "value": "",
    "props": { "placeholder": "Type a keyword",
               "dataSource": "@[file://page/flow/search.df?market=us]" } } },
  "f13": { "title": "Static cascader", "component": {
    "type": "cascader", "value": "",
    "props": { "items": [{ "label": "Level 1", "value": "l1",
                           "children": [{ "label": "Level 2", "value": "l2" }] }] } } },
  "f14": { "title": "Dynamic cascader", "component": {
    "type": "dynamicCascader", "value": "",
    "props": { "dataSource": "@[file://page/flow/area.df]",
               "initialItems": [{ "label": "Level 1", "value": "l1", "isLeaf": false }] } } }
}
```

A few things that are easy to get wrong:

- **Booleans are always strings**: `"value": "true"`, `"minCount": "0"`; the `"isLeaf": false` inside `items` is a real boolean (it is option data, not a field value).
- A multi-select `select`, a `checkBox` and an `imageSelect` come back as arrays; everything else is a string, and `timePicker` is always `HH:mm`.
- The `items` elements of `radio` / `checkBox` / `select` / `cascader` are `{label, value}` (optionally `image`), with `children` added for `cascader`. **`value` is mandatory**: an entry with only a `label` can never be selected.
- You can interpolate the current value into `value`: `"value": "${secid}"` (an `.xform` gets it from the `params` of `startPageForResult`, a `singleValue` from the scope of the flow it runs in).

#### The two fields that fetch: `dataSource`

The options for `searchSelect` and `dynamicCascader` come from a `.df` that the platform calls on demand:

| Field | When it is called | What the flow can see |
|---|---|---|
| `searchSelect` | after the user types a keyword | `${@event.keyword}` |
| `dynamicCascader` | on every level expanded | `${@event.path}` (the array of values already chosen), `${@event.level}` (the level number, from 0) |

```json
{
  "version": 1,
  "actions": [
    { "op": "set", "props": { "key": "kw", "value": "${@event.keyword}" } },
    { "id": "resp", "action": "request", "params": {
      "url": "https://api.example.com/search?q=${kw}&market=${market}", "formatType": "json" } },
    { "op": "set", "props": { "key": "items", "value": "${resp.list}" } },
    { "action": "resultFilter", "params": { "keys": ["items"] } }
  ]
}
```

- The flow's output is either `{"items": [...]}` or an array outright; each element is `{label, value}` (a cascader may add `isLeaf` / `children`). **Elements with an empty `value` are dropped.**
- The `.df` sees only `@event` and **the query written explicitly in the reference string** (the `?market=us` above arrives as a top-level `${market}`); it cannot see any other field on the page.
- The reference must be `@[file://…df]`. A bare URL or an `.af` is rejected outright, which looks like "searching returns nothing, and nothing is reported".
- The same input parameters triggered again within 250 milliseconds reuse the previous result instead of firing another request.

### The return value is always `{ value, cancelled }`

Whether the sub-page is an `xpage`, `html`, or `form`, `startPageForResult` always gets back this shape:

| What happened in the sub-page | Result |
|---|---|
| the flow called `page.setResult({…})` | it closes and returns the value, `cancelled: false` |
| the flow called `page.close()` | it closes, `cancelled: true` |
| the user tapped ✕ / ‹ / the backdrop / the system back gesture | `onSubmit` is bypassed entirely: `{ value: null, cancelled: true }` |
| nothing was written / the flow failed | the form stays open with the entered values intact, ready to be submitted again |

So check `cancelled` before reading, and never write `null` back.

## Rules (breaking one means rework)

| Rule | How it is checked | Symptom when broken | Fix |
|---|---|---|---|
| Every widget with `params` has an `onEdit` | manual review | once added, the user can never switch what the widget tracks, short of deleting and re-adding it | add an editing entry point |
| An `onEdit` route must be a bare path present in `router.json`; an `onEdit` flow must be an in-package `.af` with no `..` | `check` G12d | nothing happens on tap, or a blank page opens with no error | write a bare path like `/edit` |
| The `onEdit` target must really be able to write back | `check` G12e | the page opens and pressing things changes nothing | html calls `xbridge.updateParams`; the `.xform`'s `onSubmit` flow or the XPage's `events` call `widget.updateParams` |
| Params for the data flow are written out key by key at the `depends` binding | `check` G12c | the widget renders a wall of `--` while the flow reports success | use the `{flow, params}` form |
| Keys shown on the widget must be exposed by the `.df`'s `resultFilter` | `check` G28 | that slot is permanently empty or permanently on its fallback | pass it into the flow, land it, expose it |
| `params` keys do not look like secrets (`token`/`secret`/`api_key`…) | `check` G18 | a secret lands on a plaintext echo surface and in shared screenshots | use `manifest.credentials` |
| Param values are scalars only | at the run layer (the whole write-back fails) | the parameter never gets written while the chain looks fine | flatten arrays with `join::` first |
| Related keys are written together in one call | manual review | the name is old and the number is new | write them all in the same call |
| `widget.updateParams` is only called on the `onEdit` route | at the run layer (it reports `no_brick_context`) | the flow fails outright | come in through `onEdit` |
| The `dataSource` of a `searchSelect` / `dynamicCascader` is only ever `@[file://…df]` | manual review (open the form and search once) | the search box returns nothing at all, with no error | switch to an in-package `.df` reference, with extra parameters after the `?` |
| No `container` in the `.xform` file | manual review | the presentation is hardcoded and the three-state shell cannot reuse it | delete that key |
| Check `cancelled` before reading a sub-page result | manual review | the user cancelled, and `null` got written back | test `cancelled` first |

## When something goes wrong

| Symptom | Most likely cause | What to do first |
|---|---|---|
| the editor page opens, but the widget never changes | the page never calls the write-back; or `brickId` was not picked up | confirm `xbridge.updateParams` is actually called, and that `brickId` is read from the query |
| long-press "Edit parameters" opens a blank page | `onEdit` was written as `numable://…`, or the route is not in `router.json` | switch to a bare path and check the route table |
| the write-back errors and nothing takes effect | one key's value is an array or an object | flatten it into a string; validation is all-or-nothing |
| the widget shows the old name with the new numbers | the display key was left out of the write-back | write the related keys together |
| one key on the widget is always empty although `run` is correct | that key is not in `resultFilter` (shell params are not in the rendering scope) | send it through the flow and expose it |
| submitting the form does nothing | the `onSubmit` flow failed (which leaves the form open) | run that `.af` on its own with `numable run` and see where it breaks |
| parameters get wiped after the user cancels | the write-back happened without checking `cancelled` | check it first |

## See also

`numable docs xwidget` · `numable docs af` · `numable docs page`
