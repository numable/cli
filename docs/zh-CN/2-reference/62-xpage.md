# xpage —— 声明式页面(.xpage)

> 读者:做工具的用户,和替他干活的 AI。两者读同一份。

## 它是什么

`.xpage` 是「整页级 RCN」:一个 JSON 文件就是一棵节点树,容器负责摆位置,叶子负责画东西。它与 html 页并列,由 `page/router.json` 里那条路由的 `type: "xpage"` 选中(路由怎么写见 `numable docs page`)。

选它的理由只有一个:**页面要跟组件同一套视觉语言**。详情页、图表页、tab 页、带分页的列表,用它写出来的东西和 `.xwidget` 用的是同一个渲染核、同一份 `.rcn` 画法、同一套明暗双分支。反过来说,表单、长文、要用 DOM 排版的界面,写 html 页更省事。

它跟 html 页有两处结构性差别,决定了写法:

- **没有 WebView,也没有 `xbridge`**:取数直接在节点上写 `depends` 接 `.df`,交互直接在节点上写 `events` 接 `.af`。
- **`@[file://…]` 的基准是包根**:`.xpage` 与它引的 `page/rc/*.rcn` 里都要写全 `page/flow/x.df`、`page/rc/x.rcn`。写成 `flow/x.df` 会解析成空 —— 不取数、不画,而且不报错。

## 最小可用示例

`page/xpage/detail.xpage`:

```json
{
  "type": "page",
  "id": "detail",
  "i18n": {
    "zh-CN": { "empty": "还没有数据" },
    "en-US": { "empty": "Nothing yet" }
  },
  "root": {
    "type": "container",
    "id": "root",
    "layout": "list",
    "direction": "vertical",
    "padding": "16pt",
    "gap": "12pt",
    "paddingTop": "${@contentInset.top}pt",
    "paddingBottom": "${@contentInset.bottom}pt",
    "depends": [{ "flow": "@[file://page/flow/detail.df]", "params": { "id": "${id}" } }],
    "events": { "onLoad": "@[file://page/flow/mark-read.af]" },
    "items": [
      {
        "type": "Canvas",
        "id": "hero",
        "h": "120pt",
        "params": { "title": "${title}", "sub": "${sub}" },
        "canvas": { "source": "@[file://page/rc/hero.rcn]" }
      },
      {
        "op": "forEach",
        "props": { "items": "${rows}", "key": "r", "index": "i" },
        "items": [
          {
            "type": "Canvas",
            "id": "row-${r.id}",
            "h": "56pt",
            "params": { "label": "${r.label}", "value": "${r.value}" },
            "events": { "onClick": "@[file://page/flow/open-row.af]" },
            "canvas": { "source": "@[file://page/rc/row.rcn]" }
          }
        ]
      }
    ]
  }
}
```

## 外壳与 root

外壳只有四个键,其中三个必填:

| 字段 | 必填 | 说明 |
|---|---|---|
| `type` | ✓ | 固定 `"page"` |
| `id` | ✓ | 页面标识,建议与路由名一致 |
| `root` | ✓ | 内容根,必须是一个 `container` |
| `i18n` | | 页级词表 `{语言: {key: 文案}}`,给节点层的 `${@i18n.key}` 用 |

外壳上**没有** `depends` / `events` / `layout` / `state` / `width`。页面级取数 = `root` 的 `depends`,页面级生命周期 = `root` 的 `events`,宽度恒由容器给,呈现形态归 `router.json`。

**页面标题**写在 `root` 上(可选):`"title": "${detail.name}"`。页面滚过头部之后,容器在胶囊那一行显示一个小标题,它就取这个值。按根节点能读到的一切求值(路由参数、`state`、`data`、根 `depends` 的输出),首屏、每次重渲、根取数回来时都会重算,所以数据一变标题就跟着变;求出来为空就回落路由 query 里的 `name` / `title`,再回落 `router.json` 的标题与包名(见 `numable docs page`)。不写也行,只是用户滚下去之后看到的是路由标题。

节点只有两类:

- **container**:`{type:"container", id, layout, items, …}`。`items` 里可以混排容器、叶子、`op` 操作(`forEach` / `if` / `set`)。
- **叶子**:只有两种 —— `Canvas`(一块 RCN,画法见 `numable docs rcn`)与 `input`(裸输入,见下)。

`id` 必须页内唯一;`forEach` 生成的节点用插值保证唯一(`"id": "row-${r.id}"`),重复 id 会让重绘打到错的那一格。

Canvas 叶子除了 `canvas.source`,还可以自带 `canvas.depends`(只重取这一块,不惊动整页)与 `canvas.refresh`(定时重取,写法与下限见 `numable docs xwidget`):

