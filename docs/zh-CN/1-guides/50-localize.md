# localize —— 把一个中文包做成双语

> 读者:做信息源的用户,和替他干活的 AI。两者读同一份。

## 目标

把一个只有中文的包补成中英双语:商店门面、组件标题、页面标题、组件上的字、弹出的提示,英文环境下全都是英文。做完之后 `numable render <包> --locales zh-CN,en-US` 会给你两套图,`numable check <包> --profile publish` 的双语相关闸全绿。

**先记住一条判据**,它决定每处文案该写哪种表:

> **宿主读来直接显示的字段,一律 B 表;包内容自己经求值器引用的,一律 A 表。**

| | A 表(内容文案) | B 表(元数据) |
|---|---|---|
| 长什么样 | 文件顶层一张 `i18n: { locale: { key: 文案 } }`(`.rcn` 是 `rc.i18n`) | 裸字段 = 基准语言,译文旁挂同级 `i18n: { locale: { 字段: 值 } }` |
| 怎么用 | 正文写 `${@i18n.key}` | 不用引用,宿主自己挑 |
| 谁用它 | `.rcn` · `.af` · `.xform` · `.xpage` | `manifest.json` · `.xwidget` · `router.json` 的每条路由 · 凭证 `label` |
| 空串什么意思 | **合法译文**(刻意为空),不兜底 | **缺**,继续往下兜 |

两种表都走同一条兜底链:`当前 locale → 同语言段的其它门 → en-US → 基准语言(manifest.lang)→ zh-CN → 其余`。一句话:有精确用精确,没精确用英语。

## 前置

- 包已经能跑通(`numable check` / `run` / `render` 三步都过);
- 决定好**基准语言**:`manifest.lang`,缺省 `zh-CN`。它的意思是「所有裸字段是哪门语言」。

---

## 步骤 1 · manifest 的门面(B 表)

**做什么**:裸字段保持中文,加一张 `i18n`。可翻译的字段白名单是 `title` / `subtitle` / `category` / `description`。

```json
{
  "lang": "zh-CN",
  "title": "GitHub 示例",
  "subtitle": "某个用户最近的公开动态",
  "category": "developer",
  "i18n": {
    "en-US": {
      "title": "GitHub Sample",
      "subtitle": "A user's recent public activity"
    }
  }
}
```

- `category` 用平台枚举 key(`finance` `developer` `productivity` `life` `health` `system` `tech` `news` `tools` `dashboard` `testing`),App 自己会按语言显示,**不用翻**;写成自由文本才需要给英文覆盖。
- 标题在商店宫格里是两行的瓦片:**每门语言的宽度上限 24**(一个汉字算 2、一个半角字符算 1),建议 ≤16。英文标题常常比中文长,超了会被截断。

**命令**

```
numable check <包> --profile publish
```

**看到什么算对**:没有 G19(`manifest.i18n["en-US"].title/subtitle` 缺 = E)、没有 G21(包名过宽 = E)。

## 步骤 2 · 组件标题(B 表)

**做什么**:每个 `.xwidget` 的 `title` / `sub` 加英文。

```json
{
  "version": 2,
  "title": "现在天气",
  "sub": "温度 · 体感 · 今日高低",
  "i18n": {
    "en-US": { "title": "Now", "sub": "Temperature, feels like, today's range" }
  },
  "layout": 22
}
```

这两个字段出现在「添加组件」面板和长按菜单里,漏了就是「英文环境下组件标题显示中文」。`check` G20 报 W。

## 步骤 3 · 页面标题(B 表)

**做什么**:`router.json` 里每条路由的 `title` 旁挂译文。

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

⚠️ 路由标题**不能**写成 `"title": "${@i18n.detail}"` 配一张顶层词表——路由标题不求值,标题栏会原样显示这个模板串。`check` G8 判 E。

## 步骤 4 · 组件上的字(A 表)

**做什么**:`.rcn` 里所有给人看的固定文案改成 `${@i18n.key}`,词表放 `rc.i18n`。

```json
{
  "rc": {
    "cells": [
      { "id": "hl", "type": "txt",
        "text": "${@i18n.high} $[findNotEmpty::(${hi},--)]°   ${@i18n.low} $[findNotEmpty::(${lo},--)]°",
        "x": "12pt", "y": "112pt", "w": "{parent.w}-24pt", "h": "-1",
        "fontSize": "11pt", "textColor": "#1A1A1A|#FFFFFF", "maxLines": "1" },
      { "id": "cond", "type": "txt", "text": "${@i18n.cond_clear} · ${at}",
        "x": "12pt", "y": "130pt", "w": "{parent.w}-24pt", "h": "-1",
        "fontSize": "10pt", "textColor": "#8E939B|#8E939B", "maxLines": "1" }
    ],
    "i18n": {
      "zh-CN": { "high": "高", "low": "低", "cond_clear": "晴" },
      "en-US": { "high": "H", "low": "L", "cond_clear": "Clear" }
    }
  }
}
```

