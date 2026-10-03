<!-- translated-from: zh-CN/1-guides/30-add-interaction.md sha256:1214175e3bde -->

# add-interaction — add taps and parameter editing

> Audience: people building a tool, and the AI working on their behalf. Both read this same page.

## Goal

Turn a widget from "something to look at" into "something to use". Three scenarios, from shallow to deep; they are independent, so take what you need:

| Scenario | User action | What you write | Contract it delivers |
|---|---|---|---|
| ① Tap the widget to run a flow | Tap anywhere on the widget | `events.onClick` = an `.af` | Record something / toggle a state, and make the widget update immediately |
| ② Long-press to edit parameters | Long-press the widget → Edit | `events.onEdit` = an `.af` | **Write the chosen value back into this widget's instance parameters** |
| ③ Collect several fields | Long-press the widget → a form | `.xform` + `startPageForResult` | Collect a whole set of values at once, then write them back |

All three share one thing: the **action flow `.af`**. It and the data flow `.df` are two different file kinds: a `.df` can only fetch and transform data (see `numable docs df`), while an `.af` is the one with haptics, overlays, navigation, write-back and refresh.

## Prerequisites

- The package already has one working widget;
- You know the widget's instance parameter names (the `params` in `.xwidget`);
- `.af` files live in `xWidget/flow/*.af` (used by widgets) or `page/flow/*.af` (used by pages). **`@[file://...]` inside `.xwidget` and `xWidget/rc/*.rcn` resolves from `xWidget/`**, so you write `@[file://flow/mark.af]`; on the page side it resolves from the package root.

---

## Scenario ① · Tap the widget to run a flow

**What to do**: change the value of `events.onClick` from a navigation string to an `.af` reference. If the value resolves to a string it is navigation; if it resolves to a reference or an inline object it runs a flow.

`xWidget/today.xwidget`:

```json
{
  "version": 2,
  "title": "Today",
  "sub": "Cups so far today",
  "layout": 22,
  "params": {},
  "events": { "onClick": "@[file://flow/drink.af]" },
  "canvas": {
    "source": "@[file://rc/today.rcn]",
    "depends": [ { "flow": "@[file://flow/today.df]", "params": {} } ],
    "refresh": { "interval": ["3600"] }
  }
}
```

`xWidget/flow/drink.af`:

```json
{
  "version": 1,
  "actions": [
    { "action": "ui.haptic" },

    { "id": "cur", "action": "data.get", "params": { "key": "cups", "default": 0 } },

    { "op": "set", "props": { "key": "_b", "value": "1" },
      "_note": "Read barrier: the step immediately after data.get cannot see its result, so put one empty set in between" },

    { "op": "set", "props": { "key": "c0", "value": "${cur}" },
      "_note": "Land upstream results as data-scope keys first — ${} inside method arguments only sees keys that op:set has landed" },

    { "op": "set", "props": { "key": "next", "value": "$[calc::(${c0}+1)]" } },

    { "action": "data.set", "params": { "key": "cups", "value": "${next}" } },

    { "action": "ui.toast", "params": { "message": "${@i18n.logged}", "type": "success", "duration": 2000 } },

    { "action": "widget.refresh",
      "_note": "Always refresh after writing to disk, and place it after every data.set. scope defaults to bundle, desktop defaults to true" }
  ],
  "i18n": {
    "zh-CN": { "logged": "已记下一杯" },
    "en-US": { "logged": "One more cup" }
  }
}
```

Seven points, each matching one silent failure:

| Point | Symptom if you skip it |
|---|---|
| `actions[0]` is always `ui.haptic` | RCN has no animation, so there is ~250 ms of nothing between the tap and the repaint, and the user taps again |
| Insert an `op:set` barrier after `data.get` | The adjacent step reads empty, everything downstream is wrong, and the flow still reports success |
| Land values with `op:set` before using them in method arguments | `$[calc::(${cur}+1)]` resolves to nothing and computes empty |
| Follow disk writes with `widget.refresh`, after every `data.set` | The data is written but the widget still shows the old content (the render cache has no data dimension); it only heals on the next `interval` |
| The condition key of `op:if` is `props.val` (not `cond`) | The condition is always false, the whole branch silently does not run, and the flow still reports success |
| `concurrent` / `sequential` go in the `action` slot (not the `op` slot) | The whole block is silently skipped |
| Copy goes through `${@i18n.key}` plus the flow's top-level `i18n` table | English users get Chinese text |

