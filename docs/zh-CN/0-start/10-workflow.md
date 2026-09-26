# workflow —— 创作流程与纪律

> 读者:做信息源的用户,和替他干活的 AI。两者读同一份。
> 先读这章,它定义「做一个信息源的顺序」与「不能越的线」;能不能做某件事见 `numable docs capabilities`,具体文件格式见 layout / xwidget / df / rcn 各章。

## 一个信息源是什么

一个信息源就是**一个目录**,里面全是明文 JSON / HTML,没有构建产物、没有编译步骤。App 把工作区目录当根:文件写进去,包就在 App 里可见;改一个字,重渲就生效。

最小的包长这样(`numable init` 生成的起步包):

```
my-source/
  manifest.json                # 身份与元数据:id(ULID)/ version / title / category / network / i18n
  xWidget/
    clock.xwidget              # 一个组件的声明:尺寸档、实例参数、取数绑定、刷新节奏、点击行为
    rc/clock.rcn               # 这个组件的画法(几何 + 颜色 + 文本,渲成一张位图)
    flow/clock.df              # 这个组件的取数流(请求 + 加工,产出给 .rcn 用的键)
  page/
    router.json                # 页面路由表(可选:没有页面就不要 page/)
    html/home/index.html       # 点组件进入的详情页
  .numable/                    # 本机夹具与产出,永不进包(numable init 已写进 .gitignore)
```

四类文件各管一件事,**互不越界**:

| 文件 | 管什么 | 不管什么 |
|---|---|---|
| `manifest.json` | 包的身份、商店门面、网络白名单、凭证声明、语言基准 | 不放任何业务数据 |
| `.xwidget` | 把「画法 + 取数 + 尺寸 + 刷新 + 点击」绑在一起,并给出实例参数默认值 | 不写画法,不写取数逻辑 |
| `.df` | 取数与加工:请求、解析、算派生量,最后 `resultFilter` 透出一组键 | 不碰 UI,不引语言/主题 |
| `.rcn` | 画:用 `.df` 透出的键渲一个组件 | 不发请求,不做重计算 |

多出来的两类是可选的:`page/` 下的详情页(html / xpage / form 三种页型,见 `numable docs page`),和 `.af` 交互流(点击、参数写回、刷新,见 `numable docs af`)。

## 创作顺序

七步。**每一步都有命令能验**,不要跳步——跳过第 2 步直接画组件,是返工最常见的原因(组件画完了才发现字段路径不对,几何和判空全得重写)。

### 1. 克隆起步

```
numable init my-source
numable init my-source --from ../已有的包目录
```

从模板或一个已有的包克隆,不要手搓目录:身份 `id`(26 位 ULID)由工具生成并写进 `manifest.id` / `manifest.domain`,目录布局与文件后缀现成正确。看到 `✓ 新包 …  id=…` 即成功。

### 2. 先取数,后画组件

先写 `.df`,把数据跑通:

```
numable run my-source --flow clock --full
```

`--full` 打印完整输出。**取到的键,就是组件上能用的全部变量**——包括你要用来判空的旗标、要显示的时间锚、要驱动折线的定长数组。这一步产出的键名清单,是第 3 步的输入。

看到 `✓ clock {...}` 且键名与你预期一致算对;看到 `✗` 就先修流,不要往下走。`run` 会强制网络白名单,打印 `· 网络白名单已强制: [...]`——这里少一个 host,真机上就是同一处被拦。

### 3. 画组件

写 `.rcn`,渲出来看:

```
numable render my-source --widget clock
```

产出在 `my-source/.numable/render/` 下:每个组件 × 浅色 / 暗色 / 空态 × 语言各一张 PNG,外加一张 `index.html` 拼图。`render` 会先跑一遍 `run`,取数失败的组件会用空数据渲——所以空态那张不是摆设,它就是「源挂了那天用户看到的东西」。只调版式、不想每次都打一轮网络(有日限额的源尤其要省)时加 `--no-run`,复用上一次取到的数据。同目录下 `<组件>.json` 记着每张图的尺寸与可点区域(`hits`:点哪块会触发哪个事件;为空说明组件里没有单独可点的格子,点整张组件走 `.xwidget` 的 `onClick`),核对点击范围时用得上。

包里有页面(`page/`,点组件打开的那一层)时,页面也渲出来看:

```
numable render my-source --page
```

