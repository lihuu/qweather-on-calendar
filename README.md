# Weather to Calendar (Cloudflare Workers)

将和风天气的预报转换为可订阅的 iCalendar(ics) 链接，提供一个网页生成订阅链接，并对接口进行按 IP 限流与每日配额控制。

## 功能概览

- `/calendar?city=...` 输出动态 ics，支持日历订阅
- 按 IP 每秒限流（默认 1 次/秒，可配置）
- 每日调用配额控制（默认 950 次，可配置）
- 使用 Cloudflare KV 记录限流与配额
- 提供前端页面生成订阅链接

## 目录结构

- `src/index.ts` Worker 路由与限流/配额控制
- `src/weather.ts` 和风天气 API 调用
- `src/ics.ts` ics 内容生成
- `public/index.html` 订阅链接生成页面
- `wrangler.jsonc` Worker 配置

## API

### 生成日历订阅

`GET /calendar?city=城市名`

示例：
`https://<your-domain>/calendar?city=Beijing`

响应：

- `Content-Type: text/calendar; charset=utf-8`
- ics 文件内容

错误：

- 400: 缺少 `city`
- 429: 超过限流
- 503: 当日配额用尽
- 500: 上游异常

## 部署说明

### 1. 前置条件

- Cloudflare 账号
- Wrangler 已安装（`pnpm install` 或全局安装）
- 和风天气 API Key

### 2. 创建 KV 命名空间

```bash
pnpm wrangler kv namespace create WEATHER_KV
```

将命令输出的 `id` 填入 `wrangler.jsonc`：

```json
{
	"kv_namespaces": [{ "binding": "WEATHER_KV", "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }]
}
```

### 3. 配置环境变量与密钥

本项目用到以下配置：

#### 必需密钥（Secret）

本项目使用 **JWT 认证**（推荐方式，安全性更高）：

- `QWEATHER_KEY_ID`：和风天气凭据 ID（kid）
- `QWEATHER_PROJECT_ID`：和风天气项目 ID（sub）
- `QWEATHER_PRIVATE_KEY`：Ed25519 私钥（PEM 格式）

设置方式：

```bash
pnpm wrangler secret put QWEATHER_KEY_ID
pnpm wrangler secret put QWEATHER_PROJECT_ID
pnpm wrangler secret put QWEATHER_PRIVATE_KEY
```

> **如何获取这些参数？**
>
> 1. **生成 Ed25519 密钥对**：
>    ```bash
>    openssl genpkey -algorithm ED25519 -out ed25519-private.pem && \
>    openssl pkey -pubout -in ed25519-private.pem > ed25519-public.pem
>    ```
> 2. **上传公钥到和风天气控制台**：
>    - 访问 [控制台-项目管理](https://console.qweather.com/project)
>    - 添加凭据 → 选择 "JSON Web Token"
>    - 复制 `ed25519-public.pem` 内容并粘贴
>    - 保存后获得 `KEY_ID`（凭据 ID）
> 3. **获取项目 ID**：在控制台项目管理页面查看
> 4. **私钥内容**：复制 `ed25519-private.pem` 完整内容（包括 `-----BEGIN PRIVATE KEY-----` 等标记）
>
> 详细文档：https://dev.qweather.com/docs/configuration/authentication/#json-web-token

#### 必需环境变量（vars）

- `QWEATHER_API_HOST`：和风天气天气 API Host，例如 `https://api.qweather.com`
- `GEO_API_HOST`：和风天气 Geo API Host，例如 `https://geoapi.qweather.com`

#### 可选环境变量（vars）

- `RATE_LIMIT_PER_SECOND`：每 IP 每秒请求数上限，默认 `1`
- `DAILY_QUOTA_LIMIT`：每日总调用上限，默认 `950`

在 `wrangler.jsonc` 中配置示例：

```json
{
	"vars": {
		"QWEATHER_API_HOST": "https://api.qweather.com",
		"GEO_API_HOST": "https://geoapi.qweather.com",
		"RATE_LIMIT_PER_SECOND": "1",
		"DAILY_QUOTA_LIMIT": "950"
	}
}
```

本地开发可使用 `.dev.vars`：

```
# JWT 认证参数（Secret）
QWEATHER_KEY_ID=your_credential_id
QWEATHER_PROJECT_ID=your_project_id
QWEATHER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIE...(完整私钥内容)...
-----END PRIVATE KEY-----"

# API 配置
QWEATHER_API_HOST=https://api.qweather.com
GEO_API_HOST=https://geoapi.qweather.com

# 限流配置
RATE_LIMIT_PER_SECOND=1
DAILY_QUOTA_LIMIT=950
```

### 4. 本地开发

```bash
pnpm dev
```

访问 `http://localhost:8787/`。

### 5. 部署到 Cloudflare

```bash
pnpm deploy
```

部署完成后会获得默认域名：
`https://<worker-name>.<account>.workers.dev`

### 6. 自定义域名（可选）

在 Cloudflare Dashboard 将 Worker 绑定到自定义域名。前端页面通过 `window.location.origin` 自动读取当前域名：

- 已绑定：显示自定义域名链接
- 未绑定：显示 `workers.dev` 链接

## 限流与配额说明

- 限流：按 `CF-Connecting-IP` 维度，每秒计数，超过返回 429
- 配额：按日期计数，超过返回 503
- 计数存储在 `WEATHER_KV`，非强一致性，适用于轻量限流与配额控制

## 注意事项

- 和风天气免费版有每日调用限制，请根据实际套餐调整 `DAILY_QUOTA_LIMIT`
- `RATE_LIMIT_PER_SECOND` 与 `DAILY_QUOTA_LIMIT` 都是字符串配置，代码里会转为数字
- ics 结果带 1 小时缓存，减少上游请求
