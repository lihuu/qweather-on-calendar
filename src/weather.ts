import { Env } from './index';

interface WeatherForecast {
  fxDate: string; // 预报日期
  tempMax: string;
  tempMin: string;
  textDay: string; // 白天天气状况文字
  iconDay: string; // 图标代码
  precip: string; // 降水量
}

export async function handleWeatherRequest(cityKeyword: string, env: Env): Promise<WeatherForecast[]> {
  const apiKey = env.QWEATHER_API_KEY;
  if (!apiKey) throw new Error('API Key not configured');

  // 1. 城市搜索 (GeoAPI)
  // https://geoapi.qweather.com/v2/city/lookup?location=beijing&key=xxx
  const geoUrl = `${env.GEO_API_HOST}/v2/city/lookup?location=${encodeURIComponent(cityKeyword)}&key=${apiKey}`;
  
  const geoResp = await fetch(geoUrl);
  const geoData: any = await geoResp.json();

  if (geoData.code !== '200' || !geoData.location || geoData.location.length === 0) {
    throw new Error(`City "${cityKeyword}" not found.`);
  }

  const locationId = geoData.location[0].id; // 获取最匹配的 Location ID

  // 2. 天气预报 (WeatherAPI - 7天预报)
  // 免费版支持 3天或7天，这里使用 3d (三天) 或 7d
  const weatherUrl = `${env.QWEATHER_API_HOST}/v7/weather/7d?location=${locationId}&key=${apiKey}`;
  
  const weatherResp = await fetch(weatherUrl);
  const weatherData: any = await weatherResp.json();

  if (weatherData.code !== '200') {
    throw new Error(`Weather API Error: ${weatherData.code}`);
  }

  return weatherData.daily;
}