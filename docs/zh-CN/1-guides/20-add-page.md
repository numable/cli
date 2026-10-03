# add-page —— 给已有的组件加一张详情页

> 读者:做工具的用户,和替他干活的 AI。两者读同一份。

## 目标

让「点一下组件」有去处:组件上只放一眼能看完的结论,细节放进包内的一张页。做完这一章,你的包会多出:

- `page/router.json` 一张路由表(首页 + 详情页);
- 一张详情页(**html** 或 **xpage** 二选一);
- 组件 `.xwidget` 上一条 `events.onClick`,带着这个组件的参数跳过去。

两条路线怎么选:

| | html 页 | xpage 页 |
|---|---|---|
| 写什么 | HTML + CSS + JS,数据经 `xbridge.runDataFlow` 拿 | JSON 声明容器与 Canvas,数据经节点 `depends` 拿 |
| 适合 | 长文、表格、复杂交互、要滚动的详情 | 与组件同一套画法的板块流,零 WebView |
| 代价 | 自己写主题、语言、让位这三件事 | 版式受 RCN 能力约束(画法见 `numable docs rcn`) |

不确定就先写 html:它对排版没有限制,且参数写回(`numable docs add-interaction`)天然可用。

## 前置

- 包里已有一个跑得通的组件(还没有就先做 `numable docs first-card`);
- 组件的 `.df` 已经透出你要在页上显示的键(`numable run <包> --flow <组件名> --full` 能看到);
- 知道这个组件的实例参数叫什么(`.xwidget` 的 `params`)——详情页要靠它知道「点的是哪一个」。

---

## 路线 A:html 详情页

### 步骤 1 · 建路由表

**做什么**:新建 `page/router.json`。**首页恒写 `"path": "/"`,且放第一条**——有的平台按 `path == "/"` 找首页,有的取第一条,两条一起守才处处一致。

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

逐字段:

| 字段 | 必填 | 说明 |
|---|---|---|
| `path` | ✓ | `/` 开头,**没有路径参数**,要传值用 query(`/detail?secid=1.600519`) |
| `entry` | ✓ | html / xpage 页**相对 `page/`**(`html/detail/index.html`);form 页是包根相对、自带 `page/` 前缀 |
| `type` | | `html`(默认)/ `xpage` / `form`,未知值一律当 html |
| `title` | | 裸字段 = `manifest.lang` 那门语言,译文旁挂同级 `i18n`(见 `numable docs i18n`) |
| `present` | | `page`(默认)/ `sheet` |

容器顶部**不画标题**,只有一条浮动的 ‹ / ··· / ✕ 胶囊;`title` 用在返回栈与外部展示上。别指望它给你留出空间——让位是页面自己的事(步骤 2)。

**命令**

```
numable check <包>
```

**看到什么算对**:`router.json` 相关无 error(路径写错、JSON 语法错会被 G0 / G12 报出来)。

### 步骤 2 · 写页面

**做什么**:建 `page/html/detail/index.html`。下面这份是最小可用模板,四件事一件都不能少。

