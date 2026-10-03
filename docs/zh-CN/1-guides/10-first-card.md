# first-card —— 从零做一个组件,完整走一遍

> 读者:做工具的用户,和替他干活的 AI。两者读同一份。

## 目标

做出一个能装进 App、能放上仪表盘和桌面的工具:一个 158×158 的组件,显示 Hacker News 此刻的榜首标题与分数,带取数时间锚,浅色 / 暗色两套配色,取不到数据时显示空态而不是白板。

数据源:`https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=1`(公开、零密钥、GET 一个 JSON)。

走完这一章你会得到:

```
hn/
  manifest.json            身份 + 出网白名单
  xWidget/
    top.xwidget            组件的声明:尺寸 / 刷新 / 点击 / 绑哪条流哪张画
    rc/top.rcn             组件的画法
    flow/top.df            组件的取数
  page/                    起步包自带的首页(这一章不动它)
  .numable/                本机夹具与渲染产物,永不进包
```

## 前置

1. Node ≥ 18,`numable` 命令可用。
2. 装了 Chrome / Chromium(只有 `numable render` 需要它)。
3. 有一个创作工作区目录,并且已经在 Numable App(Mac / Windows)工作台里把它加成工作区目录 —— 目录里的每个包都会出现在 App 的工具列表里。还没有就先 `numable workspace init`。

一条命令自检:

```
numable doctor
```

看到 node、Chrome、渲染页、引擎大版本四行都是 `✓` 就可以开始。

---

## 步骤 1 · 建包

**做什么**:用 `numable init` 建包,不要 `cp -r` 别的包 —— 身份(ULID)必须重新生成,两个包共用一个 id 会互相顶掉。

**命令**

```
numable init hn --title "HN 榜首"
```

**看到什么算对**

```
✓ 新包 HN 榜首  id=01M200QWNNX1RFPNTX5S7M8PGW
  目录: /…/hn
  来源: starter 模板(一个时间组件)
```

起步包给了一个现成的时间组件 `clock`。把这三个文件改名成本章要做的 `top`:

```
mv hn/xWidget/clock.xwidget hn/xWidget/top.xwidget
mv hn/xWidget/rc/clock.rcn  hn/xWidget/rc/top.rcn
mv hn/xWidget/flow/clock.df hn/xWidget/flow/top.df
```

再把 `hn/xWidget/top.xwidget` 里 `canvas.source` 与 `depends[0].flow` 两处路径里的 `clock` 改成 `top`。文件名与路径的对应关系没有自动推断,改一处漏一处的症状是「解析成空、取数根本不发、且不报错」。

---

## 步骤 2 · 声明出网白名单

**做什么**:包能访问哪些 host,由 `manifest.json` 的 `network` 决定,App 在网络层强制。声明与实际引用必须**恰好相等** —— 少一个请求被拦,多一个安装面板会向用户披露一个根本用不到的域名。

**改 `hn/manifest.json`**(完整可复制;`id` 用你自己 `init` 出来的那个,不要照抄)

```json
{
  "id": "01M200QWNNX1RFPNTX5S7M8PGW",
  "version": 1,
  "title": "HN 榜首",
  "lang": "zh-CN",
  "category": "tech",
  "subtitle": "Hacker News 此刻榜首",
  "domain": "01M200QWNNX1RFPNTX5S7M8PGW",
  "minEngine": "1.0.0",
  "network": ["hn.algolia.com"],
  "i18n": {
    "en-US": { "title": "HN Top", "subtitle": "The #1 story on Hacker News" }
  }
}
```

`network` 里写的是**纯 host**,不带协议、不带路径。逐字段说明见 `numable docs layout`。

---

## 步骤 3 · 写取数流 `.df`

**做什么**:`.df` 只做两件事 —— 打请求、把响应加工成一组扁平的键。它不做 UI,也拿不到语言 / 主题。最后一个节点 `resultFilter` 列出的键,就是组件能用的全部变量;没列进去的键,组件上那一格就是空的,而且不报错。

四个必须有的东西:

