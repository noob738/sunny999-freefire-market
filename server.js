const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const http = require("http");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || "");

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error("BOT_TOKEN or ADMIN_CHAT_ID missing");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const DATA_FILE = "store-data.json";

const WEBSITE =
  "https://noob738.github.io/sunny999-activation-center/";

const PLANS = {
  prime5: { name: "PRIME 5 ID", amount: 999 },
  prime6: { name: "PRIME 6 ID", amount: 1299 },
  prime7: { name: "PRIME 7 ID", amount: 1999 },
  prime8: { name: "PRIME 8 ID", amount: 3999 }
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch (e) {
    console.error("Data load error:", e.message);
  }

  return {
    orders: [],
    credentials: [],
    usedScreenshots: []
  };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let data = loadData();

function randomString(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return result;
}

function generateLogin() {
  let login;

  do {
    login = randomString(12).toLowerCase() + "@gmail.com";
  } while (
    data.credentials.some(x => x.login === login)
  );

  return login;
}

function generatePassword() {
  return randomString(16);
}

function generateActivationCode() {
  let code;

  do {
    code = "";

    for (let i = 0; i < 10; i++) {
      code += Math.floor(Math.random() * 10);
    }

  } while (
    data.credentials.some(x => x.activationCode === code)
  );

  return code;
}


/* START */

bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {

  const chatId = msg.chat.id;
  const payload = match && match[1]
    ? match[1].trim()
    : "";

  if (!payload) {

    await bot.sendMessage(
      chatId,

      "👑 SUNNY 999 BOT\n\n" +
      "🔥 FREE FIRE ACCOUNT STORE\n\n" +
      "🌐 Website:\n" +
      WEBSITE
    );

    return;
  }

  const plan = PLANS[payload];

  if (!plan) {

    await bot.sendMessage(
      chatId,
      "❌ Invalid account selection."
    );

    return;
  }

  const orderId =
    "ORD-" +
    Date.now() +
    "-" +
    Math.floor(Math.random() * 1000);

  const order = {

    id: orderId,

    userId: chatId,

    username:
      msg.from.username || "",

    firstName:
      msg.from.first_name || "",

    plan: payload,

    planName: plan.name,

    amount: plan.amount,

    status:
      "WAITING_PAYMENT_SCREENSHOT",

    createdAt:
      new Date().toISOString()
  };

  data.orders.push(order);

  saveData(data);

  await bot.sendMessage(
    chatId,

    "🛒 ORDER CREATED\n\n" +

    "🎮 Account: " +
    plan.name +

    "\n💰 Amount: ₹" +
    plan.amount +

    "\n\n📸 Payment karne ke baad " +
    "PAYMENT SCREENSHOT yahin send karo.\n\n" +

    "⚠️ Sirf real payment screenshot bhejo.\n" +

    "❌ Fake / edited proof submit mat karo."
  );
});


/* PAYMENT SCREENSHOT */

