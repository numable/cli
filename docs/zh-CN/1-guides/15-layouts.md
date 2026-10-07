# layouts —— 从官方版式起步:选版式、接数据、写文案

> 读者:做工具的用户,和替他干活的 AI。两者读同一份。

## 目标

不画画面,也能做出一个看起来像官方出品的组件:从十二个官方版式里挑一个,把它的**槽位**接上你的数据和文案。坐标、字号、配色、明暗两套、数字格式化、取不到数据时的空态,全部由版式负责;你只碰一个文件里的一段。

适合谁:想要一个「显示某个数」的组件,而现成工具里没有(用现成组件组仪表盘见 `numable docs board`)。要自己设计画面,走 `numable docs first-card`。

## 十二个版式

| 名字 | 是什么 | 适合 | 档位 |
|---|---|---|---|
| `big-number` | 一个大数字 + 单位 + 一句副标 | 步数、余额、粉丝数、温度 | `22` · `11` |
| `change` | 价格 + 涨跌幅胶囊,按用户的涨跌色习惯上色 | 股价、汇率、指数 | `22` · `21` |
| `sparkline` | 数字 + 一条近期走势线 | 体重、访问量、行情 | `22` · `21` |
| `list` | 3–5 行,每行名字 + 右侧一个值 | 自选、待办、几个服务 | `42` · `44` |
| `progress` | 完成 / 目标:方形是进度环,迷你是进度条 | 今日步数、预算、配额 | `22` · `21` |
| `countdown` | 离某一天还有 N 天(当天、已过都会自己换说法) | 纪念日、假期、截止日 | `22` · `21` |
| `checkin-grid` | 每天做没做的格子,右下角是今天 | 习惯、运动、学习 | `22` · `42` |
| `compare` | 同一个量在 2–3 个对象间并排比,最大的标出来 | 几个人的跑量、几个渠道的下载 | `42` |
| `status` | 一盏灯:正常 / 留意 / 故障 / 未知 | 网站、服务、设备 | `22` · `11` |
| `ranking` | 前 N 名带名次,大档每行一根相对长度条 | 支出分类、热门文章 | `44` · `22` |
| `agenda` | 下一件事:什么事、几点、还有多久、在哪 | 会议、课程、服药 | `22` · `21` |
| `dual-metric` | 两个不同的量各占一块 | 距离与爬升、收入与订单 | `42` · `22` |

档位见 `numable docs xwidget`(`22` = 158×158,`42` = 338×158,`44` = 338×354,`21` = 158×60,`11` = 68×60)。每个版式的所有档位共用**同一条取数流**:槽位填一次,几个尺寸一起有。

列出全部版式:

```
numable init --layout
```

## 前置

1. `numable` 命令可用;要出图还需要 Chrome / Chromium(`numable doctor` 自检)。
2. 知道数据从哪来:一个公开接口、本包存的数据,或者干脆是几句固定文案。

## 步骤 1 · 用版式建包

**做什么**:`--layout` 后面写版式名字。建出来的是一个普通的包,身份(ULID)是新的。

**命令**

```
numable init weight --layout sparkline --title 体重
```

**看到什么算对**

```
✓ 新包 体重  id=01M4A4GN96F18T671BSM14R5T4
  目录: /…/weight
  来源: 版式 sparkline(槽位说明见 slots.json)
```

目录里是:

```
weight/
  manifest.json
  slots.json                  槽位说明(只给人和 AI 读,不影响运行)
  xWidget/
    sparkline.xwidget         22 档
    sparkline-21.xwidget      21 档
    rc/sparkline.rcn          画法:不要改
    rc/sparkline-21.rcn       画法:不要改
    flow/sparkline.df         取数:只改「① 槽位」那一段
```

建好就能直接出图 —— 每个版式都带一份示例数据,不联网:

```
numable render weight
```

## 步骤 2 · 读 slots.json

**做什么**:先看每个槽要什么,再动手。一个槽长这样:

```json
{
  "key": "series",
  "kind": "data",
  "type": "series",
  "required": true,
  "meaning": {
    "zh-CN": "走势:数字数组,按时间从旧到新,最后一个 = 现在。取最后 16 个点;不足 16 个时左边补平",
    "en-US": "History: an array of numbers, oldest first, last = now. The last 16 points are drawn; fewer are padded flat on the left"
  },
  "example": [920, 980, 1010, "…", 1284],
  "whenEmpty": { "zh-CN": "图位画一块骨架", "en-US": "A skeleton block in the chart area" }
}
```

| 字段 | 意思 |
|---|---|
| `key` | 槽名,也是 `.df` 里那条 `op:set` 的 `key` |
| `kind` | `copy` 文案 · `data` 数据 · `style` 样式开关(只能选给定的名字) |
| `type` | 值的形状,见下面「槽位约定」 |
| `required` | 必填槽不给,组件上那个位置显示 `--` |
| `maxLen` | 按档位给的最长字数(中文字数,英文约 1.8 倍字符);超出以「…」截断,不会挤坏画面 |
| `values` | `enum` 槽可选的值 |
| `example` | 示例值 |
| `whenEmpty` | 这个槽空着时组件上长什么样 |

`slots.json` 的 `pick` 一句话说这个版式适合什么,`sizes` 列出它有哪几个档位。

## 步骤 3 · 填槽位

**做什么**:打开 `xWidget/flow/<版式>.df`。它分两段,中间用两条空 `op:set`(`_slots` / `_derived`)隔开:

- **① 槽位**:每个槽一条 `op:set`。把示例值换成你的取数表达式或文案 —— **只改这一段**。
- **② 派生**:把槽位算成组件要画的东西(格式化数字、涨跌方向、折线坐标、颜色角色)。不要改,改了画面会错位或整块空白。

文案写进文件顶层的 `i18n` 表,槽位里写 `${@i18n.<键>}`;表里 `t_` 开头的键是版式自带的文案,不要改。要联网,就在 ① 之前加 `request` 和一个屏障,并把 host 写进 `manifest.json` 的 `network`。

一个填好的 ① 段(体重,数据来自一个公开接口):

```json
{
  "version": 1,
  "i18n": {
    "zh-CN": { "title": "体重", "unit": "kg", "note": "近 16 次" },
    "en-US": { "title": "Weight", "unit": "kg", "note": "Last 16 weigh-ins" }
  },
  "actions": [
    {
      "id": "resp",
      "action": "request",
      "params": { "url": "https://api.example.com/weight", "method": "GET", "formatType": "json", "timeout": "8000" }
    },
    { "op": "set", "props": { "key": "_b", "value": "1" }, "_note": "屏障:request 之后紧邻的节点读不到结果" },
    { "op": "set", "props": { "key": "_slots", "value": "1" } },
    { "op": "set", "props": { "key": "title", "value": "${@i18n.title}" } },
    { "op": "set", "props": { "key": "value", "value": "${resp.latest}" } },
    { "op": "set", "props": { "key": "format", "value": "1dp" } },
    { "op": "set", "props": { "key": "unit", "value": "${@i18n.unit}" } },
    { "op": "set", "props": { "key": "series", "value": "$[pluck::(${resp.history},kg)]" } },
    { "op": "set", "props": { "key": "change", "value": "" } },
    { "op": "set", "props": { "key": "note", "value": "${@i18n.note}" } },
    { "op": "set", "props": { "key": "at", "value": "$[formatDate::(${@time.nowMs},HH:mm)]" } },
    { "op": "set", "props": { "key": "accent", "value": "teal" } },
    { "op": "set", "props": { "key": "_derived", "value": "1" } }
  ]
}
```

(`_derived` 之后的 ② 段与 `resultFilter` 原样保留,这里没有抄出来。)

- 接口给的是对象数组、版式要的是数组(`series`、`names`、`values`),用 `$[pluck::(${resp.list},字段)]` 摘一列。
- 数字给原始值就行,不用自己格式化:`format` 槽决定显示成 `8,432` / `8.4K` / `8432.0`。
- 可选槽不用就写空串 `""`,不要删掉那一条 —— 删了,② 段读不到它。

**命令**

```
numable check weight
numable run weight
numable render weight
```

**看到什么算对**:`check` 零 error;`run` 每条流 `✓`;`render` 出的浅色 / 暗色 / 空态三列里,数字、文案都在预期位置,长文案以「…」结尾而不是压到别的字上。

