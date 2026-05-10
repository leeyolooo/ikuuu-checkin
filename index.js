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

  console.log(summary);
  await sendTelegramMessage(summary);
}

runCheckin().catch(console.error);
