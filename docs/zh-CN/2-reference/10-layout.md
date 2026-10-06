# layout —— 包结构与 manifest

> 读者:做工具的用户,和替他干活的 AI。两者读同一份。

## 它是什么

一个工具就是一个目录。目录里有一份 `manifest.json`(身份与元数据)、若干个组件(`xWidget/`)、可选的页面(`page/`)和资产。发布时这个目录被整个封成一个 `.xbundle`:归档里的文件集合 = `manifest.files` ∪ `manifest.json`,一个字节都不多。所以「目录里有什么」= 「用户设备上会下载到什么」。

目录布局与文件后缀都是**硬约定**:客户端按后缀决定用哪个引擎解析,按固定路径去找 `page/router.json`、`xWidget/*.xwidget`。放错位置的文件不会报错,只是永远不被加载。

`manifest.json` 是这个包对平台说的全部话:它叫什么、归哪一类、要连哪些域名、要不要用户的密钥、最低要什么引擎。安装面板、商店组件、网络守卫都只读这一份;写错的后果通常不是崩溃,而是**装得上、跑得起来、但某件事永远不发生**(例如 host 没声明 → 请求被静默拦掉)。

## 最小可用示例

`numable init` 生成的包就长这样,可直接复制后改字段:

```json
{
  "id": "01KZ58G6AXEKVWCQFYNY9S6EEM",
  "version": 1,
  "title": "我的工具",
  "lang": "zh-CN",
  "category": "dashboard",
  "subtitle": "从一个时间组件开始",
  "domain": "01KZ58G6AXEKVWCQFYNY9S6EEM",
  "minEngine": "1.0.0",
  "network": [],
  "i18n": {
    "en-US": { "title": "My Tool", "subtitle": "Start from a clock card" }
  }
}
```

它对应的目录:

```
<包目录>/
  manifest.json              身份与元数据(必需)
  logo.png                   512×512 满幅方图(发布必需)
  banner.xbanner             工具页顶部横幅(可选)
  page/
    router.json              页面路由表(有页面才需要)
    html/<route>/index.html  H5 页
    xpage/<name>.xpage       XPage 页(声明式,零 WebView)
    form/<name>.xform        表单页
    rc/<name>.rcn            页面域 RCN
    flow/<name>.af|.df       页面域流:.af 交互 / .df 取数
    assets/                  页面用的图片与文本资产
  xWidget/
    <名>.xwidget             组件声明,一组件一文件
    rc/<名>.rcn              组件的画法
    flow/<名>.df             组件的取数流
    assets/                  组件用的资产
  .numable/                  本机 sidecar:夹具与渲染产物,永不进包
  .gitignore                 init 已写好(.numable/ .studio/ build/)
```

## 怎么写

### 后缀硬约定

| 后缀 | 是什么 | 放哪 |
|---|---|---|
| `.xwidget` | 一个组件的声明 | `xWidget/` 下一层,不再嵌目录 |
| `.rcn` | 组件/页面块的画法(RCN 模板) | `xWidget/rc/` 或 `page/rc/` |
| `.df` | 取数流(取数与加工,零 UI) | `xWidget/flow/` 或 `page/flow/` |
| `.af` | 交互流(用户手指参与的动作) | 同上 |
| `.xpage` | XPage 页面 | `page/xpage/` |
| `.xform` | 表单页 | `page/form/` |
| `.xbanner` | 工具页横幅(一个组件的 canvas:source / depends / refresh) | 包根 |

组件域 `xWidget/` 与页面域 `page/` **各有一套** `rc/` + `flow/`,物理隔离;两边的 `@[file://…]` 基准也不同(见 `numable docs xwidget`)。

### manifest 字段