What the flow can see: **this widget's instance parameters** + `@i18n` (this flow's own table) + `@app`. **There is no `@event`** — a whole-widget tap carries no event payload.

The three scopes of `widget.refresh`:

```json
{ "action": "widget.refresh", "params": { "scope": "self" } }
```

| `scope` | What it refreshes | Notes |
|---|---|---|
| `bundle` (default) | Every widget in this package | This package only; never across packages |
| `widget` | Every instance of the one widget kind named by `widgetId` | `widgetId` is required |
| `self` | The single widget that triggered this flow | Needs the host to supply widget identity; whole-widget onClick / onEdit both do |

The meaning is "clear the fetch timer + actually fetch + re-render", not reload. Calling it twice within 5 seconds returns `{refreshed:0}`, which is a **success**; matching 0 widgets is also a success. Calling it from a data flow (`.df`, `depends`) is hard-refused — that would self-oscillate: refresh → re-run depends → refresh again.

⚠️ **`widget.updateParams` cannot be used from a whole-widget `onClick`**: an onClick flow does not carry widget identity, so the call fails the whole flow with `no_brick_context`. To change this widget's parameters, use scenario ②.

**Command**

```
numable check <package>
```

**What "correct" looks like**: no G30 (`op:if` condition key) or G4b (reference immediately after a concurrent block) errors. If this `.af` is bound to a cell in a `.rcn` rather than to the whole widget, `check` also uses G22 to verify that `ui.haptic` is in `actions[0]` (W). Whether the flow behaves correctly can only be learned by tapping it in the app — `run` only runs `.df` files.

---

## Scenario ② · Long-press to edit parameters

The user long-presses a widget on the dashboard → "Edit". This path delivers exactly one contract: **write the value back into this widget's instance parameters.** Like scenario ①, this flow can read the widget's instance parameters, so writing `${quote}` into `singleValue`'s `component.value` preselects the current value; when the user cancels, `${r.cancelled}` is `true` and `${r.value.value}` is empty, so check for emptiness and skip the write-back. "It opens, but pressing OK does nothing" is the most common failure on this path.

**What to do**: point `events.onEdit` at an `.af` reference, and in that flow collect a value with `singleValue` and write it back with `widget.updateParams`.

Excerpt from `xWidget/now.xwidget`:

```json
"params": { "city": "Shanghai", "lat": "31.2222", "lon": "121.4581" },
"events": {
  "onClick": "numable://self",
  "onEdit": "@[file://flow/edit-city.af]"
}
```

`xWidget/flow/edit-city.af`:

```json
{
  "version": 1,
  "actions": [
    { "action": "ui.haptic" },

    { "id": "r", "action": "singleValue",
      "params": {
        "container": "sheet",
        "title": "${@i18n.title}",
        "desc": "${@i18n.desc}",
        "confirmTxt": "${@i18n.ok}",
        "component": {
          "type": "select",
          "value": "${city}",
          "props": {
            "items": [
              { "label": "Shanghai", "value": "Shanghai" },
              { "label": "Beijing", "value": "Beijing" },
              { "label": "Guangzhou", "value": "Guangzhou" }
            ]
          }
        }
      }
    },

    { "op": "set", "props": { "key": "picked", "value": "${r.value.value}" },
      "_note": "The return shape is always {value:{value}, cancelled}; land it before testing it" },

    { "op": "if", "props": { "val": "$[if::(gt::(length::(${picked}),0),1,0)]" },
      "items": [
        { "action": "widget.updateParams", "params": { "city": "${picked}" } },
        { "action": "ui.toast", "params": { "message": "${@i18n.done}", "type": "success" } }
      ]
    }
  ],
  "i18n": {
    "zh-CN": { "title": "选择城市", "desc": "改这张卡显示的城市", "ok": "确定", "done": "已更新" },
    "en-US": { "title": "Pick a city", "desc": "Change the city on this widget", "ok": "OK", "done": "Updated" }
  }
}
```

`singleValue` essentials:

