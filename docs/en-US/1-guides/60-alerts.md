<!-- translated-from: zh-CN/1-guides/60-alerts.md sha256:9387c57a4d33 -->

# alerts — reminders and background jobs

> Audience: the person building a tool, and the AI working on their behalf. Both read this same page.

## Goal

Add a **reminder** to a package (a notification when a time arrives or a condition holds) or a **background job** (no notification: it runs on its own schedule and writes the result into this package's `data.*`, which your widgets and pages read the next time they render).

Both are the same kind of file: `xJob/<id>.xjob`. **A Job is a widget without a picture** — the shell (`title` / `sub` / `i18n` / `params` / `form` / `events`) follows `.xwidget`, and inside it are two recipes: `task` (what to run) and `alert` (what to send afterwards).

## Before you start

1. The package already runs (`numable check` is error-free on the `personal` profile).
2. If the reminder has to judge a condition, the package already has a data flow whose `resultFilter.keys` really exposes the key you want to judge — the reminder reuses that flow instead of duplicating it. How to write one: `numable docs df`.

---

## Step 1 · Learn the three shapes

**There is no `type` field.** The shape is a combination, and `check` and the runtime read it the same way:

| Has `alert`? | Has `depends` in `task`? | What it is | How it knows to fire |
|---|---|---|---|
| yes | no | **static reminder** | Everything — what to send and when — is fixed the moment the user creates it, and handed to the system scheduler |
| yes | yes | **dynamic reminder** | At each tick it fetches, then judges the condition, and only fires when the answer is true |
| no | yes | **background job** | At each tick it fetches and writes into `data.*`; it never sends anything |

Two questions decide it: **do you want a notification?** No → write only `task`. Yes → write `alert`; **can you tell whether and what to send at creation time?** Yes → `task` only needs `refresh`; no → `task` needs `depends`.

`task` has the **same shape** as a widget's `canvas`: `canvas` is `{source, depends, refresh}`, `task` is `{depends, then, refresh}` — drop the drawing, add a step that runs afterwards. If you can write a widget you can write a Job, and the `depends` contract is word for word the same (slots are independent, merged in declaration order, inputs come only from the call site, and no slot can see another slot's output).

### The smallest version of each

```jsonc
// Static reminder: every day at 08:00 (3 keys. task has only refresh = nothing to judge, so it just fires)
{
  "title": "Drink water",
  "task":  { "refresh": { "at": ["08:00"] } },
  "alert": { "message": { "title": "Time for water", "body": "One 250ml glass" } }
}
```

```jsonc
// Dynamic reminder: nudge me while something is unhandled (5 keys. No new data flow — depends points at the widget's own)
{
  "title": "Pending",
  "task":  { "depends": [{ "flow": "@[file://xWidget/flow/todo.df]" }],
             "refresh": { "interval": ["1800"] } },
  "alert": { "activeCondition": "$[gt::(${n},0)]",
             "message": { "title": "${n} items waiting", "body": "Tap to deal with them" } }
}
```

```jsonc
// Background job: log one value a day, no notification (4 keys. No alert block = never fires)
{
  "title": "Log the daily gold price",
  "task": { "depends": [{ "flow": "@[file://xWidget/flow/range.df]" }],
            "then": { "flow": "@[file://xJob/flow/record.df]", "params": { "cur": "${cur}" } },
            "refresh": { "at": ["23:55"] } }
}
```

It lives at `xJob/<id>.xjob`, a sibling of `xWidget/`; `manifest` needs no entry, being in the folder is enough. `depends` points at a widget's data flow (read only), and the flow for the `then` step lives in `xJob/flow/`. **Inside a `.xjob`, `@[file://…]` paths are relative to the bundle root** — unlike `.xwidget`, where they are relative to `xWidget/`. Getting it wrong resolves to empty: the fetch never happens and nothing is reported.

---

## Step 2 · Generate the skeleton with init

**Command** (run it inside the bundle folder):

```
numable init --job price --kind cross
```

`--kind` is only a template name; it does not appear in the generated file. There are six:

