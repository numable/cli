# page —— 页面(router.json / html / xpage / xform)

> 读者:做信息源的用户,和替他干活的 AI。两者读同一份。

## 它是什么

`page/` 是包里「点进去看的那一层」。组件(`.xwidget`)只有一屏静态画面,点它、或长按它选「编辑参数」,打开的就是 `page/` 下的某一页。一个包可以完全没有 `page/`(纯桌面组件),但只要组件的 `events.onClick` 指向 `numable://self/page/...`,那条路由就必须在 `page/router.json` 里存在,否则App 里直接弹「页面不存在」。

页面有三种做法,由 `router.json` 里那条路由的 `type` 决定:

- **html**(默认):离线 HTML,跑在容器的 WebView / iframe 里。适合列表、表单、管理页这类「用 DOM 写更快」的界面。网络被焊死,数据只能经 `window.xbridge` 拿(见 `numable docs bridge`)。
- **xpage**:整页用 RCN 声明式画,一页就是一棵 JSON 节点树。适合与组件同一套视觉语言的详情页、图表页。
- **form**:`.xform` 文件,由平台的表单组件渲染,交上来一个对象。适合「就是要收几个值」的设置页。

三型是**白名单分派**:`type` 未写或写了不认识的值一律按 html 处理。所以 `type` 写错(比如 `"xform"`)不会报错,只会得到一张空白页 —— 错渲比报错难查。

容器自己带一条恒浮动的 chrome 胶囊(‹ 与 ···|✕),它**不替页面留位置**,每一页都得自己往下让。这是页面层最常见的一个静默失效。

## 最小可用示例

`page/router.json`(`numable init` 生成的那份,加了第二条路由):

```json
{
  "routes": [
    {
      "path": "/",
      "entry": "html/home/index.html",
      "title": "我的信息源",
      "i18n": { "en-US": { "title": "My Source" } }
    },
    {
      "path": "/detail",
      "entry": "html/detail/index.html",
      "title": "详情",
      "i18n": { "en-US": { "title": "Detail" } }
    }
  ]
}
```

## 目录结构

```
page/
  router.json                  # 路由表,固定在 page/ 下
  html/<路由名>/index.html      # html 页
  xpage/<名>.xpage             # xpage 页
  form/<名>.xform              # form 页
  rc/<名>.rcn                  # 页面用的 RCN 块
  flow/<名>.df | <名>.af        # 页面用的取数流 / 交互流
  assets/…                     # 页面图片等资产
```

固定约定:页面调的流一律找 `page/flow/<名>.<后缀>`(`runDataFlow` 只搜 `.df`,`runFlow` / `runActionFlow` 只搜 `.af`)。`page/html/<路由>/page.json` 是旧格式,已经没有了,包里出现即 `check` G1 报错。

## router.json 逐字段

| 字段 | 必填 | 类型 | 取值 / 一句注意 |
|---|---|---|---|
| `routes` | ✓ | 数组 | 路由表。**首页恒写 `"path": "/"` 且放第一条** —— 有的平台按 `path == "/"` 找首页,有的取第一条,两条都满足才处处一致 |
| `routes[].path` | ✓ | string | `/` 开头。**没有路径参数**,要传值用 query(`/detail?secid=1.600519`) |
| `routes[].entry` | ✓(除非只用 `remote`) | string | **基准按页型分,写错就是空白页**:`html` / `xpage` 相对 `page/`(`"html/home/index.html"`、`"xpage/home.xpage"`);`form` 是包根相对、**自带 `page/` 前缀**(`"page/form/pick.xform"`) |
| `routes[].type` | 可选 | `html` \| `xpage` \| `form` | 缺省 `html`;未知值也按 html。三个值以外没有第四种 |
| `routes[].title` | 可选 | string | 标题,**B 表**:裸字段 = `manifest.lang` 那门,译文旁挂 `routes[].i18n`。不求值 —— 写 `${...}` 会原样显示 |
| `routes[].i18n` | 可选 | `{locale:{title}}` | 见 `numable docs i18n` |
| `routes[].present` | 可选 | `page`(默认)\| `sheet` | `sheet` = 贴底组件式呈现。只影响这条路由被 `numable://` 打开时的落地形态 |
| `routes[].remote` | 可选 | https URL | 这条路由是**包声明的远程页**;可与 `entry` 共存作兜底 |
| 顶层 `fallback` | 可选 | https URL | 请求了一条**不存在**的 path 时兜底加载的远程页。不写 = 直接报「页面不存在」 |

