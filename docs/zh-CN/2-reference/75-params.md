# params —— 参数与用户可编辑字段

> 读者:做工具的用户,和替他干活的 AI。两者读同一份。

## 它是什么

同一个组件,张三加了一份看茅台、李四加了一份看英伟达 —— 差别就在 **params**:组件声明里写默认值,每个组件实例各持一份自己的值,用户可以改。

params 有三件事要接:**声明**(`.xwidget` 里写默认值)、**使用**(把值交给取数流和渲染)、**修改**(给用户一个改的入口,并把新值写回)。三件缺一件的症状都很像「没坏但没用」:声明了不传 → 组件渲一片 `--`;传了不给入口 → 用户加完组件就再也换不了标的,只能删了重加。

改参数的界面不用自己画 —— 平台提供两套现成的输入 UI:单值选择(`singleValue`)和多字段表单(`.xform`),共 14 种字段类型。也可以写一张 H5 页自己画。

## 最小可用示例

一个带参数、可编辑的组件(`.xwidget` 外壳部分):

```json
{
  "version": 2,
  "title": "个股",
  "sub": "价格 · 两个月形状",
  "layout": 22,
  "params": { "secid": "1.600519", "alias": "贵州茅台" },
  "events": {
    "onClick": "/detail?secid=${secid}",
    "onEdit": "/edit?ref=quote&secid=${secid}"
  },
  "canvas": {
    "source": "@[file://rc/quote.rcn]",
    "depends": [
      { "flow": "@[file://flow/quote.df]", "params": { "secid": "${secid}", "alias": "${alias}" } }
    ]
  }
}
```

对应的编辑页(`page/html/edit/index.html`,路由 `/edit`)里,写回只有一行:

```js
var brickId = new URLSearchParams(location.search).get('brickId') || '';
xbridge.updateParams(brickId, { secid: '1.000001', alias: '平安银行' });
```

## 怎么写

### 声明:`.xwidget` 的 `params`

```json
"params": { "secid": "1.600519", "alias": "贵州茅台", "mask": "0" }
```

- **只能是标量**(字符串 / 数字 / 布尔),不能嵌对象或数组。多选的结果也要拍平成一个串。
- 这里写的是**默认值**:用户新加一个组件时从它起步。
- **默认值不本地化**。`params` 里没有 `i18n` 旁挂表,也不要在默认值里写 `${@i18n.x}`:params 是**数据**(取数的入参),不经词表求值,写进去的 `${@i18n.x}` 就是那串字面量。默认值写业务值(代码、城市 id、开关 `"0"`),要随语言变的文字住 `.rcn` 或 `.df` 的文案表(`numable docs i18n`);要按语言取数,在 `.df` 里直接读 `${@app.language}`,不用把语言塞进 params。
  想让组件上那个名字跟着语言变,做法是:params 只存一个稳定的 code,`.df` 把 code 透出来,`.rcn` 里按 code 在两个文案 key 之间挑:`"$[if::(eq::(${code},us),${@i18n.nameUs},${@i18n.nameCn})]"`。
- 键名不要像密钥。用户自带的密钥走 `manifest.credentials`,不是 params(`numable docs layout`)。

### 三层值:默认值 / 实例值 / 流输出

从低到高:

1. **`.xwidget` 里的默认值** —— 用户没改过时用它;
2. **这个组件实例自己的值** —— 用户改过的键覆盖默认值(删掉某个键就回落默认);
3. **取数流的输出** —— 上面两层合并出的值是**取数的入参**;RCN 真正看得见的是这一层,`${}` 取的就是它。

⚠️ 有一条很容易踩空:**外壳 params 不在 RCN 的渲染域里**。RCN 只看得见取数流 `resultFilter` 透出的键。所以「不参与取数、但要显示在组件上」的键(别名、城市名)也必须走一趟流:传进去 → 在流里落地 → 透出来。少这一趟,那一格恒空或恒走兜底,不报错。

### 使用:params 怎么进 `.df`

**绑定处显式声明**,一个键一个键写:

```json
"depends": [ { "flow": "@[file://flow/quote.df]", "params": { "secid": "${secid}" } } ]
```

裸字符串绑定(`"depends": ["@[file://flow/quote.df]"]`)传的是**空入参**,流里的 `${secid}` 取到空、请求打成 `?secid=`,而流仍然报成功。