| `--kind` | Writes | When to use it |
|---|---|---|
| `static` | `xJob/<id>.xjob` | Fires at a time, fetches nothing |
| `once` | `xJob/<id>.xjob` | Fires once at a date and time the user picks (see "Reminders that fire once" below) |
| `cross` | `xJob/<id>.xjob` | Fires once when the value crosses the line you set (decided by a built-in recipe, see Step 4) |
| `level` | `xJob/<id>.xjob` | Fires every so often while the condition holds |
| `changed` | `xJob/<id>.xjob` | Fires when the value is no longer what it was (decided by a built-in recipe, see Step 4) |
| `task` | `.xjob` + `xJob/flow/<id>.df` | No notification; the result goes into `data.*` |

**What success looks like**: it lists the files it wrote plus three follow-ups. If a target file already exists it writes nothing and stops — it will never overwrite your edits. The plain fields use the package's `lang`; `--lang` overrides it on the spot.

One thing to do right after generating: point `task.depends` at a data flow this package really has. `init --job` raises `manifest.minEngine` to the engine version this kind of reminder needs by itself (4 for threshold-cross and value-change, 3 for a one-time reminder, 2 for the rest; left alone if already high enough) and prints what it changed. If you later lower it by hand, `check` reports G45 — too low and the symptom is: on an older app the reminder simply never fires, and nothing is reported.

**You can also do this in the desktop App's Workbench** (Mac / Windows): open the package, and the "Alerts & jobs" group in the tree on the left holds the files under `xJob/`; "New reminder / task…" creates the same skeleton as `init --job` from the same templates and raises `minEngine` too. The editor splits the `.xjob` into a form you fill in section by section (the decision can be one of the Threshold cross / Above threshold / Value change recipes), and next to it previews, live, the **consent panel**, the **notification** and the **upcoming** fire times the user will see; **Test run** really fetches and decides once and feeds the result into the previews. It edits the same `.xjob` file, so you can switch between the CLI and the editor freely.

---

## Step 3 · Field by field

### The shell

| Field | Static | Dynamic | Job | Type / one caution |
|---|---|---|---|---|
| `version` | no | no | no | int, defaults to `1` |
| `id` | no | no | no | `[a-z0-9-]`, defaults to the file name. **Do not rename it**: every copy a user creates is booked under "package + rule id + parameters", so a different spelling is a different rule and the old copies — with whatever the user typed into them — are orphaned |
| `title` | **yes** | **yes** | **yes** | The creation sheet, the reminders page and the long-press menu on a widget all use it as the name of this rule |
| `sub` | no | no | no | A one-line subtitle |
| `i18n` | advised | advised | advised | A single overlay table with exactly four slots, see step 5 |
| `params` | no | no | **banned** | The default table; **values are always strings** (write numbers as strings too). `""` means required — the user cannot confirm without filling it in |
| `form` | no | no | **banned** | Describes the field area of the creation sheet; its keys must be a subset of `params`. Field types and props: `numable docs params`. Leave it out and everything renders as a text box |
| `events.onClick` | no | no | **banned** | What tapping the notification opens (an in-package route or a `numable://` string); it defaults to the package home. Navigation only, no action flow — tapping a notification is a cold start, there is no flow context |

"banned" means it is an error in a background job (G45): a job belongs to the package, there is exactly one of it, and it has no user input and nothing to tap.

For threshold parameters **default to empty, never to a "sensible number"**: the 5000 you guessed misleads the person watching 4500. Default values are not localized either.

### `task`: what to run

| Field | Static | Dynamic | Job | One caution |
|---|---|---|---|---|
| `depends` | **banned** | **yes** | **yes** | An array of fetch slots, word for word the same contract as a widget's `canvas.depends`, and it only takes `.df`. Writing it makes the reminder no longer static |
| `then` | **banned** | no | **yes** | Either a built-in decision recipe `{recipe, …}` (reminders only, see Step 4) or one `{flow, params}` binding (runs after `depends` has merged; state may only be written in this step) |
| `refresh` | **yes** | **yes** | **yes** | See below. Without it the rule is never evaluated (G45) |

### `alert`: what to send afterwards

