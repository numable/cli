# credentials —— 接需要密钥的数据源

> 读者:做工具的用户,和替他干活的 AI。两者读同一份。

## 目标

有些数据源没有 token 就用不了(或者配额低到没法用)。这一章把「用户自己去申请一个 token」的源接进来,做完之后:

- `manifest.json` 里多一条 `credentials` 声明,安装面板会把它披露给用户;
- `.df` 的 `request` 上写一个 `credential: "gh"`,**流里一个字节的密钥都没有**;
- 你在本机用一份不进包的夹具跑通取数;
- 用户在 App 的「我的 → 凭证管理」里绑定自己的 token,由 App 在网络边界注入。

**贯穿全章的一件事:密钥归用户,不归包。** 你写的是「这个包需要一把什么样的钥匙、往哪个域名递」,钥匙本身由 App 保管、由 App 注入,包永远看不到它的值。

## 前置

- 目标接口用一个 header / query 参数就能鉴权(OAuth 那类见文末);
- 这个接口的域名已经写进 `manifest.network`;
- 手上有一把你自己的 token 用来本机验证。

---

## 步骤 1 · 在 manifest 里声明

**做什么**:加 `credentials` 数组。全章用一个虚构的示例包「GitHub 示例」来讲(不是商店里的 GitHub 工具):它读某个用户的公开动态,匿名就能读,绑了令牌配额更高 —— 正好是 `required: false` 的两档。

```json
{
  "id": "01J9ZQ3K4M5N6P7R8S9T0V1W2X",
  "version": 1,
  "title": "GitHub 示例",
  "lang": "zh-CN",
  "category": "developer",
  "subtitle": "某个用户最近的公开动态",
  "domain": "github",
  "minEngine": "1.0.0",
  "network": ["api.github.com"],
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
  ],
  "i18n": { "en-US": { "title": "GitHub Sample", "subtitle": "A user's recent public activity" } }
}
```

逐字段:

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✓ | 声明 id(declId)。`.df` 里用**字面量**引它;包内唯一 |
| `type` | ✓ | 注入机制,见下表 |
| `hosts` | ✓ | 这把钥匙**允许被送往**的 host,必须是 `manifest.network` 的子集 |
| `label` | ✓ | 绑定面板上显示的名字。裸字符串 = `manifest.lang` 那门语言,译文旁挂同级 `i18n` |
| `i18n` | ✓ | 至少给出 `zh-CN` / `en-US` 两门(基准门写在裸 `label` 里,另一门放这) |
| `required` | | `false`(缺省)= 没绑也能用,匿名降级;`true` = 没绑就不发请求 |
| `help` | | 教用户去哪申请的页面,必须是 https |
| `headerName` | `type=header` 时必填 | 注入到哪个头 |
| `paramName` | `type=query` 时必填 | 注入到哪个 query 参数 |

`type` 四种简单机制(注入形状由 App 决定,包管不着):

| `type` | 注入成什么 | 何时用 |
|---|---|---|
| `bearer` | `Authorization: Bearer <值>` | 最常见 |
| `token` | `Authorization: token <值>` | GitHub 这类 |
| `header` | `<headerName>: <prefix?><值>` | 自定义头,如 `X-Goog-Api-Key` |
| `query` | URL 上追加 `?<paramName>=<值>` | **只给 query-only 的 API**;能走头就走头(`check` 恒出一条 W 提醒你确认) |

`jwt-assertion` 与 `oauth2` 只能引用平台内置的 preset(`preset` 字段),自己写声明会被拦——OAuth 的授权端点如果由包作者自由声明,等于允许包把用户送进一个钓鱼页。需要新 preset 走反馈。

**命令**

```
numable check <包>
```

**看到什么算对**:没有 G18 的 error。常见的四条:

| 报错 | 修法 |
|---|---|
| `credentials[i] 缺 hosts` | 显式写,凭证的发送面不能靠推断 |
| `host "x" ∉ manifest.network` | 先加进 `network`(那是安装面板披露给用户的清单) |
| `label 缺 en-US 覆盖` | 补 `i18n`;绑定面板要渲这个字段 |
| `type "x" 不在机制白名单` | 换 `bearer` / `token` / `header` / `query` |

---

## 步骤 2 · 取数流里只写 declId

**做什么**:在 `request` 的 `params` 里写 `credential`,值是**字面量** declId。