| 字段 | 必填 | 类型 | 取值 / 一句注意 |
|---|---|---|---|
| `id` | 是 | string | 26 位 ULID(`0-9A-HJKMNP-TV-Z`)。`numable init` 生成,终生不改 |
| `version` | 是 | int | 整包内容版本。内容变了就 +1 —— 分发更新只认它 |
| `title` | 是 | string | 包名。裸值 = `lang` 那门语言;建议 ≤16 字,硬上限单位宽 24(全角算 2) |
| `subtitle` | 发布必填 | string | 一句话介绍,建议 ≤22 字。商店与安装面板显示 |
| `description` | 否 | string | 一段话简介。分享这个工具时当组件副标显示,**不写就回落成分类名**;可被 `i18n` 覆盖 |
| `category` | 是 | string | 平台枚举 key,见下 |
| `domain` | 是 | string | 业务域键。`init` 已填好,不必改 |
| `minEngine` | 是 | string | 按用到的能力写够用的最低一档:只用基础能力写 `"1.0.0"`;用了提醒 / 后台任务至少 `"2.0.0"`;一次性提醒、`alert.remove`、表格取数(`tsv` / `csv`)至少 `"3.0.0"`;判定配方 `task.then.recipe` 至少 `"4.0.0"`。`numable init --job` 会自动抬,写低了 `check` 用 G45 / G51 拦下。**只比大版本整数**,与 App 版本是两条独立的轴;`numable doctor` 会拿它跟当前引擎大版本对一次 |
| `lang` | 否(缺省 `zh-CN`) | BCP-47 | 包的基准语言 = 「所有裸字段是哪门话」的陈述。显式写出来 |
| `network` | 有请求就必填 | string[] | 出网 host 白名单,纯 host 不带协议与路径;支持 `*.example.com`(只配子域,不含裸域)。缺省 / 空数组 = 拒一切出口。**重定向逐跳校验**:请求途中每一跳的 host 都按这份白名单再判一次,跳出去的那一跳直接拒(`network_blocked:redirect_escaped:<host>`),`numable run` / `render` 与 App 同一份判据 |
| `credentials` | 否 | object[] | 用户自带密钥声明,见下 |
| `i18n` | 否 | object | 元数据译文(B 表),见下 |
| `system` | 否 | bool | 平台系统包专用,自制包不写 |
| `keyId` / `files` / `signature` | — | — | 发布时自动写入,源目录里不要出现 |

### `category` 的 11 个枚举值

`finance` 财经 · `developer` 开发者 · `productivity` 效率 · `life` 生活 · `health` 健康 · `system` 系统 · `tech` 科技 · `news` 资讯 · `tools` 效率 · `dashboard` 看板 · `testing` 测试。

平台自带这 11 个 key 的中英词表,写枚举 key 就自动双语。`tools` 与 `productivity` 显示同一个名字,新包用 `productivity`。写枚举以外的自由文本也能装,但你得自己在 `i18n` 里给它英文覆盖,否则英文环境显示中文。

### `credentials`(用户自带密钥)

```json
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
]
```

| 键 | 说明 |
|---|---|
| `id` | 取数流 `request.credential` 用**字面量**引用的名字;包内唯一 |
| `type` | `bearer` / `token` / `header`(须配 `headerName`)/ `query`(须配 `paramName`,能走头就别走 query) |
| `required` | `false` = 没绑定就匿名发请求;`true` = 没绑定就不发请求、组件渲「需要凭证」占位 |
| `hosts` | 密钥只随这些 host 发送;必须是 `network` 的子集 |
| `label` | 绑定面板上的名字。中英双份必须齐:裸值 + `i18n["en-US"].label` |
| `help` | 教用户去哪拿密钥,必须是 https 链接 |

密钥本身永远不进包、不进 `params`、不进 `data.*`。本机测试把值放 `.numable/params/_credentials.json`(`{"gh":"ghp_…"}`),它在 sidecar 里,不进包也不进版本控制。接入细节见 `numable docs df`。

### `i18n`(元数据 B 表)

```json
"lang": "zh-CN",
"title": "GitHub 示例",
"subtitle": "某个用户最近的公开动态",
"i18n": { "en-US": { "title": "GitHub Sample", "subtitle": "A user's recent public activity" } }
```

裸字段就是 `lang` 那一门,译文旁挂在 `i18n.<locale>` 下;可覆盖的字段只有 `title` / `subtitle` / `category` / `description`。这里的空串表示「缺译文」,平台会继续往下兜底 —— 和内容文案表(A 表)里空串表示「刻意留空」正好相反。完整规则见 `numable docs i18n`。

