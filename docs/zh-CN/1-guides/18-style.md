# style —— 页面与组件的默认风格

## 什么时候用

用户没有指定视觉风格时，采用 Numable 默认风格。它提供中性色背景、清晰的文字层级、少量强调色和明暗配色，覆盖工具页面、仪表盘组件与桌面小组件。

用户指定手绘、纸张、复古或其他风格时，按用户要求设计。修改已有工具时，延续它已有的风格，除非用户要求换风格。默认风格不要求所有工具看起来相同，也不是发布资格。

## 从可以运行的模板开始

页面与组件一起做，从时间工具起步：

```
numable init my-tool
```

生成的首页会显示真实的设备时间、日期与时区；App 内还有添加组件按钮。页面样式在 `page/assets/numable.css`，页面逻辑在 `page/assets/clock.js`，组件在 `xWidget/rc/clock.rcn`。替换时间工具的正文和逻辑即可；页面不需要时也可以删除对应路由与页面文件。

以数据组件为主时，先选最接近的版式：

```
numable init my-metric --layout big-number
numable docs layouts
```

已有 12 种组件版式，包含大数字、趋势、列表、进度与倒数日。版式的槽位便于快速接入数据；需要不同视觉表现时，也可以就地改 RCN 的颜色、字号和构图。先检查同一工具的其他尺寸，避免只改了一个尺寸。

版式包主要提供组件，不自动生成页面。需要页面时，另建一个临时的默认包，把其中的 `page/assets/numable.css` 复制进目标包，再按 `numable docs add-page` 添加页面；不要把时间工具首页当成其他工具已经做好的首页。

## 页面怎么复用

页面引入包内样式：

```html
<link rel="stylesheet" href="../../assets/numable.css" />
```

此路径适用于 `page/html/home/index.html` 这类两层目录。多页共用同一个 CSS 文件，减少每页自己写一份的差异。

| 用途 | 类名 |
|---|---|
| 页面标题与当前状态 | `nb-header`、`nb-sub` |
| 指标区域 | `nb-card`、`nb-label`、`nb-metric` |
| 列表与详情 | `nb-section`、`nb-section-head`、`nb-row`、`nb-row-label`、`nb-row-value` |
| 操作 | `nb-actions`、`nb-button`、`nb-button-secondary` |
| 编辑表单 | `nb-field`、`nb-input` |
| 加载、空态、失败 | `nb-state`、`nb-error` |
| 数据来源与隐私 | `nb-footnote` |

这些是样式构件。表单仍要绑定真实的保存操作，失败态要提供真实的重试，不能仅画一个可点的按钮。优先使用带标签的原生 `button`、`input` 和 `label`。

默认页面标题 24、段标题 13、正文 15、脚注 11，左右边距 14，段落间距 20。组件标题通常 13，主数字随尺寸变化。页面与组件使用同一套文字和颜色语义，不把小组件直接拉大当详情页；组件回答的问题，在页面里应得到同等或更完整的答案。

XPage 用 `numable docs xpage` 的 Canvas 与容器节点实现同样的层级；CSS 类名只适用于 HTML 页面。

## 怎么改风格

在默认 CSS 之后引入自己的样式，覆盖语义变量：

```css
:root { --nb-accent: #2F6FE4; --nb-on-accent: #FFFFFF; --nb-radius: 18px; }
:root[data-theme="dark"] { --nb-accent: #5C9BFF; --nb-on-accent: #0B0C0E; }
```

主要变量：`--nb-bg` 页底、`--nb-card` 内容底、`--nb-ink` 主文字、`--nb-sub` 次文字、`--nb-line` 分隔、`--nb-accent` 强调色、`--nb-on-accent` 强调色上的文字、`--nb-accent-soft` 选中底。改变强调色时，一并检查按钮文字和选中底的搭配。

RCN 不读取 CSS。组件的对应色值需要在 `.rcn` 中改成 `浅|深` 双分支。页面默认强调色与组件默认强调色可以不同；同一工具确定自己的强调色后，再同步应用到页面与组件。

可以改变配色、字体层级、间距、圆角和排版，也可以完全替换默认 CSS。不要用自定义风格覆盖安全区与容器边界：HTML 保留 `--xb-content-top`、`--xb-content-bottom`；XPage 保留内容 inset。主题读取容器的 `data-theme`，语言跟随 `data-lang` 与语言变化事件，详见 `numable docs bridge`。

桌面小组件复用组件画布，不需要另写一份 CSS。组件必须自己画底色；不要依赖仪表盘外壳替它补底，桌面背后可能是任意壁纸。

## 验证与交付

```
numable check my-tool
numable run my-tool
numable render my-tool
numable render my-tool --page
```

同时看浅色、暗色与空态。改了风格后，再检查窄宽、长标题、中文与英文；页面主操作能否辨认、切换主题后是否可读、组件与页面信息是否一致。页面截图可以检查排版，保存、导航、添加组件等交互还需要在 App 内实际操作验证。
