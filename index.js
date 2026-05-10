// ikuuu.org 自动签到
// 敏感信息通过环境变量传入

const BASE_URL = "https://ikuuu.org";
const LOGIN_URL = `${BASE_URL}/auth/login`;
const CHECKIN_URL = `${BASE_URL}/user/checkin`;

const ACCOUNTS = JSON.parse(process.env.ACCOUNTS || "[]");

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Referer": `${BASE_URL}/auth/login`,
  "X-Requested-With": "XMLHttpRequest",
};

async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log("⚠️ Telegram 未配置，跳过通知");
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
  });
}

async function login(email, password) {
  try {
    const resp = await fetch(LOGIN_URL, {
      method: "POST",
      redirect: "manual",
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `email=${encodeURIComponent(email)}&passwd=${encodeURIComponent(password)}&code=`,
    });

    const cookieHeaders = resp.headers.get("set-cookie") || "";
    let cookie = cookieHeaders
      .split(",")
      .map((c) => c.split(";")[0].trim())
      .join("; ");

    let data;
    try {
      data = await resp.json();
    } catch {
      const text = await resp.text();
      throw new Error("登录失败（非 JSON 响应）: " + text.slice(0, 100));
    }

    if (data.ret === 1) {
      console.log(`✅ 登录成功: ${email}`);
      return cookie;
    } else {
      console.error(`❌ 登录失败: ${email} | ${data.msg}`);
      return null;
    }
  } catch (err) {
    console.error(`⚠️ 登录异常: ${email} | ${err}`);
    return null;
  }
}

async function checkIn(cookie, email) {
  try {
    const resp = await fetch(CHECKIN_URL, {
      method: "POST",
      headers: { ...HEADERS, Cookie: cookie },
    });
    const data = await resp.json();
    if (data.ret === 1) {
      return `🎉 签到成功: ${email}\n${data.msg}`;
    } else {
      return `ℹ️ 提示: ${email}\n${data.msg}`;
    }
  } catch (err) {
    return `⚠️ 签到异常: ${email}\n错误: ${err}`;
  }
}

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
    const sign = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}\n${secret}`)
      .digest("base64");
    payload = { timestamp, sign, msg_type: "interactive", card };
  } else {
    payload = { msg_type: "interactive", card };
  }
  try {
    const resp = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (data.code === 0 || data.StatusCode === 0) {
      console.log("📤 飞书机器人 推送成功");
    } else {
      console.log("❌ 飞书机器人 推送失败:", JSON.stringify(data));
    }
  } catch (e) {
    console.log("❌ 飞书机器人 推送异常:", e);
  }
}

async function sendFeishuAppMessage(content, title = "ikuuu 签到") {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  const receiveId = process.env.FEISHU_APP_RECEIVE_ID;
  const receiveType = process.env.FEISHU_APP_RECEIVE_TYPE || "open_id";
  if (!appId || !appSecret || !receiveId) return;

  // 1. 获取 tenant_access_token
  let tenantToken;
  try {
    const resp = await fetch(
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      }
    );
    const data = await resp.json();
    tenantToken = data.tenant_access_token;
    if (!tenantToken) {
      console.log("❌ 飞书应用 获取token失败:", JSON.stringify(data));
      return;
    }
  } catch (e) {
    console.log("❌ 飞书应用 获取token异常:", e);
    return;
  }

  // 2. 发送消息卡片
  const card = feishuCard(title, content);
  try {
    const resp = await fetch(
      `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${receiveType}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tenantToken}`,
        },
        body: JSON.stringify({
          receive_id: receiveId,
          msg_type: "interactive",
          content: JSON.stringify(card),
        }),
      }
    );
    const data = await resp.json();
    if (data.code === 0) {
      console.log("📤 飞书应用 推送成功");
    } else {
      console.log("❌ 飞书应用 推送失败:", JSON.stringify(data));
    }
  } catch (e) {
    console.log("❌ 飞书应用 推送异常:", e);
  }
}

async function notifyAll(content, title) {
  await Promise.all([
    sendTelegramMessage(content),
    sendFeishuMessage(content, title),
    sendFeishuAppMessage(content, title),
  ]);
}

async function runCheckin() {
  const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  let results = [];

  for (const [email, password] of ACCOUNTS) {
    const cookie = await login(email, password);
    if (cookie) {
      results.push(await checkIn(cookie, email));
    } else {
      results.push(`❌ 登录失败: ${email}`);
    }
  }

  let summary = "📋 ikuuu 签到任务汇总\n==============================\n";
  summary += results.join("\n\n");
  summary += `\n\n⏰ 执行时间: ${now}`;

  const allOk = results.every((r) => r.includes("🎉") || r.includes("ℹ️"));
  const allFail = results.every((r) => r.includes("❌") || r.includes("⚠️"));
  const title = allOk
    ? "✅ ikuuu 签到成功"
    : allFail
      ? "❌ ikuuu 签到失败"
      : "⚠️ ikuuu 签到部分完成";

  console.log(summary);
  await notifyAll(summary, title);
}

runCheckin().catch(console.error);

