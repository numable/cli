# pitfalls —— 按现象查:组件坏了怎么定位

> 读者:做信息源的用户,和替他干活的 AI。两者读同一份。

这一章按**你看到的现象**索引,不按技术分类。组件是位图,坏掉时几乎不报错:流报 success、日志干净、`check` 全绿,只有屏幕上一片 `--` 或整块白。所以先按下面三层跑一遍,再拿现象去下面的表里对号。

---

## 1. 先做这三件事

三条命令是三层不同的网,漏的东西各不相同。**按顺序跑,不要跳层**。

### 1.1 `numable check` —— 静态闸

```
numable check
numable check --profile publish
```

看每行开头的 `✗`(error,必须修)/ `!`(warn)。消息末尾常带错误码(如 `(G30)`),码的含义查:

```
numable docs lint-codes
```

- **能看出什么**:JSON 语法错、字段缺失、废弃字段、`depends` 裸绑定、`op:if` 缺 `props.val`、双单位后缀、`parseDate` 非安全 pattern、网络白名单不闭合、`.xpage` 根没让位、路由指向不存在的页、凭证声明不合法。
- **看不出什么**:取值路径对不对、方法名存不存在、组件长什么样、暗色下瞎不瞎、空态白不白。这些静态看不见。
- **默认档位是 `personal`**,会跳过商店门面 / 双语 / 组件档位 / 首屏缓存等发布向的段。上架前必须再跑一遍 `--profile publish`,否则「本地全绿、发布被拒」。

其中有七条专门盯**写错了但哪儿都不报错**的写法。它们在两个档位下都查,所以只要跑过 `check` 就已经过了这一遍:

| 码 | 你会看到的现象 | 真正写错的地方 |
|---|---|---|
| G31 | 某一格恒空,或恒走 `findNotEmpty` 的兜底分支 | 调了不存在的方法(没有 `abs` / `avg` / `filter` / `groupBy` / `indexOf` / `push`),未注册方法**静默求空** |
| G32 | 整个组件渲不出、日志干净 | `x` / `y` / `w` / `h` / `fontSize` / `lineWidth` / `maxWidth` / `maxHeight` 里写了 `$[方法]`,求不出值时整串交给布局,布局直接失败 |
| G33 | 某个节点静默不画,组件上开个洞 | 把布局锚点 `{parent.w}` / `{id.h}` 塞进了 `$[method::(…)]` 的参数(两个域不互通) |
| G34 | 某一格显示的是语言码或明暗档,不是你的业务值 | `.df` 的 `resultFilter.keys` 透出了保留键 `lang` / `theme`,渲染层同名注入**后写的赢** |
| G35 | 屏上一片空白,看着像忘了写文案 | `.xpage` 节点层引的 `${@i18n.k}` 不在这一页的顶层表里,查不到求值成空串 |
| G36 | 点了没反应、不弹错 | 事件值以 `${` 开头 —— 派发层先按首字符分类再插值,以插值开头的串哪一类都不像 |
| G37 | 用户在设置页填完返回,组件纹丝不动,过一阵才自愈 | `.af` 里 `data.set` / `data.merge` / `data.remove` 落盘后没有 `widget.refresh`,组件重载第一步命中的是旧数据渲的那张图 |

### 1.2 `numable run` —— 数据层真跑

```
numable run
numable run --full
numable run --flow quote
```

用真的 ActionFlow 引擎跑每个 `.df`,**真打网络**,且强制 `manifest.network` 白名单(与真机同一份判据)。

- **能看出什么**:数据源还活不活、取值路径 `${resp.a.b}` 对不对、加工逻辑对不对、哪个键是空的。默认打印摘要,`--full` 打印每个键的完整值 —— **逐个键看过去**,这是唯一能发现「值有但是错的」的机会(摘要只报形状)。
- **看不出什么**:组件画成什么样;`.rcn` 里引用的键名是否与这里的输出对得上(拼错一个字母,这层依旧全绿)。
- 输出里出现 `network_blocked:…` = 该 host 不在 `manifest.network`,真机上同样会被静默拦掉。
- 需要密钥的包:测试用的密钥放 `<包>/.numable/params/_credentials.json`(该目录永不进包)。详见 `numable docs credentials`。

### 1.3 `numable render` —— 渲染层三态图

```
numable render
numable render --widget quote --states light,dark,empty
```

同进程先跑一遍 `run` 拿真数据,再用真的 RCN 渲染核把每个组件渲成 PNG:**浅色 / 暗色 / 空态**三张,落在 `<包>/.numable/render/`,并生成 `index.html` 拼图。