流里用**顶层裸名**取,不是 `${params.secid}`:

```json
{ "op": "set", "props": { "key": "k", "value": "$[findNotEmpty::(${secid},1.600519)]" } }
```

而且入参进流的第一件事就是像上面这样 `op:set` 落地一次 —— 方法参数里的 `${}` 看不见 flow 入参,只看落地过的键。

XPage 的路由 query 进根节点 params、`.xform` 的 `onSubmit` 参数,规则完全一样:**要什么就显式传什么**。

### 修改:给用户一个入口

入口只有一个:`.xwidget` 的 `events.onEdit`(长按组件 →「编辑参数」)。目标有三条路,选一条:

| 路 | 怎么写 | 适合 |
|---|---|---|
| ① H5 页 | `"onEdit": "/edit?ref=quote&secid=${secid}"`,页里调 `xbridge.updateParams` | 需要搜索、列表、自定义排版的编辑器 |
| ② 表单页 | `"onEdit": "/edit"` 指向一条 `type: "form"` 的路由,`.xform` 的 `onSubmit` 流里调 `widget.updateParams` | 几个字段填一填就完事 |
| ③ 交互流 | `"onEdit": "@[file://flow/edit.af]"`,流里 `singleValue` 收一个值再 `widget.updateParams` | 只改一个值,连页面都不用建 |

三条路的共同点:

- 走路由时 `onEdit` **必须是裸 path**(`/edit`),不能写 `numable://…` —— 它拿去跟 `router.json` 逐字匹配,写成 deeplink 会打开一个空白页且不报错。这一点跟 `onClick` 不同。
- **当前值只能靠插值带过去**(`?secid=${secid}`):没有「读实例参数」的接口。
- **`brickId` 由容器自动补进目标页的 query**,页面直接读就行,不用自己传。
- **只有 `onEdit` 这条路能写回**。整组件 `onClick` 的流没有绑定的组件实例,里面调 `widget.updateParams` 会直接失败;取数流里更是结构性拒绝(在 depends 里改参数会「改 → 重渲 → 再改」自激)。

### 写回:`widget.updateParams` 的合同

AF 里:

```json
{ "action": "widget.updateParams", "params": { "secid": "${picked.value.code}", "alias": null } }
```

H5 里(同一套语义的另一个外观):

```js
xbridge.updateParams(brickId, { secid: '1.000001', alias: null });
```

| 规则 | 说明 |
|---|---|
| 顶层就是要写的 params | 不套 `{params:{…}}` 这一层;AF 里 `brickId` 由宿主给,不用也不能自己传 |
| **merge,不是替换** | 只动你写出来的键,其它键原样保留 |
| `null` = 删键 | 删掉之后那个键回落 `.xwidget` 里的默认值 = 「恢复默认」 |
| 值只收标量 | 数字与布尔按标准形转串(`1.0` → `"1"`,`true` → `"true"`);对象或数组会让整次调用失败 |
| 校验先于写入 | 任何一个键非法,整次调用失败,**不写一半** |
| 返回合并后的全量 params | AF 里是 `{ params }` |
| 改即生效 | 写回后组件自动重渲,壳上的「完成」只负责关闭页面 |

一次把该改的键**一起写**。比如换城市要同时写 `lat`/`lon`/`city`:只写坐标不写名字,组件上会显示旧城市名配新城市的数字 —— 比不生效更糟。

### 单值输入:`singleValue`

不用建页面,一步收一个值:

```json
{
  "action": "singleValue",
  "id": "r",
  "params": {
    "container": "sheet",
    "title": "选择股票",
    "desc": "改完立即生效",
    "confirmTxt": "确定",
    "themeColor": "#5DCAA5|#4AB894",
    "component": {
      "type": "select",
      "value": "${secid}",
      "props": { "items": [
        { "label": "贵州茅台", "value": "1.600519" },
        { "label": "平安银行", "value": "0.000001" }
      ] }
    }
  }
}
```

- `container` **必填**:`page` / `sheet` / `dialog`。
- 返回 `{ "value": { "value": <string | string[] | null> }, "cancelled": <bool> }`,所以读的是 `${r.value.value}`。
- 只收一个值。要收多个字段用 `.xform`。

`params` 的完整形状(六个键,除 `container` 与 `component` 外都可省):