A 表细则:

| 规矩 | 说明 |
|---|---|
| 扁平一层 | `{ locale: { key: 值 } }`,不要再套 `values` 之类的外层(`check` G8 判 E) |
| key 只用 `[A-Za-z0-9_]` | 且**不能动态拼**(`${@i18n.${k}}` 求不出来) |
| 值只能是字符串 | 求不出来时 RCN / XPage 会把原串照渲出去,屏上就是字面量 |
| 插值用多个 key 拼 | 「高 12 度」拆成 `${@i18n.high} ${t}${@i18n.deg_post}`,别把整句做成模板 |
| 复数用两个 key | `key_one` / `key_other`,在正文用 `$[if::(...)]` 选 |
| 组件上文案住 `.rcn`;XPage 节点层的 `${@i18n.x}` 要在 `.xpage` 顶层表里有 key | 节点层读的是页表,`.rcn` 表的 key 在那里看不到,缺 key 渲成空白 |

## 步骤 5 · 交互流的提示语(A 表)

**做什么**:`.af` 与 `.df`(以及 `.xform`、`.xpage` 页面)顶层加同形状的 `i18n`,`ui.toast` / `ui.alert` / 表单标题、取数流里拼的成品句子都用 `${@i18n.key}`。

```json
{
  "version": 1,
  "actions": [
    { "action": "ui.haptic" },
    { "action": "ui.toast", "params": { "message": "${@i18n.logged}", "type": "success" } }
  ],
  "i18n": {
    "zh-CN": { "logged": "已记下今天" },
    "en-US": { "logged": "Logged today" }
  }
}
```

作用域合并规则(低被高覆盖):

| 载体 | 用哪张表 |
|---|---|
| XPage 节点 | 页表 |
| Canvas | 页表 ⊕ 那份 `.rcn` 的 `rc.i18n`(`.rcn` 赢) |
| `.af` | 宿主表 ⊕ 流自己的表(组件事件流没有宿主表,只有自己的) |
| `.df` | 宿主页表 ⊕ 流自己的表(组件取数流没有宿主表,只有自己的) |
| `.xform` | 自己的表 |

### XPage 页的表写在文件顶层

`.xpage` 的节点层(节点 `params`、`props.text`、长按 `menu[].label`)读的是**这一页顶层的 `i18n`**,和 `.rcn` 的 `rc.i18n` 是两张表:

```json
{
  "type": "xpage",
  "id": "channel",
  "root": {
    "layout": "list",
    "items": [
      { "type": "Canvas", "id": "hd", "h": "120pt",
        "canvas": { "source": "@[file://page/rc/head.rcn]" } },
      { "type": "input", "id": "kw", "w": "276pt", "h": "44pt",
        "props": { "hint": "${@i18n.searchHint}" } }
    ]
  },
  "i18n": {
    "zh-CN": { "searchHint": "搜频道…", "openYt": "在 YouTube 打开 ↗" },
    "en-US": { "searchHint": "Search channels…", "openYt": "Open on YouTube ↗" }
  }
}
```

- 表在**页文件顶层**,与 `type` / `root` 平级,不是放在 `root` 里面。
- 页里那些 `Canvas` 引的 `.rcn`,读的是「页表 ⊕ 它自己的 `rc.i18n`」,同名 key 以 `.rcn` 自己那份为准 —— 所以 `.rcn` 里的文案照旧写在 `.rcn` 里,不用往页表搬。
- 节点层引了页表里没有的 key,那一处求值成**空串**:不报错、不留原串,屏上就是一片空白,看着像忘了写文案。`check` G35 专门拦这个。

### `.xform` 用自己那一张表

表单页的表也在文件顶层,和 `type` / `form` 平级;整份文件里的文案 —— 标题、说明、确认钮、每个字段的 `title` 与 `props.placeholder` —— 都可以引它:

```json
{
  "type": "form",
  "id": "form-pick",
  "title": "${@i18n.title}",
  "desc": "${@i18n.desc}",
  "confirmTxt": "${@i18n.ok}",
  "onSubmit": "@[file://page/flow/save.af]",
  "form": {
    "name": {
      "title": "${@i18n.nameLabel}",
      "component": { "type": "textInput", "props": { "placeholder": "${@i18n.namePh}" } }
    }
  },
  "i18n": {
    "zh-CN": { "title": "选择", "desc": "改完点确定", "ok": "确定",
               "nameLabel": "名称", "namePh": "请输入名称" },
    "en-US": { "title": "Pick", "desc": "Confirm when done", "ok": "OK",
               "nameLabel": "Name", "namePh": "Enter a name" }
  }
}
```

