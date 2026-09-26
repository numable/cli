<!-- translated-from: zh-CN/1-guides/40-credentials.md sha256:2708d5d0a566 -->

# credentials — connect a data source that needs a key

> Audience: people building a source, and the AI working on their behalf. Both read this same page.

## Goal

Some data sources are useless without a token (or their quota is too low to be useful). This chapter connects the kind of source where the user goes and gets a token themselves. When you are done:

- `manifest.json` carries a `credentials` declaration, which the install panel discloses to the user;
- the `request` in your `.df` names a `credential: "gh"`, and **not one byte of the key appears in the flow**;
- you get the fetch working locally with a fixture that never enters the package;
- the user binds their own token under "Mine → Credentials" in the app, and the app injects it at the network boundary.

**One idea runs through the whole chapter: the key belongs to the user, not to the package.** What you write is "this package needs a key of this shape, sent to these hosts"; the key itself is kept by the app, injected by the app, and its value is never visible to the package.

## Prerequisites

- The target API authenticates with a single header or query parameter (OAuth-style sources are covered at the end);
- The API's host is already listed in `manifest.network`;
- You have one of your own tokens on hand for local verification.

---

## Step 1 · Declare it in the manifest

**What to do**: add a `credentials` array. The whole chapter uses a made-up sample package, "GitHub Sample" (not the GitHub source in the store): it reads a user's public activity, which works anonymously and gets a higher quota once a token is bound — exactly the two tiers of `required: false`.

```json
{
  "id": "01J9ZQ3K4M5N6P7R8S9T0V1W2X",
  "version": 1,
  "title": "GitHub 示例",
  "lang": "zh-CN",
  "category": "developer",
  "subtitle": "某个用户最近的公开动态",
  "domain": "github",
  "minEngine": "1.0.0",
  "network": ["api.github.com"],
  "credentials": [
    {
      "id": "gh",
      "type": "token",
      "required": false,
      "hosts": ["api.github.com"],
      "label": "GitHub 访问令牌",
      "i18n": { "en-US": { "label": "GitHub token" } },
      "help": "https://github.com/settings/tokens"
    }
  ],
  "i18n": { "en-US": { "title": "GitHub Sample", "subtitle": "A user's recent public activity" } }
}
```

Field by field:

| Field | Required | Notes |
|---|---|---|
| `id` | ✓ | The declaration id (declId). The `.df` references it as a **literal**; unique within the package |
| `type` | ✓ | The injection mechanism, see the table below |
| `hosts` | ✓ | The hosts this key **may be sent to**; must be a subset of `manifest.network` |
| `label` | ✓ | The name shown in the binding panel. The bare string is in the `manifest.lang` language; translations hang off a sibling `i18n` |
| `i18n` | ✓ | Give at least `zh-CN` / `en-US`; the base language sits in the bare `label`, the other one goes here |
| `required` | | `false` (default) = usable unbound, degrading to anonymous; `true` = no request is sent until it is bound |
| `help` | | The page telling users where to get the key; must be https |
| `headerName` | required when `type=header` | Which header to inject into |
| `paramName` | required when `type=query` | Which query parameter to inject into |

The four simple mechanisms of `type` (the app decides the injected shape; the package has no say):

| `type` | What gets injected | When to use it |
|---|---|---|
| `bearer` | `Authorization: Bearer <value>` | The common case |
| `token` | `Authorization: token <value>` | GitHub and friends |
| `header` | `<headerName>: <prefix?><value>` | A custom header, e.g. `X-Goog-Api-Key` |
| `query` | Appends `?<paramName>=<value>` to the URL | **Only for query-only APIs**; use a header whenever you can (`check` always emits a W asking you to confirm) |

`jwt-assertion` and `oauth2` may only reference a platform-built-in preset (the `preset` field); hand-written declarations are rejected — if package authors could freely declare an OAuth authorization endpoint, a package could walk the user into a phishing page. Ask for a new preset through feedback.

**Command**

```
numable check <package>
```

**What "correct" looks like**: no G18 errors. The four common ones:

