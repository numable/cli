# builtins —— 内置变量(@app / @i18n / @env / @device / @time / @contentInset / @safeArea / @window / @fetch / @event)

> 读者:做信息源的用户,和替他干活的 AI。两者读同一份。

## 它是什么

`@` 开头的一组根变量,由平台注入,不用你自己传:当前是什么设备、什么语言、现在几点、容器有多宽、这一屏的数据是不是回落来的。它们与包自己的数据分属两个命名空间——包里叫 `time` 的字段和 `@time` 永远不会互相覆盖。

取法与普通变量一样:`${@time.nowMs}`、`${@window.width}`,也能进方法参数:`$[formatDate::(${@time.nowMs},HH:mm)]`。

两件事先说在前面:

- **不是每个根在每种文件里都有**。写了一个当地没有的根,求值结果是空,不报错——现象是那一格空着、或者条件恒假。下面每个根都标了在哪些文件里可用。
- **`@i18n` 在 `.df` 与 `.af` 里都能读**(宿主页表 ⊕ 本文件顶层 `i18n` 表);语言量(`@app.language` / `@device.language` / `@time.locale`)在 `.df` 里也能读。按语言取数、在数据层出文案的做法见 `numable docs i18n`。

## 最小可用示例

一个组件的 RCN 里,时间锚 + 回落提示 + 跟随容器宽度:

```json
{
  "type": "txt",
  "id": "anchor",
  "x": "16pt", "y": "12pt", "w": "${@window.width}pt",
  "text": "$[if::(eq::(${@fetch.stale},1),${@i18n.stale},formatDate::(${@time.nowMs},HH:mm))]"
}
```

## 怎么写(逐根逐键)

### `@app` —— App 自己

| 键 | 类型 | 例值 | 在哪能用 |
|---|---|---|---|
| `platform` | string | `ios` / `android` / `harmony` / `win` / `web` | `.df` |
| `name` | string | App 名 | `.df` |
| `versionName` | string | `1.8.0` | `.df` |
| `buildNumber` | string | `2410` | `.df` |
| `appId` | string | 安装标识 | `.df` |
| `language` | string | `zh-CN` | `.rcn` `.xpage` `.xform` `.af` `.df` |
| `locale` | string | `zh-CN`,与 `language` 同值 | `.rcn` `.xpage` `.xform` `.af` `.df` |

⚠️ **`@app` 在两类文件里装的东西不一样**:渲染与事件类文件(`.rcn` / `.xpage` / `.xform` / `.af`)里的 `@app` 只保证 `language` 与 `locale` 两个键,上面那五个环境键在那里读不到。要按平台分支,在 `.df` 里读 `${@app.platform}`,把结论落成一个顶层键透出去(`isIos = $[eq::(${@app.platform},ios)]`),渲染层只看那个键。

### `@i18n` —— 当前语言的文案表

`${@i18n.<key>}`,值是字符串。**能读到哪张表按文件类型分**,规则、fallback 链与空串语义都在 `numable docs i18n`,这里不重复。两条最常撞的:key 不能动态拼;求不出来的引用会原样显示在屏幕上。

`.df` / `.af` 里读到的是宿主页表 ⊕ 本文件顶层 `i18n` 表;`.xwidget` 直接挂的流没有宿主表,只有自己那份。

### `@env` —— 运行环境

| 键 | 类型 | 例值 | 在哪能用 |
|---|---|---|---|
| `name` | string | `debug` / `release` | `.df` `.af` |
| `debug` | boolean | `true` / `false` | `.df` `.af` |

用来在开发时打点、或临时指到测试接口。**别拿它当开关留在发布包里**:用户装到的恒是 `release` 那一支,另一支等于死代码。

### `@device` —— 设备

| 键 | 类型 | 例值 | 在哪能用 |
|---|---|---|---|
| `osName` | string | `iOS` / `Android` / `HarmonyOS` / `Windows` | `.df` `.af` |
| `osVersion` | string | `17.4` | `.df` `.af` |
| `brand` | string | 厂商 | `.df` `.af` |
| `model` | string | 机型 | `.df` `.af` |
| `isTablet` | boolean | `true` / `false` | `.df` `.af` |
| `language` | string | 系统语言 | `.af` `.df` |
| `platform` | string | `ios` / `android` / `harmony` / `win`;由宿主下发,**不保证有** | `.df` |

⚠️ 宿主可以用同名根整体覆盖 `@device`(页面驱动的取数流里,它常常只带 `platform` 一个键)。所以**别在取数流里按机型细节分支**;真要分支,把判断结果落成显式的顶层键,或让调用方把它作为参数传进来(见 `numable docs params`)。

### `@time` —— 时间

| 键 | 类型 | 例值 | 在哪能用 |
|---|---|---|---|
| `nowMs` | number | `1757308800000`(毫秒时间戳) | `.df` `.af` `.rcn` `.xpage` |
| `timeZoneId` | string | `Asia/Shanghai` | `.df` `.af` `.rcn` `.xpage` |
| `locale` | string | 当前 locale | `.af` `.rcn` `.xpage` `.df` |