### 不要写的字段

| 写了会怎样 | 字段 |
|---|---|
| `check` 直接报 error | `scheme`、`schemes`、`page/html/<route>/page.json`、`*.flow.json`、`xWidget/template/`、任何 `actionFlow/` 目录 |
| 无任何效果(留着只会误导后来的人) | `navStyle`、`hideDuringAudit`、`logo`(图放包根 `logo.png`)、`poster`(改 `banner.xbanner`)、`defaultVipOnly` |

⚠️ 第二行那些字段**没有闸**:`check` 一声不吭,克隆一个现成包时会连它们一起带过来。新建包后先把 manifest 通读一遍,见到就删。

`legacyId` 也属于这一类,但它有一个小用处:`check` 拿它当报错行首的包名前缀。新包不必写,已经有的留着也无害。

### 注释怎么写

JSON 没有注释语法,包里统一用 **`_note` 键**:

```json
{
  "id": "hi",
  "type": "txt",
  "_note": "这行是标题,字号跟着卡宽走",
  "text": "${@i18n.title}",
  "x": "12pt", "y": "12pt", "w": "-1", "h": "-1",
  "fontSize": "16pt", "textColor": "#1A1A1A|#FFFFFF"
}
```

- 键名必须以 `_note` 开头(`_note` / `_noteWhy` / `_note2` 都行)。`check` 的各条闸都按这个前缀跳过注释,别的下划线名字不保证被跳过 —— 在注释里举例写个 `${@i18n.x}` 或 `abs::()`,会被当成真的引用报出来。
- 注释是**某个对象上的一个字段**,不能自己单独站着。往 `cells` / `react` / `children` 数组里塞一个 `{"_note": "…"}` 会让整个组件渲染失败(那是个没有 `type` 的 cell),`check` G7c 拦。

### 资产约定

- **`logo.png`**:包根,512×512 正方形,**满幅、自己不烤圆角**。宿主统一按 `边长 × 0.2237` 裁圆角;图自己先圆一次,四角会出现透明缺口或双重圆角。
- **总量上限 3MB**(源目录全部文件之和);**单个文件超过 256KB 会出提示** —— 流越大每次取数越慢,拆成几条流或把重复展开的表达式改成查表。图片优先用 RCN 画,或用包内 `.uri` 文本资产。
- **别往包目录塞不发布的东西**:夹具、截图、笔记一律放 `.numable/`(`.` 开头的名字一律被跳过,不会打进包),或放到包目录之外。

### 没有 `logo.png` 会怎样

不报错,也不是空白:平台画一个**首字母占位图标** —— 一个纯色圆角方块加一个字。

- 字 = `title` 去掉首尾空格后的**第一个字符**,英文转大写(中文包就是第一个汉字);`title` 为空时是 `#`。
- 底色 = 按 `manifest.id` 从 8 色板里定死取一个(把 id 的字符码求和对 8 取模),所以同一个包每次都是同一种颜色,换不了。
- 这个占位是自用包的正常形态;`check --profile publish` 会用 G11 拦住没有 `logo.png` 的发布包。

要控制第一个字长什么样,就改 `title` 的首字;要别的图,只能自己出 `logo.png`。

### `banner.xbanner`

包根一个单文件,工具页顶部那张 16:9 的横幅。不写就用平台的默认模板(把包名、分类、首字母图标摆上去);写了就整块归你画。它就是一个组件的 `canvas`:`source`(画什么)、`depends`(取什么数)、`refresh`(多久重取一次)三个键与 `.xwidget` 里的写法完全一样,只是尺寸由 `scene` 给、没有 `layout`。

