<!-- translated-from: zh-CN/2-reference/95-sources.md sha256:dbbb84bbaebd -->

# sources — Data sources used by the official tools

> For: people building a tool, and the AI doing it for them.

The table lists the hosts the published official tools fetch data from. If the tool you are building talks to a host that is already here, read the `.df` of an official tool that uses it first and follow it: request headers, field paths, units and empty-value handling have already been worked out there.

- **Key**: the host is only called after the user adds their own key — see `numable docs credentials`.
- Add the host to your own tool's `manifest.network`; requests to anything not listed are blocked.
- These are third-party services; their terms, limits and availability by region apply.

89 hosts across 28 tools.

| Host | Official tools using it | Key |
|---|---|---|
| `datacenter-web.eastmoney.com` | Fuel Prices · Macro Calendar · Stocks |  |
| `push2delay.eastmoney.com` | Futures · Portfolio · Stocks |  |
| `query1.finance.yahoo.com` | Futures · Portfolio · Stocks |  |
| `air-quality-api.open-meteo.com` | Air Quality · Weather |  |
| `api.frankfurter.dev` | App Store Board · Portfolio |  |
| `fundmobapi.eastmoney.com` | Funds · Portfolio |  |
| `fundsuggest.eastmoney.com` | Funds · Portfolio |  |
| `geocoding-api.open-meteo.com` | Air Quality · Weather |  |
| `m.cmbchina.com` | Exchange Rates · Gold Price |  |
| `nominatim.openstreetmap.org` | Air Quality · Weather |  |
| `push2his.eastmoney.com` | Futures · Stocks |  |
| `query2.finance.yahoo.com` | Portfolio · Stocks |  |
| `www.ccb.com` | Exchange Rates · Gold Price |  |
| `www.okx.com` | Crypto · Portfolio |  |
| `api-one-wscn.awtmt.com` | Macro Calendar |  |
| `api.alternative.me` | Crypto |  |
| `api.appstoreconnect.apple.com` | App Store Board | yes |
| `api.cloudflare.com` | Cloudflare Watch | yes |
| `api.coingecko.com` | Crypto |  |
| `api.exchange.coinbase.com` | Crypto |  |
| `api.github.com` | GitHub Inbox | yes |
| `api.gold-api.com` | Gold Price |  |
| `api.jijinhao.com` | Gold Price |  |
| `api.npmjs.org` | Package Stats |  |
| `api.open-meteo.com` | Weather |  |
| `api.revenuecat.com` | RevenueCat | yes |
| `api.statistiken.bundesbank.de` | Rates |  |
| `api.stripe.com` | Stripe Revenue | yes |
| `api.wise.com` | Exchange Rates |  |
| `bitbucket.status.atlassian.com` | Service Status |  |
| `cdn-api.cboe.com` | Stocks |  |
| `crates.io` | Package Stats |  |
| `data.eastmoney.com` | Stocks |  |
| `datacenter.eastmoney.com` | Stocks |  |
| `discordstatus.com` | Service Status |  |
| `ewealth.abchina.com` | Exchange Rates |  |
| `formulae.brew.sh` | Package Stats |  |
| `futsseapi.eastmoney.com` | Futures |  |
| `github.com` | Release Watch |  |
| `hn.algolia.com` | Hacker News |  |
| `home.treasury.gov` | Rates |  |
| `hub.docker.com` | Package Stats |  |
| `huggingface.co` | Hugging Face Papers |  |
| `icbcphp.icbc.com.cn` | Gold Price |  |
| `itunes.apple.com` | App Store Board |  |
| `linearstatus.com` | Service Status |  |
| `lobste.rs` | Lobsters |  |
| `markets.newyorkfed.org` | Macro Calendar |  |
| `np-anotice-stock.eastmoney.com` | Stocks |  |
| `np-weblist.eastmoney.com` | Stocks |  |
| `papi.icbc.com.cn` | Exchange Rates |  |
| `pypi.org` | Package Stats |  |
| `pypistats.org` | Package Stats |  |
| `registry.npmjs.org` | Package Stats |  |
| `searchapi.eastmoney.com` | Portfolio |  |
| `searchconsole.googleapis.com` | Search Console | yes |
| `stats.bis.org` | Rates |  |
| `status.circleci.com` | Service Status |  |
| `status.claude.com` | Service Status |  |
| `status.cursor.com` | Service Status |  |
| `status.datadoghq.com` | Service Status |  |
| `status.digitalocean.com` | Service Status |  |
| `status.figma.com` | Service Status |  |
| `status.mongodb.com` | Service Status |  |
| `status.npmjs.org` | Service Status |  |
| `status.openai.com` | Service Status |  |
| `status.postman.com` | Service Status |  |
| `status.render.com` | Service Status |  |
| `status.sentry.io` | Service Status |  |
| `status.supabase.com` | Service Status |  |
| `usage.numable.app` | Claude Code Usage | yes |
| `wise.com` | Exchange Rates |  |
| `www.boc.cn` | Exchange Rates |  |
| `www.chinamoney.com.cn` | Exchange Rates |  |
| `www.cloudflare.com` | Cloudflare Watch |  |
| `www.cloudflarestatus.com` | Cloudflare Watch |  |
| `www.dockerstatus.com` | Service Status |  |
| `www.federalreserve.gov` | Macro Calendar |  |
| `www.githubstatus.com` | Service Status |  |
| `www.googleapis.com` | YouTube Stats | yes |
| `www.mof.go.jp` | Rates |  |
| `www.netlifystatus.com` | Service Status |  |
| `www.notion-status.com` | Service Status |  |
| `www.redditstatus.com` | Service Status |  |
| `www.sec.gov` | SEC Filings |  |
| `www.v2ex.com` | V2EX |  |
| `www.vercel-status.com` | Service Status |  |
| `www.youtube.com` | YouTube Stats |  |
| `yield.chinabond.com.cn` | Rates |  |