- **能看出什么**:整个组件渲不出(报错或全白)、文字溢出组件外、暗色下看不清、空态一片白、数字错位、图标不显示。**空态那一列最重要** —— 最常见的事故不是崩溃,是取数失败后的静默空白。
- **看不出什么**:手机上的字形度量差、桌面小组件行为、点击与交互。这些只能装进 App 看。
- 命令末尾会打印浏览器侧的 warning/error 前 8 条,整个组件渲不出时先看这几行。

> 三层都绿还是坏,说明问题在「App 里才有」的那一类:桌面小组件、点击链路、容器浮层、多语言切换。跳到下面对应的分组。

---

## 2. 现象索引

### 2.1 整组件不显示 / 一片空白 /「wasm 未就绪」

这一组的共同点:**RCN 源解析失败 = 整个组件不渲**,不是某个格子丢。编辑器里表现为「wasm 未就绪」,`render` 里表现为该组件报错或全白。

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| 整组件白 / renderer 返回 null | 某个 cell 缺 `type`(常见于把注释对象、`op` 简写混进 `cells`) | `check` 会拦(扫 `cells` / `react` / `children`) | 每个 cell 都写 `type`;注释键改成 `_note` | `numable docs rcn` |
| 整组件白 | 尺寸/坐标字段里写了 `$[方法]`(`x/y/w/h/fontSize` 只认 `${变量}` 与布局表达式) | `render` 报错;`check` 拦不住 | 先在 `.df` 里 `op:set` 算好,这里写 `"${w1}pt"` | `numable docs rcn` |
| 整组件白 | 双单位后缀,如 `"14.0ptpt"` | `check` 拦(「双单位后缀」) | 去掉一层 | `numable docs rcn` |
| 整组件白 | `cornerRadius` 写成了字符串 | `render` 报错 | 写四角对象 `{"leftT":"8pt","leftB":"8pt","rightT":"8pt","rightB":"8pt"}` | `numable docs rcn-nodes` |
| 整组件白 | 用了不存在的字段名(如 `visibility`、`letterSpacing`、`lineDash`) | `render` 层;字段表里没有的就是没有 | 隐藏用 `hide`(`"0"`/`"1"`/`"2"`);虚线、字间距没有,别写 | `numable docs rcn-nodes` |
| 整组件白,只在某些数据下复现 | `path.d` 由数据拼出且带了逗号(逗号被当参数分隔符) | 换一组数据重跑 `render` | `d` 里一律空格分隔 | `numable docs rcn` |
| 整组件白,取数失败那天才复现 | `line.points` 有空槽,或尺寸串里 `calc` 算出 null 后裸接 `pt` | `numable render --states empty` | 每个值套 `$[findNotEmpty::(…, 0)]`;端点兜 `-99`、y 兜 `999` | `numable docs rcn` |
| 整组件白,包完全打不开 | JSON 语法错(尾逗号、缺引号) | `check` 拦(报「JSON 语法错误」) | 修 JSON。App 里表现是整组件不渲且日志干净 | `numable docs layout` |
| 信息源页顶部横幅整块空白,别处都正常 | `banner.xbanner` 没写 `scene`(它没有档位可依,尺寸只能自己声明) | App 里打开信息源页 | 补 `"scene": {"width": 338, "height": 190, "corner": 18}` | `numable docs layout` |
| 整组件白,数据某天变 0 | 除零把宽算成 NaN;或用 `layer` 的宽表达进度条,宽 0 时圆角大于宽 | `--states empty` | 分母套 `max::(x,1)`;进度条/游标用 `line` + `lineCap:"round"` | `numable docs rcn` |

