# add-interaction —— 加点击与参数编辑

> 读者:做工具的用户,和替他干活的 AI。两者读同一份。

## 目标

让组件从「只能看」变成「能用」。三个场景由浅入深,各自独立,按需要挑:

| 场景 | 用户动作 | 你要写的 | 产出契约 |
|---|---|---|---|
| ① 点组件跑一个流 | 轻点整个组件 | `events.onClick` = 一个 `.af` | 记一笔 / 切一个状态,并让组件立刻变 |
| ② 长按编辑参数 | 长按组件 → 编辑 | `events.onEdit` = 一个 `.af` | 把用户选的值**写回这个组件的实例参数** |
| ③ 收多个字段 | 长按组件 → 一张表单 | `.xform` + `startPageForResult` | 一次收完一组值再写回 |

三个场景共用一套东西:**交互流 `.af`**。它与取数流 `.df` 是两种文件:`.df` 只能取数加工(见 `numable docs df`),`.af` 才有触觉、弹窗、导航、写回、刷新这些能力。

## 前置

- 包里已有一个跑得通的组件;
- 知道这个组件的实例参数名(`.xwidget` 的 `params`);
- `.af` 放 `xWidget/flow/*.af`(组件上用)或 `page/flow/*.af`(页面里用)。**`.xwidget` 与 `xWidget/rc/*.rcn` 里的 `@[file://...]` 基准是 `xWidget/`**,写 `@[file://flow/mark.af]`;页面那边基准是包根。

---

## 场景 ① · 点组件跑一个流

**做什么**:把 `events.onClick` 的值从导航串换成一个 `.af` 引用。值解析出来是字符串 = 导航;是引用 / 内联对象 = 跑流。

`xWidget/today.xwidget`:

```json
{
  "version": 2,
  "title": "今天",
  "sub": "今天喝了几杯",
  "layout": 22,
  "params": {},
  "events": { "onClick": "@[file://flow/drink.af]" },
  "canvas": {
    "source": "@[file://rc/today.rcn]",
    "depends": [ { "flow": "@[file://flow/today.df]", "params": {} } ],
    "refresh": { "interval": ["3600"] }
  }
}
```

`xWidget/flow/drink.af`:

```json
{
  "version": 1,
  "actions": [
    { "action": "ui.haptic" },

    { "id": "cur", "action": "data.get", "params": { "key": "cups", "default": 0 } },

    { "op": "set", "props": { "key": "_b", "value": "1" },
      "_note": "读取屏障:data.get 之后紧邻的节点读不到它的结果,隔一个空 set 再用" },

    { "op": "set", "props": { "key": "c0", "value": "${cur}" },
      "_note": "上游结果先落成 data 域的键 —— 方法参数里的 ${} 只看得见 op:set 落地过的键" },

    { "op": "set", "props": { "key": "next", "value": "$[calc::(${c0}+1)]" } },

    { "action": "data.set", "params": { "key": "cups", "value": "${next}" } },

    { "action": "ui.toast", "params": { "message": "${@i18n.logged}", "type": "success", "duration": 2000 } },

    { "action": "widget.refresh",
      "_note": "写盘之后必须刷新,且排在所有 data.set 之后。scope 缺省 bundle、desktop 缺省 true" }
  ],
  "i18n": {
    "zh-CN": { "logged": "已记下一杯" },
    "en-US": { "logged": "One more cup" }
  }
}
```

七条要点,每条都对应一个静默失效:

| 要点 | 不做的现象 |
|---|---|
| `actions[0]` 恒是 `ui.haptic` | RCN 没有动画,点下去到画面变化之间 ~250ms 全无反馈,用户会再点一次 |
| `data.get` 之后插一个 `op:set` 屏障 | 紧邻节点读到空,后面全算错,流仍报成功 |
| 进方法参数前先 `op:set` 落地 | `$[calc::(${cur}+1)]` 取不到值,算出空 |
| 写盘后接 `widget.refresh`,且在所有 `data.set` 之后 | 数据写进去了,组件还是旧的(渲染图缓存不含数据维度),要等下一个 `interval` 才自愈 |
| `op:if` 的条件键是 `props.val`(不是 `cond`) | 条件恒假、整个分支静默不执行,流照报成功 |
| `concurrent` / `sequential` 写在 `action` 位(不是 `op` 位) | 整块静默跳过 |
| 文案走 `${@i18n.key}` + 流顶层 `i18n` 表 | 英文环境下弹出中文 |