## 槽位约定

| `type` | 写什么 | 例 |
|---|---|---|
| `text` | 一句话 | `"比昨天多 1,204 步"` |
| `number` | 一个数(数字或数字串,带千分位逗号也行;不是数字时原样显示) | `8432` |
| `percent` | 百分比的那个数,`-1.23` 表示跌 1.23%(带不带 `%` 都行) | `1.37` |
| `time` | 时效锚,当天 `HH:mm`、跨天 `MM-dd HH:mm`;纯本地计算的组件留空 | `"14:30"` |
| `date` | `yyyy-MM-dd` | `"2027-02-06"` |
| `datetime` | `yyyy-MM-dd HH:mm` | `"2026-10-08 14:30"` |
| `series` | 数字数组,从旧到新 | `[920, 980, 1284]` |
| `bits` | 按天的 `0` / `1` 串,最后一位是今天 | `"0110111"` |
| `text[]` / `number[]` | 数组,一行一个,从上到下 | `["Apple", "NVIDIA"]` |
| `enum` | 只能是 `values` 里的一个 | `"ok"` |

三个公共槽:

- `title`:组件名(第一行)。有对象写对象名(`贵州茅台`、`上海`),没有就写功能名(`今日步数`)。不写来源名 —— 用户知道这是哪个工具。
- `accent`:源色,只选名字:`indigo` `green` `blue` `purple` `orange` `rose` `teal` `graphite`。它画身份点和版式里唯一的强调色。涨跌类用 `graphite`(红绿已经代表涨跌)。
- `at`:右上角的时效锚。数据是联网取的就写取数时刻;空着这一格就不显示。

`format`(有数字的版式才有):`auto` 千分位 + 最多两位小数 · `int` 取整 · `1dp` / `2dp` 固定小数 · `compact` 中文用万 / 亿、英文用 K / M / B · `raw` 原样。`11` 档恒用紧凑写法。

涨跌色不用你管:`change` / `sparkline` 按用户在 App 里选的涨跌颜色上色,没选时中文红涨、其余绿涨。

## 规则(违反 = 返工)

| 规则 | 检查方式 | 违反时的现象 | 修法 |
|---|---|---|---|
| 只改 `.df` 的「① 槽位」段与 `i18n` 表 | 人审 | 改了 `.rcn` 坐标或 ② 段:换个数据就错位、字段全空 | 从版式重建,只在 ① 段接数据 |
| 槽位一条都不删,不用的写 `""` | run 层 | ② 段读不到,对应位置渲 `--` 或整块空 | 把那条 `op:set` 加回来 |
| 槽名不改 | run 层 | 组件那个位置恒为空 | 照 `slots.json` 的 `key` 写 |
| 文案写进 `i18n` 表,中英两份 | 人审 | 切到英文还是中文 | 槽里写 `${@i18n.<键>}` |
| 联网就声明 `network` | `check` G3 | 请求被拦,组件一直是空态 | 把 host 写进 `manifest.json` |

## 出错怎么办

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| `run` 报「字段为空: note」 | 可选槽故意留了空串 | 在 `.numable/params/_dfrun.json` 里声明:`{ "optionalEmpty": { "<组件名>": ["note"] } }` |
| 数字显示 `--` | 槽里的表达式取不到值(路径写错 / 接口失败) | `numable run <包>` 看那条流的输出 |
| 走势线是一条平线 | `series` 不是数组,或只有一个点 | 用 `pluck::` 摘出数字数组 |
| 涨跌胶囊是灰的 | `change` 为空或为 0 | 确认给的是百分比的数,不是价格 |
| 打卡格子全灰 | `days` 不是 `0` / `1` 串 | 把记录拼成按天的位串,最后一位是今天 |

## 下一步

- 想在一个包里放几个版式:各建一个包,把 `xWidget/` 下的文件挪到同一个包里(文件名别撞),再 `numable check`。
- 发布前可以删掉 `slots.json`(留着也不影响运行);发布还要 `logo.png` 与至少三个组件,见 `numable docs publish`。

## 相关

- `numable docs df` —— 取数流的写法与白名单
- `numable docs board` —— 用现成组件组仪表盘
- `numable docs first-card` —— 自己设计画面