| 键 | 必填 | 说明 |
|---|---|---|
| `container` | 是 | `page` / `sheet` / `dialog` |
| `component` | 是 | 一个字段,形状与 `.xform` 里的 `component` 完全相同(下表 14 种) |
| `title` | 否 | 浮层标题 |
| `desc` | 否 | 标题下的一行说明 |
| `confirmTxt` | 否 | 确认钮文案,不写用平台默认 |
| `themeColor` | 否 | 强调色,支持 `浅\|深` 两段 |

一个把六个键都写满的例子(收一个开关):

```json
{
  "action": "singleValue",
  "id": "r",
  "params": {
    "container": "dialog",
    "title": "${@i18n.maskTitle}",
    "desc": "${@i18n.maskDesc}",
    "confirmTxt": "${@i18n.ok}",
    "themeColor": "#5DCAA5|#4AB894",
    "component": {
      "type": "switch",
      "label": "${@i18n.maskLabel}",
      "value": "${mask}",
      "props": {}
    }
  }
}
```

### 多字段表单:`.xform`

`page/form/pick.xform`,并在 `router.json` 里给它一条 `"type": "form"` 的路由:

```json
{
  "type": "form",
  "id": "form-pick-stock",
  "title": "选择股票",
  "desc": "改完点确定",
  "confirmTxt": "确定",
  "themeColor": "#5DCAA5|#4AB894",
  "onSubmit": { "flow": "@[file://page/flow/save.af]", "params": { "brickId": "${brickId}" } },
  "form": {
    "code": {
      "title": "代码",
      "required": "1",
      "component": {
        "type": "select",
        "value": "NVDA",
        "props": { "items": [
          { "label": "英伟达 NVDA", "value": "NVDA" },
          { "label": "苹果 AAPL", "value": "AAPL" }
        ] }
      }
    },
    "alias": {
      "title": "组件上显示的名字",
      "component": { "type": "textInput", "props": { "placeholder": "留空则用代码" } }
    }
  }
}
```

四条硬规则:

1. **文件里不写 `container`** —— 以什么形态呈现由调用方(`startPageForResult`)决定,同一份表单能被 page / sheet / dialog 三态复用。
2. `form` 的**键就是结果键**,**声明顺序就是渲染顺序**。
3. `dataSource` 只接受 `.df` 引用,额外参数写在引用串里面:`"dataSource": "@[file://page/flow/search.df?market=us]"`。
4. 主题外壳由平台给,只有强调色跟着 `themeColor`;它支持 `浅|深` 两段(`"#5DCAA5|#4AB894"`),单值 = 明暗同色。⚠️ 这个两段写法**只圈 `themeColor`**:`colorPicker` 的 `value` / `recommended` 是用户要选的内容色,写 `#FF0000` 就是 `#FF0000`,不会被当成两段劈开。

`onSubmit` 绑定的流里,用户填的值在 `${@event.value}` 里(一个「字段名 → 值」的对象),照着写回:

```json
{ "action": "widget.updateParams", "params": { "secid": "${@event.value.code}", "alias": "${@event.value.alias}" } }
```

### 14 种字段类型

字段外壳恒为 `{ required?, title?, desc?, component: { type, label?, desc?, value?, disable?, props? } }`。布尔值一律用字符串 `"true"` / `"false"`。

| `type` | 值的形状 | 一句话 |
|---|---|---|
| `textInput` | 串 | 自由文本;要限长、限行、按正则校验都在这里 |
| `numberInput` | 串 | 带范围与步进的数字 |
| `datePicker` | 串 | 日期,按 `format` 存成串 |
| `timePicker` | `HH:mm` | 时间 |
| `colorPicker` | 串 | 预设色 + 自定义 |
| `progressBar` | 串 | 滑杆选数 |
| `switch` | `"true"` / `"false"` | 开关 |
| `radio` | 串 | 一组里选一个 |
| `checkBox` | 数组 | 一组里选多个 |
| `select` | 串(可多选时是数组) | 下拉 |
| `imageSelect` | 数组 | 传图,记得配 `compress` |
| `searchSelect` | 串 | 带搜索的选择,可接远程 |
| `cascader` | 串 | 一次写全的层级选择 |
| `dynamicCascader` | 串 | 逐层去取的层级选择 |