流里能拿到什么:**这个组件的实例参数** + `@i18n`(这条流自己的表)+ `@app`。**没有 `@event`**——整组件点击不带事件负载。

`widget.refresh` 的三档作用域:

```json
{ "action": "widget.refresh", "params": { "scope": "self" } }
```

| `scope` | 刷谁 | 备注 |
|---|---|---|
| `bundle`(缺省) | 本包所有组件 | 只能刷本包,跨包不做 |
| `widget` | `widgetId` 指定的那一种组件的全部实例 | `widgetId` 必填 |
| `self` | 触发这条流的那一个组件 | 需要宿主给出组件身份,整组件 onClick / onEdit 都有 |

语义是「清取数计时 + 真取数 + 重渲」,不是 reload。5 秒内重复调返回 `{refreshed:0}`,是**成功**;匹配 0 个组件也是成功。取数流(`.df`、`depends`)里调它是硬拒的——那会「刷新 → 重跑 depends → 再刷新」自激。

⚠️ **`widget.updateParams` 在整组件 `onClick` 里用不了**:onClick 的流不点亮组件身份,调用会以 `no_brick_context` 让整条流失败。要改这个组件的参数,走场景 ②。

**命令**

```
numable check <包>
```

**看到什么算对**:没有 G30(`op:if` 条件键)、G4b(并发后紧邻引用)类 error。如果这条 `.af` 是绑在 `.rcn` 的某个 cell 上(不是整组件),`check` 还会用 G22 检查 `ui.haptic` 在不在 `actions[0]`(W)。流跑得对不对,只有在 App 里点一下才知道——`run` 只跑 `.df`。

---

## 场景 ② · 长按编辑参数

用户长按仪表盘上的组件 → 「编辑」。这条路的产出契约只有一个:**把值写回这个组件的实例参数**。 这条流和场景 ① 一样能读到这个组件的实例参数,所以 `singleValue` 的 `component.value` 写 `${quote}` 就能预选当前值;用户取消时 `${r.cancelled}` 为 `true`、`${r.value.value}` 为空,判空后不写回即可。打得开、按了没反应,是这条路最常见的失败。

**做什么**:`events.onEdit` 写成 `.af` 引用,流里 `singleValue` 收值、`widget.updateParams` 写回。

`xWidget/now.xwidget` 片段:

```json
"params": { "city": "上海", "lat": "31.2222", "lon": "121.4581" },
"events": {
  "onClick": "numable://self",
  "onEdit": "@[file://flow/edit-city.af]"
}
```

`xWidget/flow/edit-city.af`:

```json
{
  "version": 1,
  "actions": [
    { "action": "ui.haptic" },

    { "id": "r", "action": "singleValue",
      "params": {
        "container": "sheet",
        "title": "${@i18n.title}",
        "desc": "${@i18n.desc}",
        "confirmTxt": "${@i18n.ok}",
        "component": {
          "type": "select",
          "value": "${city}",
          "props": {
            "items": [
              { "label": "上海", "value": "上海" },
              { "label": "北京", "value": "北京" },
              { "label": "广州", "value": "广州" }
            ]
          }
        }
      }
    },

    { "op": "set", "props": { "key": "picked", "value": "${r.value.value}" },
      "_note": "返回形状恒为 {value:{value}, cancelled};先落地再判" },

    { "op": "if", "props": { "val": "$[if::(gt::(length::(${picked}),0),1,0)]" },
      "items": [
        { "action": "widget.updateParams", "params": { "city": "${picked}" } },
        { "action": "ui.toast", "params": { "message": "${@i18n.done}", "type": "success" } }
      ]
    }
  ],
  "i18n": {
    "zh-CN": { "title": "选择城市", "desc": "改这个组件显示的城市", "ok": "确定", "done": "已更新" },
    "en-US": { "title": "Pick a city", "desc": "Change the city on this card", "ok": "OK", "done": "Updated" }
  }
}
```

`singleValue` 要点:

- `container` **必填**:`page` / `sheet` / `dialog`。sheet 恒占容器高的 0.8、dialog 恒 0.6,不随内容伸缩。
- 返回恒为 `{ "value": { "value": <string|string[]|null> }, "cancelled": <bool> }`,读 `${r.value.value}`。
- 判有没有选,用「非空」判据 `gt::(length::(x),0)`,别用 `eq::(x,)` 之类。
- 组件类型有 14 种(`textInput` `numberInput` `datePicker` `timePicker` `colorPicker` `progressBar` `switch` `radio` `checkBox` `select` `imageSelect` `searchSelect` `cascader` `dynamicCascader`),布尔值用字符串 `"true"` / `"false"`。字段细节见 `numable docs params`。

