# bridge —— H5 页 JS 桥契约

> 读者:做工具的用户,和替他干活的 AI。两者读同一份。

## 它是什么

`window.xbridge` 是 html 页面唯一能碰到宿主的口子。页面跑在容器注入了 CSP 的沙盒里:**`fetch` / `XMLHttpRequest` 直连被焊死**(`connect-src 'none'`,图片是例外),所以取数、导航、弹提示、加组件、写参数,一律经这个对象。

它是 ActionFlow 能力面的第二个外观 —— 大部分方法背后就是同一条 action 的同一份实现,所以「桥能做什么」基本等于「`.af` 能做什么」(全表见 `numable docs af`)。只有 xpage / xform 页面用不到它:那两型页面直接绑 `.df` / `.af`。

只在 html 页里用。写之前先判环境,普通浏览器里 `window.xbridge` 是 `undefined`。

## 最小可用示例

```html
<script>
  // 1. 判环境:浏览器里直接预览时不炸
  const inApp = !!(window.xbridge && xbridge.isXBundleEnv());

  // call 型方法回的是信封 { code, msg, data }:code === 0 才算成功,结果在 data。统一拆一层
  async function call(p) {
    const r = await p;
    if (!r || r.code !== 0) throw new Error((r && r.msg) || "bridge error");
    return r.data;
  }

  async function load() {
    if (!inApp) return;

    // 2. 取数:调 page/flow/home.df(runDataFlow 只搜 .df)
    const data = await call(xbridge.runDataFlow("home", { id: new URLSearchParams(location.search).get("id") || "" }));
    document.getElementById("n").textContent = data.count;

    // 3. 读 App 环境:一定要 await
    const app = await call(xbridge.appInfo());     // { theme, language, locale, … }
    document.documentElement.dataset.lang = app.language;
  }

  async function reset() {
    // 4. 二次确认用桥的,不用 window.confirm
    if (!(await call(xbridge.confirm("清空记录?", "此操作不可撤销")))) return;
    xbridge.haptic("warning");
    await call(xbridge.runActionFlow("reset"));    // 副作用流,.af
    xbridge.toast("已清空", "success");
  }

  // 5. 添加组件入口:一个按钮,打开面板由用户自己挑
  function addCard() { xbridge.pickWidgets([{ id: "today", params: { habit: "water" } }]); }

  load();
</script>
```

## 分组用例

上面那段覆盖了最常走的路。剩下的方法各给一行,复制就能用(`call()` 就是上面那个拆信封的 helper)。

**取数与本地数据**

```js
const data = await call(xbridge.runDataFlow("home", { id: "1" }));   // page/flow/home.df
const r    = await call(xbridge.runActionFlow("save", { v: "1" }));  // page/flow/save.af,副作用流
await call(xbridge.setData("watchlist", JSON.stringify(["AAPL", "TSLA"])));   // 值只能是字符串
const list = JSON.parse((await call(xbridge.getData("watchlist"))) || "[]");  // 没存过时是空,自己兜底
```

`getData` / `setData` 的命名空间恒是本包,页面指定不了;它们对应 `.af` 里的 `data.get` / `data.set`,同一份存储,页面和流看得见彼此写的东西。

**反馈**

```js
xbridge.showLoading("正在同步…");     // notify,不 await
try { await call(xbridge.runActionFlow("sync")); } finally { xbridge.hideLoading(); }
await xbridge.alert("今天已经打过组件了", "明天再来");
if (await call(xbridge.confirm("清空记录?", "此操作不可撤销"))) { /* … */ }
const r = await call(xbridge.singleValue({
  container: "sheet",
  title: "选择城市",
  component: { type: "select", value: "bj",
    props: { items: [{ label: "北京", value: "bj" }, { label: "上海", value: "sh" }] } }
}));
if (r && !r.cancelled) { /* 值在 r.value.value */ }
```

`showLoading` / `hideLoading` 是 notify:**必须自己配对收起来**,尤其是取数抛错那条路(所以写 `finally`)。忘了收,页面就永远盖着一层遮罩,而且不报错。

**组件**

```js
xbridge.pickWidgets([{ id: "today", params: { habit: "water" } }]);  // 请用户挑,面板里才落盘
xbridge.removeWidget("today");                                       // 直接落盘,删这个组件的全部实例
const p = await call(xbridge.updateParams(brickId, { city: "shanghai" })); // 只有参数页拿得到 brickId
await call(xbridge.refreshWidget());                                       // data = { refreshed: 张数 }
```

⚠️ **`removeWidget` 不过面板、直接落盘**,而且删的是该组件的**全部实例**(用户可能摆了三张各带各的参数)。调它之前自己加一次 `xbridge.confirm`。

