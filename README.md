# Hello World 网站（Node.js）

一个零依赖的 Node.js 小网站：浏览器访问后显示问候语和**当前服务器时间**。

## 项目结构

```
helloworld-node/
├── package.json          # 项目说明与启动脚本
├── server.js             # 服务端：静态资源 + /api/time 接口
├── README.md             # 本说明文件
├── .gitignore            # Git 忽略规则
└── public/               # 前端静态资源
    ├── index.html        # 页面结构
    ├── style.css         # 页面样式
    └── app.js            # 前端逻辑（请求服务器时间）
```

## 运行环境

- Node.js 18 或更高版本（内置 `http` / `fs` / `path` 模块，**无需 `npm install`**）

查看版本：

```bash
node -v
```

## 运行命令

```bash
# 1. 进入项目目录
cd helloworld-node

# 2. 启动服务（二选一）
node server.js
# 或者
npm start
```

启动成功后终端会输出：

```
--------------------------------------------------
  Hello World 网站已启动 ✅
  访问地址： http://127.0.0.1:3000
  网站署名： 豆包
  时区设置： Asia/Shanghai
  ...
--------------------------------------------------
```

然后在浏览器打开：<http://127.0.0.1:3000>

停止服务：在运行终端按 `Ctrl + C`。

## 常用自定义

| 需求 | 做法 |
| --- | --- |
| 改名字 | 打开 `server.js`，修改 `CONFIG.name`（默认 `'豆包'`） |
| 换端口 | `PORT=8080 node server.js`，或改 `server.js` 里 `CONFIG.port` |
| 让局域网可访问 | `HOST=0.0.0.0 node server.js`，再用本机 IP 访问 |
| 换时区 | `TZ_NAME=Asia/Tokyo node server.js`，或改 `CONFIG.timeZone` |
| 改问候语文字 | 编辑 `public/index.html` 里的 `<h1 class="title">` |
| 改配色 | 编辑 `public/style.css` 顶部的 `:root` 变量 |

## 接口说明

| 接口 | 说明 |
| --- | --- |
| `GET /` | 返回页面 `public/index.html` |
| `GET /api/time` | 返回 JSON：服务器时间、星期、时区、时间戳、站点署名、进程启动时间 |
| `GET /api/health` | 健康检查，返回 `{ "status": "ok", "uptime": 秒数 }` |

`/api/time` 返回示例：

```json
{
  "name": "豆包",
  "serverTime": "2026-10-08 15:30:12",
  "weekday": "星期四",
  "timeZone": "Asia/Shanghai",
  "timestamp": 1791449412000,
  "serverStartedAt": "2026-10-08 15:21:52",
  "uptimeSeconds": 500
}
```

## 工作原理

1. 浏览器请求 `/`，服务端从 `public/` 目录返回静态文件。
2. 页面加载后，`public/app.js` 调用 `/api/time` 获取服务器时间并显示。
3. 页面每 5 秒重新校准一次，两次请求之间用本地计时器平滑推进秒数。
4. 时间显示基于服务端返回的时区字段，因此无论浏览器在哪个时区，看到的都是服务器时间。