```json
{
  "version": 2,
  "id": "banner",
  "ratio": "16:9",
  "theme": "auto",
  "scene": { "width": 338, "height": 190, "corner": 18 },
  "params": {},
  "canvas": {
    "source": {
      "cells": [
        { "id": "bg", "type": "layer", "x": "0pt", "y": "0pt",
          "w": "{parent.w}", "h": "{parent.h}", "bgColor": "#884532|#884532" },
        { "id": "t", "type": "txt", "text": "${@i18n.t}",
          "x": "24pt", "y": "114pt", "w": "-1", "h": "-1",
          "fontSize": "20pt", "textColor": "#FFFFFF|#FFFFFF",
          "typeface": "System-Bold", "maxLines": "1" },
        { "id": "s", "type": "txt", "text": "${@i18n.s}",
          "x": "24pt", "y": "{t.b}+6pt", "w": "-1", "h": "-1",
          "fontSize": "12pt", "textColor": "#B8FFFFFF|#B8FFFFFF", "maxLines": "1" }
      ],
      "i18n": {
        "zh-CN": { "t": "我的工具", "s": "一句话说明" },
        "en-US": { "t": "My source", "s": "One line about it" }
      }
    },
    "depends": []
  }
}
```

要取数的横幅(比如海报上放一条行情)把画布与取数流都放进 `xWidget/`,在横幅里引用它们;工具页会按 `refresh` 定时重取:

```json
{
  "canvas": {
    "source": "@[file://xWidget/rc/banner.rcn]",
    "depends": [{ "flow": "@[file://xWidget/flow/quote.df]", "params": { "code": "${code}" } }],
    "refresh": { "interval": ["600"] }
  }
}
```

五件要记住的事:

1. **必须写 `scene`** —— 横幅没有 `layout` 档位可依,尺寸只能自己声明,`width` / `height` 必须为正,少了这一块整张横幅渲不出来。惯用值就是上面那组 `338 × 190`(16:9)加 `corner: 18`。
2. **引用写包根路径**。横幅在包根,`@[file://…]` 从包根算起,要写 `xWidget/rc/…`、`xWidget/flow/…`;`.xwidget` 里从 `xWidget/` 算起,别照抄过来。
3. **拿不到包的元数据**。`${meta.title}` 之类只有默认模板才有,自定义横幅里求值为空。要显示包名就自己写进 `source` 的 `i18n`,像上面那样。
4. **`params` 是固定值**。取数流里写 `${键名}` 取到的就是它;横幅只有一份,用户不能像组件那样在仪表盘上改。不取数就留空对象,`depends` 留空数组、不写 `refresh`。
5. **双语靠自觉**:`check` 的 i18n 闸(G8)不扫 `.xbanner`。横幅上的字漏了英文没人会告诉你,发布前自己切语言看一眼。

不要写顶层 `rcn` / `flow`:App 只读 `canvas`,那种写法会被当作没有横幅、换成默认模板,`check` 用 G43 拦下。

## 规则(违反 = 返工)