| Error | Fix |
|---|---|
| `credentials[i] is missing hosts` | Write it explicitly; where a credential may be sent must never be inferred |
| `host "x" ∉ manifest.network` | Add it to `network` first (that is the list the install panel discloses to the user) |
| `label has no en-US override` | Add `i18n`; the binding panel renders that field |
| `type "x" is not in the mechanism allowlist` | Use `bearer` / `token` / `header` / `query` |

---

## Step 2 · The data flow only names the declId

**What to do**: put `credential` in the `request`'s `params`, with a **literal** declId as the value.

Excerpt from `xWidget/flow/events.df` (the `login` input comes from the `.xwidget` `params`):

```json
{
  "version": 1,
  "actions": [
    { "op": "set", "props": { "key": "h", "value": "${login}" } },
    { "op": "set", "props": { "key": "hdr", "value": { "Accept": "application/vnd.github+json", "User-Agent": "Numable" } } },

    { "op": "if", "props": { "val": "$[if::(eq::(${h},),0,1)]" },
      "items": [
        { "id": "ev", "action": "request",
          "params": {
            "url": "https://api.github.com/users/${h}/events/public?per_page=100",
            "method": "GET",
            "header": "${hdr}",
            "formatType": "json",
            "credential": "gh"
          }
        }
      ]
    },

    { "op": "set", "props": { "key": "_b", "value": "1" } },
    { "op": "set", "props": { "key": "iso", "value": "$[pluck::(${ev},created_at)]" } },
    { "op": "set", "props": { "key": "actN", "value": "$[length::(${iso})]" } },
    { "action": "resultFilter", "params": { "keys": ["actN"] } }
  ]
}
```

Three rules:

| Rule | Symptom | How to check |
|---|---|---|
| `credential` must be a literal declId, never a `${...}` | At run time the call silently goes out anonymous: a 401 or empty data, with no error | `check` G18b (E) |
| The declId you reference must be declared in `manifest.credentials` | Same as above | `check` G18b (E) |
| The request host must be in both `manifest.network` and that declaration's `hosts` | The network guard silently blocks it on a device | `check` G3 (E) |

**Things you do not write, and cannot write**:

- No `Authorization` header — injection happens at the network boundary, and a header you write is overwritten by the same-named injection;
- No "is it bound yet" test before the request — the app injects at the network boundary, and an unbound credential simply means an anonymous request. If you really need two tiers of display by binding state, use the read-only `credential.state` (`params` is `{ "id": "gh" }`): it returns only one of `bound` / `unbound` / `expired` plus a fingerprint `fp` that changes on rebinding, never the value. Or degrade directly on the **response** (for example the API always returns 403 without a key);
- Never read the value out into any variable.

---

## Step 3 · Get it working locally (fixtures)

**What to do**: put your own token into the package's sidecar fixture. This file lives under `.numable/` and **never enters the package** (packaging, the editor and backup all ignore that prefix), and `numable init` has already added it to `.gitignore`.

`<package>/.numable/params/_credentials.json`:

```json
{
  "gh": "ghp_your_own_token"
}
```

One flat level: **key = declId, value = the secret string**. Add one line per key.

A few other fixtures live in the same folder; it saves time to know them all:

| File | Purpose |
|---|---|
| `_credentials.json` | Credential values, by declId |
| `_datastore.json` | Preloaded `data.*` keys and values (visible to `data.get` in flows) |
| `<widget>.json` / `<page flow>.json` | Inputs for that flow, overriding the default params in `.xwidget` |
| `_dfrun.json` | `{ "optionalEmpty": { "<flow>": ["key"] }, "expectedFail": ["<flow>"] }`, declaring which flows are legitimately empty and which are designed to fail |

**Command**

```
numable run <package> --flow events --full
```

`run` uses the real engine, hits the real network, and injects exactly as a device would according to the `type` / `hosts` you declared: requests whose host does not match **get no injection**.

**What "correct" looks like**:

- `✓ events {...}` with real values in the fields → the declaration, the injection and the fetch are all correct;
- `· events  skipped (a required credential is declared but …/params/_credentials.json has no fixture)` → you declared `required: true` without a fixture; add one;
- `✗ events empty fields: …` → the request went out but did not authenticate (expired token / wrong `type` / mismatched `hosts`). Try the URL by hand in a terminal first to confirm the token itself is valid.