**不要写 `navStyle`。** 容器 chrome 恒是一条浮动胶囊、不画标题栏,这个字段没有任何效果。

后三个字段各配一行示例:

```json
{
  "routes": [
    { "path": "/", "entry": "html/home/index.html", "title": "首页" },
    { "path": "/pick", "type": "xpage", "entry": "xpage/pick.xpage", "title": "选择", "present": "sheet" },
    { "path": "/rank", "remote": "https://example.com/rank", "title": "榜单" }
  ],
  "fallback": "https://example.com/404"
}
```

- `present` **只有 `page`(缺省)与 `sheet` 两档**。它和 `startPageForResult` 的 `container` 是**两个概念**:后者有 `page` / `sheet` / `dialog` 三档,是「流程里临时开一页问点东西」的呈现形态。**`dialog` 在路由上写了不认**,想要对话框形态只能走 `startPageForResult`(见 `numable docs af`)。
- `remote` 是这条路由的远程页,可与 `entry` 共存作兜底;顶层 `fallback` 管的是「请求了一条不存在的 path」。
- 这两个字段的域名都要写进 `manifest.network`,否则请求发不出去(`check` G3)。它们是包**声明的组成页面**,所以照旧压容器栈、照旧带 `···` 菜单 —— 这是外链一律交给系统浏览器那条规则的唯一例外。

标题的优先级:`routes[].title` > query 里带的 title > `manifest.title`。页面在运行期改不了它 —— 容器 chrome 恒是一条浮动胶囊、不画标题栏。

## 三种页型

### html 页

最小模板(`page/html/home/index.html`,在 `numable init` 生成的首页上补齐了主题、语言与取数):

```html
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>我的信息源</title>
<style>
  /* 容器注入这两个变量;浏览器里打开时回落 0,所以本地预览也不塌 */
  :root { --xb-content-top: 0px; --xb-content-bottom: 0px; }
  body {
    margin: 0;
    font: 15px/1.5 -apple-system, system-ui, sans-serif;
    color: #1c1c1e; background: #f5f6f8;
    /* 上下让位:chrome 胶囊浮在内容之上,页面自己往下排 */
    padding: calc(var(--xb-content-top) + 16px) 16px calc(var(--xb-content-bottom) + 16px);
  }
  /* 明暗:容器在 <html> 上打 data-theme,切换时不重载页面 */
  [data-theme="dark"] body { color: #f3f4f6; background: #0b0c0e; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  input, select, textarea { font-size: 16px; }   /* 低于 16px 会让 iOS 聚焦时整页放大 */
</style>
</head>
<body>
  <h1>我的信息源</h1>
  <p id="out">加载中…</p>
<script>
  // 语言:容器在 <html> 上打 data-lang,切语言时派发 languagechange(页面不重载)
  const lang = () => document.documentElement.getAttribute("data-lang") || "zh-CN";
  addEventListener("languagechange", render);
  addEventListener("themechange", render);

  // 路由 query:直接读 location.search
  const q = new URLSearchParams(location.search);

  // 桥的 call 型方法回信封 { code, msg, data }(不会 reject),结果在 data
  async function call(p) {
    const r = await p;
    if (!r || r.code !== 0) throw new Error((r && r.msg) || "bridge error");
    return r.data;
  }

  async function render() {
    // 网络只能走桥。页面里的 fetch / XMLHttpRequest 被容器的 CSP(connect-src 'none')焊死。
    const data = await call(xbridge.runDataFlow("home", { id: q.get("id") || "" }));
    document.getElementById("out").textContent =
      lang().startsWith("zh") ? `共 ${data.count} 条` : `${data.count} items`;
  }
  render();
</script>
</body>
</html>
```

四件必须知道的事:

1. **让位**:`--xb-content-top` / `--xb-content-bottom` / `--xb-safe-bottom` 由容器注入;不读就被胶囊压住顶部,各平台都不报错。
2. **主题**:写 `[data-theme="dark"]` 选择器,**不要靠 `prefers-color-scheme`** —— 页面在 iframe/WebView 里,那个媒体查询跟的是宿主系统,App 内切主题拨不动它。
3. **语言**:读 `document.documentElement.dataset.lang`;切换只派发 `languagechange` 事件、不重载页面,所以文案渲染要能被重跑。
4. **网络**:`fetch` / `XHR` 直连被 CSP 焊死(图片是例外)。数据一律 `xbridge.runDataFlow("<flow 名>", params)`,副作用一律 `xbridge.runActionFlow` / `runFlow`;它们回的是信封 `{ code, msg, data }`,结果在 `data`(上面的 `call()`)。全部方法见 `numable docs bridge`。