`router.json` 里每条路由按手机宽出浅色、暗色两张整页截图,落在同一目录的 `page*.png`。页面里的取数与 `run` 走同一套白名单和夹具,被拦下的请求、页面脚本报错、没模拟的桥方法都会打印出来。`form` 页和远程页暂不支持,要在 App 里点进去看。细节见 `numable docs page`。

### 4. 声明

写 `.xwidget`,把 rc / df / 尺寸档 / 刷新节奏 / 点击行为绑起来。两处最容易错:

- `canvas.depends` 必须写成 `{"flow": "@[file://flow/clock.df]", "params": {...}}`,裸字符串会把入参吞成空(G12c);
- 组件上要显示但不参与取数的键,也得经 `.df` 透出——`.xwidget.params` 不在渲染域(G28)。

### 5. 静态闸

```
numable check my-source
```

默认 `personal` 档,要求零 error。它抓的是「不检查就没人发现」的那一类:白名单不闭合、cell 缺 `type`、`op:if` 条件键写错、并发结果晚一拍、取数失败没有 `error` 出口。错误码全表见 `numable docs lint-codes`。

### 6. 贴图确认

把 `.numable/render/` 下的浅色 / 暗色 / 空态三张图给用户看。**用户点头才算做完**——`check` 与 `run` 证明不了「好不好看」和「这是不是他想要的那个组件」。

### 7. 持续优化

用户在 App 编辑器里手改、或再让 AI 改,**改的都是同一份源文件**。每次改完只需重跑受影响的那一层:改 `.df` 跑 `run`,改 `.rcn` 跑 `render`,改 `.xwidget` / `manifest.json` 跑 `check`。

## 命令速查

上面七步用到的就是这些,外加几个不常用但省事的开关:

| 命令 | 干什么 |
|---|---|
| `numable workspace init [目录]` | 把一个目录变成创作工作区:写一份给 AI 看的指引,之后在这个目录里直接对 AI 说需求即可 |
| `numable init <目录> [--from <包>]` | 新建包(重新生成身份 ULID) |
| `numable check [包…] [--profile personal\|publish]` | 静态闸 |
| `numable run [包…] [--flow a,b] [--full] [--fixtures <目录>]` | 数据层真跑 |
| `numable render [包…] [--widget a,b] [--states light,dark,empty] [--locales zh-CN,en-US]` | 渲染层出图 |
| `numable render [包…] --page [/路由,…] [--locales zh-CN,en-US]` | 页面出图(html / xpage,浅色 + 暗色整页截图) |
| `numable docs [主题]` | 读这套文档 |
| `numable doctor [包…]` | 环境 / 引擎版本 / 工作区体检 |

三个通用开关与三个环境变量:

- `--json`:所有命令都能加,输出改成机器可读的 JSON。给脚本或 AI 消费时用它,别去解析给人看的那份彩色输出。
- `--lang zh|en`:界面语言(`numable docs` 也跟着换语言)。
- `--fixtures <目录>`:`run` 换一套夹具跑。默认读 `<包>/.numable/params/`,想同时留一套「空数据」夹具验空态时,把它放别处再用这个开关指过去。
- `NUMABLE_PROFILE` / `NUMABLE_LANG` / `NUMABLE_CHROME`:分别免去每次打 `--profile`、`--lang`,以及指定渲染用的浏览器可执行文件。

## 三层验证各管什么

三层不可互替。任何一层绿了都不代表另一层绿。

| 层 | 命令 | 抓什么 | 抓不到什么 |
|---|---|---|---|
| 静态 | `numable check` | 结构与字段合法性、白名单闭合、凭证声明闭合、已知的静默失效写法(`cell` 缺 `type`、双单位后缀、`concurrent` 晚一拍、`parseDate` 脏 pattern、取数流没有 `error` 出口) | 取值路径写错、版式难看、判空逻辑反了 |
| 数据 | `numable run` | 数据源活不活、字段路径对不对、派生量算得对不对、白名单拦不拦、凭证夹具够不够 | 渲染层的分支写错(值在,但组件上走了兜底那条) |
| 渲染 | `numable render` | 溢出与裁切、暗色可读性、空态是不是一片空白、没求值的 `$[...]` 字面量被画上去 | 手机上的字形度量与方法差异(`render` 用的是浏览器引擎) |

手机上独有的差异(字形宽度、数字格式化、日期方法)只能装到手机上看。

## 红线

违反下面任何一条,包不算做完。「检查方式」一栏说明它在哪一层能被抓到。

