// Vercel Serverless Function：GET /api/time
// Vercel 会自动把项目根目录 api/ 下的文件映射成同名接口，
// 即 api/time.js -> https://你的域名/api/time
// 本地 `node server.js` 跑通后，推到 GitHub 再由 Vercel 部署即可。

const CONFIG = {
  // 【你的名字】：部署后可在 Vercel 项目的 Environment Variables 里改名为 SITE_OWNER
  name: process.env.SITE_OWNER || '豆包',
  timeZone: process.env.TZ_NAME || 'Asia/Shanghai'
};

// 每个 Serverless 实例第一次被加载时的时间（冷启动会刷新）
const INSTANCE_STARTED_AT = Date.now();

/**
 * 把 Date 格式化为 "YYYY-MM-DD HH:mm:ss"（按指定时区）
 */
function formatDateTime(date, timeZone) {
  const parts = {};
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  for (const item of formatter.formatToParts(date)) {
    if (item.type !== 'literal') parts[item.type] = item.value;
  }
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}

/**
 * 取中文星期几
 */
function formatWeekday(date, timeZone) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    weekday: 'long'
  }).format(date);
}

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: '405 Method Not Allowed' });
    return;
  }

  const now = new Date();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    name: CONFIG.name,
    serverTime: formatDateTime(now, CONFIG.timeZone),
    weekday: formatWeekday(now, CONFIG.timeZone),
    timeZone: CONFIG.timeZone,
    timestamp: now.getTime(),
    serverStartedAt: formatDateTime(new Date(INSTANCE_STARTED_AT), CONFIG.timeZone),
    uptimeSeconds: Math.floor((now.getTime() - INSTANCE_STARTED_AT) / 1000)
  });
};