`widget.updateParams` 要点:

- 入参**顶层就是要合并的 params**,不套一层;逐键 merge,值为 `null` = 删这个键、回落 `.xwidget` 里的默认值。
- 值必须是标量,会被标准化成字符串(`1.0` → `"1"`、`true` → `"true"`);传对象或数组整次失败。
- 写回即生效:落盘 + 那个组件重渲。**不用**再补 `widget.refresh`(那是给 `data.*` 写盘用的)。
- 失败以整条流失败告终(`no_brick_context` / `non_scalar_value` / `brick_not_found`),不会返回一个「假成功」。

**onEdit 的另一种形态**是裸路由 path,指向一张能写回的页:

```json
"events": { "onEdit": "/pick" }
```

| 目标 | 怎么写回 | `check` 怎么判 |
|---|---|---|
| html 页 | `xbridge.updateParams(brickId, params)` | 恒过 |
| `.xform` 页 | `onSubmit` 绑定的流里有 `widget.updateParams` | 查那条流 |
| `.xpage` 页 | 任意节点的 `events` 绑定里有 `widget.updateParams`(**不看 `depends`**) | 查那些绑定 |

**命令**

```
numable check <包>
```

**看到什么算对**:以下几条 G12d / G12e 的 error 一条都不出现——

| 报错 | 意思 | 修法 |
|---|---|---|
| `onEdit = numable://…` | onEdit 逐字匹配 `router.json` 的 path,`numable://` 形态匹配不上 → 开出**空白页且不报错** | 改裸 path(`/pick`)或改 af 引用 |
| `onEdit 指向 …,但包里没有 xWidget/…` | af 基准是 `xWidget/` 不是包根 | 改路径 |
| `那条 flow 里没有 widget.updateParams` | 「编辑参数」跑完什么都不会变 | 补写回 |
| `那张页的 … 里没有 widget.updateParams` | 同上,页形态 | 在页里补写回 |

---

## 场景 ③ · 用 `.xform` 收一组字段

一次要改好几个值(名称 + 代码 + 标签),用 `.xform`:它是一张**页**,由 `startPageForResult` 以 page / sheet / dialog 三态之一呈现,提交后把值回灌给发起的流。

### 1)写表单

`page/form/pick.xform`:

```json
{
  "type": "form",
  "id": "form-pick",
  "title": "${@i18n.title}",
  "desc": "${@i18n.desc}",
  "confirmTxt": "${@i18n.ok}",
  "themeColor": "#5DCAA5|#4AB894",
  "onSubmit": "@[file://page/flow/pick-submit.af]",
  "form": {
    "name": {
      "title": "名称",
      "required": "true",
      "component": { "type": "textInput", "props": { "placeholder": "请输入" } }
    },
    "code": {
      "title": "代码",
      "component": {
        "type": "select",
        "value": "NVDA",
        "props": { "items": [
          { "label": "英伟达 NVDA", "value": "NVDA" },
          { "label": "苹果 AAPL", "value": "AAPL" }
        ] }
      }
    }
  },
  "i18n": {
    "zh-CN": { "title": "选择股票", "desc": "改这个组件跟踪的标的", "ok": "确定" },
    "en-US": { "title": "Pick a stock", "desc": "Change what this card tracks", "ok": "OK" }
  }
}
```

四条硬规则:

- **不写 `container`**——三态由调用方 `startPageForResult` 决定,写在文件里那份会被忽略,还会让同一张表在两个入口下不一致;
- `form` 的**键就是结果键**,**声明顺序就是渲染顺序**;
- 字段外壳是 `{ required?, title?, desc?, component: { type, value?, props? } }`,布尔用字符串;
- `searchSelect` / `dynamicCascader` 的 `dataSource` 只接受 `.df` 引用,额外参数写在引用里面(`@[file://page/flow/search.df?market=us]`)。

### 2)登记路由

`page/router.json` 里加一条。⚠️ `form` 页的 `entry` 是**包根相对、自带 `page/` 前缀**,与 html / xpage 不同:

```json
{ "path": "/pick-form", "type": "form", "entry": "page/form/pick.xform", "title": "选择标的" }
```

