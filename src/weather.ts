import { Env } from './index';

interface WeatherForecast {
  fxDate: string; // 预报日期
  tempMax: string;
  tempMin: string;
  textDay: string; // 白天天气状况文字
  iconDay: string; // 图标代码
  precip: string; // 降水量
}

export interface WeatherNowData {
  weather: string;
  temperature: string;
  windDirection: string;
  dressingIndex: string | null;
}

/**
 * 生成和风天气 JWT Token
 * https://dev.qweather.com/docs/configuration/authentication/#json-web-token
 */
async function generateQWeatherJWT(env: Env): Promise<string> {
  const kid = env.QWEATHER_KEY_ID;
  const projectId = env.QWEATHER_PROJECT_ID;
  const privateKeyPem = env.QWEATHER_PRIVATE_KEY;

  if (!kid || !projectId || !privateKeyPem) {
    throw new Error('JWT configuration incomplete: missing KEY_ID, PROJECT_ID or PRIVATE_KEY');
  }

  // 准备 Header
  const header = {
    alg: 'EdDSA',
    kid: kid,
  };

  // 准备 Payload
  const iat = Math.floor(Date.now() / 1000) - 30; // 当前时间 -30 秒，防止时间误差
  const exp = iat + 900; // 15 分钟后过期
  const payload = {
    sub: projectId,
    iat: iat,
    exp: exp,
  };

  // Base64URL 编码
  const base64UrlEncode = (obj: any): string => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const data = `${headerEncoded}.${payloadEncoded}`;

  // 导入私钥
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'Ed25519' },
    false,
    ['sign']
  );

  // 签名
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    cryptoKey,
    encoder.encode(data)
  );

  // Base64URL 编码签名
  const signatureArray = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
  const signatureEncoded = signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  // 拼接 JWT
  return `${data}.${signatureEncoded}`;
}

export async function handleWeatherRequest(cityKeyword: string, env: Env): Promise<WeatherForecast[]> {
  // 生成 JWT Token
  const token = await generateQWeatherJWT(env);

  // 1. 城市搜索 (GeoAPI)
  // https://dev.qweather.com/docs/api/geoapi/city-lookup/
  // Token 通过 Authorization 请求头传递
  const geoParams = new URLSearchParams({
    location: cityKeyword,
    number: '1', // 只返回最匹配的1个结果
  });
  
  const geoUrl = `${env.GEO_API_HOST}/geo/v2/city/lookup?${geoParams.toString()}`;
  
  const geoResp = await fetch(geoUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!geoResp.ok) {
    throw new Error(`GeoAPI request failed with status ${geoResp.status}`);
  }
  
  const geoData: any = await geoResp.json();

  if (geoData.code !== '200') {
    throw new Error(`GeoAPI Error: code ${geoData.code}`);
  }
  
  if (!geoData.location || geoData.location.length === 0) {
    throw new Error(`City "${cityKeyword}" not found.`);
  }

  const location = geoData.location[0]; // 获取最匹配的位置信息
  const locationId = location.id; // Location ID 用于天气查询

  // 2. 天气预报 (WeatherAPI - 7天预报)
  // 免费版支持 3天或7天，这里使用 3d (三天) 或 7d
  // Token 同样通过 Authorization 请求头传递
  const weatherUrl = `${env.QWEATHER_API_HOST}/v7/weather/7d?location=${locationId}`;
  
  const weatherResp = await fetch(weatherUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const weatherData: any = await weatherResp.json();

  if (weatherData.code !== '200') {
    throw new Error(`Weather API Error: ${weatherData.code}`);
  }

  return weatherData.daily;
}

export async function handleWeatherNowRequest(cityKeyword: string, env: Env): Promise<WeatherNowData> {
  const token = await generateQWeatherJWT(env);

  // 1. 城市查询
  const geoParams = new URLSearchParams({
    location: cityKeyword,
    number: '1',
  });
  const geoUrl = `${env.GEO_API_HOST}/geo/v2/city/lookup?${geoParams.toString()}`;
  const geoResp = await fetch(geoUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!geoResp.ok) {
    throw new Error(`GeoAPI request failed with status ${geoResp.status}`);
  }
  const geoData: any = await geoResp.json();
  if (geoData.code !== '200' || !geoData.location || geoData.location.length === 0) {
    throw new Error(`City "${cityKeyword}" not found.`);
  }
  const locationId = geoData.location[0].id;

  // 2. 实时天气
  const nowUrl = `${env.QWEATHER_API_HOST}/v7/weather/now?location=${locationId}`;
  const nowResp = await fetch(nowUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!nowResp.ok) {
    throw new Error(`Now weather request failed with status ${nowResp.status}`);
  }
  const nowData: any = await nowResp.json();
  if (nowData.code !== '200' || !nowData.now) {
    throw new Error(`Now weather API Error: ${nowData.code}`);
  }

  // 3. 穿衣指数（type=3）
  let dressingIndex: string | null = null;
  const indexUrl = `${env.QWEATHER_API_HOST}/v7/indices/1d?type=3&location=${locationId}`;
  const indexResp = await fetch(indexUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (indexResp.ok) {
    const indexData: any = await indexResp.json();
    if (indexData.code === '200' && indexData.daily && indexData.daily.length > 0) {
      dressingIndex = indexData.daily[0].category || indexData.daily[0].text || null;
    }
  }

  return {
    weather: nowData.now.text,
    temperature: nowData.now.temp,
    windDirection: nowData.now.windDir,
    dressingIndex,
  };
}