| Field | Static | Dynamic | Job | One caution |
|---|---|---|---|---|
| `message` | **yes** | **yes** | — | `{title, body?}`. A static reminder's `message` **may only reference `params` and `@app`** — at creation time no other key exists, and referencing one renders empty (G45) |
| `activeCondition` | **banned** | no | — | An expression; only a literal `1` / `true` counts as true. Omitted it means `$[eq::(${hit},1)]`, reading the `hit` that `then` produced |
| `level` | no | no | — | `quiet` / `normal` / `urgent`, defaults to `normal`. You set the default; the user may change their own copy, but only downwards |

`alert` accepts exactly these three keys; one more is an error. **Do not mark every reminder in a package `urgent`**: the levels exist for the one that truly cannot wait. A package that is all `urgent` has no levels at all, the user turns the whole package's notifications off, and the urgent one goes silent with them (the publish profile warns about this).

When a condition will not fit in an expression, do not fight it: move the decision into the `then` data flow and have it output a `hit`.

### `refresh`: rhythm and cooldown

`interval` / `at` / `tz` work exactly as they do for a widget (see `numable docs xwidget`), plus two keys only a Job has:

| Key | Value | Meaning |
|---|---|---|
| `cooldown` | seconds | **Cools down after a hit**: once the answer is true (for a job, once a write succeeds), the whole rule is not evaluated for `cooldown` seconds — `then` does not run either. Defaults to `0` |
| `days` | `["mon"…"sun"]` | Filters `at` by weekday, defaults to every day. **Static reminders only** |

Only a static reminder may write `${parameter}` inside `at` ("whatever time the user picked"). A dynamic rhythm belongs to the platform, so a parameter there is an error (G45).

Cooldown has only this one meaning. If you want "keep evaluating but stay quiet", record the time of the last notification in `data.*` inside `then` and throttle yourself.

### Reminders that fire once: a dated `at`

"Remind me to pay the rent at 9:00 on October 1" does not need a dynamic reminder that polls — write the static reminder's `at` as a **dated** entry, `YYYY-MM-DD HH:MM`, and it fires exactly once:

```jsonc
{
  "title": "Remind me then",
  "params": { "what": "", "date": "", "time": "09:00" },
  "form": {
    "what": { "title": "Remind me to", "component": { "type": "textInput" } },
    "date": { "title": "Date", "component": { "type": "datePicker", "props": { "format": "YYYY-MM-DD" } } },
    "time": { "title": "Time", "component": { "type": "timePicker" } }
  },
  "task":  { "refresh": { "at": ["${date} ${time}"] } },
  "alert": { "message": { "title": "${what}", "body": "Set for ${date} ${time}" } }
}
```

`numable init --job <id> --kind once` writes exactly this skeleton. The rules:

- **How a dated entry is recognised**: once leading and trailing whitespace is trimmed, an `at` entry that **still contains whitespace in the middle** is dated (`"${date} ${time}"`, `"2026-10-01 09:00"`); a daily `HH:MM` never contains any. An entry that is just `"${when}"` is judged by the value the user fills in.
- **The format is strict**: one ASCII space, 24-hour clock, everything zero-padded, and the date must actually exist. `2026-10-1 9:00` and `2026-02-30 09:00` can never be scheduled.
- **An incomplete date means no alert, never a daily one**. With `date` empty, `"${date} ${time}"` becomes `" 09:00"`, and that entry is simply void; the create sheet greys out its main button. The same happens for a time that has already passed, and the sheet asks the user to pick another.
- **Only `tz` decides the time zone**: leave it out and the time follows the phone (travel to another zone and it still fires at 9:00 local — right for to-dos); set it and the moment is pinned in absolute time (for "released at 8:30 New York time" write `"tz": "America/New_York"`). The string itself may not carry an offset.
- **However far away, it is scheduled now**: an alert a month out is handed to the system timer the moment the user creates it, regardless of the scheduling window other rhythms use.
- Only a static reminder with no `depends` may use it; the same `at` may not mix it with daily entries, and it may not be combined with `interval` or `days` — none of these fail at runtime, but you never get what you meant (G45).
- Once it has fired, its row on the reminders page reads "Ended" with no switch and is cleared automatically 7 days later; ended ones do not count toward the 20-per-package limit. Changing the date schedules it again.
- It needs `manifest.minEngine` 3 or higher: older apps cannot read a dated entry and silently drop it — the package installs fine and the alert simply never fires (G45).

