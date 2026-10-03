# rcn —— 组件的画法(.rcn)

> 读者:做工具的用户,和替他干活的 AI。两者读同一份。

## 它是什么

`.rcn` 是一个组件的画法。它不取数、不跳转,只回答一件事:**拿到这些值,画成什么样**。数据从 `.df` 来(见 `numable docs df`),尺寸档位由 `.xwidget` 的 `layout` 决定(见 `numable docs xwidget`),`.rcn` 只负责把值摆到像素上。

它是一份平铺的节点数组:`cells` 里每个对象是一个节点,按数组顺序绘制,**后面的画在上面**。节点之间靠 `id` 与锚点表达式互相定位,没有自动布局、没有 flex、没有动画。画出来的结果是一张**位图**——App 把它缓存起来贴到仪表盘和桌面小组件上,所以它必须在浅色、深色、以及「一个字段都没取到」三种情况下都成立。

一个组件至少要有一个 `.rcn`。同一个包的多个组件各写各的 `.rcn`,不共享节点,也不互相引用。

## 最小可用示例

一张 `22` 档(158×158pt)榜单组件的画法:

```json
{
  "rc": {
    "cells": [
      {
        "id": "bg",
        "type": "layer",
        "x": "0pt", "y": "0pt",
        "w": "{parent.w}", "h": "{parent.h}",
        "bgColor": "#FFFFFF|#15171A"
      },
      {
        "id": "brand",
        "type": "txt",
        "x": "12pt", "y": "12pt",
        "w": "90pt", "h": "-1",
        "maxLines": "1",
        "text": "${@i18n.brand}",
        "fontSize": "9pt",
        "typeface": "System-Bold",
        "textColor": "#6B7280|#8E939B"
      },
      {
        "id": "title",
        "type": "txt",
        "x": "12pt", "y": "32pt",
        "w": "134pt", "h": "-1",
        "maxLines": "3",
        "lineSpacing": "3pt",
        "text": "$[findNotEmpty::(${t0},${@i18n.empty})]",
        "fontSize": "13pt",
        "typeface": "System-Bold",
        "textColor": "#0E1116|#F3F4F6"
      },
      {
        "id": "heatTr",
        "type": "line",
        "points": "[1.5,1.5,132.5,1.5]",
        "x": "12pt", "y": "108pt",
        "w": "134pt", "h": "3pt",
        "lineWidth": "3pt", "lineCap": "round",
        "strokeColor": "#D6DAE1|#2C313A"
      },
      {
        "id": "heat",
        "type": "line",
        "points": "[1.5,1.5,$[findNotEmpty::(${b0},1.5)],1.5]",
        "x": "12pt", "y": "108pt",
        "w": "134pt", "h": "3pt",
        "lineWidth": "3pt", "lineCap": "round",
        "strokeColor": "#FF6600|#FF8A3D"
      },
      {
        "id": "pts",
        "type": "richText",
        "x": "12pt", "y": "118pt",
        "w": "80pt", "h": "-1",
        "maxLines": "1",
        "spans": [
          { "text": "$[findNotEmpty::(${p0},--)]", "fontSize": "19pt", "typeface": "System-Bold", "textColor": "#0E1116|#F3F4F6" },
          { "text": "${@i18n.pts}", "fontSize": "10pt", "textColor": "#6B7280|#8E939B" }
        ]
      }
    ],
    "i18n": {
      "zh-CN": { "brand": "HACKER NEWS", "pts": " 分", "empty": "暂无热榜数据" },
      "en-US": { "brand": "HACKER NEWS", "pts": " pts", "empty": "No stories" }
    }
  }
}
```

字段注解(对应上面的行):`layer` 铺满整组件当底 · `h: "-1"` = 按内容自适应 · `${@i18n.brand}` 取本文件 `rc.i18n` 里的文案 · `$[findNotEmpty::(…)]` 给取数结果兜底 · `line.points` 是相对本节点 `x/y` 的坐标串 · `points` 里的动态值也要兜底,否则空态整个组件渲不出 · `richText` 让「19pt 数字 + 10pt 单位」在一行里对齐 · `i18n` 是本文件自带的文案表。

顶层只有 `rc` 一个键(可以再加一个 `_note` 放说明),`rc` 下只有 `cells` 与 `i18n`。**没有 `scene`**——画布尺寸不写在这里,由组件的 `layout` 档位给。

## 三类表达式,严格分工

这是 `.rcn` 里最容易出事的一块。三种写法由**三个不同的求值器**处理,互相看不见对方:

| 写法 | 是什么 | 只能出现在 |
|---|---|---|
| `{title.b}` `{parent.w}` | **布局锚点**:引用另一个节点的几何 | 几何字段:`x` `y` `w` `h` `maxWidth` `maxHeight` |
| `${key}` `${@i18n.k}` `${@app.language}` | **取值**:取数流输出、文案表、内置量 | 任何字符串字段 |
| `$[method::(…)]` | **方法计算** | 内容/颜色/`hide` 等字段;**几何字段用不了** |

### `{}` 布局锚点

六个锚点:`x`(左)`y`(上)`w`(宽)`h`(高)`r`(右边缘)`b`(下边缘)。`parent` 只有 `x/y/w/h`。

几何字段里**允许**算术:`+ - * / %` 和括号。

```
"x": "{icon.r}+6pt"
"y": "{title.b}+8pt"
"x": "({parent.w}-{badge.w})/2"
"w": "{parent.w}-24pt"
```

`h: "-1"` = 高度按内容自适应(`txt` 最常用);`w: "-1"` 同理,是做「宽度跟着文字走」的胶囊的关键。

### `${}` 取值

渲染域 = **这个组件的 `.df` 通过 `resultFilter` 透出的键** ⊕ 内置量 `@app.*` / `@i18n.*`。

`.xwidget` 里给 `depends` 的 `params` **不在渲染域内**:它是取数的入参,不是渲染的变量。要在组件上显示某个参数,得让它经 `.df` 走一圈——`depends.params` 传进去,`.df` 里落地成键,`resultFilter` 透出来,`.rcn` 才取得到。`check` 会拦(G28)。