### 2.2 字段是 `--` 或整片空

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| `run` 报 success 但所有字段空 | `${resp.a.b}` 取值路径错一层 | `numable run --full` 对着真实响应形状看 | 改路径 | `numable docs df` |
| 组件上一片 `--`,但 `run` 全绿 | `depends` 用了裸字符串形态 → 入参被吞成空 | `check` 拦(报「depends 用裸绑定」) | 写 `{"flow":"@[file://flow/x.df]","params":{"secid":"${secid}"}}`,不吃参数的也写 `params:{}` | `numable docs xwidget` |
| 组件上某处恒空 / 恒走兜底 | `.rcn` 里的 `${x}` 不在该组件 `.df` 的 `resultFilter` 输出里(外壳 params 不在渲染域) | `check` 拦(G28) | 参数经 `depends.params` 传进 `.df`,再由 `resultFilter` 透出来 | `numable docs xwidget` |
| 取数根本没发生 | `@[file://…]` 路径基准写错 | `run` 里该组件无网络记录 | 组件宿主基准是 `xWidget/`(`@[file://flow/x.df]`),页面宿主基准是包根(`@[file://page/flow/x.df]`) | `numable docs xwidget` |
| 紧跟 `concurrent` 之后的字段为 null | 并发结果晚一拍才可见 | `check` 拦 | 中间插屏障 `{"op":"set","props":{"key":"_barrier","value":"1"}}` | `numable docs af` |
| `concurrent` 块 3ms 就成功、字段全空 | 写在了 `op` 位 | `run` 里耗时异常短 | 写 `"action":"concurrent"` | `numable docs af` |
| `op:if` 分支里读并发分支 id 全空 | 嵌套求值域读不到 | `run --full` | 把读取提到顶层,或退回串行 | `numable docs af` |
| 某个统计键干脆消失 | 方法名不存在 → 未注册方法**静默求空** | 拿方法名去 `numable docs methods` 查 | 没有 `abs` / `avg` / `filter` / `push` / `indexOf`;绝对值写 `$[if::(ge::(${v},0),${v},calc::(0-${v}))]` | `numable docs methods` |
| 手写的 `nav.open` 带 `fallback`,在 App 的流编辑器里打开并保存后回落不再生效 | 流编辑器只保存它认识的参数,`fallback` 会被剥掉 | 打开 `.af` 看 `fallback` 还在不在 | 这条流用文本方式改,别经流编辑器保存 | `numable docs af` |
| `$[index::(${obj},${key})]` 取对象某项为空 | `index::` 是按位置取,对象按 key 取要用 `get::(${obj},${key})` | `run --full` 看该键是否消失 | 改 `get::` | `numable docs methods` |
| `$[get::(${obj},${key})]` 取不到 | 方法参数里的 `${}` 看不见 flow 入参,只看流里已落地的键(action 的 `id` 结果、`op:set` 的键) | `run --full` | 先 `op:set` 把入参落地成键 | `numable docs df` |
| 分支恒落 else、代码看着全对 | `op:set` 引用的键排在被引用者之前(没有依赖图) | 逐行看顺序 | 先依赖、后派生 | `numable docs df` |
| `${a[${i}]}` 那一处恒空,还把默认 params 覆盖掉 | 嵌套下标不支持 | `run --full` | 动态下标只有 `$[index::(${arr},${i})]` | `numable docs methods` |
| 明明 `set` 了却读不到 | `data.get` / `request` 之后同样晚一拍;或 `op:if` 分支内 `set` 的键出了分支就没了 | `run --full` | 插屏障;算值用表达式里的 `if::` 嵌套,`op:if` 只用来分派动作 | `numable docs af` |
| `sleep` 不等 | 参数名是 `timestamp` 不是 `duration` | `run` 耗时 | 改名 | `numable docs af` |
| 渲染层某两个键莫名被顶掉 | 业务键叫了 `lang` / `theme`(渲染层注入同名值) | `render` 对照 `run --full` | 换键名,如 `srcLang` | `numable docs rcn` |
| 拆出去复用的那几步整段没执行,流却报成功 | `op:include` 在 `.df` / `.af` 里恒展开成空 —— 它不是「没找到文件」,是这条路根本没接 | `run --full` 看那几步产出的键在不在 | 把步骤复制回来,或拆成独立 `.df` 用多条 `depends` 绑定 | `numable docs af` |
| `htmlParse` / `xmlParse` 一个 key 都没取到 | `rules` 写成了对象 —— 它是**数组** | `run --full` 看该步输出是不是 `{}` | 写成 `"rules": [{"key":"…","selector":"…"}]` | `numable docs df` |
| `run` 成功、`data={}` 且用了 `xmlParse` | 各平台的 XML 引擎不一致,`run` 这一层也没有 XML 解析器 | `run` | 改 `formatType:"string"` + `split::` 切 | `numable docs df` |

### 2.3 组件上出现字面量(表达式被原样画出来)

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| 某格画出半截 `$[…]` | 该格 `x/y/w/h` 里写了内插减法,如 `"${v}pt-24pt"` | `render` | 几何在 `.df` 里算完,这里只写 `"${v}pt"`;布局锚点算术用 `"({parent.w}-{a.w})/2"` | `numable docs rcn` |
| 屏上出现 `${@i18n.xxx}` 或该处空白 | key 不在该载体读的表里:`.rcn` 读 rc 表,XPage 节点层读 `.xpage` 顶层表 | `numable check`(G8 / G35) | 把 key 补进对应的表 | `numable docs i18n` |
| 页面标题显示成表达式 | `route.title` 引了 `${@i18n.…}`(它是元数据字段,宿主直接显示) | `check` 拦(G8) | 裸 `title` + 旁挂 `routes[i].i18n["en-US"].title` | `numable docs i18n` |
| 标题渲成 `第␣␣盒`、日期 1970 | `depends.params` 引了不存在的键 → 原样透传字面串 | `run --full` 看首字符是不是 `$` | 对齐键名;上游没有就别绑 | `numable docs page` |