query 参数读 `location.search`,和普通网页一样。

上面的模板只用到了取数一个方法。另外几个高频用法(全表与语义纪律见 `numable docs bridge`):

```html
<script>
  // 让用户改一个值:整个 config 就是单值配置,返回的值在 r.value.value(call() 见上面的模板)
  async function editCity() {
    const r = await call(xbridge.singleValue({
      title: "城市",
      container: "sheet",
      component: { type: "select", value: "sh", props: { items: [{ label: "上海", value: "sh" }] } }
    }));
    if (!r || r.cancelled) return;
    await call(xbridge.setData("city", r.value.value));      // 只能存字符串,命名空间恒是本包
    xbridge.toast("已保存", "success");
  }

  // 改某个已加到仪表盘的组件的参数:逐键 merge,值只能是标量,null = 删这个键
  async function retitle(brickId) {
    await call(xbridge.updateParams(brickId, { title: "自选", days: "30" }));
    await call(xbridge.refreshWidget());                      // 写完立刻重取,否则组件上还是旧图
  }

  // 包内跳转 + 作为子页把结果交回去
  function openDetail(id) { xbridge.route("numable://self/page/detail?id=" + encodeURIComponent(id)); }
  function submit(v) { xbridge.setResult({ picked: v }); xbridge.closePage(); }

  // 耗时动作给个转圈,注意 hideLoading 必须在所有分支里都跑到
  async function sync() {
    xbridge.showLoading("同步中…");
    try { await call(xbridge.runActionFlow("sync")); } finally { xbridge.hideLoading(); }
  }
</script>
```

### xpage 页

整页用一棵 JSON 节点树声明,和组件同一套画法、同一个渲染核。外壳只有 `{type:"page", id, root}` 三个必填键(加一个可选的 `i18n`);`root` 是容器,扛页面级的 `depends`(取数,接 `.df`)与 `events`(交互,接 `.af`);容器的 `layout` 八选一,叶子只有 `Canvas` 与 `input` 两种;`@[file://…]` 的基准是**包根**,要写全 `page/flow/x.df`。

```json
{
  "type": "page",
  "id": "demo-home",
  "root": {
    "type": "container",
    "id": "root",
    "layout": "list",
    "direction": "vertical",
    "padding": "12pt",
    "gap": "12pt",
    "paddingTop": "${@contentInset.top}pt",
    "paddingBottom": "${@contentInset.bottom}pt",
    "depends": [{ "flow": "@[file://page/flow/home.df]", "params": {} }],
    "items": [
      {
        "type": "Canvas",
        "id": "hero",
        "h": "56pt",
        "canvas": { "source": "@[file://page/rc/hero.rcn]" }
      }
    ]
  }
}
```

八种 `layout` 各自的字段、页面作用域(`params` / `state` / `data`)、事件时机、`visible`、`input` 节点、以及一批「写了不生效」的字段,全在 `numable docs xpage`。取数流写法 `numable docs df`;action 全表 `numable docs af`;从零加一张页面 `numable docs add-page`。

### form 页

`.xform` 是「就问几个值」的页面类型:声明字段,平台渲染,提交时把 `{ 字段名: 值 }` 交给 `onSubmit` 指向的 `.af`。

```json
{
  "type": "form",
  "id": "pick-city",
  "title": "选择城市",
  "confirmTxt": "保存",
  "onSubmit": "@[file://page/flow/save-city.af]",
  "form": {
    "city": {
      "title": "城市",
      "required": "true",
      "component": {
        "type": "select",
        "value": "sh",
        "props": { "items": [{ "label": "上海", "value": "sh" }, { "label": "北京", "value": "bj" }] }
      }
    }
  }
}
```

要点:字段顺序 = 声明顺序,键就是结果键;**不写 `container`**(呈现形态由容器定);值只有 `string` 与 `string[]`,布尔用字符串。14 种组件类型、`props` 逐个字段、以及取数型组件(`searchSelect` / `dynamicCascader`)怎么接 `.df`,见 `numable docs params`。