**每个类型接受哪些 `props`、每个 `props` 是什么意思、缺省是什么 —— 见 `numable docs form-fields`**(那张表由表单引擎自己生成,不会和代码分叉)。下面只讲怎么用它们。

`items` 的每一项都是 `{ label?, value, image? }`(`value` 必填;`image` 给选项配图)。级联的项多两个键:`children[]` 是下一层,`isLeaf` 标它是不是末级 —— **动态级联靠 `isLeaf` 判断还要不要再问一层**,漏了会一直请求下去。

多值字段(`checkBox` / `imageSelect`)拿回来是真数组;而 params 只收标量,写回前先 `join::` 成一个串。

#### 校验:填错了当场拦住

表单在**提交那一刻**逐字段校验,不合格就停下、把那一格标红并显示一句话,不会把脏值写出去。校验全靠上表那几个 props,不用自己在流里判:

| props | 管哪些字段 | 判据 |
|---|---|---|
| `required` | 全部(写在**字段外壳**上,不是 `props` 里) | 空值拦住 |
| `maxLength` | `textInput` | 字符数上限 |
| `maxLines` | `textInput` | 行数上限(按换行数算) |
| `pattern` + `errorMessage` | `textInput` | 正则不匹配就拦住,提示语用 `errorMessage`;不写 `errorMessage` 用平台默认的「格式不正确」 |
| `min` / `max` | `numberInput` · `progressBar` | 数值区间(闭区间,两头都取得到) |
| `decimal` | `numberInput` · `progressBar` | 小数位上限;`decimal: "0"` = 只收整数 |
| `min` / `max` | `datePicker` | 日期区间,**按该字段自己的 `format` 解析**,所以要写成和 `format` 同一个样子 |
| `minCount` / `maxCount` | `checkBox` · `select` · `cascader` · `imageSelect` | 选中个数区间 |

```json
{
  "required": "true",
  "title": "邮箱",
  "component": {
    "type": "textInput",
    "props": {
      "placeholder": "you@example.com",
      "maxLength": "64",
      "pattern": "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
      "errorMessage": "看起来不像一个邮箱地址"
    }
  }
}
```

⚠️ **`pattern` 空值是放行的** —— 它只管「填了的内容对不对」,不管「填没填」。要求必填得同时写 `"required": "true"`,两件事两个开关。

⚠️ **`pattern` 有两种写法**:直接写正则本身(`"^\\d{6}$"`),或者带斜杠和修饰符(`"/^abc$/i"`)。写坏的正则**不会报错,而是判定为不匹配** —— 现象是「怎么填都过不去」,先把正则拿去单独试一下。

⚠️ 校验只在**提交**时跑,输入过程中不拦;所以 `maxLength` 不是「打不进去更多字」,是「超了不让提交」。

#### 图片压缩:`compress`

`imageSelect` 的 `compress` 是个对象,不写就原图上传(照片动辄几 MB,会把写回撑爆):

| 键 | 说明 |
|---|---|
| `targetSizeKB` | 目标体积(KB),压到不超过它为止 |
| `maxLongSide` | 长边像素上限,**小于 320 按 320 算** |
| `minQuality` / `maxQuality` | 质量区间,0–1 的小数(缺省 `0.55` / `0.9`);两个写反了会自动摆正 |
| `format` | `auto`(缺省)/ `jpeg` / `png` |
| `alphaPolicy` | `preserve`(缺省,保留透明)/ `drop`(丢掉透明,压得更小) |
| `failPolicy` | 压不到目标体积时怎么办:`use_min_quality`(缺省,用最低质量那版)/ `keep_original`(原图) |

```json
{ "type": "imageSelect", "props": {
    "maxCount": "3", "imageAccept": "image/*",
    "compress": { "targetSizeKB": "300", "maxLongSide": "1600", "format": "jpeg" } } }
```

#### 14 种各一个最小写法

下面每一段都是一个完整的 `component`,直接贴进 `.xform` 的字段里(或贴进 `singleValue` 的 `params.component`):

