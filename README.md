> **About this repository** — the public home of the `numable` CLI: the authoring docs
> (English and Chinese), the templates, and the issue tracker. The CLI itself ships on npm
> (`npx numable`); its source currently lives in Numable's main repository and will be published
> here once its internal dependencies are untangled. Everything below is mirrored from
> **numable@0.1.14**; docs for any earlier version are under its tag (e.g. `v0.1.12`).
> Bugs, questions and ideas: [open an issue](https://github.com/numable/cli/issues).
>
> **关于这个仓库** —— `numable` 创作命令行的公开主页:中英创作文档、模板和问题反馈。命令行本身在 npm 上
> (`npx numable`);源码目前在 Numable 主仓里,理清内部依赖后会放到这里。下面的内容同步自
> **numable@0.1.14**;更早版本的文档在对应的 tag 下(如 `v0.1.12`)。报 bug、提问题、提想法:[开一个 issue](https://github.com/numable/cli/issues)。

# numable

Authoring CLI for **Numable** tools — the content bundles (XBundle) that show up as widgets on a
Numable dashboard and as native widgets on your home screen.

It is built to be driven **by your own AI agent** (Claude Code, Codex, Cursor…) as much as by you:
`numable workspace init` writes an `AGENTS.md` into the folder, the whole spec ships inside the CLI
(`numable docs`), and every rule the spec states is enforced by a command the agent can run itself.

```bash
npx numable init my-card     # new bundle from the starter template
cd my-card
npx numable check            # static gate — same rules as the publish pipeline
npx numable run              # run every data flow for real, against the real network
npx numable render           # render the widgets to PNG (light / dark / empty)
```

Install it locally if you use it often:

```bash
npm i -g numable
```

## Commands

| | |
|---|---|
| `numable workspace init [dir]` | Turn a directory into an authoring workspace (writes the AI guide) |
| `numable init <dir> [--from <bundle>]` | New bundle: clone the starter template, an existing bundle, or an official tool from [numable/tools](https://github.com/numable/tools) (`--from github:weather`), with a fresh identity |
| `numable check [bundles…]` | Static gate. `--profile personal` (default) skips the store-only rules; `publish` runs everything |
| `numable run [bundles…]` | Data layer for real: every `.df` through the real engine and the real network |
| `numable render [bundles…]` | Render layer: the real drawing core to PNG, per theme and locale |
| `numable docs [topic]` | Read the spec, one chapter at a time |
| `numable doctor` | Check the environment, engine version and workspace, and whether a newer CLI is out |

Common flags: `--json` for machine-readable output, `--lang zh|en` for the interface language.
Env vars: `NUMABLE_PROFILE`, `NUMABLE_LANG`, `NUMABLE_CHROME`.

## The spec travels with the CLI

There is no separate documentation site to keep in sync — the same Markdown the CLI prints is what
the Numable desktop app shows in its reader, in English and Chinese:

```bash
numable docs workflow      # start here: the authoring sequence and the hard rules
numable docs capabilities  # what you can build, and where the platforms differ
numable docs pitfalls      # symptom → cause → fix
```

Three of the reference chapters (`rcn-nodes`, `methods`, `lint-codes`) are generated from the engine
itself, so they cannot drift from what the runtime actually accepts.

## Requirements

- **Node 18+**
- A Chrome/Chromium for `numable render` (point `NUMABLE_CHROME` at it if it is not found).
  `numable doctor` tells you what is missing.

Fixtures for local runs live in `<bundle>/.numable/` and are never shipped inside a bundle.

## Links

- Numable — <https://get.numable.app>
- License: MIT

---

# numable(中文)

**Numable 工具**的创作命令行。工具就是那些内容包(XBundle):装进来是仪表盘上的组件,
钉出去是系统桌面上的小组件。

它是**给你自己的 AI 助手**(Claude Code、Codex、Cursor……)和你共用的:`numable workspace init`
会在目录里写好 `AGENTS.md`,整份规范随包发布(`numable docs`),而规范里的每一条都有一个
命令能让 AI 自己验证。

```bash
npx numable init my-card     # 用模板起一个新包
cd my-card
npx numable check            # 静态闸,判据与发布链路同一份
npx numable run              # 每条取数流真跑一遍,真网络
npx numable render           # 把组件渲成 PNG(浅色 / 深色 / 空态)
```

常用的话装到本地更快;国内网络慢可以换镜像源:

```bash
npm i -g numable --registry=https://registry.npmmirror.com
```

## 命令

| | |
|---|---|
| `numable workspace init [dir]` | 把一个目录变成创作工作区(写入给 AI 看的指引) |
| `numable init <dir> [--from <bundle>]` | 新建包:克隆模板、已有的包,或 [numable/tools](https://github.com/numable/tools) 里的官方工具(`--from github:weather`),换一套全新身份 |
| `numable check [包…]` | 静态闸。`--profile personal`(默认)跳过只跟上架有关的条目,`publish` 全开 |
| `numable run [包…]` | 数据层真跑:每条 `.df` 走真引擎、真网络 |
| `numable render [包…]` | 渲染层:用真的绘制内核出 PNG,分明暗与语言 |
| `numable docs [主题]` | 一次读一章规范 |
| `numable doctor` | 体检环境、引擎版本与工作区,并查有没有更新的 CLI |

通用参数:`--json` 机器可读输出、`--lang zh|en` 界面语言。
环境变量:`NUMABLE_PROFILE`、`NUMABLE_LANG`、`NUMABLE_CHROME`。

## 规范跟着命令行走

没有另一个需要同步的文档站 —— CLI 打印的那份 Markdown,就是 Numable 桌面端阅读器里显示的那份,
中英各一套:

```bash
numable docs workflow      # 从这儿开始:创作顺序与不能破的规矩
numable docs capabilities  # 能做什么、不能做什么、各平台差在哪
numable docs pitfalls      # 现象 → 原因 → 修法
```

其中三章(`rcn-nodes`、`methods`、`lint-codes`)是从引擎本身生成的,不会和运行时真正接受的东西漂开。

## 需要什么

- **Node 18 及以上**
- `numable render` 需要一个 Chrome/Chromium(找不到就用 `NUMABLE_CHROME` 指过去)。
  跑 `numable doctor`,缺什么它会说。

本地跑用的夹具放在 `<包>/.numable/` 下,永远不会被打进包里。

## 链接

- Numable — <https://get.numable.app>
- 许可:MIT