- `container` is **required**: `page` / `sheet` / `dialog`. A sheet is always 0.8 of the container height and a dialog always 0.6; neither grows with its content.
- The return value is always `{ "value": { "value": <string|string[]|null> }, "cancelled": <bool> }`; read `${r.value.value}`.
- To test whether anything was picked, use the non-empty test `gt::(length::(x),0)`, not something like `eq::(x,)`.
- There are 14 component types (`textInput` `numberInput` `datePicker` `timePicker` `colorPicker` `progressBar` `switch` `radio` `checkBox` `select` `imageSelect` `searchSelect` `cascader` `dynamicCascader`), and booleans are the strings `"true"` / `"false"`. Field details are in `numable docs params`.

`widget.updateParams` essentials:

- The input **is the params to merge, at the top level** — no extra wrapper. Keys are merged one by one; a value of `null` deletes that key and falls back to the default in `.xwidget`.
- Values must be scalars and are normalised to strings (`1.0` → `"1"`, `true` → `"true"`); passing an object or an array fails the whole call.
- The write takes effect immediately: it is persisted and that widget re-renders. You do **not** add a `widget.refresh` (that one is for `data.*` writes).
- Failures end the whole flow (`no_brick_context` / `non_scalar_value` / `brick_not_found`); it never returns a fake success.

**The other form of onEdit** is a bare route path pointing at a page that can write back:

```json
"events": { "onEdit": "/pick" }
```

| Target | How it writes back | What `check` inspects |
|---|---|---|
| html page | `xbridge.updateParams(brickId, params)` | Always passes |
| `.xform` page | The flow bound to `onSubmit` contains `widget.updateParams` | That flow |
| `.xpage` page | Some node's `events` binding contains `widget.updateParams` (**`depends` is not considered**) | Those bindings |

**Command**

```
numable check <package>
```

**What "correct" looks like**: none of these G12d / G12e errors appear —

| Error | Meaning | Fix |
|---|---|---|
| `onEdit = numable://…` | onEdit matches `router.json` paths literally, and the `numable://` form never matches → it opens a **blank page with no error** | Use a bare path (`/pick`) or an af reference |
| `onEdit points at …, but the package has no xWidget/…` | The af base is `xWidget/`, not the package root | Fix the path |
| `that flow has no widget.updateParams` | "Edit parameters" runs and changes nothing | Add the write-back |
| `that page has no widget.updateParams in …` | Same as above, page form | Add the write-back inside the page |

---

## Scenario ③ · Collect a set of fields with `.xform`

When several values change at once (name + code + label), use `.xform`: it is a **page**, presented by `startPageForResult` as one of page / sheet / dialog, and on submit it feeds the values back to the flow that opened it.

### 1) Write the form

`page/form/pick.xform`:

```json
{
  "type": "form",
  "id": "form-pick",
  "title": "${@i18n.title}",
  "desc": "${@i18n.desc}",
  "confirmTxt": "${@i18n.ok}",
  "themeColor": "#5DCAA5|#4AB894",
  "onSubmit": "@[file://page/flow/pick-submit.af]",
  "form": {
    "name": {
      "title": "Name",
      "required": "true",
      "component": { "type": "textInput", "props": { "placeholder": "Enter a value" } }
    },
    "code": {
      "title": "Symbol",
      "component": {
        "type": "select",
        "value": "NVDA",
        "props": { "items": [
          { "label": "NVIDIA NVDA", "value": "NVDA" },
          { "label": "Apple AAPL", "value": "AAPL" }
        ] }
      }
    }
  },
  "i18n": {
    "zh-CN": { "title": "选择股票", "desc": "改这张卡跟踪的标的", "ok": "确定" },
    "en-US": { "title": "Pick a stock", "desc": "Change what this widget tracks", "ok": "OK" }
  }
}
```

Four hard rules:

- **Do not write `container`** — the presentation mode is decided by the caller's `startPageForResult`; a value in the file is ignored and makes the same form inconsistent between two entry points;
- The **keys of `form` are the result keys**, and **declaration order is render order**;
- A field's shell is `{ required?, title?, desc?, component: { type, value?, props? } }`, with booleans as strings;
- The `dataSource` of `searchSelect` / `dynamicCascader` accepts only a `.df` reference, with extra parameters written inside the reference (`@[file://page/flow/search.df?market=us]`).

### 2) Register the route

Add one entry to `page/router.json`. ⚠️ A `form` page's `entry` is **relative to the package root and carries its own `page/` prefix**, unlike html / xpage:

```json
{ "path": "/pick-form", "type": "form", "entry": "page/form/pick.xform", "title": "Pick a symbol" }
```

### 3) The submit flow: hand the values over

`page/flow/pick-submit.af`:

```json
{
  "version": 1,
  "actions": [
    { "action": "page.setResult",
      "params": {
        "name": "${@event.value.name}",
        "code": "${@event.value.code}"
      }
    }
  ]
}
```

In an `onSubmit` flow the user's input lives at `@event.value.<field key>`. `page.setResult` closes the form and returns the values; writing nothing leaves the form open with its values intact and re-submittable (useful when validation fails and you want to stay put).

### 4) The calling flow: open the form → write back

`xWidget/flow/edit-stock.af` (bound to `onEdit`):

```json
{
  "version": 1,
  "actions": [
    { "action": "ui.haptic" },

    { "id": "r", "action": "startPageForResult",
      "params": {
        "page": "/pick-form",
        "container": "sheet",
        "params": { "secid": "${secid}" }
      }
    },

    { "op": "set", "props": { "key": "code", "value": "${r.value.code}" } },
    { "op": "set", "props": { "key": "name", "value": "${r.value.name}" } },

    { "op": "if", "props": { "val": "$[if::(gt::(length::(${code}),0),1,0)]" },
      "items": [
        { "action": "widget.updateParams", "params": { "secid": "${code}", "title": "${name}" } }
      ]
    }
  ]
}
```

`startPageForResult` essentials:

| Item | Notes |
|---|---|
| `page` | A route path, matching an entry in `router.json` literally |
| `container` | **Defaults to `sheet`**; `page` = pushed on the stack / `sheet` = bottom overlay (0.8 of container height) / `dialog` = centred overlay (0.6 of container height) |
| `params` | The inputs handed to the child page |
| Return value | Always `{ value, cancelled }`; cancelling (✕ / ‹ / tapping the backdrop / the system back gesture) gives `{ value: null, cancelled: true }` and never runs `onSubmit` |
| Page types | All three of `xpage` / `html` / `form` work |

An `html` child page returns values through the bridge: `xbridge.setResult(payload)` / `xbridge.closePage()`.

**Command**

```
numable check <package>
```

**What "correct" looks like**: `check` reports no errors; the route `/pick-form` exists with `type` `form`; and the `onEdit` flow contains a `widget.updateParams` (G12e). How the form looks and whether it submits is judged by trying it in the app.

---

## Common mistakes

| Symptom | Most likely cause | What to do first |
|---|---|---|
| Tapping does nothing at all | `onClick` is a bare flow-name string (neither a navigation string nor an `@[file://...]` reference) | Change it to `@[file://flow/x.af]` |
| Tapping does nothing, but only on widgets | The `.af` path was written relative to the package root | On a widget, references resolve from `xWidget/` |
| None of the actions in a branch run, yet the flow reports success | `op:if` used `cond` instead of `props.val` | Use `props.val`; `check` G30 catches it (E) |
| The data is written but the widget does not change | `widget.refresh` is missing, or it sits before one of the `data.set` steps | Move it after every disk write |
| "Edit" opens, but nothing changes after picking | The flow has no `widget.updateParams` | Add it; `check` G12e catches it (E) |
| Long-press edit opens a blank page | `onEdit` was written in the `numable://` form | Use a bare path; `check` G12d catches it (E) |
| The whole flow fails with `no_brick_context` | `widget.updateParams` was called from a whole-widget `onClick` (which carries no widget identity) | Move it to `onEdit` |
| The form is an overlay from one entry point and a full page from another | The `.xform` file declares `container` | Remove it and let `startPageForResult` decide |
| The user cancelled, yet the widget was wiped | `cancelled` was never checked, or the value was written back without an emptiness test | Add a non-empty test before writing back |
| The flow stalls halfway | An action flow has a hard 15-second timeout; actions that wait for the user (`nav.open` / `startPageForResult` / `singleValue`) pause the clock, but other long operations do not | Move slow work into a `.df`, or call `ui.showLoading` first |
| The overlay text is Chinese even in an English environment | The copy is hard-coded instead of going through `${@i18n.key}` | Add the flow's top-level `i18n` table |

## Next

- The complete action table and file format for `.af`: `numable docs af`
- The 14 form components and their parameter model: `numable docs params`
- The three page types and routing: `numable docs page`