```json
{
  "f01": { "title": "文本", "component": {
    "type": "textInput", "value": "hello", "props": { "placeholder": "请输入" } } },
  "f02": { "title": "数字", "component": {
    "type": "numberInput", "value": "8", "props": { "min": "0", "max": "100", "step": "1" } } },
  "f03": { "title": "日期", "component": {
    "type": "datePicker", "value": "2026-06-30", "props": { "format": "YYYY-MM-DD" } } },
  "f04": { "title": "时间", "component": {
    "type": "timePicker", "value": "09:30" } },
  "f05": { "title": "颜色", "component": {
    "type": "colorPicker", "value": "#1677FF",
    "props": { "recommended": ["#1677FF", "#34C759", "#FF9500"] } } },
  "f06": { "title": "滑杆", "component": {
    "type": "progressBar", "value": "40", "props": { "min": "0", "max": "100", "step": "1" } } },
  "f07": { "title": "开关", "component": {
    "type": "switch", "value": "true" } },
  "f08": { "title": "单选", "component": {
    "type": "radio", "value": "a",
    "props": { "items": [{ "label": "选项 A", "value": "a" }, { "label": "选项 B", "value": "b" }] } } },
  "f09": { "title": "多选", "component": {
    "type": "checkBox", "value": ["a"],
    "props": { "items": [{ "label": "选项 A", "value": "a" }, { "label": "选项 B", "value": "b" }],
               "minCount": "0", "maxCount": "2" } } },
  "f10": { "title": "列表选择", "component": {
    "type": "select", "value": "b",
    "props": { "items": [{ "label": "选项 A", "value": "a" }, { "label": "选项 B", "value": "b" }] } } },
  "f11": { "title": "图片", "component": {
    "type": "imageSelect", "value": [], "props": { "maxCount": "2", "imageAccept": "image/*" } } },
  "f12": { "title": "搜索选择", "component": {
    "type": "searchSelect", "value": "",
    "props": { "placeholder": "输入关键字",
               "dataSource": "@[file://page/flow/search.df?market=us]" } } },
  "f13": { "title": "静态级联", "component": {
    "type": "cascader", "value": "",
    "props": { "items": [{ "label": "一级", "value": "l1",
                           "children": [{ "label": "二级", "value": "l2" }] }] } } },
  "f14": { "title": "动态级联", "component": {
    "type": "dynamicCascader", "value": "",
    "props": { "dataSource": "@[file://page/flow/area.df]",
               "initialItems": [{ "label": "一级", "value": "l1", "isLeaf": false }] } } }
}
```

几个容易写错的地方:

- **布尔一律写字符串**:`"value": "true"`、`"minCount": "0"`、`"isLeaf": false` 是 `items` 里的真布尔(它不是字段值,是选项数据)。
- `select` 的多选、`checkBox`、`imageSelect` 回来是数组,其余都是串;`timePicker` 恒 `HH:mm`。
- `radio` / `checkBox` / `select` / `cascader` 的 `items` 元素是 `{label, value}`(可选 `image`),`cascader` 多一个 `children`。**`value` 是必须的**,只写 `label` 那一项选不中。
- `value` 里可以插值把当前值带进来:`"value": "${secid}"`(`.xform` 由 `startPageForResult` 的 `params` 供值,`singleValue` 由所在流的作用域供值)。

#### 两个要取数的字段:`dataSource`

`searchSelect` 与 `dynamicCascader` 的选项来自一条 `.df`,平台按需调用它:

| 字段 | 什么时候调 | 流里能看见什么 |
|---|---|---|
| `searchSelect` | 用户输入关键字后 | `${@event.keyword}` |
| `dynamicCascader` | 每展开一层 | `${@event.path}`(已选值的数组)、`${@event.level}`(= 层号,从 0 起) |

```json
{
  "version": 1,
  "actions": [
    { "op": "set", "props": { "key": "kw", "value": "${@event.keyword}" } },
    { "id": "resp", "action": "request", "params": {
      "url": "https://api.example.com/search?q=${kw}&market=${market}", "formatType": "json" } },
    { "op": "set", "props": { "key": "items", "value": "${resp.list}" } },
    { "action": "resultFilter", "params": { "keys": ["items"] } }
  ]
}
```

- 流的输出要么是 `{"items": [...]}`,要么直接是一个数组;元素形状 = `{label, value}`(级联另可带 `isLeaf` / `children`)。**`value` 为空的元素会被丢掉。**
- `.df` 只看得见 `@event` 和**引用串里显式带的 query**(上面的 `?market=us` 进来就是顶层的 `${market}`),看不见页面上别的字段。
- 引用只能是 `@[file://…df]`。写成裸 URL 或 `.af`,平台直接拒绝,表现是「搜了没有任何结果、也不报错」。
- 同一组入参在 250 毫秒内重复触发会复用上一次的结果,不会连打请求。