### `$[]` 方法

```
"text": "$[findNotEmpty::(${p0},--)]"
"hide": "$[if::(eq::(${apiOk},1),0,1)]"
```

三条硬约束:

1. **几何字段不能写 `$[]`**。写了整个组件渲成空白,没有报错。要用方法算尺寸,先在 `.df` 里算成变量,这里写 `"${_w}pt"`。
2. **`{}` 与 `$[]` 不互嵌**。`$[calc::({parent.w}-20)]` 这个节点会静默不画——锚点是另一个求值器的东西,方法看不见它。
3. **方法嵌套裸写**,内层不加 `$[`:`"$[if::(eq::(${a},1),X,Y)]"` 里的 `eq::` 前面没有 `$[`。嵌了两层,`$[` 会原样画进画面。`check` 会拦(G28)。

方法全表见 `numable docs methods`。**未注册的方法静默求空**(比如没有 `abs::`),写错方法名的表现是那一处什么都不显示。

## 节点类型

十种。字段全表见 `numable docs rcn-nodes`,这里只给「是什么 + 不给就白画的字段」。

| type | 用途 | 至少要给 |
|---|---|---|
| `layer` | 纯色块:卡底、分区底板、胶囊底、分隔线 | `bgColor`(或 `color`) |
| `group` | 容器,把子节点装进 `children`,配 `clip` 做圆角裁切 | — |
| `txt` | 单段文字 | `text` `fontSize` `textColor` |
| `richText` | 一行里混字号/混色 | `spans[]`,每 span 至少 `text` `fontSize` `textColor` |
| `img` | 远程或包内图片 | `url`(不写 `scaleType` 就是 `centerCrop`,要完整装入得显式写 `fitCenter`) |
| `line` | 折线、进度条、迷你走势 | `points` `lineWidth` `strokeColor` |
| `curves` | 同 `line`,但平滑成曲线 | 同上 |
| `arc` | 圆环 / 扇形进度 | `startAngle` `sweepAngle` `lineWidth` + 颜色 |
| `path` | SVG 路径,图标就用它 | `d` `viewBox` + `fillColor` 或 `strokeColor` |
| `op` | 控制流,不画东西 | `action` + `props` |

常用通用字段:

| 字段 | 类型 / 单位 | 说明 |
|---|---|---|
| `type` | 枚举,**必填** | 缺了不是这一格不画,是**整个组件失败** |
| `id` | 字符串 | 画布内唯一;别的节点靠它锚定 `{id.r}`。不被引用的节点可以不写 |
| `x` `y` `w` `h` | 尺寸串,`pt` | `-1` = 自适应 |
| `maxWidth` `maxHeight` | `pt` | 给自适应节点封顶 |
| `paddingLeft/Right/Top/Bottom` | `pt` | 做胶囊时靠它撑出内边距 |
| `hide` | `"0"` 显示 / `"1"` 隐藏但占位 / `"2"` 隐藏且不占位 | 数据驱动的显隐一律用它,**不是 `visibility`** |
| `bgColor` | Paint | 所有节点都有 |
| `cornerRadius` | **对象** `{"leftT","leftB","rightT","rightB"}` | 写成字符串整组件失败 |
| `borderColor` + `borderWidth` | Paint + `pt` | 缺一个就整条边不可见 |
| `alpha` | `0`~`1`,默认 `1` | |
| `clip` | `"1"` 裁 / `"0"` 不裁 | 圆角要裁住子节点必须写 `"1"`;写 `"true"` 不认,等于没开 |
| `zIndex` | 数字串 | 一般不用,靠数组顺序就够 |
| `events.onClick` | 导航串 / `{"flow":"@[file://flow/x.af]"}` | 见 `numable docs af` |
| `_note` | 任意字符串 | 写给人和 AI 看的说明,**注释只能写在节点内的这个字段** |

`op` 节点的写法与六个 `action` 见下面「画图形 · 控制流」。

## 单位

**一律 `pt`**。`pt` 是 1:1 的设计单位;`px` 会按渲染密度换算,现象是整个组件缩在左上角、字号明显偏小,而且不报错。

`-1` 是唯一的特殊值(自适应)。`0pt` 是合法的零。数字后面必须恰好一个单位后缀:`"14.0ptpt"` 会让整个组件渲不出,`check` 会拦(G28)。

## 颜色

颜色字段的值叫 **Paint**,格式 `浅色|深色`:

```
"bgColor": "#FFFFFF|#15171A"
"textColor": "#0E1116|#F3F4F6"
```

- 浅色取**第一段**,深色取**最后一段**。写三段,中间那段永远不生效。
- 单值(不带 `|`)不分明暗,深浅色下同一个颜色。

**只有这 10 处字段走 Paint**:`bgColor` · `borderColor` · `shadowColor` · `textColor`(或 `color`)· `fillColor`(或 `color`)· `strokeColor` · `coverageColor` · `mask.paint` · `spans[].textColor` · `spans[].bgColor`。其它地方写 `浅|深` 不生效。

**每个颜色都要写两段**,`check` 拦(G7)。白名单只有纯透明和纯黑遮罩:`#00000000` / `#000000` / `#FFFFFF00`——这三个没有明暗之分。

### Paint 完整语法

一段 Paint(`|` 的一侧)有四种字面量、两种渐变,别的写法一律解析失败。**失败是静默的**:整个 Paint 作废,那一块什么都不画,不回落成黑色、也不报错。

| 写法 | 例子 | 说明 |
|---|---|---|
| `#RGB` | `#F63` | 每位翻倍,等价 `#FF6633` |
| `#ARGB` | `#8F63` | 四位时**第一位是 alpha** |
| `#RRGGBB` | `#FF6633` | 不透明 |
| `#AARRGGBB` | `#15FF5C4D` | 八位时**前两位是 alpha**:`#15` ≈ 8% 不透明的红 |
| `linear(c1\,c2\,…)@角度` | `linear(#2F7FC4\,#A9D2EC)@90` | 线性渐变,色标两个起 |
| `radial(c1\,c2\,…)@cx\,cy\,r` | `radial(#8CFFFFFF\,#00FFFFFF)@0.8\,0.16\,0.6` | 径向渐变 |

