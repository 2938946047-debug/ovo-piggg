# 白页摄影书

极简电子摄影书编辑器原型。固定纯白底页，支持自由放置照片、文字、内置/导入图案和矢量手写，并提供多作者作品归属、公开评论以及草稿/公开快照隔离的 AI 资料问答。

图片可切换矩形、圆角、圆形/椭圆和拱形，并提供原图、黑白、暖调复古、柔焦模糊和高对比滤镜。形状与滤镜会同步用于在线阅读、单页图片、PDF 和视频导出。

## 本地运行

```powershell
pnpm install
pnpm dev
```

没有环境变量时，编辑、发布、阅读、PDF 导出和 AI 演示回答均可本地运行。配置 `OPENAI_API_KEY` 后，`POST /api/ai/ask` 会使用 Responses API、图像上下文和网页检索；配置 Supabase 与 Railway 变量后，可接入 OTP、私有对象存储、RLS 和 MP4 Worker。

演示阅读者验证码为 `246810`。评论需要登录并绑定当前公开版本；AI 对话仅保存在 React 内存中，刷新或闲置 30 分钟后清除。

## 手机访问与公开部署

开发服务器使用 `0.0.0.0` 启动后，同一 Wi-Fi 下的手机可通过电脑局域网 IP 访问，例如 `http://192.168.0.44:3001/`。局域网链接要求电脑保持开机、开发服务器持续运行，并不等同于互联网公开地址。

要让任何人通过分享链接长期访问，需要完成以下部署：

1. 在 Supabase 创建项目并执行 `supabase/migrations/` 中的迁移，为账号、作品快照、评论、向量检索和 RLS 提供持久化存储。
2. 将项目推送到 Git 仓库并导入 Vercel，配置 `.env.example` 中的 Supabase 与 OpenAI 环境变量。
3. 为域名配置 Vercel DNS；发布弹窗会自动使用部署后的域名生成 `?book=slug` 分享链接。
4. 需要服务端 MP4 队列时再部署 Railway Worker；浏览器本地视频导出不依赖 Railway。

当前无环境变量模式是可操作的单机演示：发布快照和评论保存在开发进程内存中，服务器重启后恢复示例数据。正式公开站点必须配置 Supabase，不能依赖演示内存数据。

复用已运行的开发服务器执行端到端测试：

```powershell
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3001"
pnpm test:e2e
```

## 约束

- `SceneDocumentV1.backgroundPolicy` 固定为 `fixed-white`，每页 `background` 固定为 `#ffffff`。
- 原图存入私有桶；公开衍生图应由 Worker 移除 EXIF/GPS。
- SVG 导入会拒绝脚本、事件属性、外部链接、`foreignObject` 和 CSS URL。
- `ai_query_events` 只记录问题哈希与运行指标，不包含原始问题、回答或对话。
- 每本摄影书都带有不可伪造的 `author_id`。编辑、页面保存、上传、发布和导出接口都会在服务端验证作者身份，数据库 RLS 再次限制跨作者写入。
- 浏览者只能读取公开快照，可以评论但不能进入编辑器或修改摄影书；评论者只能删除自己的评论，作者可以管理自己作品下的评论。
- MP4 固定 1920x1080、白色留边、每页 5 秒、0.5 秒淡入淡出且无音乐。

数据库迁移位于 `supabase/migrations/`。`0002_multi_author_comments.sql` 添加公开资料、评论表、版本绑定和对应 RLS 策略。

## 示例图片

界面内置演示照片来自 Unsplash：

- Ricardo Gomez Angel, concrete architecture (`photo-1511818966892-d7d671e672a2`)
- Unsplash contributor, coast (`photo-1487958449943-2429e8be8625`)
- Unsplash contributor, architectural detail (`photo-1494526585095-c41746248156`)