If the thing gets done early (the to-do is ticked off, or its time changes), withdraw the alert with `alert.remove`, described below.

---

## Step 4 · The `then` step: state and edges

### Start with a built-in decision recipe

The two most common decisions — "fire on the way through the line" and "fire when it's no longer what it was" — **need no decision flow**. Write a built-in recipe in `then` and the app evaluates it:

```json
"then": { "recipe": "cross", "value": "${px}", "line": "${price}", "dir": "${dir}" }
```

```json
"then": { "recipe": "changed", "keys": ["${ver}", "${state}"] }
```

| Recipe | Fields | Fires when |
|---|---|---|
| `cross` threshold cross | `value` the number · `line` the line · `dir` direction (`below` by default / `above`) | Last time it was on one side of the line and this time it is on the other (below: last ≥ line and now < line) |
| `changed` value change | `keys`: 1–4 values | Any value differs from last time |

- Each field is either a whole-string `${key}` (that key from the instance parameters and the fetched output) or a literal. **Expressions are not supported.**
- **The previous value is kept by the app separately for each reminder** — the copy watching 5000 and the one watching 4500 each keep their own, so there is no state key to build.
- The first run only records a baseline and does not fire; a run with no value (offline, empty field) neither compares nor records, so the baseline is never lost.
- Two options: `"oncePerDay": true` fires at most once a day (in `refresh.tz`, the device time zone by default); `"fireOnFirst": true` fires on the first run if the condition already holds.
- A recipe puts `hit` (0 / 1) and `prev` (the previous value) into scope, so a notification can say `changed from ${prev} to ${px}`. If you also write `activeCondition`, both the recipe and the condition must hold.
- It needs `manifest.minEngine ≥ 4` (`init --job` and the editor raise it for you; older apps don't know recipes — the package installs but never fires). Recipes are for reminders only — a background task writes its results to `data.*`, so it still uses the decision flow below.
- "Remind me while a condition holds, again after a while" needs no recipe: write `alert.activeCondition` (e.g. `$[ge::(${chg},${pct})]`) plus `refresh.cooldown`.

Only when the decision is more involved (a combination of several fields, counting how many new items arrived, reporting again on recovery) do you write your own decision flow, below.

### Writing your own decision flow

A rule like "fire on the way through the line" has to remember the previous value. Where you remember it is the easiest thing in this chapter to get wrong:

**Not in the fetch step.** `depends` points at a flow the widgets are using too, and every widget render overwrites the previous value, so the reminder never sees the crossing. Hence the two steps: `depends` only fetches (whatever `data.*` caching it already does is fine and unrestricted), and `then` is where state is written.

```json
{
  "id": "prevRaw",
  "action": "data.get",
  "params": { "key": "price.last.${dir}.${price}", "default": "" }
}
```

#### The state key must carry the parameters

The `${dir}.${price}` in that key is not a naming habit, it is correctness:

One rule can have several copies (watching 5000 and watching 4500 are two of them; different instruments are several more), and they run their `then` **one after another** in the same pass. Share one key and the first copy writes, the second reads a "previous value" that already equals this value, and nobody ever sees a crossing; copies for different objects would read another object's price as their baseline. **Put every one of the rule's `params` into the key**, in both `data.get` and `data.set`.

Built-in recipes don't need this (the app keeps a separate value per reminder). When you write your own decision flow there is no lint for this — a static check cannot tell, so it is on you.

#### Guard against empty values

On a failed fetch the value is empty. Start with a flag for "did this pass actually get a value":

```json
{
  "op": "set",
  "props": { "key": "hasCur", "value": "$[if::(eq::(findNotEmpty::(${cur},__none__),__none__),0,1)]" }
}
```

**Do not test emptiness with `length::`.** `$[if::(gt::(length::(${cur}),0),1,0)]` is the form that comes to hand first, and it is the one trap in this chapter worth memorising: `length::` is only meaningful for strings, arrays and objects, and returns 0 for any **number**. So whenever the value is a number the flag stays 0, the guard never opens and `data.set` never runs once — while the flow still reports success, the log stays clean and nothing shows on screen. The sentinel form above holds for strings, numbers, empty strings and missing keys alike; the number `0` counts as "has a value" there, which is what you want.

The previous value in the same flow behaves the same way: its type follows whatever was written last time, so `hasPrev` must not use `length::` either. Whether a value is a number depends on how the fetch step computed it — anything out of `length::(…)` or `calc::(…)` is a number, and so is a numeric field in JSON. When in doubt assume it is a number; the sentinel form covers both.

With the flag in place, **only write when you really got a value:**

```json
{
  "op": "if",
  "props": { "val": "$[eq::(${hasCur},1)]" },
  "items": [{ "action": "data.set", "params": { "key": "price.last.${dir}.${price}", "value": "${cur}" } }]
}
```

Skip the guard and the symptom is a false "gold fell below" the moment the network drops — the most trust-destroying failure there is. Guard the decision too: while the previous value is empty `hit` stays `0`, so a fresh install, a new device or a restore only establishes a baseline instead of firing every currently-true reminder at once.

The platform adds one layer of its own: if a flow fails, or a key referenced by `activeCondition` is missing or empty this time, the answer counts as "unknown" — nothing fires and no timer moves. But it cannot undo the write you already made in `then`.

---

## Step 5 · Two languages

A `.xjob` has a **single** i18n layer, and it is the metadata kind (fields the platform reads and displays directly): the plain fields are the base language and `i18n[locale]` is a **same-shaped overlay of the translatable fields**, with exactly four slots — `title` / `sub` / `message` / `form`. Anything else is not read (G47 warns).

Inside the `form` slot each field can override three things, each in the same place it sits in the base language:

| What it overrides | Where it goes |
|---|---|
| The field name | `form.<key>.title` |
| The hint text inside the input box | `form.<key>.component.props.placeholder` (or `form.<key>.props.placeholder`) |
| Option text of a choice field | `form.<key>.component.props.items`, **matched by `value`**, only the `label` is swapped |

```jsonc
{
  "title": "金价提醒",
  "i18n": {
    "en-US": {
      "title": "Gold price alert",
      "message": { "title": "Gold ${cur}", "body": "Crossed your ${price}" }
    }
  },
  "alert": { "message": { "title": "金价 ${cur}", "body": "已越过你设的 ${price}" } }
}
```

Two things differ from a content text table (the kind inside a `.rcn`), see `numable docs i18n`:

- **Write `${}` straight into the translation.** Each language puts the variable where it belongs, with no need to split it into keys. The platform picks the whole `message` for the current language first, then substitutes this run's data.
- Which means **the translation's set of `${}` references must match the base language exactly**: drop or misspell `${cur}` and that spot renders empty — and the notification has already gone out, with no way to reproduce it afterwards. This one is an error (G47).

Translated options **swap the text, never the options**: an extra `value` in the translation does not become a new option, and one you leave out falls back to the base-language `label`. The set of options is part of the parameter contract (every copy a user creates is keyed by its parameters), so it must not change with the language.

```jsonc
{
  "params": { "dir": "down" },
  "form": { "dir": { "title": "方向", "component": { "type": "radio", "props": {
    "items": [{ "value": "down", "label": "跌破" }, { "value": "up", "label": "涨破" }] } } } },
  "i18n": { "en-US": { "form": { "dir": { "title": "Direction", "component": { "props": {
    "items": [{ "value": "down", "label": "Falls below" }, { "value": "up", "label": "Rises above" }] } } } } } }
}
```

If you write hint text for an input box, the user sees yours (something like "whatever name you know it by"); only when you leave it out does the app fall back to its own "Required" / "Optional" — so it is worth writing.

---

## Step 6 · Local state in a static reminder: `alert.skip`

"Remind me to take it at 8, unless I already logged it today" — that has local state, but **do not turn it into a dynamic reminder** for that reason: dynamic is best-effort on phones, and a missed reminder is the worst direction to fail in for this kind of thing.

The answer is to keep the reminder static and have the action flow that logs "taken" drop today's occurrence:

```json
{ "action": "alert.skip", "params": { "id": "dose", "until": "today" } }
```

- It can only touch **this package's** reminders; omitting `params` means every copy of the rule (the flow has no idea what time the user picked or what they named it).
- It means: drop the occurrences already scheduled before `until`, and carry on afterwards; calling it again does nothing extra. `until: "today"` is the next midnight, and you may also pass a time string with its own zone.
- It has side effects, so **it may only appear in an `.af`** — the data-flow whitelist does not include it.
- Hang it on every path that logs "taken" (tapping the whole widget, toggling on the page, back-filling a past day…); miss one and logging through that path does not silence today's reminder.

`alert.skip` only skips a stretch of time; the rule and the user's copy of it stay. To withdraw it altogether, use `alert.remove` from the next step.

---

## Step 7 · Withdraw a reminder: `alert.remove`

The usual ending for a one-time reminder: the to-do was completed, deleted, or moved, and the old alert should not fire any more. In the matching action flow write:

```json
{ "id": "rm", "action": "alert.remove", "params": { "id": "once", "params": { "tid": "${tid}" } } }
```

- It returns `{ removed }`, the number of copies deleted this time. No match, or a rule id that does not exist, gives `{ removed: 0 }` rather than an error — the "done" flow does not need to check whether the user ever set a reminder; just call it, and calling it again is harmless.
- `params` **matches as a subset**: a copy is removed when every key you give exists in it with an equal value; keys the copy has beyond those are ignored. Omit it or write `{}` for every instance of the rule. This differs from `alert.skip`'s `params` on purpose — whoever withdraws usually only knows *which thing* (a business id), not what title or time were filled in when the alert was created. So **give the alert a business key that never changes** when you create it (such as the to-do's `tid`: default it in `params` and leave it out of `form`, so the user neither sees nor edits it), and remove by that key alone.
- It only removes **this package's** reminders; it removes reminders only, never background jobs; switched-off and ended copies are removed just the same.
- It is the same thing as the user tapping "Delete this reminder" on the reminders page: any fires already scheduled go too. No sheet opens, nothing pops up, and nothing is written to the reminder history.
- It may only appear in an action flow (`.af`); data flows cannot call it. In an H5 page the equivalent is `xbridge.alertRemove({ id, params })` (see `numable docs bridge`).
- It needs `manifest.minEngine` 3 or higher; on an older app it is an unknown action and the whole flow fails (G45).

