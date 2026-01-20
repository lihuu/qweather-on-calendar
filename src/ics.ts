// 更详细的图标映射（参考 https://dev.qweather.com/docs/resource/icons/ ）
const ICON_MAP: Record<string, string> = {
  // 晴 / 多云 / 阴（含夜间代码）
  '100': '☀️', // 晴
  '150': '🌙', // 晴-夜
  '101': '🌤️', // 多云
  '102': '🌤️', // 少云
  '103': '⛅️', // 晴间多云
  '104': '☁️', // 阴
  '151': '☁️', // 多云-夜
  '152': '☁️', // 少云-夜
  '153': '☁️', // 晴间多云-夜

  // 阵雨 / 雷阵雨 / 冰雹
  '300': '🌦️', // 阵雨
  '301': '🌦️', // 强阵雨
  '302': '⛈️', // 雷阵雨
  '303': '🌩️', // 强雷阵雨
  '304': '🌩️🌨️', // 雷阵雨伴有冰雹

  // 雨（含强度、冻雨、阶段性）
  '305': '🌧️', // 小雨
  '306': '🌧️', // 中雨
  '307': '🌧️', // 大雨
  '308': '🌧️', // 极端降雨
  '309': '🌦️', // 毛毛雨/细雨
  '310': '🌧️', // 暴雨
  '311': '🌧️', // 大暴雨
  '312': '🌧️', // 特大暴雨
  '313': '🌧️❄️', // 冻雨
  '314': '🌧️', // 小到中雨
  '315': '🌧️', // 中到大雨
  '316': '🌧️', // 大到暴雨
  '317': '🌧️', // 暴雨到大暴雨
  '318': '🌧️', // 大暴雨到特大暴雨
  '399': '🌧️', // 雨（未分类）

  // 雪 / 雨夹雪
  '400': '🌨️', // 小雪
  '401': '🌨️', // 中雪
  '402': '🌨️', // 大雪
  '403': '🌨️', // 暴雪
  '404': '🌧️❄️', // 雨夹雪
  '405': '🌧️❄️', // 雨雪天气
  '406': '🌨️', // 阵雨夹雪
  '407': '🌨️', // 阵雪
  '408': '🌨️', // 小到中雪
  '409': '🌨️', // 中到大雪
  '410': '🌨️', // 大到暴雪
  '499': '🌨️', // 雪（未分类）

  // 能见度 / 霾 / 沙尘
  '500': '🌫️', // 薄雾
  '501': '🌫️', // 雾
  '509': '🌫️', // 浓雾
  '510': '🌫️', // 强浓雾
  '514': '🌫️', // 大雾
  '515': '🌫️', // 特强浓雾
  '502': '🌫️', // 霾
  '511': '🌫️', // 中度霾
  '512': '🌫️', // 重度霾
  '513': '🌫️', // 严重霾
  '503': '🏜️', // 扬沙
  '504': '🏜️', // 浮尘
  '507': '🌪️', // 沙尘暴
  '508': '🌪️', // 强沙尘暴

  // 其他 / 兜底
  '900': '🌡️', // 热
  '901': '🥶', // 冷
  'default': ''
};

export function generateICS(forecasts: any[], cityName: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MyWeatherWorker//CN',
    `X-WR-CALNAME:${cityName} 天气预报`, // 日历名称
    'X-WR-TIMEZONE:Asia/Shanghai',
    'REFRESH-INTERVAL;VALUE=DURATION:PT2H', // 建议客户端每2小时刷新一次
    'X-PUBLISHED-TTL:PT2H'
  ];

  forecasts.forEach((day) => {
    const dateStr = day.fxDate.replace(/-/g, ''); // 2023-10-01 -> 20231001
    // 全天事件，结束日期必须是开始日期+1天
    const nextDateObj = new Date(day.fxDate);
    nextDateObj.setDate(nextDateObj.getDate() + 1);
    const nextDateStr = nextDateObj.toISOString().split('T')[0].replace(/-/g, '');

    const emoji = ICON_MAP[day.iconDay] || ICON_MAP['default'];

    // 标题包含城市信息: ☀️ 南京: 晴 25° / 15°
    const summary = `${emoji} ${cityName}: ${day.textDay} ${day.tempMax}° / ${day.tempMin}°`;

    // 更多指标：湿度、气压、风向风力（白天/夜间）
    const humidity = day.humidity ?? day.hum ?? '—';
    const pressure = day.pressure ?? day.pres ?? '—';
    const windDay = [day.windDirDay || '', day.windScaleDay ? `${day.windScaleDay}级` : '']
      .filter(Boolean)
      .join(' ');
    const windNight = [day.windDirNight || '', day.windScaleNight ? `${day.windScaleNight}级` : '']
      .filter(Boolean)
      .join(' ');

    const description = [
      `天气: ${day.textDay}`,
      `温度: ${day.tempMin}°C - ${day.tempMax}°C`,
      `降水: ${day.precip}mm`,
      `湿度: ${humidity}%`,
      `气压: ${pressure}hPa`,
      `白天风: ${windDay || '—'}`,
      `夜间风: ${windNight || '—'}`,
    ].join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${dateStr}-${cityName}@weather-worker`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART;VALUE=DATE:${dateStr}`,
      `DTEND;VALUE=DATE:${nextDateStr}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n'); // iCalendar 规范要求 CRLF 换行
}