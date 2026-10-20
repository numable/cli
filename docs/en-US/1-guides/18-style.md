<!-- translated-from: zh-CN/1-guides/18-style.md sha256:f66c237ffc73 -->

# style — Default style for pages and widgets

## When to use it

Use Numable defaults when the user has not requested a visual style: neutral backgrounds, clear type hierarchy, restrained accents and light/dark colours for tool pages, dashboard widgets and home-screen widgets.

Follow requests for hand-drawn, paper, retro or other styles. Preserve an existing tool's style when editing it unless the user asks to change it. Defaults do not require every tool to look the same and are not a publishing requirement.

## Start with a working template

For a tool with both pages and widgets, start with the clock:

```
numable init my-tool
```

Its home page shows the actual device time, date and time zone, with an Add widget button inside the app. Page styles live in `page/assets/numable.css`, page logic in `page/assets/clock.js`, and the widget in `xWidget/rc/clock.rcn`. Replace the clock's content and logic. If no page is needed, remove its route and files.

For a tool focused on data widgets, pick the closest layout:

```
numable init my-metric --layout big-number
numable docs layouts
```

There are 12 widget layouts, including big numbers, trends, lists, progress and countdowns. Slots make connecting data quick. For a different visual treatment, edit the RCN colours, typography and composition in place. Check all sizes belonging to the same tool.

Layout packages mainly provide widgets and do not generate a page. To add one, create a temporary default package, copy its `page/assets/numable.css` into the target, and follow `numable docs add-page`. The clock home page is not a finished home page for a different tool.

## Reusing page styles

Load the local stylesheet:

```html
<link rel="stylesheet" href="../../assets/numable.css" />
```

This path fits two-level directories such as `page/html/home/index.html`. Share one stylesheet across pages.

| Purpose | Classes |
|---|---|
| Page title and current state | `nb-header`, `nb-sub` |
| Metric area | `nb-card`, `nb-label`, `nb-metric` |
| Lists and details | `nb-section`, `nb-section-head`, `nb-row`, `nb-row-label`, `nb-row-value` |
| Actions | `nb-actions`, `nb-button`, `nb-button-secondary` |
| Editing forms | `nb-field`, `nb-input` |
| Loading, empty and failure states | `nb-state`, `nb-error` |
| Sources and privacy | `nb-footnote` |

These are styling building blocks. Forms still need real save actions and failures need real retry actions. Do not draw an interactive button without wiring it up. Prefer labelled native `button`, `input` and `label` elements.

Default page titles are 24, section headings 13, body text 15 and footnotes 11; horizontal padding is 14 and section spacing 20. Widget titles are usually 13, while primary numbers vary with size. Pages and widgets share text and colour roles. Do not stretch a widget to make a detail page: the page should answer the widget's question at least as completely.

For XPage, implement the same hierarchy with Canvas and container nodes from `numable docs xpage`. CSS classes only apply to HTML pages.

## Customising the style

Load your stylesheet after the default one and override semantic variables:

```css
:root { --nb-accent: #2F6FE4; --nb-on-accent: #FFFFFF; --nb-radius: 18px; }
:root[data-theme="dark"] { --nb-accent: #5C9BFF; --nb-on-accent: #0B0C0E; }
```

Main variables: `--nb-bg` page background, `--nb-card` content surface, `--nb-ink` primary text, `--nb-sub` secondary text, `--nb-line` separators, `--nb-accent` accent, `--nb-on-accent` text on accent and `--nb-accent-soft` selected surfaces. Check button text and selected surfaces whenever changing the accent.

RCN does not read CSS. Change corresponding colours in `.rcn` using light/dark branches separated by `|`. Default page and widget accents may differ; once a tool has its own accent, apply it consistently to both.

Colours, type hierarchy, spacing, corners and layout are all customisable, and replacing the default CSS entirely is supported. Preserve safe areas and container boundaries: HTML needs `--xb-content-top` and `--xb-content-bottom`; XPage needs content insets. Read the container's `data-theme` and follow `data-lang` and language events; see `numable docs bridge`.

Home-screen widgets reuse the widget canvas, without a separate stylesheet. Draw the widget background explicitly. The dashboard shell cannot supply it on a home screen, where any wallpaper may be behind it.

## Verify and deliver

```
numable check my-tool
numable run my-tool
numable render my-tool
numable render my-tool --page
```

Inspect light, dark and empty states. After restyling, check narrow widths, long titles, Chinese and English. Check that primary actions are recognisable, both themes remain readable and page/widget information agrees. Page screenshots check layout; saving, navigation and adding widgets still need actual interaction inside the app.
