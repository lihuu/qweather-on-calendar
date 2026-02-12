/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { handleWeatherNowRequest, handleWeatherRequest } from './weather';
import { generateICS } from './ics';

export interface Env {
  ASSETS: Fetcher;
  WEATHER_KV: KVNamespace;
  // JWT 认证参数
  QWEATHER_KEY_ID: string;
  QWEATHER_PROJECT_ID: string;
  QWEATHER_PRIVATE_KEY: string;
  // API 配置
  QWEATHER_API_HOST: string;
  GEO_API_HOST: string;
  // 限流配置
  RATE_LIMIT_PER_SECOND: string;
  DAILY_QUOTA_LIMIT: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. 首页：返回生成器页面
    if (url.pathname === '/') {
      return env.ASSETS.fetch(new Request(new URL(request.url).origin + '/index.html', request));
    }

    // 2. ICS 生成接口
    if (url.pathname === '/calendar') {
      return await handleCalendarRequest(request, env);
    }

    // 3. 天气 JSON 接口
    if (url.pathname === '/weather') {
      return await handleWeatherJsonRequest(request, env);
    }

    // 4. AI Agent 技能文件（显式 UTF-8，避免乱码）
    if (url.pathname === '/SKILL.md') {
      return new Response(SKILL_MD_CONTENT, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    // 5. 静态资源（其他文件由 ASSETS 处理）
    return env.ASSETS.fetch(request);
  },
};

const WEATHER_UPSTREAM_CALL_COST = 3;
const SKILL_MD_CONTENT = `# Weather API Skill

## How to Integrate
- Endpoint: \`GET /weather?city=<city>\`
- Example: \`https://weather.outil.click/weather?city=Beijing\`
- Method: encode city with URL encoding before request.

## Response Format
\`\`\`json
{
  "city": "Beijing",
  "weather": {
    "weather": "晴",
    "temperature": "28",
    "temperatureRange": "未知/未知°C",
    "relativeHumidity": "未知",
    "windDirection": "东南风",
    "dressingIndex": "舒适"
  },
  "source": "QWeather",
  "generatedAt": "2026-02-12T00:00:00.000Z"
}
\`\`\`

## Field Types
- city: string
- weather.weather: string
- weather.temperature: string
- weather.temperatureRange: string
- weather.relativeHumidity: string
- weather.windDirection: string
- weather.dressingIndex: string | null
- source: string
- generatedAt: string (ISO datetime)

## Error Codes
- 400: missing or invalid city
- 429: rate limited
- 503: daily quota exceeded
- 500: upstream request failed
`;

async function handleCalendarRequest(request: Request, env: Env): Promise<Response> {
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const url = new URL(request.url);
  const city = url.searchParams.get('city');

  if (!city) {
    return new Response('Missing "city" query parameter', { status: 400 });
  }

  // --- A. 限流检查 (Rate Limiting) ---
  const limitPerSecond = parseInt(env.RATE_LIMIT_PER_SECOND || '1');
  const currentTime = Math.floor(Date.now() / 1000);
  const rateKey = `rate:${clientIP}:${currentTime}`;
  
  // 获取当前秒的请求数
  const currentRate = await env.WEATHER_KV.get(rateKey);
  if (currentRate && parseInt(currentRate) >= limitPerSecond) {
    return new Response('Too Many Requests. Please slow down.', { status: 429 });
  }
  // 记录请求（KV 最小 TTL 为 60 秒）
  await env.WEATHER_KV.put(rateKey, (parseInt(currentRate || '0') + 1).toString(), { expirationTtl: 60 });


  // --- B. 总配额检查 (Quota Management) ---
  // 和风天气免费版通常限制 1000次/天。按天记录 Key。
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const quotaKey = `quota:${todayStr}`;
  const dailyLimit = parseInt(env.DAILY_QUOTA_LIMIT || '950');
  
  const currentQuota = await env.WEATHER_KV.get(quotaKey);
  if (currentQuota && parseInt(currentQuota) >= dailyLimit) {
    return new Response('Daily API Quota Exceeded. Please try again tomorrow.', { status: 503 });
  }

  try {
    // 先占用配额，避免上游失败导致的无限重试
    const reservedCount = parseInt(currentQuota || '0') + 1;
    await env.WEATHER_KV.put(quotaKey, reservedCount.toString(), { expirationTtl: 86400 * 2 }); // 保留2天

    // --- C. 核心业务逻辑 ---
    // 1. 获取天气数据
    const weatherData = await handleWeatherRequest(city, env);
    
    // 2. 生成 ICS
    const icsContent = generateICS(weatherData, city);

    return new Response(icsContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="weather-${city}.ics"`,
        'Cache-Control': 'public, max-age=3600', // 客户端缓存1小时，减少请求
      },
    });

  } catch (error: any) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

async function handleWeatherJsonRequest(request: Request, env: Env): Promise<Response> {
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const url = new URL(request.url);
  const city = url.searchParams.get('city');

  if (!city) {
    return new Response('Missing "city" query parameter', { status: 400 });
  }

  // --- A. 限流检查 (Rate Limiting) ---
  const limitPerSecond = parseInt(env.RATE_LIMIT_PER_SECOND || '1');
  const currentTime = Math.floor(Date.now() / 1000);
  const rateKey = `rate:${clientIP}:${currentTime}`;
  const currentRate = await env.WEATHER_KV.get(rateKey);
  if (currentRate && parseInt(currentRate) >= limitPerSecond) {
    return new Response('Too Many Requests. Please slow down.', { status: 429 });
  }
  await env.WEATHER_KV.put(rateKey, (parseInt(currentRate || '0') + 1).toString(), { expirationTtl: 60 });

  // --- B. 总配额检查 (Quota Management) ---
  const todayStr = new Date().toISOString().split('T')[0];
  const quotaKey = `quota:${todayStr}`;
  const dailyLimit = parseInt(env.DAILY_QUOTA_LIMIT || '950');
  const currentQuota = await env.WEATHER_KV.get(quotaKey);
  if (currentQuota && parseInt(currentQuota) >= dailyLimit) {
    return new Response('Daily API Quota Exceeded. Please try again tomorrow.', { status: 503 });
  }

  try {
    // 天气 JSON 需要 3 次上游调用（城市查询 + 实时天气 + 穿衣指数）
    const reservedCount = parseInt(currentQuota || '0') + WEATHER_UPSTREAM_CALL_COST;
    if (reservedCount > dailyLimit) {
      return new Response('Daily API Quota Exceeded. Please try again tomorrow.', { status: 503 });
    }
    await env.WEATHER_KV.put(quotaKey, reservedCount.toString(), { expirationTtl: 86400 * 2 });

    const weatherData = await handleWeatherNowRequest(city, env);
    return Response.json(
      {
        city,
        weather: weatherData,
        source: 'QWeather',
        generatedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300',
        },
      }
    );
  } catch (error: any) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