### 2.4 数字 / 时间不对

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| Android 上显示 `17.0`、`Day 17.0` | `calc/max/min/floor/ceil` 在 Android 返 double;`connect::` 拼数字同理 | 装进 App 看;`render` 出的图看不出 | 进 `text` 前套 `$[round::(…)]` | `numable docs methods` |
| 空态显示带颜色的「▼ --%」/「处理中」 | `eq::` 两边能转数字就按数字比:`eq::("00","")`、`eq::(空,0)` 为真 | `render --states empty` | 判空用哨兵 `$[if::(eq::(findNotEmpty::(${x},__none__),__none__),0,1)]`(**别用 `length::`**,见下一行) | `numable docs methods` |
| 正常态反而显示 `--`(小数据量才复现) | 对**自己算出的数字**用 `length::` 判有无 → 数字恒返 0 | `run --full` 造小数据 | 换哨兵式旗标 `hasX = $[if::(eq::(findNotEmpty::(${x},__none__),__none__),0,1)]`:字符串、数字、空串、缺键四种都成立,数字 `0` 算「有值」 | `numable docs methods` |
| 提醒从来不响 / 后台任务的 `data.set` 一次都没执行 | `then` 里的守卫写成 `$[gt::(length::(${x}),0)]`,而 `x` 是数字(`calc::` / `length::` 的结果、JSON 里的数字字段都是)→ 守卫恒假 | `run --full` 看旗标那一键是不是恒 `0` | 同上换哨兵式;拿不准是不是数字就一律当数字 | `numable docs alerts` |
| 时间显示 `1970-01-01` / `01-01 07:30` | `formatDate` 喂了空 → 当 epoch 0 | `render --states empty` | 外套哨兵 `$[findNotEmpty::(${atMs},__none__)]`,判到哨兵就不渲时间 | `numable docs df` |
| 手机上「20673 天前」,`render` 出的图正常 | `parseDate` 的 pattern 含 `T`/`Z` 之类非 token 字母:浏览器引擎放行、手机上返 null | `check` 拦 | pattern 只用 `yyyy MM dd HH mm ss` 与 `- : /` 空格;先 `subString::` 切出纯日期段 | `numable docs methods` |
| 时间差了几十年 | 秒级时间戳没 ×1000 | `run --full` 看位数 | 秒级 `$[calc::(${ts}*1000)]` | `numable docs df` |
| 组件上写着「0%」「0 条」但其实没取到 | `sum::([])` = 0、`length::(空)-1` = -1 被直接渲出;GraphQL 恒返 200、错误在 `errors[]` | `render --states empty` | 聚合值闸在 `ok` 旗标内;没数据就不发这个键 | `numable docs df` |
| 数字没补零 | `parseNumber::` 的 pattern 用错 | `run --full` | 用 `$[parseNumber::(${v}, 0.00)]` | `numable docs methods` |
| 结果偏移一点点 | `if::` 出来的值又直接喂进 `calc::` | `run --full` | 先 `op:set` 落地再算 | `numable docs df` |

### 2.5 某个节点不画 / 颜色不对 / 暗色看不清

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| 某节点静默不画,别的都正常 | 布局锚点 `{parent.w}` 被塞进了 `$[calc::()]`(两域不互通) | `render` | 锚点只在布局字段裸写 | `numable docs rcn` |
| 某节点不画 | 锚定了不存在的 id,或用了六锚点以外的量 | `render` | 跨端安全锚点只有 `<id>.x/y/w/h/r/b` 与 `parent.x/y/w/h` | `numable docs rcn` |
| 暗色下一片白块 / 看不清 | 颜色单色硬编码 | `check` 拦(G7,两档都查);`render --states dark` | 每个含 hex 的 `*color` 写 `浅|深` 两段 | `numable docs rcn` |
| 暗色下颜色不是你写的那个 | 写了三段 `a|b|c` —— 深色取**最后一段**,中段永不生效 | `render --states dark` | 严格两段 | `numable docs rcn` |
| 整块颜色消失(透明) | 颜色由 flow 算,空态取不到 → 裸空 = 透明 | `--states empty` | `$[findNotEmpty::(${c},#8E939B)]` | `numable docs rcn` |
| 边框 / 阴影完全不显示 | `borderColor` 与 `borderWidth` 缺一;`shadowColor` 缺色 | `render` | 成对写 | `numable docs rcn-nodes` |
| 整个 paint 不画且不报错 | 渐变里某个色标解析失败 → 整个 paint 作废 | `render` | 逐个色标核 `#RRGGBB` / `#AARRGGBB`(A 在前) | `numable docs rcn` |
| 渐变整块不画,而同一个渐变单独写就是好的 | 它写在 `$[…]` 的参数里,色标之间的逗号没转义 → 被当成参数分隔符切开,色标碎成半截 | `render`;把那串单独摘出来写死试一次 | 方法参数里的渐变逗号写成 `\\,`:`"$[if::(eq::(${up},1),linear(#4AFF5C4D\\,#00FF5C4D)@90,…)]"` | `numable docs rcn` |
| `radial(...)` 的圆心 / 半径不是你以为的那个 | `@` 后面的参数给少了 —— 缺的那几个按 `0.5` 兜底(圆心居中、半径半个盒),不报错 | `render` 放大看 | 三个都写全:`radial(#2BFFFFFF\\,#00FFFFFF)@0.5\\,0.34\\,0.78`(取值 0~1) | `numable docs rcn` |
| 持平/无变化那天一坨实心灰 | 光晕类兜底色没带 alpha | `--states empty` | 兜底色写 `#15…` 这类带 alpha 的值 | `numable docs rcn` |
| 曲线末端的圆点被裁掉 | 端点贴着 cell 右缘 | `render` 放大看 | 判据:`点x + lineWidth/2 <= cell.w`;端点另起一个 cell | `numable docs rcn` |
| 图标随机不显示 | 图标 `path.d` 由 flow 传进来 | `render` 多跑几组数据 | `d` 写字面量,每个候选一个 `op:if` | `numable docs rcn` |
| 弱一档的分隔线暗色下等于没画 | 与底色通道差 < 10 | `--states dark` 目视 | 拉开对比 | `numable docs rcn` |
| 组件上某个符号空了一格 | 用了 emoji(字形管线渲不出) | `check` 拦(G30) | 换 BMP 符号 `★ ✓ ✕ ›`,或用图片资产 | `numable docs rcn` |