```json
{
  "type": "Canvas",
  "id": "quote",
  "h": "96pt",
  "canvas": {
    "source": "@[file://page/rc/quote.rcn]",
    "depends": { "flow": "@[file://page/flow/quote.df]", "params": { "code": "${code}" } },
    "refresh": { "interval": ["300"] }
  }
}
```

## 顶部让位

容器的 chrome 是一条**浮动胶囊**,不替页面留位置。根容器必须自己让:

```json
{
  "paddingTop": "${@contentInset.top}pt",
  "paddingBottom": "${@contentInset.bottom}pt"
}
```

- 读 `@contentInset` 而不是 `@safeArea`:前者 = 安全区 + chrome 占位,后者是纯系统安全区,在浮层组件里恒为 0,照着写在大屏上必被压。两个量的区别与其余内置变量见 `numable docs builtins`。
- `numable check` 的 G17 会拦漏写;确要让内容顶到最上面(整屏的天空页头那类),写 `"_lintTopInset": "exempt"` 并用 `_notePad` 写清理由。
- 四个方向都有独立的键:`paddingTop` / `paddingBottom` / `paddingLeft` / `paddingRight`,写了哪个就覆盖 `padding` 在那个方向上的值。顶部让位只影响 `paddingTop`,左右两边照常自己写。
- **根不能是 `layout: "pager"`**:pager 分支整个忽略 padding,让位写了不生效,G17 也会拦。要 tab 翻页就用 `list` 作根,pager 放进去。

## 八种 layout

`layout` 必写。**不写默认是 `flex`,不是 `list`** —— 一个漏了 `layout` 的滚动列表会变成不带间距的纵向 flex,看着像「gap 没生效」。

各档只认自己那几个字段,写别档的字段不报错也不生效。

### absolute —— 自由锚定

子节点用 `x/y/w/h`(以及 `r` 右边、`b` 下边)定位,支持几何表达式:`{parent.w}`、兄弟锚点 `{兄弟id.r}`、四则运算、`pt`/`px`。

```json
{
  "type": "container",
  "id": "hero",
  "layout": "absolute",
  "h": "220pt",
  "items": [
    { "type": "Canvas", "id": "bg", "x": "0pt", "y": "0pt", "w": "{parent.w}", "h": "{parent.h}", "canvas": { "source": "@[file://page/rc/bg.rcn]" } },
    { "type": "Canvas", "id": "badge", "x": "{bg.r}-72pt", "y": "16pt", "w": "56pt", "h": "24pt", "canvas": { "source": "@[file://page/rc/badge.rcn]" } }
  ]
}
```

`{parent.h}` 只在父高确定时可用(父声明了 `h`,或父是页面根)。父高是内容自适应时引用它 = 求不出来,自动回落 auto。

### stack —— 层叠

子节点相互覆盖,`items` 顺序 = 从底到顶,用子节点上的 `align` 定位,不写坐标。

```json
{
  "type": "container",
  "id": "card",
  "layout": "stack",
  "h": "160pt",
  "items": [
    { "type": "Canvas", "id": "bg", "align": "fill", "canvas": { "source": "@[file://page/rc/bg.rcn]" } },
    { "type": "Canvas", "id": "tag", "align": "bottom|right", "w": "88pt", "h": "28pt", "canvas": { "source": "@[file://page/rc/tag.rcn]" } }
  ]
}
```

`align` 是**子串判定**,不是枚举,三条规则记住就够:

| 写法 | 效果 |
|---|---|
| `fill` | **宽高两轴同时**铺满;铺满之后 `center` / `right` / `bottom` 全部失效 |
| 水平 | 写 `center` 居中、写 `right` 靠右;**两个都写时 `right` 赢**;都不写靠左 |
| 垂直 | 写 `bottom` 靠下,否则靠上 —— **没有垂直居中**,`center` 只管水平 |

缺省是 `top|left|fill`。因为是子串判定,`middle`、`middleCenter` 这类词一个都不认,**静默按缺省处理**。非 `fill` 的子节点要自己写 `w`,否则被拉成整宽。

### flex —— 顺序排布

只有两个字段生效:`direction`(`vertical` 默认 / `horizontal`)与 `gap`。横向时子节点用各自的 `w`,不写就均分。

```json
{
  "type": "container",
  "id": "tabbar",
  "layout": "flex",
  "direction": "horizontal",
  "padding": "12pt",
  "gap": "8pt",
  "items": [
    { "type": "Canvas", "id": "tab0", "w": "112pt", "h": "44pt", "params": { "label": "行情" }, "events": { "onClick": "@[file://page/flow/tab0.af]" }, "canvas": { "source": "@[file://page/rc/tab.rcn]" } },
    { "type": "Canvas", "id": "tab1", "w": "112pt", "h": "44pt", "params": { "label": "自选" }, "events": { "onClick": "@[file://page/flow/tab1.af]" }, "canvas": { "source": "@[file://page/rc/tab.rcn]" } }
  ]
}
```

