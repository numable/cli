# sources —— 官方工具用到的数据源

> 读者:做工具的用户,和替他干活的 AI。

下表列出线上官方工具从哪些域名取数据。要做的工具碰到表里已有的域名时,先读用它的那个官方工具的 `.df`,照着写:请求头、字段路径、单位、空值的处理都已经在那里试过。

- **要密钥**:这个域名只在用户填了自己的密钥后才会被请求,见 `numable docs credentials`。
- 域名要写进你自己工具的 `manifest.network`,不在里面的请求会被拦下。
- 表里的域名是第三方服务,条款、限额和可用地区以对方为准。

共 89 个域名、28 个工具。

| 域名 | 用到它的官方工具 | 要密钥 |
|---|---|---|
| `datacenter-web.eastmoney.com` | 油价 · 宏观日历 · 股票行情 |  |
| `push2delay.eastmoney.com` | 期货 · 我的持仓 · 股票行情 |  |
| `query1.finance.yahoo.com` | 期货 · 我的持仓 · 股票行情 |  |
| `air-quality-api.open-meteo.com` | 空气质量 · 天气 |  |
| `api.frankfurter.dev` | App Store 看板 · 我的持仓 |  |
| `fundmobapi.eastmoney.com` | 基金 · 我的持仓 |  |
| `fundsuggest.eastmoney.com` | 基金 · 我的持仓 |  |
| `geocoding-api.open-meteo.com` | 空气质量 · 天气 |  |
| `m.cmbchina.com` | 汇率 · 金价 |  |
| `nominatim.openstreetmap.org` | 空气质量 · 天气 |  |
| `push2his.eastmoney.com` | 期货 · 股票行情 |  |
| `query2.finance.yahoo.com` | 我的持仓 · 股票行情 |  |
| `www.ccb.com` | 汇率 · 金价 |  |
| `www.okx.com` | 加密货币 · 我的持仓 |  |
| `api-one-wscn.awtmt.com` | 宏观日历 |  |
| `api.alternative.me` | 加密货币 |  |
| `api.appstoreconnect.apple.com` | App Store 看板 | 是 |
| `api.cloudflare.com` | Cloudflare 状态 | 是 |
| `api.coingecko.com` | 加密货币 |  |
| `api.exchange.coinbase.com` | 加密货币 |  |
| `api.github.com` | GitHub 待办 | 是 |
| `api.gold-api.com` | 金价 |  |
| `api.jijinhao.com` | 金价 |  |
| `api.npmjs.org` | 开源包下载量 |  |
| `api.open-meteo.com` | 天气 |  |
| `api.revenuecat.com` | RevenueCat 订阅 | 是 |
| `api.statistiken.bundesbank.de` | 利率 |  |
| `api.stripe.com` | Stripe 收入 | 是 |
| `api.wise.com` | 汇率 |  |
| `bitbucket.status.atlassian.com` | 服务状态 |  |
| `cdn-api.cboe.com` | 股票行情 |  |
| `crates.io` | 开源包下载量 |  |
| `data.eastmoney.com` | 股票行情 |  |
| `datacenter.eastmoney.com` | 股票行情 |  |
| `discordstatus.com` | 服务状态 |  |
| `ewealth.abchina.com` | 汇率 |  |
| `formulae.brew.sh` | 开源包下载量 |  |
| `futsseapi.eastmoney.com` | 期货 |  |
| `github.com` | 开源项目发布 |  |
| `hn.algolia.com` | Hacker News |  |
| `home.treasury.gov` | 利率 |  |
| `hub.docker.com` | 开源包下载量 |  |
| `huggingface.co` | HF 每日论文 |  |
| `icbcphp.icbc.com.cn` | 金价 |  |
| `itunes.apple.com` | App Store 看板 |  |
| `linearstatus.com` | 服务状态 |  |
| `lobste.rs` | Lobsters |  |
| `markets.newyorkfed.org` | 宏观日历 |  |
| `np-anotice-stock.eastmoney.com` | 股票行情 |  |
| `np-weblist.eastmoney.com` | 股票行情 |  |
| `papi.icbc.com.cn` | 汇率 |  |
| `pypi.org` | 开源包下载量 |  |
| `pypistats.org` | 开源包下载量 |  |
| `registry.npmjs.org` | 开源包下载量 |  |
| `searchapi.eastmoney.com` | 我的持仓 |  |
| `searchconsole.googleapis.com` | Google 搜索表现 | 是 |
| `stats.bis.org` | 利率 |  |
| `status.circleci.com` | 服务状态 |  |
| `status.claude.com` | 服务状态 |  |
| `status.cursor.com` | 服务状态 |  |
| `status.datadoghq.com` | 服务状态 |  |
| `status.digitalocean.com` | 服务状态 |  |
| `status.figma.com` | 服务状态 |  |
| `status.mongodb.com` | 服务状态 |  |
| `status.npmjs.org` | 服务状态 |  |
| `status.openai.com` | 服务状态 |  |
| `status.postman.com` | 服务状态 |  |
| `status.render.com` | 服务状态 |  |
| `status.sentry.io` | 服务状态 |  |
| `status.supabase.com` | 服务状态 |  |
| `usage.numable.app` | Claude Code 用量 | 是 |
| `wise.com` | 汇率 |  |
| `www.boc.cn` | 汇率 |  |
| `www.chinamoney.com.cn` | 汇率 |  |
| `www.cloudflare.com` | Cloudflare 状态 |  |
| `www.cloudflarestatus.com` | Cloudflare 状态 |  |
| `www.dockerstatus.com` | 服务状态 |  |
| `www.federalreserve.gov` | 宏观日历 |  |
| `www.githubstatus.com` | 服务状态 |  |
| `www.googleapis.com` | YouTube 频道数据 | 是 |
| `www.mof.go.jp` | 利率 |  |
| `www.netlifystatus.com` | 服务状态 |  |
| `www.notion-status.com` | 服务状态 |  |
| `www.redditstatus.com` | 服务状态 |  |
| `www.sec.gov` | 美股公告 |  |
| `www.v2ex.com` | V2EX |  |
| `www.vercel-status.com` | 服务状态 |  |
| `www.youtube.com` | YouTube 频道数据 |  |
| `yield.chinabond.com.cn` | 利率 |  |