```html
<!DOCTYPE html>
<html lang="zh"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>详情</title>
<style>
/* 让位量由容器注入;自己写一份 0 兜底,普通浏览器里预览才不塌 */
:root{ --xb-content-top:0px; --xb-content-bottom:0px;
       --bg:#F5F6F8; --card:#FFFFFF; --fg:#0E1116; --sub:#6B7280; }
html[data-theme="dark"]{ --bg:#0B0C0E; --card:#15171A; --fg:#F3F4F6; --sub:#8E939B; }
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
  font:14px/1.5 -apple-system,system-ui,"Segoe UI",Roboto,sans-serif;
  /* 容器 chrome 浮在内容之上:顶部让位读 --xb-content-top,不写就被胶囊压住 */
  padding:calc(var(--xb-content-top) + 16px) 16px calc(var(--xb-content-bottom) + 16px)}
h1{font-size:20px;margin:0 0 10px}
.card{background:var(--card);border-radius:16px;padding:14px;margin-top:12px}
.k{color:var(--sub);font-size:12px}
.v{font-size:22px;font-weight:700;margin-top:2px}
.state{color:var(--sub);padding:24px 0;text-align:center}
</style></head>
<body>
<h1 id="name">--</h1>
<div class="card"><div class="k">现价</div><div class="v" id="px">--</div></div>
<div id="err" class="state" hidden></div>

<script>
/* 1. 参数从 query 读 —— 组件 onClick 串里的 ${secid} 是在跳转那一刻求好值的 */
var q = new URLSearchParams(location.search);
var secid = q.get("secid") || "1.600519";

/* 2. 桥不是同步就绪的:轮询等它,拿不到就渲一个不空的降级屏 */
async function ready(){
  for (var i=0;i<24 && !window.xbridge;i++) await new Promise(function(r){setTimeout(r,50)});
  return !!(window.xbridge && xbridge.isXBundleEnv());
}

/* 3. 取数只能走桥 —— 页面里的 fetch / XMLHttpRequest 被容器的 CSP 焊死(connect-src 'none'),
      不报网络错、只是永远不回来。runDataFlow("quote") 找的是 page/flow/quote.df(后缀必须对) */
async function load(){
  var r = await xbridge.runDataFlow("quote", { secid: secid }, 30000);
  /* 桥回的是信封 {code,msg,data}:code === 0 成功,流 resultFilter 透出的那组键在 data 里。
     失败不会 reject,而是 code 非 0(超时是 -2),所以要自己判 */
  if (!r || r.code !== 0) throw new Error((r && r.msg) || "bridge error");
  var d = r.data || {};
  if (!d.name && !d.price) throw new Error("empty");
  return d;
}

(async function boot(){
  if (!(await ready())) { document.getElementById("err").hidden = false;
    document.getElementById("err").textContent = "请在 Numable 里打开"; return; }

  /* 4. 主题与语言由宿主注入:根元素上 data-theme=light|dark、data-lang=<语言码>,
        页面开始加载前就写好了 —— CSS 直接用 html[data-theme="dark"] 即可,不用自己设。
        切换时页面不重载,只派发 themechange / languagechange;有 JS 侧重绘才需要监听 */
  window.addEventListener("themechange", function(e){ /* e.detail.theme = "light"|"dark" */ });
  var info = await xbridge.appInfo();          // 忘了 await 会拿到一个 Promise 对象
  var app = (info && info.data) || {};         // 同上,结果在 data 里
  var lang = String(app.language || "zh").toLowerCase();

  try {
    var data = await load();
    document.getElementById("name").textContent = data.name || "--";
    document.getElementById("px").textContent = data.price || "--";
  } catch (e) {
    document.getElementById("err").hidden = false;
    document.getElementById("err").textContent = "取数失败 · " + e.message;
  }
})();
</script>
</body></html>
```

四件必做的事,少哪件都是「哪个平台上都不报错、就是不对」:

| 必做 | 不做的现象 | 检查方式 |
|---|---|---|
| `padding-top` 读 `var(--xb-content-top)` | 首行被容器胶囊盖住,按钮点不到 | 人审(打开页面看顶部) |
| 数据走 `xbridge.runDataFlow` / `runActionFlow` | `fetch` 的 Promise 永远不 resolve,页面挂在骨架上 | 人审 / 页面控制台 |
| 取数流后缀与方法对上:`runDataFlow` 只搜 `.df`,`runFlow` / `runActionFlow` 只搜 `.af` | App 里回 `-6 flow not found`,页面显示「加载失败」 | `check` G12b |
| 明暗写 `html[data-theme="dark"]` 选择器 | 跟随不了 App 的明暗(App 锁浅色而系统是深色时尤其明显) | 人审 |

另外两条容易忘的:

- 页面里任何 `input` / `select` / `textarea` 的 `font-size` 必须 **≥16px**,否则 iOS 聚焦时整页被放大——`check` G15 拦(E)。
- 别用 `window.alert` / `window.confirm`,它们会逃出容器;用 `xbridge.alert` / `xbridge.confirm`(桥的全表见 `numable docs bridge`)。

**命令**

```
numable check <包>
```

**看到什么算对**:没有 `G12b` 的 `-6 flow not found` 类报错,没有 G15 字号报错。

### 步骤 3 · 组件接上 onClick