`wrap` / `justify` / `align` 以及子节点的 `flexGrow` / `flexShrink` / `flexBasis` **都没有实现**,写了不生效。要换行用 `flow`,要居中自己算 `w` 和 `padding`。

### flow —— 放满即换行

标签、chip 这类自然流式块。字段:`itemSpacing`(项间距,缺省 8)、`lineSpacing`(行间距,缺省 8)。子节点写各自的 `w`(不写按 80 算),放不下就换行。

```json
{
  "type": "container",
  "id": "tags",
  "layout": "flow",
  "itemSpacing": "8pt",
  "lineSpacing": "8pt",
  "items": [
    { "type": "Canvas", "id": "t1", "w": "72pt", "h": "28pt", "params": { "label": "A股" }, "canvas": { "source": "@[file://page/rc/tag.rcn]" } },
    { "type": "Canvas", "id": "t2", "w": "96pt", "h": "28pt", "params": { "label": "港股" }, "canvas": { "source": "@[file://page/rc/tag.rcn]" } }
  ]
}
```

`lineAlignment` 与 `maxLines` 没有实现。

### list —— 单轴集合

最常用的一档,也是页面根的默认选择。

| 字段 | 说明 |
|---|---|
| `direction` | `vertical`(缺省)/ `horizontal`,决定滚动轴 |
| `itemSpacing` | 项间距,**优先于 `gap`**;不写才回落 `gap`(两个名字一个语义) |
| `edgeInsets` | 首尾额外留白,主轴两端各加一次,叠在 `padding` 之上 |
| `snap` | `true` = 松手吸附到某一项起点;只在这个 list 自己是滚动源时才有意义 |
| `h` | 纵向:写了确定高 = **这个 list 自己变成滚动源**(对外恒占 `h`,内容超出内部滚动);不写 = 内容多高就多高,滚动交给页面 |

横向的一条带子:

```json
{
  "type": "container",
  "id": "band",
  "layout": "list",
  "direction": "horizontal",
  "h": "120pt",
  "itemSpacing": "8pt",
  "edgeInsets": "16pt",
  "snap": true,
  "items": [
    { "type": "Canvas", "id": "s1", "w": "140pt", "h": "120pt", "params": { "label": "1" }, "canvas": { "source": "@[file://page/rc/slot.rcn]" } },
    { "type": "Canvas", "id": "s2", "w": "140pt", "h": "120pt", "params": { "label": "2" }, "canvas": { "source": "@[file://page/rc/slot.rcn]" } }
  ]
}
```

横向 list 的子节点宽取各自的 `w`(不写 = 一项一屏),内容超宽就横滚,**不要求写 `h` 也能滚**;纵向那条「要有确定高才滚」只管纵向。⚠️ **横向 list 不支持 `onReachEnd`**,横着的触底分页没有。

### pager —— 翻页

翻页轴恒为横向。子页各是一个 `container`,**首次翻到才跑自己的 `depends`**,所以「一页一份数据」不需要嵌套页面。

| 字段 | 说明 |
|---|---|
| `h` | 建议显式写,不写按 400 算 |
| `pageSize` | 每页宽;小于容器宽时**当前页居中、两侧各露出邻页**(轮播)。不写 / 超过容器宽 = 整屏一页 |
| `pageSpacing` | 页间距,缺省 0;整屏时只在翻动过程中露出这道缝 |
| `loop` | `true` = 首尾相接循环,仅两页以上生效 |
| `pageCacheCount` | 当前页两侧各预渲几页,缺省 1;`0` = 只渲当前页。**是页数不带单位** |
| `scrollEnabled` | `false` = 禁手滑,只能由 `page` 受控切页 |
| `page` | 受控页码,写表达式(`"${activeTab}"`),点 tab 改 state 即翻页 |

```json
{
  "type": "container",
  "id": "pager",
  "layout": "pager",
  "h": "300pt",
  "pageSize": "280pt",
  "pageSpacing": "12pt",
  "loop": "true",
  "page": "${activeTab}",
  "events": { "onPageChange": "@[file://page/flow/tab-sync.af]" },
  "items": [
    { "type": "container", "id": "p0", "layout": "list", "depends": [{ "flow": "@[file://page/flow/p0.df]", "params": {} }], "items": [] },
    { "type": "container", "id": "p1", "layout": "list", "depends": [{ "flow": "@[file://page/flow/p1.df]", "params": {} }], "items": [] }
  ]
}
```