表单外壳自己的文案(取消、清空、「请选择」这类)由平台按 App 语言给,不用你翻。

## 步骤 6 · html 页自己管自己

H5 页不吃 A 表,它是一张网页:词表自己在 JS 里放一份,语言从宿主给的两个地方取——

```js
var LANG = (document.documentElement.dataset.lang || "zh").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
// 或者:var info = await xbridge.appInfo(); info.data.language
window.addEventListener("languagechange", function (e) { /* e.detail.language */ });
```

宿主在页面加载前就把 `data-lang` 写在根元素上;切语言时页面**不重载**,只派发 `languagechange`。`appInfo()` 是异步的,忘了 `await` 会拿到一个 Promise 对象。

词表放页面自己的 JS 里,形状随你,能跑就行。一个够用的最小模式:

```js
var T = {
  zh: { title: "近 30 天", empty: "还没有数据", refresh: "刷新" },
  en: { title: "Last 30 days", empty: "Nothing yet", refresh: "Refresh" }
};
var lang = (document.documentElement.dataset.lang || "zh").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
function t(k) { return (T[lang] && T[lang][k]) || T.en[k] || k; }

function paint() {
  document.querySelectorAll("[data-t]").forEach(function (el) { el.textContent = t(el.dataset.t); });
}
paint();
window.addEventListener("languagechange", function (e) {
  lang = String(e.detail && e.detail.language || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  paint();   // 页面不重载,自己把已经画上去的字重刷一遍
});
```

三条注意:

- **切语言不重载页面**,所以只在初始化时读一次 `data-lang` 是不够的 —— 不接 `languagechange`,用户切完语言这一页还是旧文案,退出重进才变。
- 页面里 `<html lang>` 之类的静态属性不会自动跟着变,要显示给屏幕阅读器的话自己在 `paint()` 里一起写。
- 页面文案与 `.rcn` 的 A 表是**两套**,没有共享通道。同一句话在组件上和页上都要出现时,两边各写一份。

---

## 步骤 7 · 两套图一起看

**命令**

```
numable render <包> --locales zh-CN,en-US
```

**看到什么算对**:`<包>/.numable/render/` 下每个组件出 `<组件名>.<态>.<locale>.png`,外加一张 `index.html` 拼图。打开拼图逐张比:

- 英文那张不能有残留中文(漏了 key 会兜底回中文,看得出来);
- 英文通常更长:检查有没有被截断、有没有换行挤掉下一行、数字和单位有没有错位;
- 空态那一列同样要看——空态文案也要双语。

不带 `--locales` 时只渲基准语言那一门。页面同理:`numable render <包> --page --locales zh-CN,en-US` 每条路由每门语言各出浅色、暗色两张。

## 步骤 8 · 过闸

**命令**

```
numable check <包> --profile publish
```

`personal` 档会跳过双语相关的段,所以**做本地化必须用 publish 档来验**。

**看到什么算对**:

| 码 | 拦什么 | 级 |
|---|---|---|
| G8 | A 表不是扁平对象 / 带 `values` 外层 / 引用的 key 在必需门缺失 / 路由标题写成 `${@i18n.}` 配顶层词表 | E |
| G8 | 各门 key 对不齐 / 空串译文没声明 / 有未使用的 key / 门代码不是 BCP-47 | W |
| G8b | 用户可见的键里有中文硬编码 | W |
| G19 | `manifest.i18n["en-US"].title` 或 `subtitle` 缺 | E |
| G20 | `.xwidget` 的 `i18n` 不是对象 | E |
| G20 | `.xwidget` 缺英文 `title` / `sub` | W |
| G21 | 某门语言的包名宽度 > 24 | E |

---

## 三条容易搞反的

### 1)A 表空串是合法译文,B 表空串是「缺」

英文里常常要把中文的量词/后缀去掉(「12 度」→「12°」),这时 `"deg_post": ""` 是**刻意为空**:运行时照渲空,不会兜底回中文。`check` 会为空串出一条 W 提醒你「是不是没翻完」;确属刻意,就在同一张表的宿主对象里声明一次:

```json
"i18n": {
  "zh-CN": { "deg_post": "度" },
  "en-US": { "deg_post": "" }
},
"i18nEmptyOk": ["deg_post"]
```

(`.rcn` 里写在 `rc` 下,与 `rc.i18n` 同级。)反过来,B 表里 `"title": ""` 一律当成「这门没写」,继续沿兜底链找。

