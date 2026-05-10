# ikuuu 自动签到

每天自动登录 [ikuuu.org](https://ikuuu.org) 签到，通过 Telegram 推送结果。

## 运行时间

- **自动**：每天北京时间 00:00（UTC 16:00）
- **手动**：GitHub → Actions → ikuuu 自动签到 → Run workflow

## 配置说明

在仓库 **Settings → Secrets and variables → Actions** 中添加以下 Secrets：

| Secret 名称 | 说明 | 示例 |
|-------------|------|------|
| `ACCOUNTS` | 账号密码，JSON 二维数组，支持多账号 | `[["email1","pass1"],["email2","pass2"]]` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token，从 [@BotFather](https://t.me/BotFather) 获取 | `123456:ABC-DEF...` |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID，从 [@userinfobot](https://t.me/userinfobot) 获取 | `123456789` |

## 如何修改账号

1. 进入仓库 Settings → Secrets and variables → Actions
2. 点击 `ACCOUNTS` → Edit
3. 修改 JSON 内容，格式：`[["邮箱1","密码1"],["邮箱2","密码2"]]`
4. 保存即可

## 工作原理

1. GitHub Actions 按 cron 时间触发
2. 使用 Node.js 20 运行 `index.js`
3. 依次登录每个账号，执行签到
4. 汇总结果发送到 Telegram

## 从 Cloudflare Workers 迁移

此项目原运行在 Cloudflare Workers，已迁移到 GitHub Actions 以释放 Cloudflare cron trigger 额度。