`onPageChange` 的 payload 是 `@event.page`,恒为逻辑页码 `0..n-1`(开了 `loop` 也一样)。`direction: "vertical"` 与 `initialPage` 没有实现;初始页用 `page` 表达式给。`loop` 与 `pageCacheCount` 在设备上生效,本地预览不模拟这两项。

### grid —— 等宽网格

| 字段 | 说明 |
|---|---|
| `columnCount` | 列数,**必须是数字**(写 `"2"` 会当成没写,回落缺省 2) |
| `columnSpacing` / `rowSpacing` | 列间距 / 行间距 |

```json
{
  "type": "container",
  "id": "grid",
  "layout": "grid",
  "columnCount": 2,
  "rowSpacing": "12pt",
  "columnSpacing": "12pt",
  "items": [
    { "type": "Canvas", "id": "g1", "h": "88pt", "canvas": { "source": "@[file://page/rc/cell.rcn]" } },
    { "type": "Canvas", "id": "g2", "h": "88pt", "canvas": { "source": "@[file://page/rc/cell.rcn]" } }
  ]
}
```

列宽由容器算(`(内容宽 − 间距) / 列数`),子节点写不写 `w` 都会被拉成列宽;**同一行的高度取该行最高的那个**。`itemAspectRatio` / `crossAxisAlignment` 没有实现。

### waterfall —— 不等高瀑布流

字段与 grid 相同(`columnCount` / `columnSpacing` / `rowSpacing`),差别是每个子节点保留自己的高度,新项永远落到**当前最短的那一列**。列的分配策略不可配,`balanceStrategy` 写了不生效。

```json
{
  "type": "container",
  "id": "feed",
  "layout": "waterfall",
  "columnCount": 2,
  "columnSpacing": "12pt",
  "rowSpacing": "12pt",
  "items": []
}
```

## 控制流:op

节点数组里除了 `XContainer` / `Canvas`,还能放 **`op` 节点**:它自己不渲染任何东西,只决定「这一段展开成哪些节点、用什么变量」。子节点写在 **`items`** 里(不是 RCN 那个 `react`)。

五种,在 iPhone / Android / HarmonyOS / 桌面上行为逐字一致:

| `op` | props | 作用 |
|---|---|---|
| `forEach` | `items` 数组 · `key`(当前项的变量名,**默认 `item`**)· `index`(下标变量名,**默认 `index`**) | 数组有几项就把 `items` 里那段展开几份 |
| `for` | `from` · `to` · `step`(默认 `1`)· `index`(默认 `index`) | 按次数展开。**半开区间**:`from` 取得到、`to` 取不到;`step` 为负则递减 |
| `if` | `cond` · `else`(节点数组,可省) | 条件成立展开 `items`,否则展开 `else` |
| `set` | `name` · `value` | 算一个变量出来给**后面的兄弟节点**用 |
| `remove` | `cond` | 条件成立就把这一段整个丢掉 |

```json
{
  "op": "forEach",
  "props": { "items": "${rows}", "key": "r", "index": "i" },
  "items": [
    { "type": "Canvas", "id": "row-${r.id}", "h": "56pt",
      "params": { "label": "${r.label}", "n": "${i}" },
      "canvas": { "source": "@[file://page/rc/row.rcn]" } }
  ]
}
```

⚠️ **`if` 的条件字段是 `cond`** —— 和取数流 / 交互流里的 `op:if` 不是一个东西,那边读的是 `props.val`。两边写反了都**不报错,而且坏得不一样**:在 `.xpage` 里写成 `val`,`cond` 就是空的,而**空条件按成立处理** —— 于是这一段**恒展开、`else` 永远走不到**,看起来像「条件没生效」;反过来在流里写成 `cond` 则是永远不分支。判据只有一条:**在 `.xpage` 里写 `cond`,在 `.df` / `.af` 里写 `val`**。

⚠️ 同理,**`cond` 求不出值时按成立处理**(整个不写 `cond` 也一样)。所以 `"cond": "${maybeMissing}"` 这种写法要保证那个键一定有值 —— 取空串会判成不成立、取不到键则判成成立,两种「空」结果相反。

⚠️ **`for` 的参数是 `from` / `to` / `step`**,不是 RCN 里那个 `count`。同一个词在两处的意思不同,别照搬。

⚠️ **`set` 改的是往后的兄弟,不是子节点**:它把变量并进当前这一层的作用域,从它**之后**的每个节点都能读到,`items` 里也能读到;写在它前面的节点读不到。

⚠️ **循环变量出了这一段就没了**:`key` / `index` 只在展开时存在,不会留在节点树上。要在事件流里用到它,得在展开时经 `params` 传进去(如上例的 `"n": "${i}"`)。