(表里的 `\,` 是转义,原因见下一节;JSON 里要写成 `\\,`。)

渐变的四条规则:

1. **角度是裸度数**,不带单位。`@90` 对;`@90deg` 不报错,静默按 `0` 算。不写 `@…` 也是 `0`。
2. 角度方向:`0` = 左→右,`90` = 上→下,`180` = 右→左,`270` = 下→上。角度是在「把这个节点当成正方形」的坐标里算的,细长节点上视觉夹角会被宽高比拉斜——要严格 45°,把节点做成正方形。
3. `radial` 的 `@cx,cy,r` 三个都是 `0`~`1` 的比例:`cx` 圆心横向(占节点宽的几成)、`cy` 圆心纵向(占节点高的几成)、`r` 半径(占节点**短边**的几成,大于 1 按 1 算)。不写 `@…` = `0.5,0.5,0.5`。
4. **色标只能等距**:两个色标落在 0 和 1,三个落在 0 / 0.5 / 1,没有指定位置的写法。想让某个颜色占更长一段,把它重复写一遍近似——`linear(#FFF,#FFF,#0FFF)` 让白色占前一半。

### 表达式里的结构符要转义

`:` `(` `)` `[` `]` `,` 这六个字符是**方法表达式的结构符**。它们出现在 `$[…]` 的参数里时,要当普通字符用就必须在前面加一个反斜杠——JSON 字符串里写成两个:

```json
{
  "id": "area",
  "type": "curves",
  "x": "12pt", "y": "40pt",
  "w": "134pt", "h": "48pt",
  "lineWidth": "1.5pt",
  "points": "[0,40,44,22,88,26,132,6]",
  "strokeColor": "#FF5C4D|#FF5C4D",
  "coverageColor": "$[if::(eq::(${up},1),linear(#4AFF5C4D\\,#00FF5C4D)@90,linear(#4A1FC77D\\,#001FC77D)@90)]"
}
```

不转义会怎样:`linear(#4AFF5C4D,#00FF5C4D)@90` 里的逗号被当成 `if::` 的参数分隔符,`if::` 于是收到四个参数、渐变被切成两半,**这一格静默不画**,日志干净。渐变、`points` 串、含冒号的文案(`"12:30"`)都会撞上。

`$[…]` 之外的反斜杠会被直接吃掉(`\,` 求值成 `,`),所以纯字面量的渐变加不加转义都能跑;统一都加,省得记两套。

三样凑齐(渐变 + 明暗双分支 + 转义)的完整片段,天空底 + 一层柔光:

```json
{
  "id": "sky",
  "type": "layer",
  "x": "0pt", "y": "0pt",
  "w": "{parent.w}", "h": "{parent.h}",
  "bgColor": "linear(#2F7FC4\\,#6FB4E0\\,#A9D2EC)@90|linear(#1F5C90\\,#487F9E\\,#6E9AB0)@90"
}
```

```json
{
  "id": "glow",
  "type": "layer",
  "x": "0pt", "y": "0pt",
  "w": "{parent.w}", "h": "{parent.h}",
  "bgColor": "radial(#2BFFFFFF\\,#00FFFFFF)@0.5\\,0.34\\,0.78|radial(#1EFFFFFF\\,#00FFFFFF)@0.5\\,0.34\\,0.78"
}
```

柔光这类叠加层用 `radial` 而不是「一条装着横向渐变的窄 `layer`」:横向渐变的窄条**纵向是硬边**,渲出来是一道齐刷刷的白杠;`radial` 四周都柔,没有哪条边会被读成线。

## 画图形

上面十种节点定的是「画什么」,这一节是「画成什么样」:阴影、描边、变换、裁剪、图片、文字细节,以及几种图形自己的字段。每小节一个最小片段加它最容易踩的坑,字段全表见 `numable docs rcn-nodes`。

### 阴影

`shadowColor` + `shadowRadius` + `shadowDx` / `shadowDy`,任何节点都能用。

```json
{
  "id": "card",
  "type": "layer",
  "x": "12pt", "y": "12pt",
  "w": "{parent.w}-24pt", "h": "72pt",
  "bgColor": "#FFFFFF|#20232A",
  "cornerRadius": { "leftT": "12pt", "leftB": "12pt", "rightT": "12pt", "rightB": "12pt" },
  "shadowColor": "#14000000|#40000000",
  "shadowRadius": "8pt",
  "shadowDy": "2pt"
}
```

- **只写 `shadowColor` 什么都看不见**:`shadowRadius` 与 `shadowDx` / `shadowDy` 三个都是 0 时,阴影整段跳过。至少给一个。
- `shadowRadius` 是模糊半径;`0pt` 配一个偏移 = 硬边色块(做「厚底」用)。
- 阴影颜色走 Paint,所以 `浅|深` 两段是必须的,也可以直接写渐变。

### 描边、圆角与裁切

```json
{
  "id": "avatarBox",
  "type": "group",
  "x": "12pt", "y": "12pt", "w": "40pt", "h": "40pt",
  "cornerRadius": { "leftT": "20pt", "leftB": "20pt", "rightT": "20pt", "rightB": "20pt" },
  "borderColor": "#E4E7EC|#262A31",
  "borderWidth": "1pt",
  "clip": "1",
  "children": [
    { "id": "avatar", "type": "img", "x": "0pt", "y": "0pt", "w": "40pt", "h": "40pt", "url": "${avatar}", "scaleType": "centerCrop" }
  ]
}
```

- `borderColor` 与 `borderWidth` 必须成对,缺一个整条边不可见。
- `cornerRadius` 是**四角对象**,写成字符串整组件失败。圆形头像 = 四角都写边长的一半。
- 圆角要把**子节点**也裁住,父节点上必须写 `"clip": "1"`。它只认字符串 `"1"`——写 `true`、写数字 `1`、写 `"yes"` 都等于没开,现象是圆角框里露出方角的图。