### 2.6 文字排版问题

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| 几个词挤成一坨,空格没了 | `connect::` 吃掉参数前后空格;`richText.span.text` 两端空格同样被吃 | `render` | 拼文本用 `txt` 的 `text` 内插:`"${a} ${b}"` | `numable docs rcn` |
| 文案变长时胶囊顶出组件外 | 用 `layer` 底板 + `txt` 两个节点,底板宽写死 | `render` 换长文案 | 胶囊 = 一个 `txt`(自带 `bgColor` / `padding*` / `cornerRadius`),`w:"-1"`,x 用自身锚 `{parent.w}-{id.w}-14pt` | `numable docs rcn` |
| 填了 `maxLines` 却没有省略号 / 该折不折 | `lineBreak:"1"` = 允许折行且关掉省略号 | `render` | 要「…」就关 `lineBreak` | `numable docs rcn-nodes` |
| 主数值与单位错位十几 pt / 下半块空一片 | `txt` 没有垂直居中,盒顶 = 字形 ink 顶 | `render` 量像素 | 面板高按实际行数摆;改字号必重算上一行底边 | `numable docs rcn` |
| 加粗没生效 | cell 级 `bold` 不存在,写进去被丢弃 | `render` | 选 `typeface` 的 Bold 变体,如 `System-Bold` | `numable docs rcn-nodes` |
| 空数组时组件上开一个洞 | 空态骨架画在了 `forEach` 里面 | `--states empty` | 骨架画在 `forEach` 之外 | `numable docs rcn` |

### 2.7 点了没反应 / 填了没变化

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| 点击整个没反应 | 事件串以 `${` 开头(被当表达式,不当导航) | App 里;`check` 拦不住这一形态 | 写成 `"https://${tail}"` / `"numable://self/page/detail?id=${id}"` | `numable docs af` |
| 点击没反应 | 目标路由不在 `router.json`,或 `numable://self/widget/<id>` 的 id 不存在 | `check` 拦(G12) | 补路由;跳自己首页写 `numable://self` | `numable docs page` |
| 点击弹「信息源『self』未安装」 | 在 `nav.open` 里用了 `numable://self`(它只在页内路由成立) | App 里 | 跨包写目标包的 ULID 字面量 | `numable docs af` |
| 点到文字上没反应,点空白处才有 | 可点区只在底板 cell 上 | App 里 | 按钮做成一个 `txt` cell,事件绑它 | `numable docs rcn` |
| 打开的页面里 `${id}` 是字面量 | query 只插顶层标量,插不进嵌套路径 | `run --full` | 在 `.df` 里提成顶层键 | `numable docs af` |
| 长按组件没有「编辑参数」这一项 | `onEdit` 写在了 `canvas` 里面 —— `canvas` 只认 `source` / `depends` / `refresh`,事件一律挂在外壳的 `events` 上 | 打开 `.xwidget` 看 `onEdit` 在哪一层 | 移到顶层 `"events": {"onEdit": "/edit"}` | `numable docs xwidget` |
| `onEdit` 打得开、按了不产生任何变化 | 该 `.af` 里没有 `widget.updateParams`,或目标页没有写回能力 | `check` 拦(G12) | 补 `widget.updateParams`;目标页 form 要有 `onSubmit`、xpage 要有 `events` | `numable docs add-interaction` |
| `onEdit` 打开空白页且不报错 | af 形态引用了包外路径 / 文件不存在;走路由的没写成裸 path | `check` 拦(G12) | 组件宿主的 af 基准是 `xWidget/` | `numable docs xwidget` |
| 表单填完保存了,组件纹丝不动,过一阵才自愈 | 写盘后没有 `widget.refresh`(命中渲染图缓存) | App 里 | 所有 `data.set` 之后接 `{"action":"widget.refresh"}` | `numable docs af` |
| `widget.refresh` 调了返回 `{refreshed:0}` | 5 秒节流窗内重复调;或 scope 匹配到 0 张(匹配 0 张算成功) | flow 返回值 | 别连点;核 `widgetId` | `numable docs af` |
| `widget.refresh` 在取数流里没用 | 渲染流硬拒该原语;`.df` 里也不可用 | App 里 | 只在 `.af` 事件流里调 | `numable docs af` |
| 流跑到一半停了 | 事件流 15 秒硬超时,而中间有等用户的动作 | App 里 | 等人的 action 标 `"interactive": true` | `numable docs af` |
| 转圈圈再也不消失 | `ui.hideLoading` 被包进了条件分支 | 走一遍失败路径 | `hideLoading` 必须在主干上,任何分支都会经过 | `numable docs af` |
| 点了没触感反馈,用户会再点一次 | 事件流第一个动作不是 `ui.haptic` | `check` 提示(G22) | `actions[0]` 放 `ui.haptic` | `numable docs af` |
| 跳外部 App 没反应 | 自动链路(载入 / 定时刷新)触发的跳转恒被拒 | App 里 | 跳转必须由用户手势触发 | `numable docs capabilities` |

