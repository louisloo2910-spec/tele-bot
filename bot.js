const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.on("message", (ctx) => {
  console.log("THREAD ID:", ctx.message.message_thread_id);
});
// ===== DATA =====
let data = {
  list: [],
  message_id: null,
  chat_id: null,
};

if (fs.existsSync("data.json")) {
  try {
    const fileData = JSON.parse(fs.readFileSync("data.json"));

    data = {
      list: Array.isArray(fileData.list) ? fileData.list : [],
      message_id: fileData.message_id || null,
      chat_id: fileData.chat_id || null,
    };
  } catch (err) {
    console.log("⚠️ data.json bị lỗi → reset data");
  }
}

function saveData() {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

// ===== BUILD MESSAGE =====
function buildText() {
  if (!data || !Array.isArray(data.list) || data.list.length === 0) {
    return "💕 Danh sách cầu nguyện:\n\n(Chưa có ai)";
  }

  let text = "💕 Danh sách cầu nguyện:\n\n";

  data.list.forEach((item, index) => {
    text += `${index + 1}. ${item.name}\n`;
    text += `   📝 ${item.content}\n`;
    text += `   🙏 ${item.count}/${item.target}\n\n`;
  });

  return text;
}

// ===== BUTTONS =====
function buildButtons() {
  return Markup.inlineKeyboard(
    data.list.map((item, index) => [
      Markup.button.callback(`➕`, `plus_${index}`),
      Markup.button.callback(`➖`, `minus_${index}`),
    ])
  );
}

// ===== UPDATE MESSAGE (1 message duy nhất) =====
async function updateMessage(ctx) {
  try {
    if (!data.chat_id || !data.message_id) return;

    await ctx.telegram.editMessageText(
      data.chat_id,
      data.message_id,
      null,
      buildText(),
      {
        reply_markup: buildButtons().reply_markup,
      }
    );
  } catch (err) {
    console.log("Edit lỗi:", err.message);
  }
}

// ===== START BOARD =====
bot.command("set_prayer", async (ctx) => {
  const msg = await ctx.reply(buildText(), buildButtons());

  data.message_id = msg.message_id;
  data.chat_id = msg.chat.id;
  data.list = [];

  saveData();
});

// ===== PARSE INPUT =====
// Format:
// Dòng 1: Tên
// Dòng 2: Nội dung (1 dòng)
// Dòng 3: Target
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  const raw = text.replace(/\r/g, "").trim();

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 3) {
    return ctx.reply(
      "❌ Sai cú pháp\n\nVD:\nTên\nNội dung\nTarget"
    );
  }

  const name = lines[0];
  const content = lines.slice(1, -1).join(" ");
  const target = parseInt(lines[lines.length - 1]);

  if (isNaN(target)) {
    return ctx.reply("❌ Target phải là số");
  }

  // ===== CHECK EXIST =====
  const existing = data.list.find(
    (i) => i.name.toLowerCase() === name.toLowerCase()
  );

  // NEW
  if (!existing) {
    data.list.push({
      name,
      content,
      count: 0,
      target,
    });

    saveData();
    updateMessage(ctx);
    return;
  }

  // SAME
  if (existing.content === content && existing.target === target) {
    return ctx.reply("❌ Không có gì thay đổi (trùng hoàn toàn)");
  }

  // UPDATE
  existing.content = content;
  existing.target = target;

  saveData();
  updateMessage(ctx);
});

// ===== +1 =====
bot.action(/plus_(\d+)/, async (ctx) => {
  const index = ctx.match[1];

  if (data.list[index]) {
    data.list[index].count += 1;

    if (data.list[index].count >= data.list[index].target) {
      ctx.reply(`🎉 ${data.list[index].name} đã đạt mục tiêu!`);
    }

    saveData();
    updateMessage(ctx);
  }

  ctx.answerCbQuery();
});

// ===== -1 =====
bot.action(/minus_(\d+)/, async (ctx) => {
  const index = ctx.match[1];

  if (data.list[index] && data.list[index].count > 0) {
    data.list[index].count -= 1;
    saveData();
    updateMessage(ctx);
  }

  ctx.answerCbQuery();
});

// ===== REMOVE =====
bot.command("remove", (ctx) => {
  const name = ctx.message.text.replace("/remove", "").trim();

  const index = data.list.findIndex(
    (i) => i.name.toLowerCase() === name.toLowerCase()
  );

  if (index === -1) {
    return ctx.reply("❌ Không tìm thấy");
  }

  data.list.splice(index, 1);
  saveData();
  updateMessage(ctx);
});

// ===== RESET =====
bot.command("reset", (ctx) => {
  data.list = [];
  saveData();
  updateMessage(ctx);
});

// ===== START BOT =====
bot.launch();
console.log("🤖 Bot đang chạy...");