### 透明与混合

- `alpha`:`0`~`1`,超出范围会被夹回区间。写在父节点上,整棵子树跟着变淡。
- `blendMode`:`normal`(默认)· `multiply` · `screen` · `overlay` · `darken` · `lighten` · `plusLighter`。大小写不敏感,**认不出来的值一律当默认**——拼错不报错,只是看不出效果。
- 浅色档合适的混合模式在深色档常常反过来(`multiply` 在深底上几乎全黑)。用了 `blendMode` 就必须两档都看一眼渲出来的图。

### 变换:旋转 / 缩放 / 平移

```json
{
  "id": "badge",
  "type": "txt",
  "x": "{parent.w}-56pt", "y": "10pt", "w": "-1", "h": "-1",
  "paddingLeft": "6pt", "paddingRight": "6pt", "paddingTop": "2pt", "paddingBottom": "2pt",
  "text": "${@i18n.new}",
  "fontSize": "9pt",
  "textColor": "#FFFFFF|#0E1116",
  "bgColor": "#128F66|#6FE8BE",
  "rotate": "-8",
  "translateY": "-2pt"
}
```

- `rotate` / `scaleX` / `scaleY` 是**纯数字,不带单位**。带了单位不报错,而是整个值被丢掉走默认:`rotate` 回 `0`(压根不转)、`scaleX/Y` 回 `1`(压根不缩)——「旋转写了没反应」基本都是写成了 `"45deg"`。
- `rotate` 正数顺时针,**默认绕节点中心转**。要换支点才写 `pivotX` / `pivotY`(带 `pt`,从节点左上角量起);填 `-1` 也是回中心。
- `translateX` / `translateY` 带 `pt`,在排好版之后再挪,**不影响锚点**——别的节点读到的 `{id.r}` 还是挪之前的位置。另外 `-1pt` 是自适应保留值,想往左挪 1pt 请写 `-1.01pt` 或改用 `x`。
- 变换不参与测量:转过、放大之后超出父节点的部分,父节点开了 `clip` 照样被切掉。

### 裁形状与渐隐:clipPath / mask

`path` 上的两个高级字段,形状写法相同:`{"d":"…","viewBox":"0 0 24 24","scaleType":"fitCenter","fillRule":"nonzero","paint":"…"}`。

- `clipPath` = 拿这个形状把节点**硬裁**成轮廓,形状之外不显示(异形头像、斜切组件)。
- `mask` = 拿形状当遮罩,再配 `paint` 就能按透明度做**软**过渡。
- 边缘渐隐最省事的写法是**只给 `mask.paint`、不给 `mask.d`**:遮罩落在节点自己的圆角矩形上,按渐变的 alpha 从实到透。

```json
{
  "id": "fade",
  "type": "path",
  "x": "0pt", "y": "{parent.h}-40pt",
  "w": "{parent.w}", "h": "40pt",
  "d": "M0 0 H100 V40 H0 Z",
  "viewBox": "0 0 100 40",
  "scaleType": "fitXY",
  "fillColor": "#FFFFFF|#15171A",
  "mask": { "paint": "linear(#FF000000\\,#00000000)@90" }
}
```

- `clipPath` 里写 `paint` 没有任何作用(只有 `mask.paint` 会被用),要软过渡就得走 `mask`。
- 在 `clipPath` / `mask` 里写 `"fillRule": "evenodd"` 会**连本节点的填充规则一起改成 evenodd**,实心图形可能突然中空。这两处别写 `fillRule`,要改就改节点自己的那个。

### 图片:img 与背景图

```json
{ "id": "logo", "type": "img", "x": "12pt", "y": "12pt", "w": "20pt", "h": "20pt", "url": "@[file://res/logo.png]", "scaleType": "fitCenter" }
```

- **不写 `scaleType` 就是 `centerCrop`**(填满并裁掉多余),不是完整装入。要完整装入必须显式写 `fitCenter`;拼错也会落回 `centerCrop`(`check` G7b 拦)。连字符写法 `fit-center` / `center-crop` 也认,大小写不敏感。
- `url` 可以是包内资源,也可以是 `${}` 取来的远程地址;图放在要鉴权的服务器上就配 `urlHeaders`(`{"名字":"值"}`)。
- 任何节点都能直接铺背景图:`bgUrl`(+ 需要时 `bgUrlHeaders`),省掉一个 `img` 子节点。
- 远程图取不到时那一块是空的,底下垫一层 `layer` 兜住颜色,别让组件上开洞。

### 富文本:richText

`spans[]` 里每段可写六个字段:`text` · `fontSize` · `textColor`(或 `color`)· `bgColor` · `typeface` · `baselineOffset`。段按顺序拼成一句,节点级的 `alignmentH` / `alignmentV` / `maxLines` / `lineSpacing` / `lineBreak` 管整块。

```json
{
  "id": "pts",
  "type": "richText",
  "x": "12pt", "y": "118pt", "w": "80pt", "h": "-1",
  "maxLines": "1",
  "spans": [
    { "text": "$[findNotEmpty::(${p0},--)]", "fontSize": "19pt", "typeface": "System-Bold", "textColor": "#0E1116|#F3F4F6" },
    { "text": "${@i18n.pts}", "fontSize": "10pt", "textColor": "#6B7280|#8E939B", "baselineOffset": "1pt" }
  ]
}
```

- 段边界**不会**自己补空格,而且直接敲一个空格没有用——见下一节。
- `baselineOffset` 带 `pt`,正数把这一段往**上**抬,负数往下压——用来把小字单位坐到大数字的基线上。
- 数字与单位不同字号时一律用它,别拿两个 `txt` 手工对齐:文本盒顶是字形墨迹顶,手对必偏。

### 段与段之间的空格

段边界不会自己补空格,而且**在段的开头或结尾敲一个空格是没有用的**——求值时会把整段两端的空白剥掉,渲染时还会再剥一次。所以这样写:

```json
{ "text": " Clicks", "fontSize": "10pt" }
```