⚠️ Check `git status` afterwards: `.numable/` should be ignored. A secret entering version control is an irreversible incident.

---

## Step 4 · The user's side

The user's path is fixed and you do not have to build any onboarding UI, but each `required` setting asks one thing of you.

**How the user binds a key**: at install time the install panel uses `credentials` to list which keys the package needs and which hosts they will be sent to; the binding itself happens under **"Mine → Credentials" in the app**, triggered by the user's own gesture, and the value goes only into the app's vault and is never echoed back to the package.

### `required: false` — usable anonymously, better once bound

Without a credential the package must still be a **complete, usable** package (in the sample package: GitHub's public-activity endpoint works anonymously too, just with a lower hourly quota). Design points:

- The main path of the flow does not depend on "bound or not": the same request carries the token when bound and goes out anonymous when not, and the **response** drives the degradation first;
- Do not report "not bound" on the widget as an error — the anonymous tier is a normal, working tier. If you want to hint "bind a token for more", first confirm with `credential.state` that it really is `unbound`.

### `required: true` — no key, no content

- The host takes over the widget: while unbound it **sends no request** and renders that widget as a "credential needed" placeholder;
- Your job is to make sure **the home page is not an empty page**: say what to do, where to do it, and what it gets them, and give a direct button:

```json
{ "onClick": "numable://app/mine?section=credentials" }
```

In an html page that is `location.href = "numable://app/mine?section=credentials"` (or via `xbridge.route(...)`).

**Command**

```
numable check <package> --profile publish
```

**What "correct" looks like**: for a package that declares `required: true`, if `numable://app/mine?section=credentials` appears nowhere under `page/`, G25 raises an error (it only runs in the publish profile). Also avoid detours like "add a widget first, then follow the prompt on the widget to connect" — the same check rejects those.

---

## Red lines (four; crossing one is an incident)

| Red line | Why | How to check |
|---|---|---|
| A secret value **never enters the package** | The package is signed and distributed to everyone | Manual review + `check` G1b (fixture-style files are banned inside a package) |
| A secret **never enters `params`** | `.xwidget.params` is a plaintext surface the user can edit, see and share | `check` G18 (a key that looks like `token`/`secret`/`api_key`/`密钥`/`令牌` is an E) |
| A secret **never enters `data.*`** | `data.*` goes into local backups and can be read by any flow in the package | Manual review |
| A secret **never enters `resultFilter`** | Once exposed it becomes render data, landing in caches and in shared screenshots | Manual review (expose only a flag such as `hasToken`) |

The same discipline from the other side: **never build a secret into a URL.** `type=query` is a restricted tier for APIs that offer no header; use a header whenever one exists.

---

## Common mistakes

| Symptom | Most likely cause | What to do first |
|---|---|---|
| `run` shows 401 / 403 although the token works by hand | The wrong `type` (GitHub is `token`, not `bearer`), or `hosts` does not match the request's host | Confirm the prefix against the API docs; write the **bare host** of the request in `hosts` |
| `run` passes but there is no data on a device | The request's host is not in `manifest.network` (the network guard is enforced on devices) | `check` G3 reports it; `run` also prints that the network allowlist is enforced |
| `check` says `credential must be a literal` | It was written as `"credential": "${credId}"` | Hard-code the declId |
| The binding panel shows an id such as `gh` | `label` is missing | Add `label` + `i18n` |
| The binding panel is in Chinese for English users | `label` only has the base language | Add `i18n["en-US"].label` |
| `required: true` is declared and `run` skips everything | There is no `_credentials.json` fixture | Add the fixture; do not switch `required` to `false` just to make the run pass |
| The request fails after redirecting to another host | The per-hop redirect guard: leaving the allowlist is refused, and credentials are stripped on every hop | Declare the redirect target host in `network` too, or use an endpoint that does not redirect |
| You want to connect an OAuth-login source | `oauth2` / `jwt-assertion` are preset-only | Use an existing preset; if there is none, file a request through feedback |

## Next

- The full allowlist for data flows and every `request` parameter: `numable docs df`
- Package identity, `network`, and every manifest field: `numable docs layout`
- From personal use to publishing to the store (all the publish-profile checks): `numable docs publish`