| 红线 | 检查方式 | 违反时的现象 | 修法 |
|---|---|---|---|
| **源文件唯一真相**:不写生成脚本,不留夹具 | `check` G1b / G1 | 夹具随包分发,或目录布局是旧式 | 夹具放 `.numable/params/`;RCN 归 `rc/`、流归 `flow/` |
| **网络白名单闭合**:`.df` 请求的 host 集合 == `manifest.network`,不多不少 | `check` G3 | 少了:真机静默拦掉,组件恒 `--`;多了:安装面板列一堆用不上的域名吓用户 | 按 `run` 打印的白名单对齐 |
| **密钥不进包**:不写进 `params`、不写进 `.df` 字面量、不写进 `data.*` | `check` G18 | 明文密钥随包分发给所有人 | 走 `manifest.credentials` 声明 + 本机夹具 `.numable/params/_credentials.json`,见 `numable docs credentials` |
| **不编数据**:取不到就让流失败,不要用 0 / 空串 / 假时间顶上 | `check` G26 | 取数失败时流报成功,空数据覆盖掉上一次的好数据,组件上出现一个看着正常的假数字 | 主干字段判空 → `action:"error"`;「集合为空」是成功,不是失败 |
| **时间锚**:实时数据组件必须显示数据时间 | 人审(看 `render` 出的图) | 用户分不清「数据没变」和「三天没刷新了」 | 把时间戳一路透出到 `.rcn`;喂 `formatDate` 前先判空,否则空值会渲成 1970 |
| **双分支颜色**:`.rcn` 里所有带 hex 的颜色字段写 `浅\|深` | `check` G7 | 暗色下整块看不见,或白底上白字 | `"textColor": "#1A1A1A\|#FFFFFF"` |
| **单位写 `pt`** | `check` G28(双单位后缀)+ `render` 层目检 | 写 `px`:内容缩到左上角、字号偏小;写成 `14.0ptpt`:整个组件渲不出且不报错 | 所有几何与字号统一 `pt` |
| **文案走 i18n**:用户可见文本写 `${@i18n.key}` | `check` G8 / G8b(publish 档) | 英文环境下组件上一半中文 | 文案表放各资产自己的 `i18n`,见 `numable docs i18n` |
| **判空用显式旗标**:`gt::(length::(${x}),0)` 或哨兵,不要 `eq::(x,)` / `eq::(x,0)` | `run` 层(把 URL 改成 404 再跑一遍) | 空态渲出「有颜色的 `▼ --%`」这类自相矛盾的画面 | 在 `.df` 里落一个 `hasX` 旗标,`.rcn` 只判旗标 |

## 个人自用 vs 发布

`check` 有两档,默认 `personal`:

| | personal(默认) | publish(`--profile publish`) |
|---|---|---|
| 用途 | 自己用 / 给用户装在自己机器上 | 上架分发 |
| 跑哪些闸 | 结构、网络、凭证、DSL 静默失效、路由与交互 | 全部 |
| 跳过什么 | 商店门面(subtitle / 包名宽度 / 英文覆盖)、logo、添加组件按钮版式、组件档位(≥3 个、必备 22 与 42/44)、双语门、首屏缓存、凭证绑定直达入口 | 不跳 |

```
numable check my-source --profile publish
```

自用包不必现在就满足发布向的要求;想上架时再跑一次 publish 档,缺什么补什么,流程见 `numable docs publish`。两者是**同一个包、同一个 ULID**:自用包发布后,用户手上那个组件长按就能升到已发布的版本,数据保留。

## 接下来读哪章

| 你要做的事 | 读 |
|---|---|
| 先弄清能做什么、各平台差在哪 | `numable docs capabilities` |
| 从零做出第一个组件(完整走一遍) | `numable docs first-card` |
| 给包加一张详情页 | `numable docs add-page` |
| 加点击、参数编辑、表单 | `numable docs add-interaction` |
| 接需要密钥的数据源 | `numable docs credentials` |
| 做中英双语 | `numable docs localize` |
| 从自用到上架 | `numable docs publish` |
| 查某个文件怎么写 | `numable docs layout` · `xwidget` · `df` · `rcn` · `af` · `page` · `bridge` · `i18n` · `params` |
| 做一张声明式页面(八种布局、条件显隐、输入框、触底分页) | `numable docs xpage` |
| 查节点字段 / 方法 / 错误码 | `numable docs rcn-nodes` · `methods` · `lint-codes` |
| 查内置变量(`@app` / `@device` / `@time` / `@contentInset` …)有哪些键 | `numable docs builtins` |
| 组件空了、点了没反应、改了没变化 | `numable docs pitfalls` |
