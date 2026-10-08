'use strict';

/**
 * Hello World 网站 —— 服务端入口
 * 只用 Node.js 内置模块（http / fs / path），无需安装任何第三方依赖。
 * 启动命令：node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

/* ------------------------------------------------------------------
 * 1. 配置区（改这里即可）
 * ------------------------------------------------------------------ */
const CONFIG = {
  // 【你的名字】填在这里，页面上会自动显示
  name: process.env.SITE_OWNER || '豆包',
  // 端口：默认 3000，也可以用环境变量 PORT 覆盖，例如 PORT=8080 node server.js
  port: Number(process.env.PORT) || 3000,
  // 监听地址：127.0.0.1 只允许本机访问；改成 '0.0.0.0' 可让局域网内其他设备访问
  host: process.env.HOST || '127.0.0.1',
  // 静态资源目录
  publicDir: path.join(__dirname, 'public'),
  // 服务器时间使用的时区
  timeZone: process.env.TZ_NAME || 'Asia/Shanghai'
};

/* ------------------------------------------------------------------
 * 2. 静态资源 MIME 类型表
 * ------------------------------------------------------------------ */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

/* ------------------------------------------------------------------
 * 3. 时间格式化工具
 * ------------------------------------------------------------------ */
// 服务器进程启动时刻（用于页脚展示）
const SERVER_STARTED_AT = new Date();

/**
 * 把 Date 对象格式化为 "YYYY-MM-DD HH:mm:ss" 形式（按 CONFIG.timeZone 时区）
 * @param {Date} date
 * @returns {string}
 */
function formatDateTime(date) {
  const parts = {};
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.timeZone,
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
  // en-CA 在部分环境下小时可能返回 "24"，这里统一收敛为 "00"
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}

/**
 * 取星期几（中文），例如 "星期四"
 * @param {Date} date
 * @returns {string}
 */
function formatWeekday(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: CONFIG.timeZone,
    weekday: 'long'
  }).format(date);
}

/**
 * 生成服务器时间数据对象，供 /api/time 与页面首屏使用
 * @returns {{name:string, serverTime:string, weekday:string, timeZone:string, timestamp:number,
 *            serverStartedAt:string, uptimeSeconds:number}}
 */
function buildTimePayload() {
  const now = new Date();
  return {
    name: CONFIG.name,
    serverTime: formatDateTime(now),
    weekday: formatWeekday(now),
    timeZone: CONFIG.timeZone,
    timestamp: now.getTime(),
    // 服务器进程启动时间（不是页面打开时间）
    serverStartedAt: formatDateTime(SERVER_STARTED_AT),
    uptimeSeconds: Math.floor((now.getTime() - SERVER_STARTED_AT.getTime()) / 1000)
  };
}

/* ------------------------------------------------------------------
 * 4. 响应辅助函数
 * ------------------------------------------------------------------ */
/**
 * 发送 JSON 响应
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {object} data
 */
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

/**
 * 发送纯文本响应
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {string} text
 */
function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text)
  });
  res.end(text);
}

/* ------------------------------------------------------------------
 * 5. 静态文件处理
 * ------------------------------------------------------------------ */
/**
 * 把 URL 路径安全地解析为磁盘上的绝对路径，防止目录穿越（../ 越权读取）
 * @param {string} urlPath 例如 "/css/style.css"
 * @returns {string|null} 合法则返回绝对路径，越界则返回 null
 */
function resolveStaticPath(urlPath) {
  // 去掉查询串，并对 URL 编码做解码（解码失败说明是非法路径）
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch (err) {
    return null;
  }

  // 去掉开头的 "/"，根路径映射到 index.html
  const relativePath = decoded.replace(/^\/+/, '') || 'index.html';
  const absolutePath = path.resolve(CONFIG.publicDir, relativePath);

  // 必须仍然位于 public 目录内，否则视为越权
  const publicRoot = path.resolve(CONFIG.publicDir) + path.sep;
  if (absolutePath !== path.resolve(CONFIG.publicDir) && !absolutePath.startsWith(publicRoot)) {
    return null;
  }
  return absolutePath;
}

/**
 * 读取并返回静态文件
 * @param {string} urlPath
 * @param {http.ServerResponse} res
 */
function serveStatic(urlPath, res) {
  const filePath = resolveStaticPath(urlPath);

  if (!filePath) {
    sendText(res, 403, '403 Forbidden：非法的文件路径');
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      sendText(res, 404, `404 Not Found：找不到 ${urlPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        sendText(res, 500, '500 Internal Server Error：读取文件失败');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length,
        // 开发阶段禁用缓存，改完代码刷新即可看到效果
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
  });
}

/* ------------------------------------------------------------------
 * 6. 路由 + 服务器
 * ------------------------------------------------------------------ */
const requestHandler = (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  // 只接受 GET / HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, '405 Method Not Allowed：本服务只支持 GET 请求');
    return;
  }

  // 接口：返回当前服务器时间（页面每 5 秒校准一次；两个接口都用这份数据）
  if (urlPath === '/api/time') {
    sendJson(res, 200, buildTimePayload());
    return;
  }

  // 健康检查接口
  if (urlPath === '/api/health') {
    sendJson(res, 200, { status: 'ok', uptime: Math.floor(process.uptime()) });
    return;
  }

  // 其余请求按静态资源处理
  serveStatic(urlPath, res);
};

const server = http.createServer(requestHandler);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[启动失败] 端口 ${CONFIG.port} 已被占用。`);
    console.error(`请换个端口启动，例如： PORT=3001 node server.js\n`);
  } else {
    console.error('\n[启动失败]', err.message, '\n');
  }
  process.exit(1);
});

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log('--------------------------------------------------');
  console.log('  Hello World 网站已启动 ✅');
  console.log(`  访问地址： http://${CONFIG.host}:${CONFIG.port}`);
  console.log(`  网站署名： ${CONFIG.name}`);
  console.log(`  时区设置： ${CONFIG.timeZone}`);
  console.log(`  启动时间： ${formatDateTime(SERVER_STARTED_AT)} ${formatWeekday(SERVER_STARTED_AT)}`);
  console.log('  停止服务： 在当前终端按 Ctrl + C');
  console.log('--------------------------------------------------');
});

// 优雅退出：收到 Ctrl+C / kill 信号时关闭服务
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    console.log('\n正在关闭服务 ...');
    server.close(() => {
      console.log('服务已关闭，再见 👋');
      process.exit(0);
    });
  });
});

module.exports = { server, CONFIG, formatDateTime, formatWeekday };
