// ikuuu.org 自动签到（Cookie 模式，绕过 Geetest 验证码）
// 敏感信息通过环境变量传入

const BASE_URL = "https://ikuuu.org";
const CHECKIN_URL = `${BASE_URL}/user/checkin`;

// COOKIES 格式: [["账号备注1", "cookie1"], ["账号备注2", "cookie2"]]
const COOKIES = JSON.parse(process.env.COOKIES || "[]");

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Referer": `${BASE_URL}/user`,
  "X-Requested-With": "XMLHttpRequest",
  "Accept": "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

// ── 飞书消息卡片 ──────────────────────────────────────

function feishuCard(title, content) {
  const template = title.includes("✅") ? "green" : title.includes("❌") ? "red" : "orange";
  return {
    header: { title: { tag: "plain_text", content: title }, template },
    elements: [{ tag: "markdown", content }],
  };
}

async function sendFeishuMessage(content, title = "ikuuu 签到") {
  const webhook = process.env.FEISHU_WEBHOOK;
  if (!webhook) return;
  const secret = process.env.FEISHU_SECRET;
  const card = feishuCard(title, content);
  let payload;
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const crypto = await import("crypto");
    const sign = crypto.createHmac("sha256", secret).update(`${timestamp}\n${secret}`).digest("base64");
    payload = { timestamp, sign, msg_type: "interactive", card };
  } else {
    payload = { msg_type: "interactive", card };
  }
  try {
    const resp = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await resp.json();
    console.log(data.code === 0 || data.StatusCode === 0 ? "📤 飞书机器人 推送成功" : `❌ 飞书机器人 推送失败: ${JSON.stringify(data)}`);
  } catch (e) { console.log(`❌ 飞书机器人 推送异常: ${e}`); }
}

async function sendFeishuAppMessage(content, title = "ikuuu 签到") {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  const receiveId = process.env.FEISHU_APP_RECEIVE_ID;
  const receiveType = process.env.FEISHU_APP_RECEIVE_TYPE || "open_id";
  if (!appId || !appSecret || !receiveId) return;
  let tenantToken;
  try {
    const resp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const data = await resp.json();
    tenantToken = data.tenant_access_token;
    if (!tenantToken) { console.log("❌ 飞书应用 获取token失败"); return; }
  } catch (e) { console.log(`❌ 飞书应用 获取token异常: ${e}`); return; }
  const card = feishuCard(title, content);
  try {
    const resp = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveType}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tenantToken}` },
      body: JSON.stringify({ receive_id: receiveId, msg_type: "interactive", content: JSON.stringify(card) }),
    });
    const data = await resp.json();
    console.log(data.code === 0 ? "📤 飞书应用 推送成功" : `❌ 飞书应用 推送失败: ${JSON.stringify(data)}`);
  } catch (e) { console.log(`❌ 飞书应用 推送异常: ${e}`); }
}

async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
    });
  } catch (e) { console.log(`❌ Telegram 推送异常: ${e}`); }
}

async function notifyAll(content, title) {
  await Promise.all([sendTelegramMessage(content), sendFeishuMessage(content, title), sendFeishuAppMessage(content, title)]);
}

// ── 签到逻辑（Cookie 模式）──────────────────────────

async function checkIn(cookie, name) {
  try {
    const resp = await fetch(CHECKIN_URL, {
      method: "POST",
      headers: { ...HEADERS, Cookie: cookie },
    });
    const data = await resp.json();
    if (data.ret === 1) {
      return `🎉 签到成功: ${name}\n${data.msg}`;
    } else if (data.ret === 0 && data.msg?.includes("已签到")) {
      return `ℹ️ 已签到: ${name}\n${data.msg}`;
    } else {
      return `❌ 签到失败: ${name}\n${data.msg}`;
    }
  } catch (err) {
    return `⚠️ 签到异常: ${name}\n错误: ${err}`;
  }
}

async function runCheckin() {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  let results = [];

  for (const [name, cookie] of COOKIES) {
    results.push(await checkIn(cookie, name));
  }

  let summary = "📋 ikuuu 签到任务汇总\n==============================\n";
  summary += results.join("\n\n");
  summary += `\n\n⏰ 执行时间: ${now}`;

  const allOk = results.every((r) => r.includes("🎉") || r.includes("ℹ️"));
  const allFail = results.every((r) => r.includes("❌") || r.includes("⚠️"));
  const title = allOk ? "✅ ikuuu 签到成功" : allFail ? "❌ ikuuu 签到失败" : "⚠️ ikuuu 签到部分完成";

  console.log(summary);
  await notifyAll(summary, title);
}

runCheckin().catch(console.error);