**做什么**:在 `.xwidget` 的 `events` 里写导航串。值解析出来是**字符串** = 导航;是结构体(`@[file://...af]` 或内联对象)= 跑 ActionFlow。

```json
{
  "version": 2,
  "title": "个股",
  "sub": "价格 · 两个月形状",
  "layout": 22,
  "params": { "secid": "1.600519" },
  "events": {
    "onClick": "/detail?secid=${secid}"
  },
  "canvas": {
    "source": "@[file://rc/quote.rcn]",
    "depends": [
      { "flow": "@[file://flow/quote.df]", "params": { "secid": "${secid}" } }
    ]
  }
}
```

导航串三种写法:

| 写法 | 去哪 |
|---|---|
| `"/detail?secid=${secid}"` | 本包的这条路由 |
| `"numable://self"` | 本包首页(`/`) |
| `"numable://self/page/detail?secid=${secid}"` | 本包这条路由,等价于第一种 |

串里的 `${...}` 在跳转那一刻求值,作用域按低到高是:外壳参数 ⊕ 这个组件的实例参数 ⊕ 本包 `data.*` ⊕ `depends` 的取数结果。**只取顶层标量**——`${obj.field}` 这类嵌套取值别指望。

**命令**

```
numable check <包>
```

**看到什么算对**:写 `numable://self/page/<x>` 而 `router.json` 里没有 `/x` 时,G12 会报「App 里会弹『页面不存在』」;没有这条报错即路由对得上。⚠️ 相对 path 形态(`/detail?...`)**不在 G12 的判据里**——它只按 `numable://` 形态查表,所以相对写法写错路由名不会被拦,只能自己对着 `router.json` 核一遍,或改用 `numable://self/page/detail` 形态让闸帮你查。

### 步骤 4 · 看效果

先确认页面用的流取得到数,再把页面渲出来看:`numable render <包> --page` 按手机宽出浅色、暗色两张整页截图,页面里的 `runDataFlow` 与 `run` 走同一套白名单和夹具(细节见 `numable docs page`)。

```
numable check <包>
numable run <包>            # 页面用的 page/flow/*.df 也会被真跑,入参取 .numable/params/<流名>.json
numable render <包> --page /detail?secid=1.600519
```

**看到什么算对**:`run` 里那条页面流打印 `✓ page/quote {...}`,键名与页面 JS 里读的字段一致;`render --page` 的输出里那条 `runDataFlow("quote")` 是 `✓`,`.numable/render/page-detail-*.png` 两张图里数据都在、顶部没被右上角的胶囊压住。

---

## 路线 B:xpage 详情页

xpage 是「整页级 RCN」:没有 WebView,页面由容器 + Canvas 节点声明式拼出来,每个 Canvas 引一份 `.rcn`,和组件同一套画法。

### 步骤 1 · 路由声明页型

```json
{
  "routes": [
    { "path": "/", "entry": "html/home/index.html" },
    { "path": "/detail", "type": "xpage", "entry": "xpage/detail.xpage", "title": "详情" }
  ]
}
```

`type` 必须写 `xpage`,漏了会被当 html 去加载一个不存在的网页。

### 步骤 2 · 写最小 xpage

**做什么**:建 `page/xpage/detail.xpage`。

```json
{
  "type": "page",
  "id": "demo-detail",
  "root": {
    "type": "container",
    "id": "root",
    "layout": "list",
    "direction": "vertical",
    "gap": "12pt",
    "padding": "16pt",
    "paddingTop": "${@contentInset.top}pt",
    "paddingBottom": "24pt",
    "depends": [
      { "flow": "@[file://page/flow/quote.df]", "params": { "secid": "${secid}" } }
    ],
    "items": [
      {
        "type": "Canvas",
        "id": "hero",
        "h": "120pt",
        "canvas": { "source": "@[file://page/rc/p-hero.rcn]" }
      },
      {
        "type": "Canvas",
        "id": "stats",
        "h": "96pt",
        "canvas": { "source": "@[file://page/rc/p-stats.rcn]" }
      }
    ]
  }
}
```

五条硬要求:

| 要求 | 不做的现象 | 检查方式 |
|---|---|---|
| 根容器 `paddingTop` 必须引 `${@contentInset.top}` | 顶部被容器胶囊压住,各平台都不报错 | `check` G17(E) |
| 根不能是 `layout: "pager"` | 各平台 pager 分支忽略 `padding`,让位写了等于没写 | `check` G17(E) |
| `depends` 写成 `{flow, params}` 对象,参数逐个显式列出 | 裸字符串传空入参,整页渲一片 `--` 且流仍报成功 | `check` G12c(E) |
| 路由 query 要用的键(这里的 `secid`),**根节点不要写同名 `params` 兜底** | 节点 params 优先级高于路由 query,点谁进来都渲同一个,零报错 | 人审(拿两个不同参数各点一次) |
| `.xpage` 与 `page/rc/*.rcn` 里的 `@[file://...]` **基准是包根** | 解析成空 → 取数不发、Canvas 不画,不报错 | 人审(写全 `page/` 前缀) |

对照记:`.xwidget` 与 `xWidget/rc/*.rcn` 里的引用基准是 `xWidget/`(写 `@[file://flow/quote.df]`),页面这边基准是包根(写 `@[file://page/flow/quote.df]`)。两套基准写反了是最常见的「什么都没发生」。

容器 `layout` 可选:`absolute` `stack` `flex` `flow` `list` `pager` `grid` `waterfall`;叶子节点只有 `Canvas` 与 `input`。节点上 `depends` 走 `.df`(取数流),`events` 走 `.af`(交互流)。完整协议见 `numable docs page`。

### 步骤 3 · 节点层文案用页表,组件内文案用 rc 表

xpage 节点层(`params` / `props.text` / `menu[].label`)的 `${@i18n.x}` 读的是**这一页顶层 `i18n` 表**,`.rcn` 表里的 key 在这里看不到;key 缺了就渲成空白(`numable check` G35 会拦)。画在 Canvas 里的文案仍住各块 `.rcn` 自己的 `rc.i18n` 表(见 `numable docs i18n`)。

### 步骤 4 · 验

```
numable check <包>
numable run <包> --flow quote --full
```

**看到什么算对**:`check` 无 G17 / G12c 报错;`run` 里页面流透出的键,与两份 `.rcn` 里 `${...}` 引的键对得上。页面版式用 `numable render <包> --page` 渲出来看。

---

## 常见错

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| 点组件弹「页面不存在」 | `router.json` 里没有那条 path,或 path 拼错 | 对着 `router.json` 核 onClick 串;把串改成 `numable://self/page/<x>` 让 G12 帮你查 |
| 点组件开出一张**空白页**,零报错 | 用 `numable://` 形态写了 `onEdit`(它逐字匹配 path,只认裸 `/edit`) | `onEdit` 改裸 path,见 `numable docs add-interaction` |
| 页面顶部一行被胶囊盖住 | html 少了 `var(--xb-content-top)`;xpage 少了 `${@contentInset.top}pt` | 补让位;xpage 那条 `check` G17 会拦 |
| 页面永远停在骨架上,控制台没有网络错 | 页面里用了 `fetch` / `XHR` | 改走 `xbridge.runDataFlow` |
| 页面显示「加载失败(-6)」 | flow 后缀与方法反了:`runDataFlow` 只搜 `.df`,`runFlow` 只搜 `.af` | 改名或改方法,`check` G12b 会报 |
| 详情页所有字段都是 `--` | 取数流入参没传进去(`depends` 写成裸字符串,或 query 里的键名与流里不一致) | `numable run <包> --flow <流名> --full` 单独跑一遍,看键 |
| 点两个不同的组件,进去是同一个内容 | xpage 根节点写了与路由 query 同名的 `params` 兜底 | 删掉根上的兜底 |
| iOS 上点搜索框整页被放大 | 输入控件字号 < 16px | 显式写 `font-size:16px`,`check` G15 拦 |
| 切 App 明暗,页面不跟 | 页面用了 `prefers-color-scheme` | 改 `html[data-theme="dark"]` 选择器 |

## 下一步

- 让页面能改组件参数、能收表单:`numable docs add-interaction`
- 路由 / 页型 / 三态呈现的完整规则:`numable docs page`
- H5 页能调的桥方法全表:`numable docs bridge`