## 信息源海报 banner.xbanner

`banner.xbanner` 不是页面,是包在信息源列表里的那张 16:9 门面组件。它放在**包根**(和 `logo.png` 平级),是**可选**的:不写就用系统默认模板(纯色底 + logo/首字母 + 包名),写了就整张由你画。

它是一个自包含的单文件 —— 内联 RCN、内联流,不引 `xWidget/` 与 `page/` 下的任何文件:

```json
{
  "version": 1,
  "id": "banner",
  "ratio": "16:9",
  "theme": "auto",
  "scene": { "width": 338, "height": 190, "corner": 18 },
  "rcn": {
    "rc": {
      "cells": [
        { "id": "bg", "type": "layer", "x": "0pt", "y": "0pt", "w": "{parent.w}", "h": "{parent.h}", "bgColor": "#8E1F27|#8E1F27" },
        { "id": "t", "type": "txt", "x": "24pt", "y": "114pt", "w": "-1", "h": "-1", "text": "${@i18n.t}", "fontSize": "20pt", "typeface": "System-Bold", "textColor": "#FFFFFF|#FFFFFF", "maxLines": "1", "maxWidth": "290pt" },
        { "id": "s", "type": "txt", "x": "24pt", "y": "{t.b}+6pt", "w": "-1", "h": "-1", "text": "${@i18n.s}", "fontSize": "12pt", "textColor": "#B8FFFFFF|#B8FFFFFF", "maxLines": "1", "maxWidth": "290pt" }
      ],
      "i18n": {
        "zh-CN": { "t": "股票行情", "s": "A股 · 美股 · 港股" },
        "en-US": { "t": "Stocks", "s": "CN · US · HK markets" }
      }
    }
  },
  "flow": { "actions": [] },
  "params": {}
}
```

| 键 | 必填 | 说明 |
|---|---|---|
| `scene` | ✓ | `{width, height, corner}`。**必须写** —— 这是它和 `.rcn` 最大的差别:`.rcn` 的画布尺寸由宿主的档位给,海报没有档位可依,不写就画不出来 |
| `rcn.rc.cells` | ✓ | 内联 RCN,画法与 `.rcn` 完全一样(`numable docs rcn`) |
| `rcn.rc.i18n` | | 这张海报自己的词表,`${@i18n.key}` 查的就是它 |
| `flow.actions` | | 内联取数流,**取数语义**(与 `.df` 同一批受限动作,不能弹 UI)。不取数就写 `[]` |
| `params` | | 传给 `flow` 的入参 |
| `version` / `id` / `ratio` / `theme` | | 固定写 `1` / `"banner"` / `"16:9"` / `"auto"` |

三条容易栽的:

- ⚠️ **自定义海报拿不到包的元数据**。`${meta.title}` / `${meta.color}` 那套注入只属于系统默认模板,自己画的海报里写了会**静默渲成空**。标题、副标题的文案要自己写进 `rcn.rc.i18n`,中英两份。
- ⚠️ **`numable check` 的多语言闸扫不到这个文件**,词表漏一门不会有人拦你,只会在切到那门语言时变成空白。写完两门自己核一遍。
- 海报是纯品牌图最省事:`flow.actions` 留空,不取数就没有失败态、没有加载骨架,列表里恒定出图。

## 节点长按菜单

菜单**不是一种页型**,包里不写菜单文件。要给 xpage 的某个节点加长按菜单,在该节点上写 `menu` 数组:

```json
{
  "type": "Canvas",
  "id": "card",
  "h": "120pt",
  "canvas": { "source": "@[file://page/rc/card.rcn]" },
  "menu": [
    { "label": "加一杯", "icon": "@[file://icons/plus.png]", "flow": "@[file://page/flow/inc.af]" },
    { "label": "归零", "role": "destructive", "flow": "@[file://page/flow/zero.af]" }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `label` | 菜单项文字,可写 `${...}` / `${@i18n.key}` |
| `icon` | 可选,`@[file://…]` 包内图片(基准 = 包根) |
| `role` | 可选,`destructive` = 红色危险项 |
| `flow` | 点选后跑的 `.af`;也可直接内联 action 数组 |

同一节点上 `longClick` 优先于 `menu` —— 写了 `longClick`,`menu` 永远不弹。

## 跳转与外链

包内跳转写 deeplink:

| 写法 | 落到哪 |
|---|---|
| `numable://self` | 本包首页(**跳首页只能这么写**,不能写 `numable://self/page/home`) |
| `numable://self/page/detail?id=${id}` | 本包 `/detail` 路由;query 只能插顶层标量 |
| `numable://app/mine?section=credentials` | App 的凭证管理页(需要凭证的包必须给这个直达入口) |

从组件点进非首页时,容器会**先把首页作为栈根压进去**,再压目标页 —— 用户按 ‹ 退回来看到的是包首页,不是直接关掉。这条不用自己实现,但设计页面时要按「上面还有一层首页」来想返回路径。

**外链(http/https)一律交给系统浏览器或独立的外部页壳打开**,不进包的容器栈:它不是包的页面,包也控制不了它。唯一例外是 `router.json` 里显式声明的 `remote` / 顶层 `fallback` —— 那是包**声明的组成页面**,照旧当自己的页处理。写外链时把整串写成字面量开头(`"https://" + tail`),别让整串从 `${` 开头,否则跳转会被当成站内路由、点了没反应。

打开一个外链,三种页面各一种写法(都不需要把目标域名写进 `manifest.network` —— 白名单只管流里的 `request`,打开网页不算):

| 在哪 | 写法 |
|---|---|
| H5 页(`page/html/…`) | `xbridge.route("https://news.ycombinator.com/item?id=" + id)` |
| XPage 节点 / 组件 `onClick` | 直接写串 `"https://example.com/${path}"`(字面 scheme 开头) |
| `.af` 流里 | `{ "action": "nav.open", "params": { "url": "https://…" } }` |

## 渲出来看

```
numable render <包> --page
numable render <包> --page /detail?id=1,/pick
```

不带路由 = `router.json` 里的全部路由;路由可以带 query,html 页的 `location.search`、xpage 的路由参数读到的就是它。每条路由按手机宽(390×844)渲浅色、暗色两张整页截图,落在 `<包>/.numable/render/page<路由>.<light|dark>.<语言>.png`(`/` → `page`,`/detail` → `page-detail`),并进同目录 `index.html` 拼图的「页面」一段。语言用 `--locales`,和组件一样;`--scale` 默认 2。

**取数与 `run` 是同一套**:html 页调的 `xbridge.runDataFlow`、xpage 的 `depends`,都在命令行这一侧用真引擎跑,网络白名单、`.numable/params/` 里的入参夹具、`_credentials.json`、`_datastore.json` 全部生效,浏览器不直连外网。漏写的域名在这里就会被拦:命令输出里有一行 `network_blocked`,截图里是页面自己的失败态 —— 这正是用户在 App 里会看到的样子。

桥方法在截图时的行为:

| 方法 | 截图时 |
|---|---|
| `runDataFlow` / `runActionFlow` / `runFlow` | 真跑 `page/flow/<名>`,结果打印在命令输出里 |
| `getData` / `setData` | 读写 `_datastore.json` 那份数据;每张图开始前还原,不会串到下一张 |
| `credentialState` | `_credentials.json` 里有这把钥匙回 `bound`,没有回 `unbound` |
| `appInfo` | 当前这张图的主题与语言 |
| `route` / `closePage` / `setResult` | 只记录、不跳转,输出里列出来 |
| `toast` / `haptic` / `showLoading` / `hideLoading` | 不显示;`showLoading` 之后没有 `hideLoading` 会被点名 |
| `confirm` / `alert` / `singleValue` / `alertAdd` | 当作用户取消(`confirm` 回 `false`),输出里注明「未模拟」 |
| `pickWidgets` / `removeWidget` / `updateParams` / `refreshWidget` / `installBundle` | 什么都不做,输出里注明「未模拟」 |

输出里另外会点名三件事:读了桥上没有的方法名(App 里是 `undefined`,对应 G42)、加载失败的资源、页面脚本抛出的未捕获错误(这一条让命令以非 0 退出)。

图的右上角有一颗半透明胶囊,标的是 App 容器按钮的位置:被它压住的内容在 App 里点不到,顶部让位没做对一眼就能看出来。

还渲不了的:`form` 页和带 `remote` 的路由会跳过并说明,这两种只能在 App 里点进去看。xpage 长页截图时,根容器的可用高会撑到整页内容高,用 `{parent.h}` 铺满一屏的版式在图上会被拉长。字形宽度等手机上独有的差异和组件一样,只能装到手机上看。

## 规则(违反 = 返工)

| 规则 | 检查方式 | 违反时的现象 | 修法 |
|---|---|---|---|
| `numable://self/page/<x>` 必须在 `router.json` 里有对应路由;`numable://self/widget/<id>` 的 id 必须存在 | `check` G12 | App 里弹「页面不存在」/ 打开一个空的添加面板 | 补路由;跳首页写 `numable://self` |
| H5 调的 flow 必须存在且后缀对得上方法(`runDataFlow`→`.df`,`runFlow`/`runActionFlow`→`.af`) | `check` G12b | 页面显示「加载失败(-6)」,flow not found | 改后缀或改方法,二者取其一 |
| `.xwidget` / xpage 的 `depends` 不能写裸字符串 | `check` G12 | 入参被吞成空,流仍报成功,组件静默渲一片 `--` | 写 `{"flow":"…","params":{"k":"${k}"}}` |
| `onEdit` 走路由时必须是裸 path 且在 `router.json` 里;走 af 时必须是包内存在的 `.af` | `check` G12 | 长按选「编辑参数」点了没反应 / 打开空白页且不报错 | 对齐路由表 / 补文件 |
| `onEdit` 的目标必须真有写回能力(af 含 `widget.updateParams`;form 有 `onSubmit`;xpage 有 `events`) | `check` G12 | 编辑页打得开、按了什么都不会变 | 在目标里补写回 |
| H5 里的 `input` / `select` / `textarea` 必须显式 `font-size` 且 ≥ 16px | `check` G15 | iOS 上聚焦输入框整页被放大,失焦不完全缩回 | CSS 里写死 `font-size: 16px`(简写 `font:` 里的字号同样算) |
| 单个文件里的加组件调用不超过 2 处;加组件页不出现「已添加」字样 | `check` G24(W) | 包里手抄了一份组件目录,新增组件忘了改 HTML 就永远加不到;「已添加」会撒谎(用户可能翻两下就关了) | 收成一个按钮 + `pickWidgets(items)`;要反馈就说「已提交」 |
| 添加组件按钮用平台基准版式(H5 用标准的 `.pickb` 样式块,xpage 里节点高 56pt) | `check` G27(W) | 同一个平台动作在每个包里长得不一样,用户认不出来 | 别自定义版式;照 `check` 报错里给的那份写 |
| 声明了 `required: true` 凭证的包,`page/` 里必须有一处 `numable://app/mine?section=credentials` 直达入口,且不能让用户「先加组件再在组件上找入口」 | `check` G25 | 用户打开首页看到一句「还没连接」,不知道去哪连 | 首页写编号步骤 + 一个直达按钮 |
| `onClick` / 外链串必须以**字面** scheme 开头 | 人审 | 点了没反应 | 写 `"https://${tail}"`,不写 `"${url}"` |

xpage 页自己那一串规则(顶部让位 G17、节点层多语言 G35、事件值不许以 `${` 开头 G36、根 params 顶掉路由 query…)在 `numable docs xpage`。

## 出错怎么办

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| 点组件弹「页面不存在」 | `onClick` 的 path 不在 `router.json` | 跑 `numable check`,看 G12 |
| 页面一片空白,没有任何报错 | `type` 写错(非 `xpage`/`form` 一律按 html 渲)或 `entry` 基准写错 | 核对 `type` 三个合法值;`form` 的 entry 要带 `page/` 前缀,html/xpage 不带 |
| 页面顶部被胶囊压住 | 没读让位量 | xpage 看 G17;html 看 `body` 的 `padding-top` 有没有 `var(--xb-content-top)` |
| 页面上的数据永远是空的 | 用了 `fetch` 直连,被 CSP 拦掉 | 改走 `xbridge.runDataFlow`,见 `numable docs bridge` |
| 页面显示「加载失败(-6)」 | flow 文件名或后缀对不上方法 | 跑 `numable check`,看 G12b |
| 组件渲一片 `--`,流却报成功 | `depends` 写成了裸字符串 | 看 G12 |
| 切了 App 语言/主题,页面没跟着变 | 只在首次渲染读了 `data-lang` / `data-theme` | 监听 `languagechange` / `themechange` 重渲 |

## 相关

- `numable docs bridge` —— H5 页能调的全部方法与容器环境
- `numable docs i18n` —— `routes[].title` 这类 B 表字段怎么翻译
- `numable docs params` —— `.xform` 的 14 种组件与用户可编辑字段