渲出来是 `1842Clicks`,数字和单位贴在一起。把空格挪到前一段的结尾、或者在文件里直接敲一个「不换行空格」,结果一样;而**整段只有空白的那一段会被整个丢掉**,等于没写。

有效的写法只有一种:让空白**从取值结果里出来**。词表里放一条值是「不换行空格」的键,让它单独占一段:

```json
"spans": [
  { "text": "$[findNotEmpty::(${p0},--)]", "fontSize": "19pt", "typeface": "System-Bold" },
  { "text": "${@i18n.nbsp}", "fontSize": "14pt" },
  { "text": "${@i18n.pts}", "fontSize": "10pt" }
]
```

```json
"i18n": {
  "zh-CN": { "nbsp": "\u00a0", "pts": "分" },
  "en-US": { "nbsp": "\u00a0", "pts": "pts" }
}
```

**「不换行空格」是什么**:Unicode 的 U+00A0,网页里的 `&nbsp;`。它就是一个空格——宽度和外观跟普通空格几乎分不出来,只有两点不同:它两边的词不允许断行(「10 kg」不会被拆到两行);以及**「去掉两端空白」那一类处理不把它当空白**。第二点正是它活得下来的原因。

**这一段的字号就是间距宽度**,与左右两段的字号无关:大约是字号的 0.2 倍(14pt 约 3pt、20pt 约 4pt、34pt 约 7pt)。要调间距只改这一段的 `fontSize`,数字与单位的字号对比一点不用动。

- 键名就叫 `nbsp`,别起 `gap`、`sp` 这种名字:一眼看得出这条的值必须是「不换行空格」,也不容易跟正文文案的键撞名。撞名不报错,只会把那句文案渲到间距的位置上。
- 已经写在词表值里的前后缀空格(`" pts"` 这种)同样要换成「不换行空格」。它在普通 `txt` 的句子中间是好的,可一旦这个键被用到某一段的开头,那个空格就没了。
- `numable check` 的 **G38** 查上面三种写法,报出来就改。

### 文字排版细节

- `maxLines` 填 `"0"` 是**不限行数**,不是「零行」。要单行写 `"1"`。
- `alignmentH` / `alignmentV` **只认 `"0"` / `"1"` / `"2"`**(靠前 / 居中 / 靠后)。写 `"center"` 不报错,静默按 `"0"` 处理,现象是「设了居中还是靠左」。
- 对齐要看得出效果,节点得比文字大:`w` 写 `-1` 的自适应节点里,横向对齐没有意义。
- `lineSpacing` 是**额外**行距(带 `pt`),不是行高。
- `lineBreak` 打开 = 允许折行;关掉 = 只排一行、超出直接切掉。只要填了 `maxLines`,关着也照样折行。
- ⚠️ **省略号(「…」)的开关就是它,但「没写」和「写 `"0"`」是两回事**:
  - **显式写 `"lineBreak": "0"` + 填了 `maxLines`** → 超出部分末尾补「…」。这是要省略号的唯一写法。
  - **这个字段留空不写** → 固定宽节点照样折行,但**不补点**。
  - **写 `"1"`** → 折行,不补点。
  - **自动宽**(`w: "-1"`)→ 撑到内容宽、根本不截断,因此也没有「…」。

  为什么「没写」不能等同于「写 0」:布局阶段对固定宽节点有一句改写,把没表过态的节点一律按「折行」处理(固定宽要按宽度回流成多行,自动高才长得起来)。所以只有作者**明确写下** `"0"`,才说明他要的是「截断 + 省略号」而不是折行。

  实测(`numable render`;手机上跑的和这里预览用的是同一份渲染核,所以看到的就是真实结果):固定宽 140pt + `maxLines:"1"` + `lineBreak:"0"` 渲成 `Mid-Autumn…`;同样的节点把 `lineBreak` 改成 `"1"` 则是 `Mid-Autumn`(无点)。
- `typeface` 只用自动表里的枚举值,加粗靠选带 `-Bold` 的那一档(没有 `bold` 字段)。**不写 `typeface` 的默认是 `Inter`**;文字里含中日韩字符时会自动换成 `NotoSansSC`(粗体档保留),所以中英混排不会缺字,但**英文数字与中文的字形宽度会不一样**,做等宽对齐的表格请显式选 `JetBrainsMono` 这类等宽族。

### 弧与环形进度:arc

```json
{
  "id": "ring",
  "type": "arc",
  "x": "12pt", "y": "12pt", "w": "64pt", "h": "64pt",
  "startAngle": "-90",
  "sweepAngle": "$[calc::(${pct}*3.6)]",
  "useCenter": "0",
  "lineWidth": "6pt",
  "lineCap": "round",
  "strokeColor": "#128F66|#6FE8BE"
}
```

- 角度 `0` 在三点钟方向,顺时针增加;从十二点起画就写 `startAngle: "-90"`。`sweepAngle` 是**扫过多少度**,不是终点角。
- **半径只按宽算**(`w` 的一半):节点不是正方形也画正圆,高只影响圆心的纵向位置。环形进度一律把 `w` 与 `h` 写成相等。
- 不闭合时半径还会再减掉半个 `lineWidth`,线才不会溢出节点。
- `useCenter` 只认字符串 `"1"`:`"1"` = 两端连回圆心画成扇形,别的值(含 `true`)都是只画一段弧。
- 底下那圈灰色轨道是**另一个 `arc`**(同尺寸、`sweepAngle: "360"`),先画轨道再画进度。

**环里那个数字怎么摆正**:`arc` 只画线,圈里的文字是另一个 `txt`。把它的 `x/y/w/h` **抄成跟 `arc` 一模一样**,再开双向居中,数字就正好落在圆心 —— 不用去算文字宽度:

```json
{
  "id": "pct",
  "type": "txt",
  "x": "31pt", "y": "36pt", "w": "96pt", "h": "96pt",
  "maxLines": "1",
  "alignmentH": "1",
  "alignmentV": "1",
  "text": "$[findNotEmpty::(${pctText},--%)]",
  "fontSize": "24pt",
  "typeface": "System-Bold",
  "textColor": "#FFFFFF|#FFFFFF"
}
```

