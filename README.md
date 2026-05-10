# ikuuu 自动签到

每天自动签到 [ikuuu.org](https://ikuuu.org)，支持飞书卡片通知 + Telegram 推送。

## 运行时间

- **自动**：每天北京时间 00:00（UTC 16:00）
- **手动**：GitHub → Actions → ikuuu 自动签到 → Run workflow

## 配置说明

在仓库 **Settings → Secrets and variables → Actions** 中添加以下 Secrets：

### 必填

| Secret 名称 | 说明 |
|-------------|------|
| `COOKIES` | 账号 Cookie，JSON 二维数组（见下方教程） |

### 可选（通知推送，不填则跳过）

| Secret 名称 | 说明 |
|-------------|------|
| `FEISHU_APP_ID` | 飞书应用 App ID |
| `FEISHU_APP_SECRET` | 飞书应用 App Secret |
| `FEISHU_APP_RECEIVE_ID` | 飞书接收人 open_id（直接发给你） |
| `FEISHU_APP_RECEIVE_TYPE` | 接收人类型，默认 `open_id` |
| `FEISHU_WEBHOOK` | 飞书群机器人 Webhook 地址 |
| `FEISHU_SECRET` | 飞书群机器人签名密钥（可选） |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID |

## Cookie 获取教程

### 第一步：获取单个账号的 Cookie

1. 用浏览器打开 [ikuuu.org](https://ikuuu.org) 并登录
2. 按 `F12` 打开开发者工具
3. 切到 **Network（网络）** 标签
4. 在页面上随便点一下（比如进入「用户中心」）
5. 在 Network 列表中找到任意一个请求（如 `checkin`、`user` 等）
6. 点击该请求 → **Headers（标头）** → 找到 **Cookie** 字段
7. **完整复制** Cookie 的值

你复制出来的内容大概长这样：
```
email=your%40qq.com; uid=12345; key=abcdef123456; expire_in=1750000000
```

### 第二步：组装 COOKIES（多账号）

`COOKIES` 是一个 JSON 二维数组，每个元素是 `["备注名", "Cookie字符串"]`：

**单账号：**
```json
[["我的账号", "email=your%40qq.com; uid=12345; key=abcdef123456"]]
```

**多账号：**
```json
[
  ["账号1", "email=aaa%40qq.com; uid=111; key=xxx"],
  ["账号2", "email=bbb%40gmail.com; uid=222; key=yyy"]
]
```

### 第三步：填入 GitHub Secrets

1. 进入仓库 **Settings → Secrets and variables → Actions**
2. 点击 **New repository secret**
3. 名称填 `COOKIES`
4. 值填上面组装好的 JSON（整个粘贴进去）
5. 点 **Add secret**

## Cookie 过期怎么办？

Cookie 有有效期（一般几个月），过期后签到会失败。届时重新获取 Cookie 并更新 Secret 即可。

## 工作原理

1. GitHub Actions 按 cron 时间触发
2. 使用 Node.js 20 运行 `index.js`
3. 直接用 Cookie 调用签到接口（无需登录，绕过 Geetest 验证码）
4. 汇总结果通过飞书 / Telegram 推送
