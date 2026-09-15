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

const DATA_FILE = "activation-data.json";

const WEBSITE =
  "https://noob738.github.io/sunny999-activation-center/";

const SUPPORT =
  "https://t.me/FreeFireActivationBot";

const PLANS = {
  prime5: { name: "PRIME 5 ID", amount: 999 },
  prime6: { name: "PRIME 6 ID", amount: 1299 },
  prime7: { name: "PRIME 7 ID", amount: 1999 },
  prime8: { name: "PRIME 8 ID", amount: 3999 }
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(
        fs.readFileSync(DATA_FILE, "utf8")
      );
    }
  } catch (e) {
    console.error("Data load error:", e.message);
  }

  return {
    orders: [],
    usedScreenshots: []
  };
}

function saveData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

let data = loadData();


/* START */

bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {

  const chatId = msg.chat.id;

  const payload =
    match && match[1]
      ? match[1].trim()
      : "";

  if (!payload) {

    await bot.sendMessage(
      chatId,

      "🔥 FREE FIRE ACTIVATION BOT\n\n" +
      "🌐 Activation Website:\n" +
      WEBSITE +
      "\n\n" +
      "💬 Support:\n" +
      SUPPORT
    );

    return;
  }

  const plan = PLANS[payload];

  if (!plan) {

    await bot.sendMessage(
      chatId,
      "❌ Invalid plan selection."
    );

    return;
  }

  const orderId =
    "ACT-" +
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

    "⚡ ACTIVATION PAYMENT\n\n" +

    "🎮 Plan: " +
    plan.name +

    "\n💰 Amount: ₹" +
    plan.amount +

    "\n\n" +

    "📸 Payment karne ke baad " +
    "payment screenshot yahin send karo.\n\n" +

    "⏳ Admin payment verify karega."
  );
});


/* PAYMENT SCREENSHOT */

bot.on("photo", async (msg) => {

  const chatId = msg.chat.id;

  const pending =
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

  if (!pending.length) {

    await bot.sendMessage(

      chatId,

      "❌ Koi pending activation payment nahi mila.\n\n" +
      "Pehle activation website se process start karo."
    );

    return;
  }

  const order = pending[0];

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

    "✅ PAYMENT SCREENSHOT RECEIVED\n\n" +

    "⏳ Admin verification pending hai.\n" +

    "Approval ke baad activation process continue hoga."
  );

  const adminText =

    "🔔 ACTIVATION PAYMENT\n\n" +

    "🆔 Order: " +
    order.id +

    "\n🎮 Plan: " +
    order.planName +

    "\n💰 Amount: ₹" +
    order.amount +

    "\n👤 User: " +
    (order.firstName || "Unknown") +

    "\n🔗 @" +
    (order.username || "N/A") +

    "\n🆔 User ID: " +
    order.userId +

    "\n\n📸 Screenshot attached.";

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


/* ADMIN */

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
        text: "Already processed",
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

      "❌ ACTIVATION PAYMENT REJECTED\n\n" +

      "Payment proof approve nahi hua.\n\n" +

      "💬 Support:\n" +
      SUPPORT
    );

    try {

      await bot.editMessageCaption(

        "❌ ACTIVATION PAYMENT REJECTED\n\n" +
        "🆔 Order: " +
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

    order.status =
      "APPROVED";

    order.approvedAt =
      new Date().toISOString();

    saveData(data);

    await bot.sendMessage(

      order.userId,

      "🎉 ACTIVATION PAYMENT APPROVED\n\n" +

      "🎮 " +
      order.planName +

      "\n💰 ₹" +
      order.amount +

      "\n\n" +

      "🌐 ACTIVATION WEBSITE:\n" +
      WEBSITE +

      "\n\n" +

      "✅ Ab activation website par process continue karo."
    );

    try {

      await bot.editMessageCaption(

        "✅ ACTIVATION PAYMENT APPROVED\n\n" +

        "🆔 Order: " +
        order.id +

        "\n🎮 " +
        order.planName +

        "\n💰 ₹" +
        order.amount,

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


/* ADMIN COMMANDS */

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
    "📋 ACTIVATION ORDERS\n\n";

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

    "📊 ACTIVATION STATUS\n\n" +

    "📦 Total: " +
    total +

    "\n⏳ Pending: " +
    pending +

    "\n✅ Approved: " +
    approved
  );
});


bot.onText(/^\/admin$/, async (msg) => {

  if (
    String(msg.from.id) !==
    ADMIN_CHAT_ID
  ) return;

  await bot.sendMessage(

    msg.chat.id,

    "👑 ACTIVATION ADMIN\n\n" +

    "/orders — Orders\n" +
    "/stock — Status"
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
      "FREE FIRE ACTIVATION BOT ONLINE"
    );

  }
).listen(
  PORT,
  () => {

    console.log(
      "Activation Bot running on port " +
      PORT
    );

  }
);

console.log(
  "FreeFireActivationBot started successfully."
);