- `h` 必须写成和圈一样的实数,**不能写 `-1`**:自适应高度会把盒子收成字那么高,`alignmentV` 就没有可居中的空间,文字贴在圈的顶上。
- 同理 `w` 也不能写 `-1`,否则 `alignmentH` 无效(见上面「文字排版细节」)。
- 数字位数会变(`9%` → `100%`),所以**只能靠居中定位,不能靠 `x` 手调**;`maxLines: "1"` 防止长值折行把行推出圆心。
- 圈里要放两行(大数字 + 小标签)时,别在一个 `txt` 里塞换行 —— 用两个 `txt`,各自沿用圈的 `x/w` 与 `alignmentH: "1"`,纵向按 `y` 排,`alignmentV` 不再需要。

### 折线与面积:line / curves

```json
{
  "id": "trend",
  "type": "curves",
  "x": "12pt", "y": "60pt", "w": "134pt", "h": "40pt",
  "points": "[0,34,44,18,88,22,132,4]",
  "lineWidth": "1.5pt",
  "lineCap": "round",
  "strokeColor": "#128F66|#6FE8BE",
  "coverageColor": "linear(#4A128F66\\,#00128F66)@90|linear(#4A6FE8BE\\,#006FE8BE)@90"
}
```

- `points` 是一个 JSON 数组的字符串,按 `x,y,x,y…` 成对,坐标**相对本节点的内容盒左上角**。
- 数组里的元素可以是数字,也可以是**用引号包起来的布局表达式**——`"points": "[0,20,\"{parent.w}/2\",4]"`,但整串必须仍是合法的 JSON 数组。
- 每个动态值都要 `findNotEmpty` 兜底:算出 null 会让整串非法、**整个组件白**,空态列一定要看。
- `coverageColor` 是「线下面那块面积」的填充:把折线首尾**垂直拉到内容盒底边**围出闭合区域。它**只有 `line` / `curves` 能用**,写在别的节点上会让这个组件验不过。
- `curves` 与 `line` 字段完全相同,只是把折线平滑成曲线;数据点少于 3 个时两者看起来一样。

### 矢量图标:path

```json
{
  "id": "arrow",
  "type": "path",
  "x": "{title.r}+4pt", "y": "{title.y}+2pt", "w": "10pt", "h": "10pt",
  "d": "M2 6 L5 3 L8 6",
  "viewBox": "0 0 10 10",
  "scaleType": "fitCenter",
  "lineWidth": "1.5pt",
  "lineCap": "round",
  "lineJoin": "round",
  "strokeColor": "#FF5C4D|#FF5C4D"
}
```

- `d` 与 `viewBox` 要一起从图形文件里抄过来。少了 `viewBox`,图形按什么尺寸缩放就没有依据,现象是大小不对或跑出边界。
- 只描边就给 `strokeColor` + `lineWidth`;只填色就给 `fillColor`;两个都给就是描边加填充。
- `fillRule` 默认 `nonzero`(都填实),要做甜甜圈那样的中空写 `evenodd`。
- `scaleType` 与图片同一套,图标一般用 `fitCenter`。
- **动态拼出来的 `d` 里不能有逗号**——逗号是表达式的结构符,会把整组件搞白。用空格分隔坐标(`"M0 0 L10 10"`),或者按上面「结构符要转义」那节转义掉。

### 分组与显隐:group / hide

`group` 自己不画内容,作用是把子节点装进 `children` 一起管:一起挪(改 `group` 的 `x/y`)、一起淡出(`alpha`)、一起裁圆角(`cornerRadius` + `clip`)、一起藏(`hide`)。子节点的 `x/y` 相对 `group` 的内容盒。

`hide` 三态,数据驱动的显隐一律用它(不是 `visibility`,那个字段会被整个丢弃、该藏的照样显示):

| 值 | 效果 |
|---|---|
| `"0"`(默认) | 正常显示 |
| `"1"` | 不画,但**位置照占**,别的节点锚点不变 |
| `"2"` | 不画,而且**六个锚点全部归零** |

```json
{ "id": "tag", "type": "txt", "x": "12pt", "y": "12pt", "w": "-1", "h": "-1", "hide": "$[if::(eq::(${apiOk},1),0,1)]", "text": "${tag}", "fontSize": "11pt", "textColor": "#6B7280|#8E939B" }
```

⚠️ 引用一个 `hide: "2"` 节点的锚点(`{tag.r}`),拿到的是 **0**,不是它本来的位置——「另一块跑到左上角去了」十有八九是这个。要让后面的内容顶上来就用 `"2"`,要保持排版稳定就用 `"1"`。

### 控制流:op

`op` 节点不画东西,只决定「渲哪些节点、用什么变量」。`action` 六个,子节点写在 **`react`** 里:

```json
[
  { "type": "op", "action": "if",      "props": { "val": "$[gt::(${n},0)]" }, "react": [] },
  { "type": "op", "action": "forEach", "props": { "items": "${list}", "key": "_it", "index": "_i" }, "react": [] },
  { "type": "op", "action": "for",     "props": { "count": "${cycle}", "index": "_i" }, "react": [] },
  { "type": "op", "action": "set",     "props": { "key": "_y", "value": "$[calc::(48+${_i}*48)]" } },
  { "type": "op", "action": "remove",  "props": { "key": "_y" } }
]
```

| action | 干什么 | 要点 |
|---|---|---|
| `if` | `props.val` 为真才渲 `react` | 真值只认 `true` / `"1"` / `"true"` / `"on"` / `"yes"` / `"y"` 与数字 1;别的数字都是假,判「有没有」先转旗标:`$[gt::(${n},0)]` |
| `forEach` | 把数组循环渲成多份 | `items` 给对象时按键名字典序取值,给单个标量当一个元素,给空则一次都不跑;`key` 是当前项的名字,`index` 是下标 |
| `for` | 按次数循环 | `count` ≤ 0 直接不渲;`index` 不写默认叫 `__index` |
| `set` | 落一个变量给后面用 | 值算出 null 就不写入;落地后才能被 `${}` 引用 |
| `remove` | 删掉一个变量 | 同名变量后面还要重新 `set` 时用得上 |
| `include` | 把一串节点原地展开 | `props.dsl` 给一个节点数组(或它的 JSON 串)。包里想复用一段版式,更省事的做法是直接复制那几个节点 |