⚠️ **`id` 必须带上循环变量**(`"id": "row-${r.id}"`):同一页里 id 撞了,重绘会打到错的那一格。

## 页面作用域:params / state / data

取值时只有**一个合并作用域**。写 `${rows}` 即可,不必写 `${params.rows}`。运行时按下面六级自上而下找,命中即停:

| 优先级 | 来源 |
|---|---|
| 1 | `op` 操作的局部变量(`forEach` 的 `key` / `index`、`set` 的 `name`) |
| 2 | 本节点 `depends` 的输出 |
| 3 | 本节点显式 `params` |
| 4 | 父链继承下来的 params(已含每一级祖先的 `depends` 输出;近的盖远的) |
| 5 | 页面 `state` |
| 6 | 全局 `data` |

写入侧则严格分三个域:

| 域 | 谁写 | 流向 | 典型 |
|---|---|---|---|
| `params` | 取数与作者声明,**只读** | 只能自上而下 | 列表数据、组件入参 |
| `state` | `.af` 里的 `xpage.setState` / `xpage.patchState` | 页内全向 | 选中的 tab、展开态、分页累积 |
| `data` | `.af` 里的 `data.set` 等 | 跨页 | 用户的自选、设置 |

`state` 是页内**唯一**能横向、自下而上传值的通道:子节点点一下改 `state.selectedId`,兄弟节点读 `${selectedId}` 高亮。它不在 `.xpage` 文件里声明,进页面时是空的;pager 的各子页**共用同一份 state**。

真有同名冲突时用前缀消歧:`${state.tab}` / `${params.tab}` / `${data.tab}`。

两个写 state 的动作差别很大:

- `xpage.setState` —— **整体替换**,这次没写进来的键会被清掉;
- `xpage.patchState` —— 浅合并,只覆盖列出的键。

日常追加、翻 tab 用 `patchState`;`setState` 只在真想清空重来时用。改完 state 记得跟一个重绘(见下)。

⚠️ **引用不存在的键不会报错,会原样透传那串字面量**。标题渲成 `第␣␣盒`、日期变成 1970,多半是这个。渲出来先看首字符是不是 `$`。

## depends 与三态

`depends` 写在**任何**节点上,不只是根:

```json
{
  "depends": [
    { "flow": "@[file://page/flow/quote.df]", "params": { "code": "${code}" } },
    { "flow": "@[file://page/flow/news.df]", "params": {} }
  ]
}
```

- 必须写成 `{flow, params}` 对象,哪怕 `params` 是空的。**裸字符串会把入参吞成空**,流仍报成功、页面渲一片 `--`(`check` G12 会拦)。
- 数组里多条**并发执行**,按声明顺序合并;分支、重试、串行依赖这类控制一律收进单个 `.df` 里(写法见 `numable docs df`)。
- 输出直接并进这个节点的 params,子树都读得到。

每个带 `depends` 的节点都是一个**异步边界**,有三态:

| 态 | 什么时候 | 渲什么 |
|---|---|---|
| loading | 取数中**且这个节点还没有过成功数据** | App 内置的骨架(按这个节点的版式排) |
| error | 任一条流失败**且还没有过成功数据** | App 内置的错误提示 + 重试 |
| loaded | 全部成功 | 正常内容 |

关键是那句「**还没有过成功数据**」:已经有数据之后再刷新,页面保留现有内容、后台取数、回来替换,**不闪骨架**;失败也保留旧数据不切错误页。所以嵌套的边界会一块块渐次出现,而不是整页等最慢的那条流。

这两态的画面由 App 统一画,**你不用也不能自己写**:节点上写 `loading` / `error` 字段不会生效,`check` 会报 G1c 提醒你删掉。

骨架也不是一取数就出现:结果 150ms 内回来就直接显示内容,一帧骨架都不闪;超过 150ms 才淡入骨架,骨架一旦出现至少停 300ms,再和结果交叉淡变。所以本地缓存命中、接口很快的页面,用户根本看不到骨架。

带 `depends` 的节点**高度必须在取数之前就能算出来**(写死 `h`,或父容器给)。否则加载完成时高度一变,整页会跳。

## 事件

值一律是标准绑定:`"@[file://page/flow/x.af]"`、`{"flow": "…", "params": {…}}`、或内联的动作数组。