### 2.8 页面问题(html / xpage / xform)

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| 页面顶部被悬浮胶囊压住 | `.xpage` 根没读 `${@contentInset.top}`;H5 没用 `var(--xb-content-top)` | `check` 拦(G17,xpage 侧) | 根写 `"paddingTop": "${@contentInset.top}pt"`;H5 写 `padding: calc(var(--xb-content-top) + 16px) …` | `numable docs page` |
| 让位写了但不生效 | 根 `layout:"pager"`(pager 分支忽略 padding) | `check` 拦(G17) | 包一层 `list` 根承让位 | `numable docs page` |
| H5 里 `fetch` 全部失败 | 容器注入 CSP `connect-src 'none'`,直连被焊死 | 看页面控制台 | 数据走 `xbridge.runDataFlow` / `runActionFlow`(图片不受限) | `numable docs bridge` |
| H5 弹框跑到容器外 / 各平台不一致 | 用了 `window.confirm` / `window.alert` | App 里 | 用 `await xbridge.confirm(...)` / `xbridge.alert(...)` | `numable docs bridge` |
| `appInfo()` 拿到 Promise 对象 | 忘了 `await` | App 里 | `const info = await xbridge.appInfo()`,读 `info.data.language`;只读 `language` / `locale` / `theme` 在所有平台都安全 | `numable docs bridge` |
| H5 页取到的字段全是 `undefined` / 确认框点「取消」照样执行 | 把桥的返回值直接当数据用 —— call 型回的是信封 `{ code, msg, data }` | App 里 | 结果在 `.data`,先判 `code === 0`;`numable docs bridge` 有现成的 `call()` | `numable docs bridge` |
| H5 调 flow 回 `-6 flow not found` | flow 路径或后缀不对 | `check` 拦(G12) | 取数用 `.df` + `runDataFlow`,副作用用 `.af` + `runFlow` | `numable docs bridge` |
| 页面打不开 / 打开的是别的页 | `entry` 基准按页型分;首页不是第一条且不是 `/` | `check` 拦(G12) | `html`/`xpage` 的 entry 相对 `page/`;`form` 的 entry 自带 `page/`。首页恒写 `"path": "/"` 并放第一条 | `numable docs page` |
| 点 A 项渲成 B 项的内容,零报错 | XPage 根节点写了与路由入参同名的 `params` 兜底,把 query 顶掉了 | App 里 A/B 对照 | 根节点不写同名兜底 | `numable docs page` |
| iOS 上列表尾部子项不渲染 | 只写了分边 padding,没保留 `padding` base | App 里 | 分边 padding 之外保留 `padding` | `numable docs page` |
| 返回上一页后数据不动 | 没有 `root.events.onVisible` 这个事件 | App 里 | 用 `nav.openForResult` 的续体里调 `xpage.reloadPage` | `numable docs page` |
| XPage 上某个字段写了完全没反应、也不报错 | 这批字段没有实现:`virtualization`、`preloadCount`、`list` / `waterfall` 的 `scrollEnabled`、`pager` 的 `direction: "vertical"` 与 `initialPage`、事件 `onScroll` / `onVisible` / `onHidden` | 从别处抄来的写法先对一下这张黑名单 | 删掉;要的效果换别的做法(逐档字段见下方相关章) | `numable docs xpage` |
| iOS 上聚焦输入框整页被放大 | H5 输入控件字号 < 16px | `check` 拦(G15) | 显式 `font-size: 16px` 起 | `numable docs page` |
| 整页一片色,块与块之间有白缝 | 根的 `gap` / `padding` 没归零 | App 里 | 整页一色时 root 间距全归零,每块 Canvas 自画自底 | `numable docs page` |
| 小按钮点偏就关了页 | 破坏性按钮热区太小 | App 里 | 热区 ≥ 44×44 | `numable docs page` |