**环境**

```js
const app  = await call(xbridge.appInfo());           // 一定要 await:{ platform, appVersion, theme, language, locale }
const mine = await xbridge.installedBundles();        // 只对系统包开放,自制包拿到的是 code 非 0
const cred = await call(xbridge.credentialState("github"));  // { state: bound|unbound|expired, fp }
```

`installedBundles()` 在自制包里调不出东西,别围着它设计「已装/未装」两态 UI。判某个方法在不在,用 `typeof xbridge.x === "function"` —— 门面上挂着什么就是页面能调到什么,没有第二份清单要核对。

## 调用形态

- **call 型**(表里标 call)返回 Promise;**notify 型**是单向通知,没有返回值,不要 `await` 它的结果来判断成败。
- **call 型 resolve 的是信封 `{ code, msg, data }`,不会 reject**:`code === 0` 为成功、结果在 `data`;失败是 `code` 非 0(`msg` 说明原因),手机上超时是 `code: -2`。把返回值直接当数据用是最常见的静默错误:`(await xbridge.runDataFlow(…)).count` 恒是 `undefined`;`if (await xbridge.confirm(…))` 更危险 —— 信封对象恒为真值,用户点了「取消」照样往下执行。用上面示例里的 `call()` 拆一层。
- 手机上 call 型默认 10 秒超时;要等用户操作的那几个(`confirm` / `alert` / `singleValue` / `alertAdd`)不设超时。
- 探测一个方法在不在,用 `typeof xbridge.confirm === "function"`;要看全表就 `Object.keys(xbridge)`。
- 表里没有的名字就是**没有** —— 调它会抛 TypeError,而这类调用几乎总被页面自己的 `try/catch` 吞掉(不崩、不报错、功能安静地不存在)。`numable check` 的 G42 会拦。

## 方法全表(26)

每个平台上都是这一张表 —— 同名、同签名、同行为。表里没有的名字就是没有。

| 方法 | 形态 | 签名 | 返回 | 对应 AF action |
|---|---|---|---|---|
| `isXBundleEnv` | — | `()` | `true`(浏览器里整个 `xbridge` 是 undefined) | — |
| `runDataFlow` | call | `(flow, params?, timeout?)` | 流的 `resultFilter` 输出 | — |
| `runActionFlow` | call | `(flow, params?, timeout?)` | 流结果 | — |
| `runFlow` | call | `(flow, params?, timeout?)` | 流结果;等价 `runActionFlow`,只搜 `.af` | — |
| `getData` | call | `(key)` | 值(字符串) | `data.get` |
| `setData` | call | `(key, value)` | — | `data.set` |
| `credentialState` | call | `(declId)` | `{ state, fp }` —— `state` = `bound` / `unbound` / `expired`,`fp` 换绑即变(可作缓存键的一维) | `credential.state` |
| `route` | notify | `(url)` | — | `nav.open` |
| `closePage` | notify | `()` | — | `page.close` |
| `setResult` | notify | `(payload)` | — | `page.setResult` |
| `toast` | notify | `(msg, type?)` | — | `ui.toast`;`type` = `success` / `error`,其余值按普通提示渲 |
| `haptic` | notify | `(type?)` | — | `ui.haptic` |
| `alert` | call | `(title, message?, okText?)` | `void` | `ui.alert` |
| `confirm` | call | `(title, message?, opts?)` | `boolean` | `ui.confirm` |
| `showLoading` | notify | `(text?)` | — | `ui.showLoading` |
| `hideLoading` | notify | `()` | — | `ui.hideLoading` |
| `singleValue` | call | `(config)` | `{ value: { value }, cancelled }` | `singleValue` |
| `pickWidgets` | notify | `(items?)` | — | `widget.pick` |
| `removeWidget` | notify | `(widgetId)` | — | 删该 widget 的**全部**实例,直接落盘 |
| `updateParams` | call | `(brickId, params)` | 合并后的 `params` | `widget.updateParams` |
| `refreshWidget` | call | `(pid?)` | `{ refreshed }` | `widget.refresh` |
| `alertAdd` | call | `({ id, params? })` | `ok` / `cancel` / `quota` | `alert.add` |
| `alertRemove` | call | `({ id, params? })` | `{ removed }` | `alert.remove`;**需要 `manifest.minEngine` 至少 3**,旧版应用的门面上没有它 |
| `appInfo` | call | `()` | `{ platform, appVersion, theme, language, locale }`(`language` 与 `locale` 同值) | — |
| `installBundle` | notify | `(id, version?, ref?)` | — | — |
| `installedBundles` | call | `()` | 已装包清单(只对系统包开放) | — |

## 语义纪律

这几条不是「用法」,是「用错了不会报错」的地方。