### 3)提交流:把值交出去

`page/flow/pick-submit.af`:

```json
{
  "version": 1,
  "actions": [
    { "action": "page.setResult",
      "params": {
        "name": "${@event.value.name}",
        "code": "${@event.value.code}"
      }
    }
  ]
}
```

`onSubmit` 的流里,用户填的值在 `@event.value.<字段键>`。`page.setResult` 之后表单关闭并回传;什么都不写 = 表单保持挂着、值还在、可以再提交(用来做校验不通过时留在原地)。

### 4)发起流:开表单 → 写回

`xWidget/flow/edit-stock.af`(挂在 `onEdit` 上):

```json
{
  "version": 1,
  "actions": [
    { "action": "ui.haptic" },

    { "id": "r", "action": "startPageForResult",
      "params": {
        "page": "/pick-form",
        "container": "sheet",
        "params": { "secid": "${secid}" }
      }
    },

    { "op": "set", "props": { "key": "code", "value": "${r.value.code}" } },
    { "op": "set", "props": { "key": "name", "value": "${r.value.name}" } },

    { "op": "if", "props": { "val": "$[if::(gt::(length::(${code}),0),1,0)]" },
      "items": [
        { "action": "widget.updateParams", "params": { "secid": "${code}", "title": "${name}" } }
      ]
    }
  ]
}
```

`startPageForResult` 要点:

| 项 | 说明 |
|---|---|
| `page` | 路由 path,与 `router.json` 里那条逐字对应 |
| `container` | **缺省是 `sheet`**;`page` = 压栈 / `sheet` = 贴底浮层(容器高 0.8)/ `dialog` = 居中浮层(容器高 0.6) |
| `params` | 传给子页的入参 |
| 返回 | 恒为 `{ value, cancelled }`;取消(✕ / ‹ / 点遮罩 / 系统返回)= `{ value: null, cancelled: true }`,不经 `onSubmit` |
| 页型 | `xpage` / `html` / `form` 三型通吃 |

`html` 子页返回值用桥:`xbridge.setResult(payload)` / `xbridge.closePage()`。

**命令**

```
numable check <包>
```

**看到什么算对**:`check` 无 error;路由 `/pick-form` 存在且 `type` 是 `form`;`onEdit` 那条流里能找到 `widget.updateParams`(G12e)。表单长什么样、能不能提交,在 App 里点一遍。

---

## 常见错

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| 点了完全没反应 | `onClick` 写成了裸 flow 名字符串(既不是导航串也不是 `@[file://...]` 引用) | 改成 `@[file://flow/x.af]` |
| 点了没反应,且只发生在组件上 | `.af` 路径基准写成了包根 | 组件上的引用基准是 `xWidget/` |
| 分支里的动作一个都没执行,流却报成功 | `op:if` 写了 `cond` 而不是 `props.val` | 改 `props.val`,`check` G30 拦(E) |
| 数据写进去了,组件上不变 | 少了 `widget.refresh`,或它排在某个 `data.set` 前面 | 移到所有写盘之后 |
| 「编辑」打得开,选完什么都没变 | 流里没有 `widget.updateParams` | 补上;`check` G12e 拦(E) |
| 长按编辑开出一张空白页 | `onEdit` 写成 `numable://` 形态 | 改裸 path;`check` G12d 拦(E) |
| 整条流以错误告终,提示 `no_brick_context` | 在整组件 `onClick` 里调了 `widget.updateParams`(它不点亮组件身份) | 改挂 `onEdit` |
| 表单在一个入口是浮层、另一个入口是整页 | `.xform` 文件里写了 `container` | 删掉,由 `startPageForResult` 决定 |
| 用户点了取消,组件却被清空了 | 没判 `cancelled` / 没判空就写回 | 写回前加非空判据 |
| 流跑到一半停住 | 事件流有 15 秒硬超时;等用户的动作(`nav.open` / `startPageForResult` / `singleValue`)会暂停计时,别的长耗时动作不会 | 把耗时的事拆进 `.df`,或先 `ui.showLoading` |
| 弹出的文案是中文,英文环境也是 | 文案硬编码,没走 `${@i18n.key}` | 加流顶层 `i18n` 表 |

## 下一步

- `.af` 的完整 action 全表与格式:`numable docs af`
- 表单组件 14 种字段与参数模型:`numable docs params`
- 页面三型与路由:`numable docs page`