| 事件 | 挂在哪 | payload | 什么时候触发 |
|---|---|---|---|
| `onLoad` | 任意节点 | 无 | 这个节点首次进入 loaded 之后。**整个生命周期恰好一次** |
| `onRefresh` | root | 无 | 用户下拉。**一旦声明就完全接管下拉** |
| `onReachEnd` | 纵向 list / waterfall | 无 | 内容滚到底 |
| `onPageChange` | pager | `@event.page` | 翻页完成 |
| `onClick` | 任意节点 | `@event.id` | 点击 |
| `longClick` | 任意节点 | `@event.id` | 长按。写了它,同节点的 `menu` 就永不弹 |
| input 的 `onChange` / `onSubmit` / `onBlur` / `onFocus` | input | `@event.value`(`onFocus` 无) | 见下 |

**三个数据事件的时机**,一张表钉死:

| 什么动作 | depends | onLoad | onRefresh |
|---|---|---|---|
| 首次进页 | 全跑 | 跑一次 | — |
| 下拉,页面没写 `onRefresh` | 全跑 | 不跑 | — |
| 下拉,页面写了 `onRefresh` | **一条都不跑** | 不跑 | 跑 |
| 容器菜单里的刷新 | 全跑 | **重跑** | — |
| 错误页上点重试 | 只跑那一个节点的 | 不跑 | — |
| `xpage.reloadPage` | 全跑 | 不跑 | — |
| `xpage.reenterPage` | 全跑 | **重跑** | — |
| 用户切换 App 语言 | 全跑 | 不跑 | — |
| `xpage.setState` / `patchState` + 重绘 | 不跑,用现有数据 | 不跑 | — |

由此两条容易踩的:

1. `onRefresh` 一旦写了,即使根有 `depends`,下拉也不会再自动重取。既想重置状态又想重取,在那条 `.af` 末尾显式加一步 `xpage.reloadPage`。
2. `onLoad` 只跑一次。要「每次回到这页都重来」,用 `xpage.reenterPage`,别指望 `onLoad`。

四个重绘 / 重载动作的分档(全表见 `numable docs af`):

| 动作 | 做什么 |
|---|---|
| `xpage.redraw` | 只重绘 `id` 指定的那个节点,不重取数 |
| `xpage.redrawPage` | 整页重绘,不重取数 |
| `xpage.reloadPage` | 软重载:重跑全部 `depends`,`onLoad` 不重跑,state 保留 |
| `xpage.reenterPage` | 硬重载:等同关掉重开,state 清空、`onLoad` 重跑 |

**触底分页**的标准写法是这四件事的组合:list 上挂 `onReachEnd` → 流里取下一页 → `xpage.patchState` 把新数据**追加**进 `${items}` → `xpage.redraw` 只重绘这个 list。不要整页 reload —— 会闪、会把全部 `depends` 再跑一遍。

分页还要在同一个 list 上声明 `loadMore`,否则触底事件**永远不触发**(`hasMore` 缺省是 false):

```json
{
  "type": "container",
  "id": "rows",
  "layout": "list",
  "direction": "vertical",
  "events": { "onReachEnd": "@[file://page/flow/next-page.af]" },
  "loadMore": { "hasMore": "${hasMore}", "noMoreText": "没有更多了" },
  "items": []
}
```

`root` 上还有一个开关:`"refresh": false` = 不挂下拉刷新头。根既没有 `depends` 也没有 `onRefresh` 时本来就不挂,不必显式写。

## visible

`visible` 接受 `true` / `false` 或表达式,不写视为显示。

```json
{
  "type": "Canvas",
  "id": "k90",
  "visible": "$[if::(eq::(${seg},90),1,0)]",
  "h": "180pt",
  "canvas": { "source": "@[file://page/rc/k90.rcn]", "depends": { "flow": "@[file://page/flow/k90.df]", "params": { "n": 90 } } }
}
```

`visible: false` 的节点**不进树**:不占位、不渲染,它的 `depends` 也**不执行**。等到 state 变了它才第一次取数 —— 三档 K 线互斥这类界面正是靠这个省掉两条没人看的请求。

⚠️ 判据比较严:表达式求出来是 `true` / `1` / 非零数字才算显示,**其余一律当隐藏**。所以引用了一个不存在的键(求值成 `${…}` 字面串),这个节点会整个消失且不报错。稳妥写法是用 `$[if::(…,1,0)]` 明确产出 1 / 0。

`enabled` 是另一回事:它会被求值,但**没有任何消费者**,写了不会禁掉事件。要让一个节点点不动,别给它挂 `events`。

## menu

在任意节点上写 `menu` 数组 = 长按弹一份声明式菜单。字段与优先级见 `numable docs page` 的「节点长按菜单」一节,这里只补两条 xpage 特有的:

- `flow` 是**必填**;`label` / `icon` / `role` 可选。
- `label` 里的 `${@i18n.key}` 查的是**这一页顶层 `i18n` 表**,查不到就渲成空串(`check` G35 会拦)。

## input 节点