- **`getData` / `setData` 的命名空间恒是本包**,页面指定不了。值只能是字符串,复杂结构自己 `JSON.stringify`。
- **`pickWidgets` 的主语是用户,不是包**。桥只把面板打开、把候选和参数递进去;真正落盘发生在面板里的原生按钮上。所以调用之后**不得**提示「已添加」—— 用户完全可能翻两下就关掉,那句话会撒谎。要给反馈就说「已提交」,或者什么都不说(面板自己有提示)。
  `items` 省略或给空数组 = 列本包全部组件;给了但**一个 id 都不认识 → 面板不开**(不会静默回落成「全部」)。
- **`pickWidgets` 与 `removeWidget` 语义正好相反**:前者只是把面板打开、请用户挑,落盘在面板里;后者不过任何面板、直接落盘,一次删掉该组件的**全部**实例。所以加组件不必自己确认(面板就是确认),删组件**必须**自己先 `confirm` 一次 —— 用户按下去之后没有任何撤销入口。
- **`alertAdd` 的主语同样是用户**:它只打开「添加提醒」的原生面板,`params` 只是预填、用户可改,提醒只在用户按下面板主按钮时才建。`ok` 之外的两个结果要分开对待:`cancel` 是用户不想加,`quota` 是本包提醒已满(面板照开、按钮置灰)—— 别把 `quota` 也写成「下次再说」。`id` 只能是本包 `xJob/` 里的提醒规则,替别的包建提醒做不到;写错(找不到或不是提醒)不开面板、调用失败(`rule_not_found`),不会回成 `cancel`。
- **`alertRemove` 不经用户、直接生效**,与 `alertAdd` 正好相反:它删掉本包这条规则里匹配的提醒(连同已经排好的那几发),不弹面板、不出提示,返回删了几份。`params` 按**子集**匹配 —— 给出的键相等就删,省略 = 这条规则的全部;没有匹配是 `{ removed: 0 }`,不算失败。只删提醒,不动后台任务。写法与建提醒时带业务键的做法见 `numable docs alerts` 步骤 7。它只在 `manifest.minEngine` ≥ 3 的包里保证存在;要兼容旧版应用,先 `typeof xbridge.alertRemove === "function"` 判一下。
- **`alert` / `confirm` 用桥的,不要用 `window.alert` / `window.confirm`**。后者是系统自带的弹窗,各平台长得不一样,而且会逃出容器边界 —— 在大屏上它会跑到窗口中央而不是包的组件里。
- **`haptic` 的参数是语义档不是物理参数**:`tap`(默认)/ `impact` / `success` / `warning` / `error` / `selection`,未知值回落 `tap`。桌面无触觉硬件、或用户关了触觉总开关时它静默无事发生,**不要在调用点自己判断该不该震**。
- **`singleValue(config)` 的整个 config 就是单值配置**,不是 `{config: …}`:必须含 `container`(`page` / `sheet` / `dialog`)与 `component`(`{type, value, props}`)。返回 `{ value: { value }, cancelled }` —— 值在 `r.value.value`,不是 `r.value`。多字段一律用 `.xform` 页面类型,见 `numable docs params`。
- **`updateParams` 逐键 merge,任一键非法则整次失败**:值只能是标量,`null` 表示删这个键、回落组件声明的默认值;传对象或数组会让整次调用报错,不是「跳过那一个键」。

## 容器环境

页面能从容器拿到四样东西,全都不需要调方法。

**CSS 变量**(容器注入,自己在 `:root` 里写一份 0 兜底,浏览器里预览才不塌):

```css
:root { --xb-content-top: 0px; --xb-content-bottom: 0px; }
body { padding: calc(var(--xb-content-top) + 16px) 16px calc(var(--xb-content-bottom) + 16px); }
```

| 变量 | 含义 |
|---|---|
| `--xb-content-top` | 顶部要让出的高度(安全区 + 浮动 chrome 占位)。**99% 的页面该读的是这个** |
| `--xb-content-bottom` | 底部要让出的高度 |
| `--xb-safe-bottom` | 纯系统安全区底部 |
| `--xb-safe-top` | 纯系统安全区顶部。**只有手机上有,桌面版没有** —— 别拿它当唯一让位依据 |
| `--xb-bar-bottom` | 滚动后那条小标题栏的底边(安全区 + 44)。页内吸顶工具条写 `position: sticky; top: var(--xb-bar-bottom)`,贴在栏下面;写 `top: 0` 会钻到栏底下 |

**主题与语言**:容器在 `documentElement` 上打 `data-theme`(`light` / `dark`)与 `data-lang`(语言码),切换时**改属性 + 派发事件,不重载页面**:

```js
addEventListener("themechange", (e) => {/* e.detail.theme */});
addEventListener("languagechange", (e) => {/* e.detail.language */});
```

写 `[data-theme="dark"] …` 的 CSS,**不要靠 `prefers-color-scheme`**:页面在 iframe / WebView 里,那个媒体查询跟的是宿主系统,App 内切主题拨不动它。

**网络**:CSP `connect-src 'none'`,`fetch` / `XHR` 一律走不通,而且失败得很安静(被 try/catch 一吞就全程无日志)。所有数据经 `runDataFlow` / `runActionFlow`。

**路由参数**:页面读 `location.search`,和普通网页一样。

## 规则(违反 = 返工)

| 规则 | 检查方式 | 违反时的现象 | 修法 |
|---|---|---|---|
| 调的 flow 必须存在,且后缀对得上方法(`runDataFlow`→`page/flow/<名>.df`;`runFlow` / `runActionFlow`→`.af`) | `check` G12b | 页面显示「加载失败(-6)」,flow not found | 改后缀或改方法名,二者取其一 |
| 输入控件显式 `font-size` ≥ 16px | `check` G15 | iOS 上聚焦输入框整页被放大,失焦不完全缩回 | CSS 里写 `input, select, textarea { font-size: 16px; }` |
| 单个文件里的加组件调用不超过 2 处;加组件页不出现「已添加」字样 | `check` G24(W) | 页面里手抄了一份组件目录,新增组件忘改就永远加不到 | 收成一个按钮 + `pickWidgets(items)` |
| 只调方法全表里的桥方法 | `check` G42 | 裸调 = TypeError(E);带 `if (xbridge.x)` 守卫 = 不崩,但那条回落分支从此永远生效(W) | 对着方法全表核名字;没有对应能力就别留那条假分支 |
| 添加组件按钮用平台基准版式(`.pickb` CSS 块逐字相等) | `check` G27(W) | 同一个平台动作在每个包里长得不一样 | 别手改版式,按报错提示重新生成那一份 |
| `appInfo()` 必须 `await` | 人审 | 同步读 `.theme` / `.language` 拿到的是 Promise 上不存在的属性 → 主题恒浅色、语言恒基准语言,**且不报错** | `const app = await xbridge.appInfo();` |
| call 型返回的是信封,结果在 `.data` | `check` G49(W) | 字段全是 `undefined`;`confirm` 点了「取消」照样执行 —— 都不报错 | 写一个 `call()` 拆信封(`code !== 0` 抛错,否则返回 `data`),所有 call 型都经它 |
| 页面里不出现 `fetch` / `XMLHttpRequest` 直连 | 人审 | 数据永远为空,控制台常被自己的 try/catch 吞掉 | 一律改走 `runDataFlow` |

## 出错怎么办

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| 页面显示「加载失败(-6)」 | flow 名或后缀对不上方法 | 跑 `numable check`,看 G12b |
| 数据永远是空的,也不报错 | 用了 `fetch` 直连被 CSP 拦 | 全文搜 `fetch(` / `XMLHttpRequest` |
| 主题恒浅色、语言恒中文 | `appInfo()` 忘了 `await` | 补 `await`;或改读 `documentElement.dataset` |
| 切主题/语言后页面没变 | 只在首屏读了一次属性 | 监听 `themechange` / `languagechange` 重渲 |
| 弹窗跑到窗口中央、大屏上溢出容器 | 用了 `window.confirm` / `window.alert` | 换 `xbridge.confirm` / `xbridge.alert` |
| 点「添加到仪表盘」没有任何反应 | `pickWidgets(items)` 里一个 id 都不认识 | 对着 `xWidget/*.xwidget` 的文件名核 id |
| 某个桥调用像是完全没发生(值没变、页面没动),控制台也干净 | 方法名不在全表里 —— 被自己的 `try/catch` 吞了,或者那句 `if (xbridge.x)` 守卫直接走了回落 | 跑 `numable check`,看 G42 |
| 页面永远盖着一层 loading 遮罩 | `showLoading` 之后取数抛了错,`hideLoading` 没走到 | 把 `hideLoading` 放进 `finally` |
| `getData` 读出来是空,明明存过 | 存的时候没 `JSON.stringify`,对象被存成 `[object Object]` | 存字符串,读出来自己 `JSON.parse` 并兜底 |
| 用户少了两个组件,谁也没删 | 页面调了 `removeWidget`,它删的是该组件全部实例 | 调用前补一次 `xbridge.confirm` |

## 相关

- `numable docs page` —— html 页在包里的位置、路由与三种页型
- `numable docs af` —— 桥背后那一层:action 全表与交互流写法
- `numable docs params` —— `singleValue` / `.xform` 的组件类型与 props