bot.on("photo", async (msg) => {

  const chatId = msg.chat.id;

  const pendingOrders =
    data.orders

      .filter(
        o =>
          String(o.userId) === String(chatId) &&
          o.status ===
            "WAITING_PAYMENT_SCREENSHOT"
      )

      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      );

  if (!pendingOrders.length) {

    await bot.sendMessage(
      chatId,

      "❌ Koi pending order nahi mila.\n\n" +

      "Pehle store website se BUY NOW karo."
    );

    return;
  }

  const order = pendingOrders[0];

  const photo =
    msg.photo[msg.photo.length - 1];

  const uniqueId =
    photo.file_unique_id;

  if (
    data.usedScreenshots.includes(uniqueId)
  ) {

    await bot.sendMessage(
      chatId,

      "❌ Ye payment screenshot pehle submit ho chuka hai."
    );

    return;
  }

  data.usedScreenshots.push(uniqueId);

  order.status =
    "PENDING_ADMIN_VERIFICATION";

  order.screenshotFileId =
    photo.file_id;

  order.screenshotUniqueId =
    uniqueId;

  order.submittedAt =
    new Date().toISOString();

  saveData(data);

  await bot.sendMessage(
    chatId,

    "✅ PAYMENT PROOF RECEIVED\n\n" +

    "⏳ Admin payment verify karega.\n" +

    "Approval ke baad account details Telegram par milengi."
  );

  const adminText =

    "🔔 NEW PAYMENT VERIFICATION\n\n" +

    "🆔 Order: " +
    order.id +

    "\n🎮 Account: " +
    order.planName +

    "\n💰 Amount: ₹" +
    order.amount +

    "\n👤 User: " +
    (order.firstName || "Unknown") +

    "\n🔗 Username: @" +
    (order.username || "N/A") +

    "\n🆔 User ID: " +
    order.userId +

    "\n\n📸 Payment screenshot attached.";

  await bot.sendPhoto(

    ADMIN_CHAT_ID,

    photo.file_id,

    {
      caption: adminText,

      reply_markup: {

        inline_keyboard: [

          [

            {
              text: "✅ APPROVE",
              callback_data:
                "approve_" + order.id
            },

            {
              text: "❌ REJECT",
              callback_data:
                "reject_" + order.id
            }

          ]

        ]

      }

    }

  );

});


/* ADMIN APPROVE / REJECT */

bot.on("callback_query", async (query) => {

  if (
    String(query.from.id) !==
    ADMIN_CHAT_ID
  ) {

    await bot.answerCallbackQuery(
      query.id,

      {
        text: "❌ Not authorized",
        show_alert: true
      }
    );

    return;
  }

  const callback =
    query.data || "";

  let action = "";
  let orderId = "";

  if (
    callback.startsWith("approve_")
  ) {

    action = "approve";

    orderId =
      callback.substring(8);
  }

  if (
    callback.startsWith("reject_")
  ) {

    action = "reject";

    orderId =
      callback.substring(7);
  }

  if (!action) return;

  const order =
    data.orders.find(
      o => o.id === orderId
    );

  if (!order) {

    await bot.answerCallbackQuery(
      query.id,

      {
        text: "Order not found",
        show_alert: true
      }
    );

    return;
  }

  if (
    order.status !==
    "PENDING_ADMIN_VERIFICATION"
  ) {

    await bot.answerCallbackQuery(
      query.id,

      {
        text: "Order already processed",
        show_alert: true
      }
    );

    return;
  }


  /* REJECT */

  if (action === "reject") {

    order.status = "REJECTED";

    order.rejectedAt =
      new Date().toISOString();

    saveData(data);

    await bot.sendMessage(

      order.userId,

      "❌ PAYMENT REJECTED\n\n" +

      "Aapka payment proof approve nahi hua.\n\n" +

      "Please contact support."
    );

    try {

      await bot.editMessageCaption(

        "❌ PAYMENT REJECTED\n\n" +

        "Order: " +
        order.id,

        {
          chat_id:
            query.message.chat.id,

          message_id:
            query.message.message_id
        }

      );

    } catch (e) {}

    await bot.answerCallbackQuery(

      query.id,

      {
        text: "Payment rejected"
      }

    );

    return;
  }


  /* APPROVE */

  if (action === "approve") {

    const login =
      generateLogin();

    const password =
      generatePassword();

    const activationCode =
      generateActivationCode();

    const credentials = {

      orderId:
        order.id,

      userId:
        order.userId,

      plan:
        order.plan,

      planName:
        order.planName,

      login:
        login,

      password:
        password,

      activationCode:
        activationCode,

      createdAt:
        new Date().toISOString()
    };

    data.credentials.push(
      credentials
    );

    order.status =
      "APPROVED";

    order.approvedAt =
      new Date().toISOString();

    saveData(data);

    await bot.sendMessage(

      order.userId,

      "🎉 PAYMENT APPROVED\n\n" +

      "👑 " +
      order.planName +

      "\n\n📧 LOGIN ID:\n" +
      login +

      "\n\n🔐 PASSWORD:\n" +
      password +

      "\n\n🔑 ACTIVATION CODE:\n" +
      activationCode +

      "\n\n🌐 ACTIVATION WEBSITE:\n" +
      WEBSITE +

      "\n\n⚠️ Ye details private rakho."
    );

    try {

      await bot.editMessageCaption(

        "✅ PAYMENT APPROVED\n\n" +

        "🆔 Order: " +
        order.id +

        "\n🎮 Account: " +
        order.planName +

        "\n💰 Amount: ₹" +
        order.amount +

        "\n\n🔐 Account details delivered to buyer.",

        {
          chat_id:
            query.message.chat.id,

          message_id:
            query.message.message_id
        }

      );

    } catch (e) {}

    await bot.answerCallbackQuery(

      query.id,

      {
        text: "Payment approved"
      }

    );

  }

});