- 循环体里用 `${_it.字段}` 取当前项、`${_i}` 取下标。**循环变量出了 `react` 就没了**,不会把最后一轮的值漏到外面。
- `op:set` 落地的键才能被方法参数里的 `${}` 看见,所以派生量要先 `set` 再用。
- **空态骨架画在 `forEach` 外面**:循环只画有数据的行,数组为空时组件上不能开一个洞。
- `props` 与 `react` 之外的字段会被忽略;`react` 必须是数组,写成对象会让整组件失败。


#### 例:用 `forEach` 画一个 N 行列表

不用把 5 行各写一遍(更不要写脚本去生成):`.df` 里把数组原样透出(`{ "op": "set", "props": { "key": "items", "value": "${resp.hits}" } }`,`resultFilter` 的 `keys` 带上 `items`),`.rcn` 里循环一次,每行的纵坐标按下标算:

```json
{ "type": "op", "action": "forEach", "props": { "items": "${items}", "key": "_it", "index": "_i" }, "react": [
  { "type": "op", "action": "if", "props": { "val": "$[lt::(${_i},3)]" }, "react": [
    { "type": "txt", "x": "14pt", "y": "14pt+${_i}*44pt", "w": "{parent.w}-28pt", "h": "-1",
      "text": "${_it.title}", "fontSize": "13pt", "textColor": "#0E1116|#F3F4F6", "maxLines": "1", "lineBreak": "0" },
    { "type": "txt", "x": "14pt", "y": "33pt+${_i}*44pt", "w": "{parent.w}-28pt", "h": "-1",
      "text": "▲ ${_it.points} · ${_it.num_comments}", "fontSize": "11pt", "textColor": "#6B7280|#8E939B", "maxLines": "1" }
  ]}
]}
```

- 坐标写成**布局表达式** `14pt+${_i}*44pt`(插值只做乘法,不写减号,不进 `$[calc::]`),行高固定,标题用 `maxLines:"1"` + `lineBreak:"0"` 截断出「…」。每行高度要随内容变时,在 `.df` 里把每行的 `y` 算好放进数组项。
- 外层 `if` 限制最多画几行,数组比预期长也不会画出组件。
- 空态(数组为空)那块画在循环**外面**(见上面的要点)。

## 文案与 i18n

固定文案不写死在 `text` 里,写进本文件的 `rc.i18n`,用 `${@i18n.key}` 引用:

```
"text": "${@i18n.empty}",
…
"i18n": { "zh-CN": { "empty": "暂无数据" }, "en-US": { "empty": "No data" } }
```

- 至少写 `manifest.lang` 那一门;上架要求中英双份。
- **空串是合法译文**,表示「这一门刻意不显示任何文字」,不会被兜底成另一门。发布档 `check` 会把空串当成疑似漏译提示(G8),确属刻意就在 `rc` 下与 `i18n` 同级写 `"i18nEmptyOk": ["key"]` 声明。
- **禁 emoji**:RCN 字形管线渲不出 U+1F000 以上的码点,现象是那个位置一片空白。`check` 拦(G30)。要图形就用 `path` 画,或者用 BMP 区的符号:`★ ✓ ✕ › ▲ ▼ ●`。

跨文件的文案组织见 `numable docs i18n`。

## 版式纪律

七条,照做组件就不会难看:

1. **尺寸只用 `{parent.w}` / `{parent.h}` 推**,不写死 158/338。四个档位:`22`=158×158 · `42`=338×158 · `44`=338×354 · `21`=158×60。
2. **每个颜色写 `浅|深` 两段**。
3. **卡边距**:158 宽用 `12pt`,338 宽用 `14pt`;块内文字到块边 `10pt`。
4. **留白**:卡底留白 = 卡边距;同一语义块内 6~8pt;跨段 14~20pt。文字永远不贴边。
5. **字号**:主数值 28pt(多指标)/ 44pt(单指标)· 次数值 18pt · 标题 14pt · 副文 11pt。加粗只能靠 `typeface: "System-Bold"`(没有 `bold` 字段,写了会被丢弃)。
6. **一个组件回答一个问题**。22 档最多 1 个主指标 + 2 个辅助;实时数据组件必须有时间锚(小字,右上或底部)。
7. **数字走 `$[parseNumber::(${x}, 0.00)]`** 格式化,不要直接把原始值往上贴。

色板(直接抄):

| 用途 | Paint |
|---|---|
| 卡底 | `#FFFFFF\|#15171A` |
| 主文 | `#0E1116\|#F3F4F6` |
| 次文 | `#6B7280\|#8E939B` |
| 分隔线 | `#E4E7EC\|#262A31` |
| 强调(只做点/线) | `#128F66\|#6FE8BE` |
| 分区底板 | `#E7E9EE\|#20232A` |
| 添加位底板 | `#EEF0F4\|#252930` |
| 涨 | `#FF5C4D\|#FF5C4D` |
| 跌 | `#1FC77D\|#1FC77D` |
| 涨(淡底) | `#15FF5C4D\|#15FF5C4D` |
| 跌(淡底) | `#151FC77D\|#151FC77D` |

强调色与「跌」色相近,数字组件里强调色只用于非涨跌语义。

## 规则(违反 = 返工)