- **请求屏障**:`request` 之后**紧邻**的节点读不到响应(结果晚一拍才可见)。中间插一个无意义的 `op:set`(下面的 `_b`)把它隔开。删掉它,下面所有取值静默变空,流仍然报成功。
- **失败出口**:主干字段取不到就 `action:"error"` 抛错终止。没有出口 = 取数失败也报成功,空数据会覆盖掉上一次的好数据,桌面小组件回落旧图那条兜底也走不到(`check` 的 G26 会拦)。判据钉在「少了它这个组件就没意义」的那个主干字段上,不是「哪个请求挂了」。注意条件字段是 `props.val`。
- **显式旗标**:判「有没有值」一律立一个 0/1 数值旗标,渲染层只看旗标。不要写 `eq::(x,)` 这种判空 —— `eq` 两边能转数字就按数字比,空串和 0 会判成相等。
- **时间锚**:榜单本身没有「数据时间」字段,用取数时刻兜底。没有时间锚的组件看不出是不是几小时前的旧数据。

**写 `hn/xWidget/flow/top.df`**

```json
{
  "version": 1,
  "actions": [
    {
      "id": "resp",
      "action": "request",
      "params": {
        "url": "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=1",
        "method": "GET",
        "formatType": "json"
      }
    },
    {
      "op": "set",
      "props": { "key": "_b", "value": "1" },
      "_note": "请求屏障(勿删):request 之后紧邻的节点读不到响应。"
    },
    {
      "op": "if",
      "props": { "val": "$[if::(gt::(length::(${resp.hits}),0),0,1)]" },
      "items": [
        { "action": "error", "params": { "errorMsg": "取不到 HN 榜单" } }
      ]
    },
    { "op": "set", "props": { "key": "title", "value": "${resp.hits[0].title}" } },
    { "op": "set", "props": { "key": "points", "value": "${resp.hits[0].points}" } },
    { "op": "set", "props": { "key": "hasTitle", "value": "$[if::(gt::(length::(${title}),0),1,0)]" } },
    { "op": "set", "props": { "key": "at", "value": "$[formatDate::(${@time.nowMs},HH:mm)]" } },
    { "action": "resultFilter", "params": { "keys": ["title", "points", "hasTitle", "at"] } }
  ]
}
```

判空旗标的写法**看字段类型**:`title` 是字符串,用 `gt::(length::(${title}),0)`;要是判一个**数字**字段(分数、star 数),`length::` 对数字恒返回 0,旗标会永远是 0 —— 改用 `ge::(${points},0)`(0 也算有值)或 `ge::(${points},1)`(0 当没有),按业务含义选。

`errorMsg` 这里直接写了中文,自用完全没问题;上架档(`numable check --profile publish`)会对它给一条 G8b 提示,到时按 `numable docs localize` 换成 `${@i18n.key}` 即可 —— `.df` 也可以有自己的 `i18n` 表。

`op:set` 引用别的键时,被引用的那个必须排在**前面**(`hasTitle` 引 `title`,所以在它后面)。流没有依赖图,顺序写反的症状是分支恒落 else,而代码看着全对。

**命令**

```
numable run hn --full
```

**看到什么算对**

```
── 01M200QWNNX1RFPNTX5S7M8PGW (HN 榜首) ──
  · 网络白名单已强制: [hn.algolia.com]  · 夹具: /…/hn/.numable/params
  ✓ top                {"title":"216M Spy TVs – The LG Smart TV Problem [video]","points":723,"hasTitle":"1","at":"16:04"}

✓ run 完成: 1 通过 / 0 失败
```

判据不是那个 `✓`,是**输出里的键数与 `resultFilter.keys` 一样多**:这里是 4 个键 4 个都在。取值路径写错时值是 null,null 会被直接丢弃,那个键从输出里整个消失 —— 而流照样报成功(见下面「常见错」第 1 条)。

`--full` 打完整 JSON,不加它只打摘要(数组只报长度 + 首元素)。

---

## 步骤 4 · 画组件 `.rcn`

**做什么**:一个组件就是一组 cell。`22` 档是 158×158。

这一步的五条硬规矩:

| 规矩 | 写法 | 违反的现象 |
|---|---|---|
| 单位一律 `pt` | `"fontSize": "13pt"` | 写 `px` 会被按渲染密度换算,内容缩到左上角 |
| 每个颜色两段「浅\|深」 | `"#FFFFFF\|#15171A"` | 只写一段 = 暗色下同一个颜色,黑底黑字 |
| 每个 cell 必须有 `type` | `"type": "txt"` | 缺一个,**整个组件**渲染失败 |
| 尺寸 / 坐标字段只认 `${变量}` 与布局表达式 | `"w": "{parent.w}"`、`"y": "34pt"` | 写 `$[方法]` 会让整个组件渲不出 |
| 文案走 `${@i18n.key}` | 文件底部 `rc.i18n` 双语表 | 中文写死在 cell 里,英文环境下露中文 |