`xWidget/flow/events.df` 片段(入参 `login` 来自 `.xwidget` 的 `params`):

```json
{
  "version": 1,
  "actions": [
    { "op": "set", "props": { "key": "h", "value": "${login}" } },
    { "op": "set", "props": { "key": "hdr", "value": { "Accept": "application/vnd.github+json", "User-Agent": "Numable" } } },

    { "op": "if", "props": { "val": "$[if::(eq::(${h},),0,1)]" },
      "items": [
        { "id": "ev", "action": "request",
          "params": {
            "url": "https://api.github.com/users/${h}/events/public?per_page=100",
            "method": "GET",
            "header": "${hdr}",
            "formatType": "json",
            "credential": "gh"
          }
        }
      ]
    },

    { "op": "set", "props": { "key": "_b", "value": "1" } },
    { "op": "set", "props": { "key": "iso", "value": "$[pluck::(${ev},created_at)]" } },
    { "op": "set", "props": { "key": "actN", "value": "$[length::(${iso})]" } },
    { "action": "resultFilter", "params": { "keys": ["actN"] } }
  ]
}
```

三条规矩:

| 规矩 | 现象 | 检查方式 |
|---|---|---|
| `credential` 必须是字面量 declId,不能是 `${...}` | 运行时静默透传成匿名请求,401 或空数据,不报错 | `check` G18b(E) |
| 引用的 declId 必须在 `manifest.credentials` 里声明过 | 同上 | `check` G18b(E) |
| 请求的 host 必须同时在 `manifest.network` 与该声明的 `hosts` 里 | 真机上被网络守卫静默拦掉 | `check` G3(E) |

**你不写、也写不了的事**:

- 不写 `Authorization` 头——注入发生在网络边界,包写的头会被同名注入覆盖;
- 不在发请求前自己判断「绑没绑」——注入由 App 在网络边界完成,没绑就是一次匿名请求。真要按绑定状态分两档展示,用只读的 `credential.state`(`params` 写 `{ "id": "gh" }`),它只回 `bound` / `unbound` / `expired` 三态和一个换绑即变的指纹 `fp`,拿不到值;也可以直接看**响应**降级(比如无 key 时接口恒返 403);
- 不把值读出来放进任何变量。

---

## 步骤 3 · 本机跑通(夹具)

**做什么**:把你自己的 token 放进包的 sidecar 夹具。这个文件在 `.numable/` 下,**永远不会进包**(打包、编辑器、备份都忽略这个前缀),`numable init` 也已经把它写进 `.gitignore`。

`<包>/.numable/params/_credentials.json`:

```json
{
  "gh": "ghp_你自己的token"
}
```

平铺一层:**键 = declId,值 = 密钥字符串**。多把钥匙就多写几行。

同目录下另外几个夹具,一起知道更省事:

| 文件 | 作用 |
|---|---|
| `_credentials.json` | 凭证值,按 declId |
| `_datastore.json` | 预置的 `data.*` 键值(流里 `data.get` 读得到) |
| `<组件名>.json` / `<页面流名>.json` | 那条流的入参,覆盖 `.xwidget` 的默认 params |
| `_dfrun.json` | `{ "optionalEmpty": { "<流>": ["键"] }, "expectedFail": ["<流>"] }`,声明「合法为空」与「设计来失败」的流 |

**命令**

```
numable run <包> --flow events --full
```

`run` 用真的引擎、打真实网络,并按你声明的 `type` / `hosts` 做与真机逐字一致的注入:`hosts` 对不上的请求**不注**。

**看到什么算对**:

- `✓ events {...}` 且字段值是真数据 → 声明、注入、取数三件都对;
- `· events  跳过(声明了 required 凭证但 …/params/_credentials.json 无夹具)` → 你声明了 `required: true` 但没放夹具,补上;
- `✗ events 字段为空: …` → 请求发出去了但没鉴权成功(token 过期 / `type` 选错 / `hosts` 不匹配)。先把 URL 拿到终端里手动试一次,确认 token 本身有效。

⚠️ 跑完检查一下 `git status`:`.numable/` 应当是被忽略的。密钥进版本控制是不可撤销的事故。

---

## 步骤 4 · 用户那一侧

用户的路径是固定的,你不用做引导 UI,但要为两种 `required` 各准备一件事。

**用户怎么绑**:安装包时,安装面板按 `credentials` 把「这个包需要哪把钥匙、会发往哪些域名」列出来;绑定在 **App 的「我的 → 凭证管理」** 里做,由用户手势触发,值只进 App 的保管箱、不回显给包。