`input` 是第二种叶子,只管三件事:**文本编辑、键盘、光标**。它自己**零视觉** —— 没有边框、没有背景、没有聚焦高亮。视觉靠分层:底下垫一个 Canvas 画圆角底 + 边框,input 叠在上面。

```json
{
  "type": "input",
  "id": "kw",
  "x": "28pt",
  "y": "16pt",
  "w": "276pt",
  "h": "44pt",
  "props": {
    "bindKey": "kw",
    "hint": "搜索…",
    "hintColor": "#999999|#8E8E93",
    "inputType": "text",
    "fontSize": 16,
    "color": "#1C1C1E|#F2F2F7",
    "caretColor": "#128F66|#6FE8BE",
    "changeFireOn": "change",
    "changeDebounce": 300
  },
  "events": { "onChange": "@[file://page/flow/search.af]" }
}
```

**`w` 与 `h` 必须显式写**(单行不会按内容自适应高)。

| props | 说明 |
|---|---|
| `bindKey` | 值写回页面 state 的键,缺省 = 节点 `id` |
| `value` | 初始值,写 `${…}`。**非受控**:之后不回灌,只有 `input.setValue` 会覆盖 |
| `hint` / `hintColor` | 占位提示与它的颜色,颜色支持 `浅\|深` 双分支 |
| `inputType` | `text` / `number` / `decimal` / `password` / `email` / `phone` / `url`,决定键盘布局 |
| `secure` | `true` 等价于 `inputType: "password"` |
| `lines` | `1` = 单行(缺省);`N` = 固定 N 行的多行框 |
| `maxLength` | 长度上限。中文输入的拼音合成期间不计数 |
| `fontSize` / `color` / `align` / `typeface` | 字体,`color` 支持双分支 |
| `caretColor` | 光标颜色 —— 唯一保留的视觉属性 |
| `autoFocus` | 挂载即聚焦并弹键盘 |
| `clearButton` | 尾部清除按钮 |
| `returnKey` | `done` / `send` / `search` / `next` / `go`,回车键的样子与语义 |
| `keyboardToolbar` | `done` = 键盘上方加一条「完成」 |
| `contentType` | 告诉系统这一格填的是什么,让密码管理器 / 短信验证码自动填充能接上。值用平台的自动填充标识(`username` · `current-password` · `new-password` · `one-time-code` · `email` · `tel` 等);不填就没有自动填充 |
| `changeFireOn` | `onChange` 什么时候派:`change`(缺省,带防抖)/ `blur` / `submit` |
| `changeDebounce` | `change` 模式的防抖毫秒,缺省 300 |

**值住页面 state,且写回是静默的**:每敲一个字就写进 `state[bindKey]`,供别的节点求值读,但**不触发重绘**(否则每个键击都重建全树,正在编辑的框会被卷走)。要联动(聚焦高亮、字数角标),在 `onChange` / `onFocus` 的流里显式 `xpage.patchState` + `xpage.redraw`。

命令式控制走五个 action,参数都是 input 节点的 `id`:`input.focus` / `input.blur` / `input.clear` / `input.selectAll` / `input.setValue`(另带 `value`,同时更新 `bindKey` 指向的 state)。

想「弹一层问一个值」而不是页面里常驻一个框,别用 input 节点,用 `singleValue` / `.xform`(见 `numable docs params`)。

## 写了不生效的字段

这些名字合法、不报错、也没有任何效果。从别处抄来的页面里它们最常见:

| 字段 | 写在哪 | 想要那个效果就 |
|---|---|---|
| `virtualization` | list / grid / waterfall | 没有替代;几十项的列表不需要它 |
| `preloadCount` | list / waterfall | 同上 |
| `scrollEnabled` | list / waterfall(pager 上**是**生效的) | 纵向 list 不写确定 `h` 就不会自己滚 |
| `direction: "vertical"` | pager | 翻页轴恒横向 |
| `initialPage` | pager | 用受控的 `page` 表达式 |
| `onScroll` | 集合容器 | 没有替代 |
| `onVisible` / `onHidden` | 任意节点 | 从子页回来要刷新,用打开子页那条流的后续步骤调 `xpage.reloadPage` |
| `enabled` | 任意节点 | 不挂 `events` |
| `wrap` / `justify` / `align` | flex 容器 | 换行用 `flow`;对齐自己算 `w` 与 `padding` |
| `flexGrow` / `flexShrink` / `flexBasis` | flex 的子节点 | 写死 `w` |
| `lineAlignment` / `maxLines` | flow | 没有替代 |
| `balanceStrategy` | waterfall | 永远是「落到最短那列」 |
| `itemAspectRatio` / `crossAxisAlignment` | grid | 子节点写死 `h` |
| `navStyle` | 路由 / 页面 | chrome 恒是浮动胶囊,不可配 |

