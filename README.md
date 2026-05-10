# ikuuu 自动签到

每天自动签到 ikuuu.org，通过 Telegram 推送结果。

## 配置 Secrets

在仓库 Settings → Secrets and variables → Actions 中添加：

| Secret | 说明 |
|--------|------|
| `ACCOUNTS` | 账号密码 JSON，格式：`[["email1","pass1"],["email2","pass2"]]` |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID |

## 手动触发

Actions → ikuuu 自动签到 → Run workflow