To change the time, `alert.remove` first and then `alert.add` with the new time pre-filled, so the user confirms it on the sheet.

---

## Step 8 · An "add reminder" button on your page: `alert.add`

Besides long-pressing a widget (see `jobs` at the end) and going to Me › Reminders, users can add one straight from your page. In the button's interaction flow:

```json
{ "id": "r", "action": "alert.add", "params": { "id": "price", "params": { "code": "${code}", "price": "" } } }
```

- All it does is open the app's own "Add reminder" sheet; `params` only pre-fills it and the user can change anything. **The reminder exists only once the user presses the sheet's main button.**
- It returns a bare string, and the three results need separate handling: `ok` = created; `cancel` = the user doesn't want it, do nothing; `quota` = this package's reminders are full (the sheet still opens, with the button greyed out) — you can point the user to Me › Reminders to clear some. Don't treat `quota` as "maybe later" too.
- `id` can only be a rule in this package's `xJob/` **that has an `alert`**; if it isn't found, or it is a background job, the whole flow fails (`rule_not_found`) and no sheet opens. A wrong id (no such file in the package) is caught by `check` with G46.
- In an H5 page the equivalent is `xbridge.alertAdd({ id, params })`, with the same results (see `numable docs bridge`).
- It waits for the user, so it can only go in an interaction flow (`.af`).

