<!-- translated-from: zh-CN/1-guides/05-board.md sha256:d12e54123e03 -->

# board — build a dashboard from existing widgets

> Readers: users who want a dashboard, and the AI working for them. Both read the same text.

## Goal

When a user says "I want to check US stocks, Bitcoin and the weather every day", **do not build a new tool**: the official tools in the Numable store already have these widgets. Your job is to pick widgets from the widget catalog, fill in their parameters and produce a **dashboard link**. The user opens it on their phone (or scans it) → Numable shows a preview first → the user agrees → the tools are installed and the dashboard is built.

Only when the catalog really has nothing for what the user wants should you build a new tool (`numable docs workflow`).

## Before you start

- With the `numable` command, use it to validate and make the link; without it (for example in a chat window) you can still write the link by hand, following the rules below.
- The widget catalog: `numable catalog` (one widget per line), or read `https://api.numable.app/catalog/widgets?format=compact` directly (JSON; add the header `x-region: cn` for mainland China). In the compact form, parameter notes shared by several widgets of one tool are written once under `tools[tool].params`: **check the widget's own `ai.params[key]` first (`null` = no note for that parameter), then the tool's**. Without `format` you get the full form, with every widget carrying its own copy. It lists official tools only and differs by region.

## Step 1 · Look up the catalog

```
numable catalog --grep weather
```

Each line reads `tool.widget [size] title — subtitle · shows … · params key=default〔how to fill〕`. Use "shows" to pick widgets and 〔how to fill〕 to fill parameters.

## Step 2 · Write the widget list

Write each widget as `tool.widget`; to set parameters, append `(key=value,key=value)`:

```
weather.now
stock.quote(secid=105.NVDA)
crypto.coin(pair=ETH-USDT,name=ETH)
```

Fill parameters only by what 〔how to fill〕 in the catalog says:

| How to fill | Meaning | What you do |
|---|---|---|
| `enum` | A few fixed values | Pick one of the listed values |
| `auto` | The default works | **Leave it unset when unsure**; follow the format if you fill it |
| `value` | Needs a concrete value | Follow the format; keep the default when unsure |
| user's own data | A check-in item, a tracked person | **Leave it unset**; the user picks after installing |
| account resource | An app, a site, a zone | **Leave it unset** |

- Parameters marked "set together with …" must all be given or all left out (for example a city name and its coordinates, or a trading pair and its coin name).
- When the user only says "keep an eye on it" without a symbol, prefer the default; fill parameters once they name something specific.
- At most 8 widgets.

## Step 3 · Make the link

```
numable board weather.now 'stock.quote(secid=105.NVDA)' hacker.top1 --name "My morning"
```

Quote widgets with parentheses in the shell. The command first validates every item against the live catalog; **if any item fails, no link is made**, and it tells you which item and why. When everything passes it prints three things:

- a QR code in the terminal — the user scans it with the phone's camera app or the scanner in Numable;
- a share link `https://get.numable.app/b#…` — opening it on the phone works too;
- `numable://app/board?…` — opens it directly on a computer with Numable installed (add `--open` to open it automatically).

When the output is not a terminal no QR code is drawn; add `--svg board.svg` for an image, or `--json` for programs.

## Without the numable command: write the link by hand

```
https://get.numable.app/b#n=My%20morning&i=weather.now,stock.quote(secid=105.NVDA),hacker.top1
```

- `n` is the dashboard name (optional, up to 12 characters), `i` is the widget list, comma-separated.
- Inside a parameter value, write `,` `(` `)` `&` `#` `=` `%` as `%2C` `%28` `%29` `%26` `%23` `%3D` `%25`, and spaces as `%20`; everything else (including CJK characters) can be written as is.
- Opened in a desktop browser, the link shows a preview and a QR code; tapped on a phone with Numable installed, it goes straight to the preview.
- Parameters live after `#` only and are never sent to the server.

## Rules

- **Add only**: a link only creates a dashboard or adds widgets to the current one; it never deletes or changes what the user already has.
- **Always preview first**: after opening the link the app shows which tools will be installed and which widgets added, and installs only once the user agrees.
- Widgets that fail validation are listed in the preview with the reason and are not added; the rest go ahead.
- Widgets that need an account (such as GitHub or Cloudflare) can be chosen; the user connects the account after installing.

## Examples

```
numable board 'stock.quote(secid=105.NVDA)' 'crypto.coin(pair=BTC-USDT,name=BTC)' stock.usmarket --name "My holdings"
numable board weather.now 'forex.rate21(base=USD,quote=CNY)' calendar.month --name "Morning glance"
numable board hacker.top1 github.inbox ccusage.today --name Developer
```

## When something goes wrong

| Message | Cause | Fix |
|---|---|---|
| No such widget among the official tools in this region | The widget name is wrong, or the tool isn't offered in the user's region | Look up the exact `tool.widget` with `numable catalog` |
| Parameter … can't be set by a link | It points at the user's own data or account | Drop it; the user picks it after installing |
| … must be set too | Only part of a parameter group was given | Complete the group, or leave all of it out |
| Value of … isn't one of the allowed values | Wrong enum value | Use one of the values listed in 〔how to fill〕 |
| Malformed | Not `tool.widget(key=value)` | Check the parentheses and equals signs |