### 返回值恒为 `{ value, cancelled }`

不管子页是 `xpage` / `html` 还是 `form`,`startPageForResult` 拿回来的都是这个形状:

| 子页里发生了什么 | 结果 |
|---|---|
| 流里 `page.setResult({…})` | 关闭并回传,`cancelled: false` |
| 流里 `page.close()` | 关闭,`cancelled: true` |
| 用户点 ✕ / ‹ / 遮罩 / 系统返回 | 不经 `onSubmit`,直接 `{ value: null, cancelled: true }` |
| 什么都没写 / 流失败 | 表单保持打开、填的值还在,可以再交一次 |

所以读之前先看 `cancelled`,别拿 `null` 去写回。

## 规则(违反 = 返工)

| 规则 | 检查方式 | 违反时的现象 | 修法 |
|---|---|---|---|
| 带 `params` 的组件都要有 `onEdit` | 人审 | 用户加完组件再也换不了标的,只能删了重加 | 加一条编辑入口 |
| `onEdit` 走路由必须是裸 path 且在 `router.json` 里;走流必须是包内存在的 `.af`、禁 `..` | `check` G12d | 点了没反应,或打开空白页且不报错 | 写 `/edit` 这种裸 path |
| `onEdit` 的目标必须真的能写回 | `check` G12e | 页打得开、按了什么都不变 | html 调 `xbridge.updateParams`;`.xform` 的 `onSubmit` 流 / XPage 的 `events` 里调 `widget.updateParams` |
| 要给取数流的 params 在 `depends` 绑定处逐键显式写 | `check` G12c | 组件渲一片 `--`,而流报成功 | 写成 `{flow, params}` |
| 组件上要显示的键必须由 `.df` 的 `resultFilter` 透出 | `check` G28 | 那一格恒空或恒走兜底 | 传进流、落地、透出 |
| `params` 键名不像密钥(`token`/`secret`/`api_key`…) | `check` G18 | 密钥进明文回显面与分享截图 | 走 `manifest.credentials` |
| params 的值只有标量 | run 层(写回时整次失败) | 参数没写进去,链路却看着正常 | 数组先 `join::` 成串 |
| 一次把相关的键一起写 | 人审 | 名字是旧的、数字是新的 | 同一次调用里写全 |
| `widget.updateParams` 只在 `onEdit` 这条路上调 | run 层(报 `no_brick_context`) | 流直接失败 | 从 `onEdit` 进来 |
| `searchSelect` / `dynamicCascader` 的 `dataSource` 只写 `@[file://…df]` | 人审(打开表单搜一次) | 搜索框搜不出任何结果,且不报错 | 换成包内 `.df` 引用,额外参数写在 `?` 后面 |
| `.xform` 文件里不写 `container` | 人审 | 呈现形态被写死,三态壳复用不了 | 删掉这个键 |
| 读子页结果前先看 `cancelled` | 人审 | 用户点了取消,却把 `null` 写了回去 | 判 `cancelled` 再写 |

## 出错怎么办

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| 编辑页打开了,改完组件纹丝不动 | 页面根本没调写回;或 `brickId` 没取到 | 页里确认 `xbridge.updateParams` 被调到,`brickId` 从 query 里读 |
| 长按「编辑参数」打开一个空白页 | `onEdit` 写成了 `numable://…`,或路由不在 `router.json` 里 | 改裸 path,对照路由表 |
| 写回报错、整次没生效 | 某个键的值是数组或对象 | 拍平成串;校验是全有或全无 |
| 组件上名字是旧的、数字是新的 | 写回时漏了显示用的那个键 | 相关键一起写 |
| 组件上某个键恒空,`run` 却是对的 | 那个键没进 `resultFilter`(外壳 params 不在渲染域) | 走一趟流再透出 |
| 表单交上去没反应 | `onSubmit` 的流失败了(表单会保持打开) | `numable run` 单跑那条 `.af`,看它在哪一步断 |
| 用户点取消后参数被清空 | 没判 `cancelled` 就写回 | 先判 |

## 相关

`numable docs xwidget` · `numable docs af` · `numable docs page`