---

## When it actually fires

Write this honestly into your own copy, and never promise "on time":

- **Static reminders** go to the system scheduler and fire with the app closed; on HarmonyOS the platform has to allow it first, and without that they fall back to the path below; on Windows the app has to be running.
- **Dynamic reminders and background jobs** have to fetch before they know whether to fire, so they ride whatever opportunities the system grants: opening the app always triggers one check; keeping a home-screen widget noticeably raises the rate; on Android they check at the interval you set, delayed by battery saver, and only once the user turns on Live monitoring under Device status (which keeps a notification in the status bar) do they check right on time; on Mac / Windows they check at your interval while the app is open.
- The one thing you can honestly promise is "**it checks when you open the app, or while a home-screen widget is on your home screen**". Not a word about "every 5 minutes, guaranteed" or "every day on the dot".
- For free users the minimum interval is clamped to half an hour, while Pro users are checked at the cadence you wrote; that is a membership tier, not a capability, so do not promise checks more often than every half hour in your wording.
- The limits are enforced by the platform and a package cannot change them: at most 20 reminder copies per package, at most 30 notifications a day, of which at most 5 may be `urgent`. Anything beyond that is dropped and shown on the management page.

A widget can declare `jobs`, which lets the user long-press it to add one of this package's reminders (parameters are pre-filled from the widget's own, and stay editable) — what it references is the `xJob/<id>` here, and a wrong id is an error (G46).

