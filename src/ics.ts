// 简单的 Emoji 映射，增强日历可读性
const ICON_MAP: Record<string, string> = {
  '100': '☀️', // 晴
  '101': '☁️', // 多云
  '104': '☁️', // 阴
  '300': '🌧️', // 阵雨
  '305': '🌧️', // 小雨
  '306': '🌧️', // 中雨
  '307': '🌧️', // 大雨
  '400': '❄️', // 小雪
  'default': '🌡️'
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
    
    // 标题: ☀️ 晴 25° / 15°
    const summary = `${emoji} ${day.textDay} ${day.tempMax}° / ${day.tempMin}°`;
    
    // 详情: 降水、湿度等
    const description = `天气: ${day.textDay}\\n温度: ${day.tempMin}°C - ${day.tempMax}°C\\n降水: ${day.precip}mm`;

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