### 2.9 网络 / 凭证

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| 真机上取不到数、日志干净 | host 不在 `manifest.network`,被网络守卫静默拦掉 | `run` 输出 `network_blocked:…`;`check` 拦(G3) | 声明的 host 与实际用到的 host **不多不少**恰好相等 | `numable docs layout` |
| 头几次请求成功、跟着的失败 | 服务端 302 到了白名单外的域(逐跳都要在白名单内) | `run` 的日志行 | 把重定向终点也声明进 `network`,或改用不跳转的端点 | `numable docs layout` |
| 接口回 401,凭证明明填了 | 空凭证时仍然发了半截头(`Bearer ` 后面是空) | `run --full`,把凭证夹具清空再跑 | 用 `op:if` 整体换掉 header 对象,不发就一个键都不发 | `numable docs credentials` |
| 凭证被静默透传成匿名 | `request.credential` 写了 `${}` 表达式,或引用了未声明的 id | `check` 拦(G18) | 写字面量 declId,并在 `manifest.credentials` 里声明 | `numable docs credentials` |
| 密钥出现在渲染缓存 / 分享截图里 | 凭证进了 `resultFilter` 输出 | 看 `run --full` 的输出键 | 只透 `hasToken` 这类旗标 | `numable docs credentials` |
| 发布被拒:params 里像凭证 | `.xwidget.params` 的键名含 token / secret / password / api_key / 密钥 / 令牌 | `check` 拦(G18,两档都查) | 走 `manifest.credentials`,不进 params | `numable docs credentials` |
| `numable run` 整包跳过 | 声明了 `required: true` 的凭证,但没有夹具 | 输出标「跳过(声明了 required 凭证但…无夹具)」 | 在 `.numable/params/_credentials.json` 里放测试密钥(该目录永不进包) | `numable docs credentials` |

### 2.10 改了没反应

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| 改了 `.rcn` / `.df`,预览还是老样子 | 渲染图缓存按「包内容代际」分代,本机包靠目录指纹判变化 | 换一处明显的文案再试 | 保存后重新触发一次载入;必要时重开预览 | `numable docs workflow` |
| `numable render` 出的图还是旧的 | 看的是 `.numable/render/` 里上一次的 PNG | 看文件时间戳 | 重跑 `numable render`;拼图页 `index.html` 也会一起重写 | `numable docs workflow` |
| 装到手机上更新不生效 | `manifest.version` 没 +1 | 跟已发布的版本号对一下 | 每次发布 `version` 必须 +1 | `numable docs publish` |
| 改了数据但组件停在旧值 | 该组件的 `refresh` 周期还没到 | 手动下拉刷新一次 | 写盘类操作用 `widget.refresh` 主动刷 | `numable docs xwidget` |

### 2.11 多语言

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| 英文环境下某处仍是中文 | B 表(元数据)缺 `en-US` 覆盖:`manifest.i18n` / `.xwidget.i18n` / `routes[i].i18n` | `check --profile publish` 拦(G19 / G20 / G8) | 逐个补 | `numable docs i18n` |
| 一个组件上中英混着出现 | A 表(内容文案)某个 key 在这一门缺失,逐 key 兜底到了别的门 | `check --profile publish`(G8) | 每门 key 补齐 | `numable docs i18n` |
| 某个词本该留空却显示了中文 | A 表里空串是**合法译文,不兜底**;B 表里空串 = 缺,继续兜 | 对照两表 | 想留空就在 A 表写 `""`;B 表别写空串 | `numable docs i18n` |
| 屏上出现 `${@i18n.x}` 字面量或空白 | key 不在该载体读的表里(XPage 节点层读页表) | `numable check`(G35) | 把 key 补进 `.xpage` 顶层 `i18n` | `numable docs i18n` |
| 切语言后组件先出骨架、离线时空态 | 数据缓存按语言分开:新语言下没有落盘数据,取到再显示;离线就没有该语言的数据 | 预期行为 | 联网后下拉刷新一次 | `numable docs i18n` |
| 切语言后组件文案没变 | 文案写死在 `.df` 或 `.rcn` 里没走 `${@i18n.key}`;或接口本身不分语言 | 人审 | 顶层加 `i18n` 表、文案改 `${@i18n.key}`;按语言取数读 `${@app.language}` | `numable docs i18n` |