### 2)按语言取数、在数据层出文案

切换语言时,仪表盘会对每个包做一次 `widget.refresh`(清取数计时 + 真取数)。所以接口本身分中英文的数据(新闻标题、城市名),在 `.df` 里直接读语言就行:

```json
{
  "id": "news",
  "action": "request",
  "params": { "url": "https://api.example.com/news?lang=${@app.language}", "formatType": "json" }
}
```

`.df` 与 `.af` 完全同构:`.df` 也可以有顶层 `i18n` 表,正文写 `${@i18n.key}`(读到的是宿主页表 ⊕ 本文件表)。要在数据层出成品文案(「和昨天差不多」「今日在高低区间的 59%」)就直接在 `.df` 里出:

```json
{
  "version": 1,
  "actions": [
    { "id": "resp", "action": "request", "params": { "url": "https://api.example.com/today?lang=${@app.language}", "formatType": "json" } },
    { "op": "set", "props": { "key": "_b", "value": "1" } },
    { "op": "set", "props": { "key": "delta", "value": "${resp.delta}" } },
    { "op": "set", "props": { "key": "summary", "value": "$[if::(gt::(${delta},0),${@i18n.up},${@i18n.flat})]" } },
    { "action": "resultFilter", "params": { "keys": ["delta", "summary"] } }
  ],
  "i18n": {
    "zh-CN": { "up": "比昨天高", "flat": "和昨天差不多" },
    "en-US": { "up": "Higher than yesterday", "flat": "About the same as yesterday" }
  }
}
```

两件事要知道:

- **任何 flow 文件都可以有顶层 `i18n` 表**,文案写 `${@i18n.key}`,语言分支读 `${@app.language}`;`check` 对 `.df` 的表做与 `.af` 相同的 G8 检查。
- **数据缓存的键含语言**。切完语言,每个组件在新语言下没有落盘数据:先出骨架,取到再显示;离线切语言就没有该语言的数据可显示(走空态 / 错误态),联网后下拉刷新即可。

主题(明暗)不一样:它是纯渲染参数,切主题只重渲、不取数,数据缓存也不分明暗,所以颜色必须写 `浅|深` 双分支。

### 3)两层缓存都按语言分开

同一个组件在两门语言下是两张位图、两份数据(渲染图缓存与数据缓存都按语言分开),这件事 App 已经处理好了。文案在 `.df` 里拼成成品句子,还是只透数字与代码(`group: "clear"`)让 `.rcn` 用 `${@i18n.cond_clear}` 拼,由你自决 —— 两条路切语言后都会更新。

---

## 常见错

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| 屏上出现 `${@i18n.xxx}` 字面量或空白 | 那个 key 在该载体读的表里不存在(`.rcn` 读 rc 表,XPage 节点读页表) | 把 key 补进对应的表,核拼写;`numable check` 的 G8 / G35 会指出 |
| 英文环境下组件标题是中文 | `.xwidget` 少了 `i18n.en-US.title/sub` | 补 B 表,`check` G20 |
| 英文环境下商店组件是中文 | manifest 少了 `i18n.en-US` | 补 B 表,`check` G19(E) |
| 页面标题不跟语言 | 路由标题写成了 `${@i18n.}` + 顶层词表(不求值) | 改成路由对象旁挂 `i18n`,`check` G8(E) |
| 某一门语言整张表不生效 | 门代码不是 BCP-47(写了 `en` 之外的奇怪值)或表不是扁平对象 | `check` G8 会报;门代码写 `en-US` / `zh-CN` |
| 切语言后组件先出骨架、过一会才出数据;离线时空态 | 数据缓存按语言分开,新语言下没有落盘数据,取到再显示;离线就没有该语言的数据可显示 | 预期行为;联网后下拉刷新 |
| 切语言后组件文案没变 | 文案写死在 `.df` 或 `.rcn` 里,没走 `${@i18n.key}`;或数据本来就不随语言变 | 顶层加 `i18n` 表、文案改 `${@i18n.key}`;要按语言取数就在 `.df` 里读 `${@app.language}` |
| 英文组件文字被截断 | 英文更长,而卡宽是固定档位 | 缩短译文,或在 `.rcn` 里给该 `txt` 设 `maxLines` 与更小的 `fontSize` |
| `check` 一条双语报错都不出 | 用的是默认 `personal` 档 | 加 `--profile publish` |

## 下一步

- A 表 / B 表的完整规则与兜底链:`numable docs i18n`
- 组件的画法与文本节点字段:`numable docs rcn`
- 上架前的全闸清单:`numable docs publish`