## 规则(违反 = 返工)

| 规则 | 检查方式 | 违反时的现象 | 修法 |
|---|---|---|---|
| 根容器 `paddingTop` 必须引 `${@contentInset.top}` | `check` G17 | 页面顶部一截被浮动胶囊压住,哪个平台都不报错 | 根上写 `"paddingTop": "${@contentInset.top}pt"`;确要全铺底时写 `_lintTopInset: "exempt"` 并用 `_notePad` 说明 |
| 根不能是 `layout: "pager"` | `check` G17 | 让位写了不生效,顶部照样被压 | 外面包一层 `list` 作根 |
| `depends` 不能写裸字符串 | `check` G12 | 入参被吞成空,流仍报成功,整页渲一片 `--` | 写成 `{"flow": "…", "params": {"k": "${k}"}}` |
| 节点层(`params` / `props` / `menu[].label`)的 `${@i18n.key}` 必须在这一页顶层 `i18n` 表里 | `check` G35 | 那处文案渲成空串,像是忘了写 | 补进页表;画在 Canvas 里的文案仍住各 `.rcn` 自己的表 |
| `events` 的值不能以 `${` 开头 | `check` G36 | 派发层先按首字符分类再插值,以插值开头的串哪一类都不像 → 点了没反应 | 把能确定的前缀写在插值外面:`"/detail?id=${id}"` |
| `.xpage` 与 `page/rc/*.rcn` 里的 `@[file://…]` 基准是包根 | 人审 | 解析成空:不取数、不画、不报错 | 写全 `page/flow/x.df`、`page/rc/x.rcn` |
| 带路由入参的页面,根节点不要再写同名 `params` 兜底 | 人审 | 点 A 进去看到 B,零报错 —— 根 params 会顶掉路由 query | 删掉根上的同名兜底,用两条 query 各开一次对照 |
| 每个节点的 `id` 页内唯一,`forEach` 里插值 | 人审 | 重绘打到错的那一格;`onLoad` 的一次性判定串台 | `"id": "row-${r.id}"` |
| 带 `depends` 的节点高度要在取数前可确定 | 人审 | 数据回来那一刻整页跳一下 | 写死 `h`,或由父容器给 |
| 挂了 `onReachEnd` 就必须给 `loadMore.hasMore` | 人审 | 滚到底什么也不发生 | 补 `"loadMore": {"hasMore": "${hasMore}"}`,并在流里维护这个键 |

## 出错怎么办

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| 整页空白,零报错 | 路由 `type` 没写 `xpage`(未知值一律当 html);或 `entry` 路径不对 | 核路由那三个字段 |
| 页面顶部被胶囊压住 | 根少了让位,或根是 pager | 跑 `numable check`,看 G17 |
| 列表项挨在一起,`gap` 像没生效 | 容器漏写 `layout`,默认成了 flex | 补 `"layout": "list"` |
| 写了 `itemSpacing` 没变化 | 容器不是 `list`(别的档不认这个名字) | 换成 `gap`,或把容器改成 list |
| 某个节点整个不见了 | `visible` 表达式求成了非 `true`/`1` 的东西,包括引用了不存在的键 | 用 `$[if::(…,1,0)]` 明确产出 1/0 |
| 文字渲成 `${xxx}` 字面串 | 那个键在六级作用域里都不存在 | 核 `.df` 的输出键名;渲出来先看首字符是不是 `$` |
| 一处文案是空白 | 节点层 `${@i18n.key}` 不在页表里 | 跑 `numable check`,看 G35 |
| 下拉刷新之后数据没变 | 写了 `onRefresh`,它已经接管下拉,`depends` 一条都不跑 | 在那条 `.af` 末尾加 `xpage.reloadPage` |
| 从子页返回,页面数据不动 | 指望了 `onVisible`(没有实现) | 在打开子页那条流的后续步骤里调 `xpage.reloadPage` |
| 滚到底不加载下一页 | 缺 `loadMore.hasMore`,或那是横向 list | 补 `loadMore`;横向没有触底事件 |
| 切了 tab 但页面没动 | 只 `patchState` 没重绘 | 跟一个 `xpage.redraw`(或 `redrawPage`) |
| 输入框里打字,别处读到的还是旧值 | 写回是静默的,不会自动重绘 | 在 `onChange` 流里 `patchState` + `redraw` |

## 相关

- `numable docs page` —— 路由、三种页型、节点长按菜单、跳转与外链
- `numable docs af` —— `xpage.*` / `input.*` 等 action 全表与交互流写法
- `numable docs rcn` —— Canvas 里那份 `.rcn` 怎么画