### What users see when they install

The install / update sheet states plainly what the package brings. Users read this, so write your `title` in words they understand:

- The package has reminders → one line, "Can send reminders", noting that each one only takes effect once the user adds it. Rule names are not listed (installing does not make anything fire).
- The package has background jobs → one line, "This tool updates in the background", followed by each job's `title` and rhythm, e.g. "Log daily gold price (Every day 23:55)". **Background jobs have no consent sheet — installing is consent**, which is why users can switch them off per package under Me › Background tasks.

Once switched off, the job stops running and whatever its `then` wrote to `data.*` stays frozen at that moment. Widgets and pages that read it must cope with "never updated again": show when the value was recorded, and don't present old data as today's.

---

## Common mistakes

| Symptom | Most likely cause | Do this first |
|---|---|---|
| `check` says the package uses `xJob/` but `minEngine` is below the engine major these features require | Reminders and background jobs need an app on engine major 2 or later (G45) | Raise `manifest.minEngine` to the version it names (2) |
| `check` says the package uses task.refresh.at="YYYY-MM-DD HH:MM" / alert.remove … below engine major 3 | One-time reminders and withdrawing reminders need an app on engine major 3 or later (G45) | Raise `manifest.minEngine` to 3 |
| `check` says the package uses … (a runtime decision recipe) but manifest.minEngine=… is below engine major 4 | A decision recipe `task.then.recipe` needs an app on engine major 4 or later (G45); set too low, older apps install it and it never fires | Raise `manifest.minEngine` to 4 |
| A fire-once reminder never fires | The date is invalid (not zero-padded, February 30) or `date` was left empty, so the entry is void | Look for G45 in `numable check`; make the date required on the sheet |
| The to-do was done long ago, yet the reminder still fires | The alert carries no business key, so removal cannot match it; or the "done" path never calls `alert.remove` | Put a hidden business id in `params` when creating it, and call `alert.remove` on every path that closes the item |
| The reminder has never fired | The decision gets no value: the `depends` flow's `resultFilter.keys` does not expose the key you judge | Run `numable run <bundle>` to see which keys that flow really exposes, and add the missing one to `keys` |
| The reminder has never fired and nothing is reported | `activeCondition` was omitted while `then` produces no `hit` | Keep `hit` in the final `resultFilter` of `then`, or write `activeCondition` explicitly |
| A false reminder fired the moment the network dropped | `then` has no empty guard, so an empty value took part in the comparison | Add a `hasCur` flag and gate both the decision and the write on it |
| The user made two copies of one rule and only one fires | The state key carries no parameters, so the copies overwrite each other's previous value | Put every one of `params` into the `data.get` / `data.set` key |
| In English, one number in the notification is blank | The translation dropped or misspelled a `${}` (G47) | Make the translation's reference set match the base language exactly |
| A field is missing from the creation sheet | A `form` key is not in `params` (G45) | Line the two up; `params` is the list that counts |
| The condition clearly holds, yet it only fires once in a long while | `refresh.cooldown` put the whole rule on ice after it came out true | Shorten or remove `cooldown` |
| A day is blank in what the background job logged | The fetch failed that day and it was written anyway | Move the write inside the empty-value guard |
| The reminder never fires and the background job logs nothing, yet nothing is reported | The empty-value flag uses `length::` while that value is a number — the flag stays 0, so the guard blocks both the write and the decision | Switch the flag to the `findNotEmpty` sentinel form |

---

## Next

- Writing and verifying a data flow: `numable docs df`
- Widget declarations and the full `refresh` syntax: `numable docs xwidget`
- Field types and props for the creation sheet: `numable docs params`
- Error codes one by one: `numable docs lint-codes`