- `nowMs` **在同一次求值里被缓存**:一条表达式(乃至同一轮渲染)里引用多次,拿到的是同一个值。要算「多久以前」,拿 `nowMs` 减去数据里的时间戳,别指望两次读到不同的值。
- 时间锚记得防空,写法见 `numable docs df` 的「必守的六条」。

### `@contentInset` / `@safeArea` / `@window` —— 容器几何

| 根 | 键 | 类型 | 说明 |
|---|---|---|---|
| `@contentInset` | `top` `right` `bottom` `left` | number(pt) | 安全区 **加上** 容器自己的悬浮 chrome(胶囊、顶栏、✕、底部导航)与键盘 |
| `@safeArea` | `top` `right` `bottom` `left` | number(pt) | 只有系统安全区。容器不贴屏幕的那条边恒为 0 |
| `@window` | `width` `height` | number(pt) | **容器**的尺寸,不是物理窗口 |

在哪能用:`.xpage` 的节点、页面里 canvas 的 `.rcn`、以及 `.af` 事件绑定的 `params`。**取数流(`.df`)里没有这三个**——写了求值为空,尺寸算出来就是 0。

- **要避开 UI 一律用 `@contentInset`**。读 `@safeArea` 会撞上悬浮胶囊:大屏上容器不贴屏幕边,`@safeArea` 四边全是 0,而胶囊照样浮在那儿。
- 三个都是**会变的量**(折叠、旋转、分屏、键盘弹起都会重新下发),别把它们当首帧常量缓存进自己的键。
- 页面默认**一个都不用写**:容器已经把内容排在正确位置。只有要精细控制的那种页(比如头图顶到状态栏底下)才读它们。
- `@window.width` 是容器宽,不是屏幕宽。大屏上容器是一列手机宽的组件,按屏幕宽画会画出界。

### `@fetch` —— 这一屏的数据新不新鲜

| 键 | 类型 | 值 | 在哪能用 |
|---|---|---|---|
| `stale` | number | `1` = 这次尝试取数失败了、现在渲的是上次成功的数据;`0` = 屏幕上的数据是刚取到的 | `.rcn` |

恒有值,不会缺席,所以 `eq::(${@fetch.stale},1)` 是可靠的判据。典型用法是把时间锚换成一句「上次更新于 …」,而不是让用户对着旧数字以为是实时的:

```json
{ "type": "txt", "id": "tip", "x": "16pt", "y": "40pt",
  "text": "$[if::(eq::(${@fetch.stale},1),${@i18n.stale},${at})]" }
```

⚠️ 它说的是**取数失败回落**,不是「数据来自缓存」。切主题那种纯重渲按设计就不取数,那时它是 `0`;切语言会重新取数,取成功后它也是 `0`。数据缓存按语言分开:切语言后新语言下没有旧数据可回落,取数失败时组件走空态 / 错误态,而不是 `stale=1`。

### `@event` —— 这次交互带来的东西

只有 `.af` 交互流里有,而且按触点不同带的键不同(点了哪个元素 / 输入了什么 / 翻到第几页)。全表在 `numable docs af`,这里不重复。

## 规则(违反 = 返工)

| 规则 | 检查方式 | 违反时的现象 | 修法 |
|---|---|---|---|
| 避让 UI 用 `@contentInset`,不用 `@safeArea` | 人审 / render 层 | 内容被悬浮胶囊压住,只在大屏或有胶囊的页上看得见 | 换成 `@contentInset` |
| 尺寸用 `@window`,不用屏幕宽 | render 层 | 大屏上内容画出容器外 | 换成 `${@window.width}` |
| 渲染层不读 `@app.platform` 之类的环境键 | run 层(那一格空/条件恒假) | 分支永远走同一支 | 在 `.df` 里判断,透一个旗标出来 |
| `@i18n` 的 key 不动态拼 | render 层(屏幕上直接显示模板串) | 那一格显示 `${@i18n.xxx}` | 拆成固定 key |
| 内置量不参与缓存键 | 人审 | 缓存按语言/主题分裂,或按时间戳永不命中 | 缓存键只用业务上的稳定标识 |

## 出错怎么办

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| `${@window.width}` 算出来是 0 | 在 `.df` 里读了容器几何 | 挪到 `.xpage` 节点或 canvas 上 |
| `${@app.platform}` 在组件上是空的 | 渲染层的 `@app` 只有语言两个键 | 在 `.df` 里读,落成顶层键透出去 |
| 屏幕上出现 `${@i18n.xxx}` 字样 | 这张表里没有这个 key,或 key 是拼出来的 | 补进该文件的 `i18n` 表 |
| 「多久以前」恒为 0 | 同一次求值里 `@time.nowMs` 是同一个值 | 用 `nowMs` 减数据里的时间戳 |
| 内容被底部胶囊压住 | 用了 `@safeArea` | 换 `@contentInset` |
| `eq::(${@fetch.stale},1)` 恒不成立 | 这是 `.rcn` 才有的量,写到别处了 | 挪回 `.rcn` |

## 相关

`numable docs i18n` · `numable docs af` · `numable docs df`