**免费版用户一共只能保存 1 条凭证**(同一条被几个工具共用只算 1 条),Pro 不限。对包的设计意味着:`required: true` 的包,对免费用户要么占掉他唯一的名额,要么他已经给别的包存过凭证、得升级才能再绑。能匿名降级的源就写 `required: false`,别把「没绑」做成「不能用」。

### `required: false` —— 匿名可用,绑了更好

包在没有凭证时必须仍然是一个**完整可用**的包(示例包里:GitHub 的公开动态接口匿名也能读,只是每小时配额低)。设计要点:

- 取数流的主路径不依赖「绑没绑」:同一条请求,绑了就带令牌、没绑就匿名,降级优先由**响应**决定;
- 组件上别把「未绑定」当错误来报——匿名档本来就是正常可用的一档。想提示「绑了能更快」,先用 `credential.state` 确认确实是 `unbound` 再说。

### `required: true` —— 没有钥匙就没有内容

- 宿主接管组件:没绑定时**不发请求**,那个组件渲成「需要凭证」的占位;
- 你要做的是**首页别是一张空页**:写清楚要做什么、去哪做、做完得到什么,并放一个直达按钮:

```json
{ "onClick": "numable://app/mine?section=credentials" }
```

在 html 页里就是 `location.href = "numable://app/mine?section=credentials"`(或经 `xbridge.route(...)`)。

**命令**

```
numable check <包> --profile publish
```

**看到什么算对**:声明了 `required: true` 的包,若整个 `page/` 里找不到 `numable://app/mine?section=credentials`,G25 会报 error(它只在 publish 档跑)。另外别写「先加一个组件,再按组件上提示连接」这种绕路——同一条闸会拦。

---

## 红线(四条,越了就是事故)

| 红线 | 为什么 | 检查方式 |
|---|---|---|
| 密钥值**永不进包** | 包会被签名分发给所有人 | 人审 + `check` G1b(包里禁止出现夹具类文件) |
| 密钥**永不进 `params`** | `.xwidget.params` 是用户可编辑、可回显、可分享的明文面 | `check` G18(键名像 `token`/`secret`/`api_key`/`密钥`/`令牌` 即 E) |
| 密钥**永不进 `data.*`** | `data.*` 会进本地备份、可被本包任何流读出 | 人审 |
| 密钥**永不进 `resultFilter`** | 透出去就进了渲染数据,会落进缓存与分享截图 | 人审(只透 `hasToken` 之类的旗标) |

同一条纪律的另一面:**URL 里不要拼密钥**。`type=query` 是受限档,只给没有 header 档的 API;能走头就走头。

---

## 常见错

| 现象 | 最可能的原因 | 先做什么 |
|---|---|---|
| `run` 显示 401 / 403,而 token 手动试是好的 | `type` 选错(GitHub 是 `token` 不是 `bearer`),或 `hosts` 与请求域名对不上 | 对着接口文档确认前缀;`hosts` 写请求的**纯 host** |
| `run` 通过,真机上没数据 | 请求的 host 没进 `manifest.network`(网络守卫在真机上强制) | `check` G3 会报;`run` 也会打印「网络白名单已强制」 |
| `check` 报 `credential 必须是字面量` | 写成了 `"credential": "${credId}"` | 写死 declId |
| 绑定面板上显示的是 `gh` 这样的 id | `label` 缺失 | 补 `label` + `i18n` |
| 英文环境下绑定面板是中文 | `label` 只有基准门 | 补 `i18n["en-US"].label` |
| 声明了 `required: true`,`run` 全部跳过 | 没放 `_credentials.json` 夹具 | 放夹具;别为了跑通把 `required` 改成 `false` |
| 重定向到别的域后请求失败 | 逐跳重定向守卫:跳出白名单即拒,凭证也逐跳剥除 | 把跳转目标域也声明进 `network`,或改用不重定向的端点 |
| 想接 OAuth 登录类的源 | `oauth2` / `jwt-assertion` 是 preset-only | 用已有 preset;没有就走反馈提请求 |

## 下一步

- 取数流的完整白名单与 `request` 全参数:`numable docs df`
- 包身份、`network`、manifest 全字段:`numable docs layout`
- 从个人自用到上架(publish 档全闸):`numable docs publish`
