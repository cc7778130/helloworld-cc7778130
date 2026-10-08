/* ============================================================
 * 前端逻辑：
 * 1. 向 /api/time 请求服务器时间
 * 2. 显示问候语（名字来自服务端配置）
 * 3. 在两次请求之间用计时器平滑推进秒数，每 5 秒与服务端重新校准一次
 * ============================================================ */
'use strict';

(function () {
  // ---------- DOM 引用 ----------
  const el = {
    ownerName: document.getElementById('owner-name'),
    time: document.getElementById('server-time'),
    date: document.getElementById('server-date'),
    weekday: document.getElementById('server-weekday'),
    timezone: document.getElementById('server-timezone'),
    bootTime: document.getElementById('boot-time'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text')
  };

  // ---------- 常量 ----------
  const API_URL = '/api/time';
  const POLL_INTERVAL = 5000;   // 每 5 秒与服务端校准一次
  const TICK_INTERVAL = 200;    // 每 200 毫秒刷新一次显示，保证秒数平滑跳动
  const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  // ---------- 状态 ----------
  let baseWallClockMs = null;   // 服务端时间对应的“墙钟毫秒”（按 UTC 字段拼装，避免受浏览器时区影响）
  let receivedAtMs = 0;         // 收到该时间的本地时刻
  let hasConnected = false;     // 是否成功连接过一次

  /* ---------------- 工具函数 ---------------- */

  /**
   * 解析 "YYYY-MM-DD HH:mm:ss" 为 { year, month, day, hour, minute, second }
   * @param {string} text
   * @returns {object|null}
   */
  function parseServerTime(text) {
    const matched = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(text).trim());
    if (!matched) return null;
    return {
      year: Number(matched[1]),
      month: Number(matched[2]),
      day: Number(matched[3]),
      hour: Number(matched[4]),
      minute: Number(matched[5]),
      second: Number(matched[6])
    };
  }

  /**
   * 两位补零
   * @param {number} value
   * @returns {string}
   */
  function pad(value) {
    return String(value).padStart(2, '0');
  }

  /* ---------------- 渲染 ---------------- */

  /**
   * 根据“当前墙钟毫秒”渲染页面上的时间信息
   * @param {number} wallClockMs
   */
  function renderClock(wallClockMs) {
    const d = new Date(wallClockMs);
    const year = d.getUTCFullYear();
    const month = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());

    el.time.textContent = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    el.date.textContent = `${year}-${month}-${day}`;
    el.weekday.textContent = WEEKDAY_NAMES[d.getUTCDay()];
  }

  /**
   * 更新底部连接状态
   * @param {'online'|'offline'|'pending'} state
   * @param {string} text
   */
  function setStatus(state, text) {
    el.statusDot.className = 'dot' + (state === 'pending' ? '' : ' ' + state);
    el.statusText.textContent = text;
  }

  /* ---------------- 与服务端交互 ---------------- */

  /**
   * 拉取一次服务器时间
   * @returns {Promise<void>}
   */
  function fetchServerTime() {
    return fetch(API_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then((data) => {
        const parsed = parseServerTime(data.serverTime);
        if (!parsed) throw new Error('服务器时间格式异常：' + data.serverTime);

        // 把服务端返回的“墙钟”按 UTC 字段拼成毫秒值，展示时也用 UTC 字段读取，
        // 这样无论浏览器在哪个时区，显示的都是服务器所在时区的时间。
        baseWallClockMs = Date.UTC(
          parsed.year, parsed.month - 1, parsed.day,
          parsed.hour, parsed.minute, parsed.second
        );
        receivedAtMs = Date.now();

        // 名字、时区等元信息
        if (data.name) el.ownerName.textContent = data.name;
        if (data.timeZone) el.timezone.textContent = '时区 ' + data.timeZone;
        if (data.weekday) el.weekday.textContent = data.weekday;

        renderClock(baseWallClockMs);

        if (!hasConnected) {
          hasConnected = true;
          // 页脚展示的是服务器进程的启动时间（来自服务端），不是页面打开时间
          if (data.serverStartedAt) {
            const uptime = typeof data.uptimeSeconds === 'number' ? data.uptimeSeconds : 0;
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            const uptimeText = (days > 0 ? days + ' 天 ' : '') +
              (days > 0 || hours > 0 ? hours + ' 小时 ' : '') +
              minutes + ' 分 ' + seconds + ' 秒';
            el.bootTime.textContent = `${data.serverStartedAt}（已运行 ${uptimeText}）`;
          }
        }
        setStatus('online', '已连接服务器，时间每 5 秒自动校准');
      })
      .catch((error) => {
        if (hasConnected) {
          // 校准失败但已有基准时间：继续本地推进，只提示状态
          setStatus('offline', '与服务器连接中断，正在重试 ...（' + error.message + '）');
        } else {
          setStatus('offline', '无法连接服务器：' + error.message);
        }
      });
  }

  /* ---------------- 循环与启动 ---------------- */

  function tick() {
    if (baseWallClockMs === null) return;
    const elapsedMs = Date.now() - receivedAtMs;
    renderClock(baseWallClockMs + elapsedMs);
  }

  setInterval(tick, TICK_INTERVAL);
  setInterval(fetchServerTime, POLL_INTERVAL);

  setStatus('pending', '正在连接服务器 ...');
  fetchServerTime();
  tick();
})();
