const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);

let data = {
  prayerTopicId: null,
  list: []
};

if (fs.existsSync("data.json")) {
  data = JSON.parse(fs.readFileSync("data.json"));
}

function save() {
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

function renderTable() {
  if (data.list.length === 0) return "📭 Danh sách trống";

  let text = "💕 DANH SÁCH CẦU NGUYỆN 💕\n\n";

  data.list.forEach((item, index) => {
    text += `${index + 1}. ${item.name}\n`;
    text += `📌 ${item.content}\n`;
    text += `👉 ${item.current}/${item.target}\n\n`;
  });

  return text;
}

function getKeyboard() {
  return Markup.inlineKeyboard(
    data.list.map((item, i) => ([
      Markup.button.callback(`+1 ${item.name}`, `plus_1_${i}`),
      Markup.button.callback(`+2`, `plus_2_${i}`),
      Markup.button.callback(`-1`, `minus_1_${i}`)
    ]))
  );
}

// set topic
bot.command("set_prayer", (ctx) => {
  data.prayerTopicId = ctx.message.message_thread_id;
  save();
  ctx.reply("✅ Đã set topic cầu nguyện");
});

// reset toàn bộ
bot.command("reset", (ctx) => {
  if (ctx.message.message_thread_id !== data.prayerTopicId) return;

  data.list = [];
  save();
  ctx.reply("🧹 Đã reset danh sách");
});

// xoá 1 người
bot.command("remove", (ctx) => {
  if (ctx.message.message_thread_id !== data.prayerTopicId) return;

  const name = ctx.message.text.replace("/remove ", "").trim();

  data.list = data.list.filter(item => item.name !== name);
  save();

  ctx.reply(`❌ Đã xoá ${name}`);
});

// thêm mới
bot.on("text", (ctx) => {
  if (ctx.message.message_thread_id !== data.prayerTopicId) return;

  const lines = ctx.message.text.split("\n");
  if (lines.length < 3) return;

  const name = lines[0].trim();
  const content = lines[1].trim();
  const target = parseInt(lines[2]);

  if (!name || !content || isNaN(target)) return;

  // check trùng
  const exists = data.list.find(item => item.name === name);
  if (exists) {
    return ctx.reply("⚠️ Người này đã có trong danh sách rồi!");
  }

  data.list.push({
    name,
    content,
    current: 0,
    target
  });

  save();

  ctx.reply(renderTable(), getKeyboard());
});

// xử lý nút
bot.on("callback_query", async (ctx) => {
  const action = ctx.callbackQuery.data;
  const index = parseInt(action.split("_").pop());

  const item = data.list[index];
  if (!item) return;

  if (action.startsWith("plus_1")) item.current += 1;
  if (action.startsWith("plus_2")) item.current += 2;
  if (action.startsWith("minus_1")) item.current = Math.max(0, item.current - 1);

  // đủ target
  if (item.current >= item.target) {
    await ctx.reply(`🎉 ${item.name} đã đủ ${item.target} lời!\nMuốn thêm nữa không?\nGõ: /add ${item.name} 200\nHoặc /remove ${item.name}`);
  }

  save();

  await ctx.editMessageText(renderTable(), getKeyboard());
});

bot.launch();
console.log("🤖 Bot đang chạy...");