尺寸只用 `{parent.w}` / `{parent.h}` 或常量,布局字段里可以做加减乘除与括号(`{brand.y}+({brand.h}-5pt)/2`),但**布局锚点不能进 `$[calc::()]`** —— 两个域不互通,那个节点会静默不画。

空态由 `findNotEmpty::` 兜:第一个参数取不到就用第二个。取不到数据时组件上显示「暂无榜单数据」和 `--`,而不是一片白。

**写 `hn/xWidget/rc/top.rcn`**

```json
{
  "rc": {
    "cells": [
      { "id": "bg", "type": "layer", "x": "0pt", "y": "0pt", "w": "{parent.w}", "h": "{parent.h}", "bgColor": "#FFFFFF|#15171A" },
      { "id": "brand", "type": "txt", "x": "12pt", "y": "12pt", "w": "90pt", "h": "-1", "maxLines": "1",
        "text": "${@i18n.brand}", "fontSize": "9pt", "typeface": "System-Bold", "textColor": "#6B7280|#8E939B" },
      { "id": "at", "type": "txt", "x": "12pt", "y": "12pt", "w": "134pt", "h": "-1", "alignmentH": "2", "maxLines": "1",
        "text": "$[findNotEmpty::(${at},--)]", "fontSize": "9pt", "textColor": "#6B7280|#8E939B" },
      { "id": "title", "type": "txt", "x": "12pt", "y": "34pt", "w": "134pt", "h": "-1", "maxLines": "4", "lineSpacing": "3pt",
        "text": "$[findNotEmpty::(${title},${@i18n.empty})]", "fontSize": "13pt", "typeface": "System-Bold", "textColor": "#0E1116|#F3F4F6" },
      { "id": "pts", "type": "richText", "x": "12pt", "y": "122pt", "w": "134pt", "h": "-1", "maxLines": "1",
        "spans": [
          { "text": "$[findNotEmpty::(${points},--)]", "fontSize": "19pt", "typeface": "System-Bold", "textColor": "#0E1116|#F3F4F6" },
          { "text": "${@i18n.nbsp}", "fontSize": "14pt" },
          { "text": "${@i18n.pts}", "fontSize": "10pt", "textColor": "#6B7280|#8E939B" }
        ] }
    ],
    "i18n": {
      "zh-CN": { "brand": "HACKER NEWS", "pts": "分", "nbsp": " ", "empty": "暂无榜单数据" },
      "en-US": { "brand": "HACKER NEWS", "pts": "pts", "nbsp": " ", "empty": "No stories" }
    }
  }
}
```

几处值得抄走的手法:

- `w: "-1"` = 高/宽自适应内容;`alignmentH: "2"` = 右对齐,配 `w: "134pt"`(= 卡宽 158 − 两侧各 12pt 边距)就是「贴右边缘」。
- `at` 与 `brand` 同一个 `y`,一个左一个右,共用一行。
- 数值与单位用 `richText` 的 span 拼,而不是两个 cell —— 单位会紧跟着数值走,数字变长也不会错位。
- 数值与单位之间那点空隙是**第三个 span**:文本 `${@i18n.nbsp}`、词表值是一个 U+00A0(不换行空格)。直接在单位前敲一个普通空格是**没有用的** —— 求值时它会被当成多余空白剥掉,渲出来是「1842分」。这个 span 的字号(这里 14pt)就是空隙宽度,跟数值、单位各自的字号无关。

节点类型与字段全表见 `numable docs rcn-nodes`,表达式方法全表见 `numable docs methods`。

**命令**

```
numable render hn
```

**看到什么算对**

```
── hn ── 1 个组件 × 态[light,dark,empty] × 语言[zh-CN]
  · 先跑数据层(run)…
  ✓ top              158×158 · 3 张 → .numable/render/top.*.png
  · 拼图: /…/hn/.numable/render/index.html
```

打开 `.numable/render/index.html`,三张图并排:

- **浅色**:标题读得清、分数在底部、时间锚在右上,没有一处内容溢出组件外。
- **暗色**:同一个组件,底色变深、文字变浅 —— 如果暗色那张和浅色一模一样,说明颜色只写了一段。
- **空态**(用空数据渲):标题位显示「暂无榜单数据」、分数位显示 `--`,一眼还能认出这是个什么组件。如果空态是一片白,取数一失败用户看到的就是那片白。

