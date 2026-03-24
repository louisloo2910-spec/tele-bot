const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== DATA =====
let data = {
  list: [],
  message_id: null,
  chat_id: null,
};

if (fs.existsSync("data.json")) {
  data = JSON.parse(fs.readFileSync("data.json"));
}

function saveData() {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

// ===== BUILD TEXT =====
function buildText() {
  if (data.list.length === 0) {
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

// ===== BUTTON =====
function buildButtons() {
  return Markup.inlineKeyboard(
    data.list.map((item, index) => [
      Markup.button.callback(`➕`, `plus_${index}`),
      Markup.button.callback(`➖`, `minus_${index}`),
    ])
  );
}

// ===== UPDATE MESSAGE =====
async function updateMessage(ctx) {
  try {
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

// ===== SET =====
bot.command("set_prayer", async (ctx) => {
  const msg = await ctx.reply(buildText(), buildButtons());

  data.message_id = msg.message_id;
  data.chat_id = msg.chat.id;
  data.list = [];

  saveData();
});

// ===== ADD / UPDATE =====
bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  const parts = text.split("|").map((p) => p.trim());

  if (parts.length < 3) {
    return ctx.reply("❌ Nhập sai cú pháp\nVD: Tên | nội dung | target");
  }

  const [name, content, targetStr] = parts;
  const target = parseInt(targetStr);

  if (isNaN(target)) {
    return ctx.reply("❌ Target phải là số");
  }

  const existing = data.list.find(
    (i) => i.name.toLowerCase() === name.toLowerCase()
  );

  // ===== CASE: CHƯA CÓ =====
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

  // ===== CASE: TRÙNG HOÀN TOÀN =====
  if (
    existing.content === content &&
    existing.target === target
  ) {
    return ctx.reply("❌ Không có gì thay đổi (bị trùng)");
  }

  // ===== CASE: UPDATE =====
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

    // đạt target
    if (data.list[index].count >= data.list[index].target) {
      ctx.reply(`🎉 ${data.list[index].name} đã đủ target!`);
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
  const name = ctx.message.text.replace("/remove ", "").trim();

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

// ===== START =====
bot.launch();
console.log("🤖 Bot đang chạy...");