| 规则 | 检查方式 | 违反时的现象 | 修法 |
|---|---|---|---|
| 每个含 hex 的颜色字段写 `浅\|深` 双分支 | `check` G7 | 暗色下刺眼白块 / 文字看不见 | 补第二段;纯透明用白名单三值 |
| `img.scaleType` 只能是 `fitXY` `fitStart` `fitEnd` `fitCenter` `centerCrop` | `check` G7b | 写错静默兜底成 `centerCrop`,图被裁 | 改成合法拼法 |
| 每个 cell 必须有非空 `type` | `check` G7c | **整个组件渲染失败**,编辑器只显「wasm 未就绪」 | 注释并进相邻 cell 的 `_note`;`op` 写完整形 `{"type":"op","action":…}` |
| 数字后只跟一个单位后缀 | `check` G28 | 整个组件渲不出,不报错 | 删掉多出来的 `pt` |
| `$[…]` 里不能再嵌 `$[` | `check` G28 | 画面上出现字面量 `$[…]` | 内层写裸方法名 `if::(…)` |
| `${x}` 必须来自本组件 `.df` 的 `resultFilter` 输出 | `check` G28 | 那一处渲空或恒走兜底 | `depends.params` 传进 `.df` → 落地 → `resultFilter` 透出 |
| 点击不写成 `click` 串(尤其别在里面写 `@[file://`) | `check` G29 | 点了没反应 | 写 `events.onClick` |
| 可见文本禁 emoji(≥U+1F000) | `check` G30 | 该位置空白 | 用 `path` 画,或用 BMP 符号 |
| cell 绑的 `.af` 首个 action 放 `ui.haptic` | `check` G22 | 点击后 ~250ms 无反馈,用户会再点一次 | 挪到 `actions[0]` |
| 尺寸与字号一律 `pt` | 人审 / render 层 | 内容缩在左上角、字号偏小 | 全量替换 `px` |
| 几何字段(`x/y/w/h/fontSize`)不写 `$[方法]` | render 层 | 整个组件白块 | 在 `.df` 里算成变量,写 `"${_w}pt"` |
| `{parent.w}` 这类锚点不进 `$[calc::()]` | render 层 | 该节点静默不画 | 用纯布局表达式:`({parent.w}-{a.w})/2` |
| 坐标里不写内插减法(`"${v}pt-24pt"`) | render 层 | 表达式被原样画出来 | 减法在 `.df` 算完再传 |
| `cornerRadius` 写四角对象 | render 层 | 整组件失败 | `{"leftT":"8pt","leftB":"8pt","rightT":"8pt","rightB":"8pt"}` |
| 显隐用 `hide`,不是 `visibility` | render 层 | 未知字段被整个丢弃 —— 该藏的那一格照常显示,不报错 | 改 `hide`,值 `"0"/"1"/"2"` |
| `path.d` 动态拼接不能带逗号 | render 层 | 整组件白屏(逗号被当参数分隔) | 用空格分隔坐标 |
| `points` 里每个动态值都要 `findNotEmpty` 兜底 | render 层(空态列) | 取数失败整组件白屏 | `"$[findNotEmpty::(${b0},1.5)]"` |
| 尺寸串里凡有 `calc::` 必须套 `findNotEmpty` | render 层(空态列) | 空态下算出 null,拼成裸 `pt`,整组件失败 | `"$[findNotEmpty::(calc::(…),0)]pt"` |
| 胶囊/按钮做成**一个** `txt`(带 `bgColor` + `padding*` + `cornerRadius`,`w:"-1"`) | 人审 | 底板宽写死,文案变长顶出组件外;或点到文字没反应(可点区只在底板) | 合成一个 `txt`,`x` 用自身锚 `{parent.w}-{id.w}-12pt` |
| 填了 `maxLines` 却没有「…」 | render 层 | 固定宽文字超出后只折行或直接切掉,末尾没有「…」 | 没写 `lineBreak` 不等于写 `"0"`:要省略号就显式写 `"lineBreak": "0"`(见上文「文字排版细节」)|
| `txt` 盒顶 = 字形墨迹顶,不是行高顶 | 人审 | 数字与单位错位约 11pt;下半块空一片 | 数字+单位用 `richText` 的 `spans`;改字号必须重算下一行的 `y` |
| 空态骨架画在 `forEach` **外面** | render 层(空态列) | 数组为空时组件上开一个洞 | 骨架/占位是独立 cell,循环只画内容 |

## 出错怎么办

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| 整个组件空白,日志干净 | 某个 cell 缺 `type`;几何字段里写了 `$[方法]`;双单位后缀;`cornerRadius` 写成字符串 | 跑 `numable check`,G7c / G28 直接点名文件与路径;都过了就逐个几何字段找 `$[` |
| 只有空态那一列白 | 尺寸串或 `points` 里的动态值算出 null | 给每个动态值套 `findNotEmpty`,兜底值用合法数字 |
| 画面上出现字面量 `$[…]` 或 `${…}` | `$[]` 嵌套了两层;或坐标里写了内插减法 | `numable check` 看 G28;减法挪到 `.df` |
| 某个节点整个不画 | `{锚点}` 进了 `$[calc::()]`;或方法名写错(未注册方法静默求空) | 把锚点表达式改成纯布局写法;方法名对照 `numable docs methods` |
| 值全是 `--`,但 `.df` 单跑是好的 | `${x}` 不在渲染域:它是 shell params,没经 `.df` 透出 | `numable check` 看 G28;补 `resultFilter` |
| 暗色下一片看不清 / 刺眼白块 | 颜色写了单值;或三段 Paint 的中段被忽略 | `numable check` 看 G7;每个颜色严格两段 |
| 文字挤成一坨,词间没空格 | `richText` 的 span 两端空格被吃掉(藏在词表值里的普通空格同样);`connect::` 也吃空格 | 加一个独立的间距 span:文本 `${@i18n.nbsp}`、词表值 U+00A0,字号即间距宽度;整句同字号时也可以只用一个 `txt`,空格写在 `text` 内插里 |
| 图被裁了,想要的是完整装进去 | `scaleType` 拼错被兜底成 `centerCrop` | `numable check` 看 G7b,改 `fitCenter` |

看像素:`numable render` 会把每个组件渲成浅色 / 深色 / 空态三张 PNG。**空态那一列必须看**——最常见的事故不是崩溃,是取数失败后的一片白。

## 相关

- `numable docs rcn-nodes` —— 节点与字段全表
- `numable docs methods` —— `$[]` 里能用的方法全表
- `numable docs xwidget` —— 组件的档位、`depends` 与参数