渲染层还会暴露一类静态检查抓不到的错:组件上出现半截 `$[if::…]` 这样的字面量(表达式没被求值,原样画了出来)。

---

## 步骤 5 · 补全组件的声明 `.xwidget`

**做什么**:`.xwidget` 把画法、取数、尺寸、刷新节奏、点击行为绑在一起,是宿主唯一读的那个文件。

**写 `hn/xWidget/top.xwidget`**

```json
{
  "version": 2,
  "title": "此刻榜首",
  "sub": "Hacker News 第一条",
  "i18n": { "en-US": { "title": "Top Right Now", "sub": "The #1 story on HN" } },
  "layout": 22,
  "params": {},
  "events": { "onClick": "numable://self" },
  "canvas": {
    "source": "@[file://rc/top.rcn]",
    "depends": [ { "flow": "@[file://flow/top.df]", "params": {} } ],
    "refresh": { "interval": ["1800"] }
  }
}
```

逐字段:

| 字段 | 说明 |
|---|---|
| `title` / `sub` | 组件在组件面板与仪表盘上的名字。裸字段 = `manifest.lang` 那一门,英文放 `i18n["en-US"]` |
| `layout` | 两位网格码,十位=宽格、个位=高格。`22` = 158×158,`42` = 338×158,`44` = 338×354 |
| `params` | 这个组件的实例参数默认值,只能是标量。这个组件没有参数,写空对象 |
| `events.onClick` | 点组件去哪。`numable://self` = 打开本包首页;去具体页写 `numable://self/page/<路径>` |
| `canvas.source` | 画法。`@[file://…]` 在组件这个宿主里的基准是 `xWidget/`,所以写 `rc/top.rcn` |
| `canvas.depends` | 取数绑定。**必须写成 `{flow, params}` 对象**,哪怕 `params` 是空的 |
| `canvas.refresh` | 刷新节奏。`interval` 裸秒数;两次取数最短间隔 3 秒,**免费版用户会被放慢到每 5 分钟**、Pro 用户按你写的走;写多快看上游接口的限流与配额扛不扛得住 |

`depends` 写成裸字符串 `"@[file://flow/top.df]"` 是最常见的一处静默失效:那种形态传**空入参**,吃参数的组件会渲一片 `--` 且不报错。这个组件虽然不吃参数,也照对象形态写 —— 加参数的那天就不会忘。

参数怎么往下传见 `numable docs params`;点击与编辑见 `numable docs add-interaction`。

---

## 步骤 6 · 过静态闸

**命令**

```
numable check hn
```

**看到什么算对**

```
静态闸 · 档位 personal(个人自用:跳过商店门面/身份资产/双语/组件档位/首屏缓存等发布向段;发布前用 --profile publish)

── HN 榜首 (hn) ──
· [01M200QWNNX1RFPNTX5S7M8PGW] 1 组件 · layout[22] · 4KB · net[hn.algolia.com]

✓ check 完成: 0 error / 0 warn
```

**0 error 是硬要求**,warn 逐条看过再决定要不要留。默认是 `personal` 档,只查「跑得起来、不静默失效、不越权」;上架要跑的全闸见 `numable docs publish`。错误码对照见 `numable docs lint-codes`。

---

## 步骤 7 · 贴图给用户确认

三态图在 `.numable/render/`:`top.light.zh-CN.png`、`top.dark.zh-CN.png`、`top.empty.zh-CN.png`。把这三张(或那张拼图 `index.html`)给用户看,用户点头才算这个组件做完了。

自己先过一遍:一个组件只回答一个问题;`22` 档最多一个主数值 + 两个辅助信息;必须有时间锚;暗色里那些「弱一档」的灰色还看得见吗。

---

## 步骤 8 · 装进 App 看真的

包目录落在工作区目录里就已经可见了,不需要打包。

1. 打开 Numable App(Mac / Windows)。
2. 到工具列表,下拉刷新 —— 「HN 榜首」应该出现在列表里。
3. 点进去,把「此刻榜首」加到仪表盘。
4. 组件显示的内容应该和 `render` 出来的浅色那张一致。

改完文件回到 App 刷新即见,不用重装。**这一步不能省**:`render` 用的是浏览器引擎,字形度量与平台差异要在 App 里才看得到。