| 规则 | 检查方式 | 违反时的现象 | 修法 |
|---|---|---|---|
| 所有 `.json .rcn .df .af .xwidget .xpage .xform .xmenu .xbanner` 必须是合法 JSON | `check` G0 | App 里整个组件/整页不渲染,日志干净 | 修语法;注释写成 `_note` 字符串 |
| `id/version/title/category/domain/minEngine` 六个字段必填 | `check` G2 | 装不进 App | 补齐 |
| `id` 必须是 26 位 ULID | `check` G2(warn)· `doctor` | 商店寻址不到,更新链路对不上 | 用 `numable init` 建包;不要 `cp -r` 别的包 |
| 不写不会被加载的文件与目录:`page.json` / `*.flow.json` / `xWidget/template/` / `actionFlow/` | `check` G1 | 那些文件永远不被加载,像「写了没生效」 | RCN 归 `rc/`,流归 `flow/`,后缀改 `.af`/`.df` |
| 包里不得有测试夹具(`*.params.json`、`fixtures/`) | `check` G1b | 夹具里的真实密钥被签名分发出去 | 移进 `.numable/params/` |
| 源目录总字节 ≤ 3MB | `check` G13 | 发布被拒 | 砍图片资产 |
| 单个文件 ≤ 256KB(提示) | `check` G13 | 取数变慢 | 拆流,或把重复展开改成查表 |
| `banner.xbanner` 必须带 `scene.width` / `scene.height`(正数) | 人审(App 里打开工具页看横幅) | 横幅那一整块不显示,别处正常 | 补 `"scene": {"width": 338, "height": 190, "corner": 18}` |
| `network` 与实际请求 host **恰好相等**(不多不少) | `check` G3 | 少了:真机请求被静默拦掉,流仍报成功、组件渲 `--`;多了:安装面板列一堆用不到的域名吓人 | 按 `.df`/`.af` 里的 `request.url` 与 `router.json` 的 `remote`/`fallback` 对齐 |
| `credentials[i]` 必须有唯一 `id`、白名单内的 `type`、显式 `hosts ⊆ network`、中英双份 `label`、https 的 `help` | `check` G18 | 绑定面板渲不出、密钥发到没声明的域 | 照上表补齐 |
| 组件的 `params` 键名不得像密钥(`token`/`secret`/`password`/`api_key`/密钥/令牌) | `check` G18 | 密钥进了明文回显面与分享截图 | 改走 `manifest.credentials` |
| 不得出现 `scheme` / `schemes` 字段 | `check` G2 / G16 | 无消费者的死字段,值悄悄错掉没人发现 | 删掉;深链直接写 `numable://<id>` |
| 发布包必须有 `subtitle`,且 `i18n["en-US"].title/subtitle` 齐全 | `check --profile publish` G19 | 英文环境的商店与安装面板显示中文 | 补英文覆盖 |
| 各语言的包名单位宽 ≤ 24(全角 2 / 半角 1) | `check --profile publish` G21 | 商店宫格两行放不下,名字被截断 | 缩短 `title` |
| 发布包必须有 `logo.png`,正方形、512、满幅不烤圆角 | `check --profile publish` G11 | 回落首字母图标;或四角出现透明缺口/双重圆角 | 重新导出满幅方图 |
| `minEngine` 的大版本不得高于当前引擎,也不得低于用到的能力要求的那一档 | `doctor`(写高了)· `check` G45 / G51(写低了) | 写高了:装包那一刻才爆「App 版本过低」;写低了:旧版应用上装得上、相关能力静默不工作 | 按上面 `minEngine` 那一行写 |
| `version` 每次改内容都 +1 | 人审 | 已装用户永远收不到更新,更新链路不命中 | 发布前 +1 |

## 出错怎么办

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| `check` 报「取数用到 X 但 manifest.network 未声明」 | 新加了一个 `request` 忘了配白名单 | 把 host 加进 `network` |
| `check` 报「声明了 X 但没有任何 flow 用它」 | 改了接口忘了删旧域名 | 删掉那条声明 |
| 真机上请求全失败、日志干净 | host 不在白名单 | 同上;`numable run` 会用同一份白名单强制拦截,先在本机复现 |
| `run` 报 `network_blocked:redirect_escaped:Y`(「X 重定向到 Y,Y 不在 network 里」) | 请求的地址会 3xx 跳到白名单外的 host;手机上这条请求同样失败 | 把 `url` 改成跳转后的最终地址(推荐 —— 白名单只留一个 host,`check` G3 也闭合);确实要经过跳转才把 Y 也加进 `network` |
| 装包报「App 版本过低」 | `minEngine` 大版本高于客户端 | `numable doctor` 看当前引擎大版本,改回去 |
| 发布后用户收不到更新 | `manifest.version` 没 +1 | +1 再发 |
| 商店里名字被截断 / 英文环境显示中文 | 名字太长 / 缺 `i18n["en-US"]` | `numable check --profile publish` 会逐条列出来 |
| 工具页顶部的横幅整块空白 | `banner.xbanner` 缺 `scene`,或某个 cell 缺 `type` | 补 `scene`;`check` G7c 会指出缺 `type` 的那个 cell |
| 工具图标是一个字母方块 | 包根没有 `logo.png`,走了首字母占位 | 放一张 512×512 满幅方图;`check --profile publish` 的 G11 也会拦 |
| 两个包在 App 里互相覆盖 | `cp -r` 复制包导致 `id` 相同 | `numable init <新目录> --from <老包>`,它会重新生成身份 |

## 相关

`numable docs xwidget` · `numable docs i18n` · `numable docs lint-codes`