/* STOCK */

bot.onText(/^\/stock$/, async (msg) => {

  if (
    String(msg.from.id) !==
    ADMIN_CHAT_ID
  ) return;

  const total =
    data.orders.length;

  const pending =
    data.orders.filter(
      o =>
        o.status ===
        "PENDING_ADMIN_VERIFICATION"
    ).length;

  const approved =
    data.orders.filter(
      o =>
        o.status === "APPROVED"
    ).length;

  await bot.sendMessage(

    msg.chat.id,

    "📊 STORE STATUS\n\n" +

    "📦 Total Orders: " +
    total +

    "\n⏳ Pending: " +
    pending +

    "\n✅ Approved: " +
    approved
  );

});


/* ORDERS */

bot.onText(/^\/orders$/, async (msg) => {

  if (
    String(msg.from.id) !==
    ADMIN_CHAT_ID
  ) return;

  const recent =
    data.orders
      .slice(-10)
      .reverse();

  if (!recent.length) {

    await bot.sendMessage(
      msg.chat.id,
      "📭 No orders yet."
    );

    return;
  }

  let text =
    "📋 RECENT ORDERS\n\n";

  recent.forEach(o => {

    text +=

      "🆔 " +
      o.id +

      "\n🎮 " +
      o.planName +

      "\n💰 ₹" +
      o.amount +

      "\n📌 " +
      o.status +

      "\n\n";

  });

  await bot.sendMessage(
    msg.chat.id,
    text
  );

});


/* CREDENTIALS */

bot.onText(
  /^\/credentials$/,
  async (msg) => {

    if (
      String(msg.from.id) !==
      ADMIN_CHAT_ID
    ) return;

    const recent =
      data.credentials
        .slice(-10)
        .reverse();

    if (!recent.length) {

      await bot.sendMessage(
        msg.chat.id,
        "📭 No credentials generated yet."
      );

      return;
    }

    let text =
      "🔐 GENERATED DETAILS\n\n";

    recent.forEach(c => {

      text +=

        "🎮 " +
        c.planName +

        "\n📧 " +
        c.login +

        "\n🔑 " +
        c.activationCode +

        "\n\n";

    });

    await bot.sendMessage(
      msg.chat.id,
      text
    );

  }
);


/* ADMIN */

bot.onText(/^\/admin$/, async (msg) => {

  if (
    String(msg.from.id) !==
    ADMIN_CHAT_ID
  ) return;

  await bot.sendMessage(

    msg.chat.id,

    "👑 SUNNY 999 ADMIN PANEL\n\n" +

    "/stock — Store status\n" +

    "/orders — Recent orders\n" +

    "/credentials — Generated details"
  );

});


/* ERROR */

bot.on("polling_error", (error) => {

  console.error(
    "Telegram polling error:",
    error.message
  );

});


/* RAILWAY */

const PORT =
  process.env.PORT || 10000;

http.createServer(
  (req, res) => {

    res.writeHead(
      200,
      {
        "Content-Type":
          "text/plain"
      }
    );

    res.end(
      "SUNNY 999 BOT ONLINE"
    );

  }
).listen(
  PORT,
  () => {

    console.log(
      "SUNNY 999 BOT running on port " +
      PORT
    );

  }
);

console.log(
  "FFAccountXBot started successfully."
);