### 2.12 刷新问题

| 现象 | 最可能原因 | 怎么确认 | 修法 | 相关章 |
|---|---|---|---|---|
| 刷新太频繁、配额被打光 | `interval` 比上游限流允许的更密 | 看 `.xwidget` 的 `canvas.refresh` 和对应 `.df` 每次打几个请求 | 按「每次请求数 × 每小时次数 ≤ 上游配额」调;分时段用窗口写法 `"09:30-15:00@10"` | `numable docs xwidget` |
| 桌面小组件的数据停在「上次打开 App 那一刻」(鸿蒙) | 鸿蒙服务组件进程只读封面图,不跑渲染、不联网 | App 里 | 这是平台能力差异,不是包的问题;别把关键新鲜度押在鸿蒙桌面组件上 | `numable docs capabilities` |
| 下拉刷新了等于没刷(带缓存的页面) | 根 `depends` 带首屏缓存但没有 `events.onRefresh` | `check --profile publish` 拦(G23) | `onRefresh` 里先 `data.remove` 缓存键,再 `xpage.reloadPage` | `numable docs page` |
| 组件整条刷新链空转 | 组件消费的 `.df` 里有无开关的缓存写回 | `check --profile publish` 拦(G23) | 缓存写回受入参 `${_cache}` 开关控制、默认关(页面传 `"_cache":1`,`.xwidget` 不传) | `numable docs df` |
| 取数失败后好数据被空数据覆盖 | 组件的 `.df` 没有 `action:"error"` 出口,失败被报成成功 | `check` 拦(G26,两档都查) | 主干字段判空 → `error`;「集合为空」算成功 | `numable docs df` |

---

## 3. 静默失效总表

下面这些错误**在哪个平台上都不报错**、`check` 也拦不住(或只在发布档才拦),只能靠 `run --full` 逐键看、`render` 三态目测、或人眼审。做完包按这张表过一遍。

| 只能靠什么发现 | 静默失效 |
|---|---|
| `run --full` 逐键看 | 取值路径错一层(流仍 success)· 未注册方法静默求空(`abs` / `avg` / `filter` / `push` / `indexOf` 都不存在)· 方法参数里的 `${}` 看不见 flow 入参 · `op:set` 依赖顺序颠倒导致分支恒落 else · `eq::` 数字化比较让判空为真 · `length::` 对数字恒返 0 · `${a[${i}]}` 嵌套下标 · `sum::([])` = 0 被当成真值渲出 · GraphQL 恒 200、错误藏在 `errors[]` · 秒级时间戳没 ×1000 · `op:include` 恒展开成空而流照报成功 · `htmlParse` / `xmlParse` 的 `rules` 写成对象 |
| `render --states empty` | 空态一片白 · 空态数字渲成 0 / 0.0 而不是 `--` · 尺寸串里 `calc` 算出 null 导致整组件失败 · flow 算色空态变透明 · `line.points` 空槽 · 空态骨架画在 `forEach` 里开洞 |
| `render --states dark` | 单色硬编码在暗色下变白块 · 三段颜色的中段不生效 · 弱一档颜色与底色通道差 < 10 |
| `render` 目测像素 | `px` 当单位被密度换算 · `connect::` 吃空格 · 胶囊被长文案顶出 · `txt` 盒顶 = 字形 ink 顶造成错位 · 曲线末端圆点被裁 · 布局锚点进 `$[calc::()]` 导致节点静默不画 · 方法参数里的渐变逗号没转义成 `\\,` · `radial` 少给 `@` 参数按 0.5 兜底 |
| 装进 App 才知道 | 事件串以 `${` 开头 → 点了没反应 · 写盘后缺 `widget.refresh` → 填了不变 · `hideLoading` 在分支内 → 转圈不停 · `numable://self` 用在 `nav.open` 里 · 15 秒硬超时打断等人的流 · XPage 根 `params` 顶掉路由 query · Android 数字渲成 `17.0` · `parseDate` 非安全 pattern 在手机上返 null · `xmlParse` 各平台引擎不一致 · XPage 上那批没有实现的字段(`onVisible` / `onScroll` / `virtualization` …)· `onEdit` 写进 `canvas` 里 → 长按菜单没有编辑项 · `banner.xbanner` 缺 `scene` → 横幅整块空白 |
| 人审 | 业务键撞上保留键 `lang` / `theme` · 凭证进了 `resultFilter` · 一个组件回答了两个问题 · 未就绪态文案说「没有」而不是「没接入」· 能进去但出不来的交互 · 定长网格把「没取到」画成 0 |

---

## 相关

`numable docs lint-codes` · `numable docs workflow` · `numable docs methods`
