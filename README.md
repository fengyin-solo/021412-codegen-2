# MD Live Editor

一个基于 Vue 3 + CodeMirror 6 的 Markdown 即时渲染编辑器。实现类似 Typora 的所见即所得编辑体验——光标所在区域显示语法标记，离开后自动渲染为格式化效果，切换过程平滑无割裂。

## How to Run

### Docker 方式（推荐）

```bash
docker-compose up --build -d
```

### 本地开发

```bash
cd frontend-editor
npm install
npm run dev
```

## Services

| 服务 | 地址 | 说明 |
|------|------|------|
| MD Live Editor | http://localhost:8081 | Docker 部署 |
| MD Live Editor (dev) | http://localhost:5173 | 本地开发 |

## 测试账号

本项目为纯前端编辑器，无需登录。

## 查找与替换

编辑器内置查找与替换工作流（基于 `@codemirror/search`）：

- **打开面板**：`Ctrl/Cmd + F`，或点击工具栏的放大镜按钮；选中一段文本再打开会自动填入
- **定位匹配**：所有匹配实时高亮，当前匹配着重显示，面板显示 `当前序号 / 总数`
- **逐个跳转**：`Enter` 下一个、`Shift + Enter` 上一个（或点面板箭头），到末尾自动回绕
- **替换**：`替换` 替换当前匹配并自动跳到下一个；`全部替换` 一次事务完成并提示替换数量
- **匹配选项**：`Aa` 区分大小写、全词匹配，切换即时生效
- **关闭**：`Esc`，焦点回到编辑器并停留在当前匹配上

行为细节：

- 编辑器内随时可用 `F3` / `Ctrl/Cmd + G`（加 `Shift` 反向）跳到上/下一个匹配，无需打开面板
- 查询会保留在编辑器状态中：关闭面板再打开、或返回编辑后继续跳转，都从当前匹配接续
- 替换即时反映到字数统计、未保存标记与渲染视图；`Ctrl/Cmd + Z` 可完整撤销
- 空搜索、无结果、替换后位置漂移、快速重复操作均安全：匹配位置始终按最新文档即时计算

运行状态级回归测试：`cd frontend-editor && npm test`

## 图片插入说明

### 支持的图片格式

编辑器支持标准 Markdown 图片语法：`![替代文本](图片地址)`

### 图片路径类型

1. **网络图片（推荐）**
   - HTTP/HTTPS 地址：`![示例](https://example.com/image.png)`
   - 协议相对地址：`![示例](//example.com/image.png)`

2. **本地文件系统路径（不支持）**
   - ❌ Windows 路径：`![图片](C:\Users\username\image.png)`
   - ❌ Mac/Linux 路径：`![图片](/Users/username/image.png)`
   - ❌ 相对路径：`![图片](./images/photo.jpg)`

### 为什么不支持本地路径？

出于安全考虑，现代浏览器禁止网页直接访问用户本地文件系统。即使输入了正确的本地路径，浏览器也会拒绝加载图片。

### 解决方案

如需使用本地图片，请采用以下方式之一：

1. **上传到图床**：将图片上传到图床服务（如 imgur、SM.MS 等），使用返回的网络地址
2. **本地服务器**：使用本地 HTTP 服务器托管图片，通过 `http://localhost:port/image.png` 访问
3. **Base64 编码**：将小图片转换为 Base64 编码嵌入（不推荐大图片）

### 常见错误示例

```markdown
# 错误：语法颠倒
![C:\Users\benzhi\Desktop\BenZhiTec](错误示范)
# 正确语法应该是：
![错误示范](C:\Users\benzhi\Desktop\BenZhiTec)
# 但即使语法正确，本地路径仍然无法在浏览器中显示

# 正确：使用网络图片
![错误示范](https://example.com/error-demo.png)
```

### 错误提示说明

- **"浏览器无法访问本地路径"**：输入了 Windows/Mac/Linux 本地文件系统路径
- **"图片加载失败"**：网络图片地址无效或无法访问
- **"未指定路径"**：图片语法中缺少 URL 部分

## 题目内容

开发一个 Markdown 即时渲染编辑器，核心功能：

- 用户能够无损编辑 Markdown 文件并看到渲染效果
- 当光标所在区域存在语法标记时，展示语法标记（编辑模式）
- 当光标离开时，展示渲染效果（预览模式）
- 语法标记和渲染效果切换过程中，用户体验不能割裂
- 非双列模式，即时渲染

### 技术实现

- 基于 CodeMirror 6 的 Decoration 系统实现行内渲染
- 通过 ViewPlugin 监听光标位置，动态切换语法标记的显示/隐藏
- CSS transition 实现平滑过渡动画
- 底层始终保持原始 Markdown 文本，渲染仅是视觉层装饰