---

## 常见错

### 1. `run` 报 ✓,但输出里少了几个键 —— 取值路径写错了

```
✓ top                {hasTitle:0, at:16:05}
```

`title` 与 `points` 整个不见了。原因:`${resp.data.hits[0].title}` 比真实响应多了一层 `data`,取值结果是 null,而 null 会被直接丢弃 —— 那个键不进结果,流仍然报成功。到了组件上就是一片 `--`。

**修法**:先 `curl` 一下接口看真实层级,再对着改路径。判据钉死为「输出键数 == `resultFilter.keys` 长度」。

### 2. 组件上出现半截 `$[if::…]` 字面量

**现象**:某一格把表达式原样画了出来。**原因**:那一格的 `x` / `y` 里写了减法内插(`"${v}pt-24pt"`)—— 坐标字段不会去算这种混合式子。

**修法**:几何在 `.df` 里 `op:set` 算完,`.rcn` 只引用 `"${v}pt"`。这类问题 `check` 拦不住,`render` 那三张图上一眼可见。

### 3. 整个组件白板 / 渲不出来

两个原因,分诊顺序:

- **cell 缺 `type`** —— `check` 直接拦:

  ```
  ✗ […] xWidget/rc/top.rcn .rc.cells[1] 缺 type:键 = id,x,y,w,h,maxLines,text,… 整个组件会渲染失败(编辑器只显「wasm 未就绪」)
  ```

- **尺寸 / 字号字段里写了 `$[方法]`** —— `check` 拦不住,`render` 出的图里甚至可能照渲,App 里是整个组件渲不出。修法:在 `.df` 里 `op:set` 落地成一个变量,`.rcn` 里只写 `${变量}`。

### 4. 暗色下看不清 / 暗色那张和浅色一样

`check` 会拦单色硬编码:

```
✗ […] xWidget/rc/top.rcn cells[0].bgColor = "#FFFFFF" 是单色硬编码,须写成「浅|深」双分支
```

**修法**:每个带颜色的字段都写两段 `浅|深`。注意深色取的是**最后一段** —— 写三段的话中间那段永远不生效。颜色对比度够不够只能人眼在 `render` 的暗色图上判。

### 5. 白名单不闭合

多声明一个用不到的 host,`check` 报 error:

```
✗ […] manifest.network 声明了 api.github.com 但没有任何 flow 用它(过度授权,安装面板会吓人)
```

少声明,`run` 里请求被拦下:

```
  ✗ top                error: 失败: 取不到 HN 榜单
      ⚠ network_blocked:not_declared:hn.algolia.com
```

**修法**:`.df` 里请求的 host 集合与 `manifest.network` 逐个对齐,不多不少。

### 6. `.df` 里没有失败出口

```
✗ […] xWidget/flow/top.df 有 request 却没有任何 `error` 出口 —— 取数失败时流会报成功,平台的兜底(不落盘 / 回落上次成功 / 桌面小组件回落旧图)整条走不到,空数据会覆盖掉好数据…
```

**修法**:主干字段判空 → `action:"error"`。两个易错点:条件字段是 `props.val`(不是 `cond`,写错的话条件恒假、分支静默不执行、流仍报成功);「集合本来就是空的」属于成功,不要抛错。

### 7. 时间锚渲成 `01-01 07:30`

`formatDate::` 喂空值会按 epoch 0 算出一个假时间,看着像真的。**修法**:先用 `findNotEmpty::` 把空值换成一个哨兵串,再判要不要格式化。

### 8. 组件上的 emoji 是个空位

RCN 的字形管线渲不出 emoji,`check` 会拦(G30)。图标用 `path` 节点写字面 `d`,或者用 BMP 里的符号(★ ✓ ✕ ›)。

更多现象 → 原因 → 修法见 `numable docs pitfalls`。

---

## 下一步

- 给包加一张点进去的详情页:`numable docs add-page`;想用声明式页面(八种布局、条件显隐、输入框、触底分页)看 `numable docs xpage`
- 查 `${@app.…}` / `${@device.…}` / `${@time.…}` / `${@contentInset.…}` 这些内置变量有哪些键:`numable docs builtins`
- 让组件可点、参数可编辑:`numable docs add-interaction`
- 接需要密钥的数据源:`numable docs credentials`
- 做双语:`numable docs localize`
- 上架:`numable docs publish`
