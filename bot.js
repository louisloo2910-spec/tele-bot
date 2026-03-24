const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf('8720842266:AAERfraOTNpKRCyKZux-pesPgRjBtJdLEfM');

// ===== DATA =====
const DATA_FILE = 'data.json';

let db = {
  prayers: [],
  messageIdStore: {},
  prayerTopicId: null
};

if (fs.existsSync(DATA_FILE)) {
  db = JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveDB() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// ===== RENDER =====
function renderList(threadId) {
  const list = db.prayers.filter(p => p.thread_id === threadId);

  let text = `💕DANH SÁCH CẦU NGUYỆN\n\n`;

  if (list.length === 0) {
    text += `Chưa có ai trong danh sách 🙏`;
  }

  const buttons = [];

  list.forEach((p, index) => {
    const percent = Math.floor((p.current / p.target) * 100);
    const barLength = Math.floor(percent / 10);
    const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);

    text += `${index + 1}. ${p.name}\n`;
    text += `${p.content}\n`;
    text += `🙏 ${p.current}/${p.target} (${percent}%)\n`;
    text += `${bar}\n\n`;

    buttons.push([
      Markup.button.callback(`+1 🙏`, `add1_${p.id}`),
      Markup.button.callback(`+2 ⚡`, `add2_${p.id}`)
    ]);
  });

  return {
    text,
    reply_markup: Markup.inlineKeyboard(buttons)
  };
}

// ===== SET TOPIC =====
bot.command('set_prayer', async (ctx) => {
  const threadId = ctx.message.message_thread_id;

  if (!threadId) {
    return ctx.reply('❌ Phải dùng trong topic!');
  }

  db.prayerTopicId = threadId;
  saveDB();

  ctx.reply('✅ Đã set topic cầu nguyện!');
});

// ===== ADD =====
bot.on('text', async (ctx) => {
  const threadId = ctx.message.message_thread_id;

  if (!threadId || threadId !== db.prayerTopicId) return;
  if (ctx.message.text.startsWith('/')) return;

  const lines = ctx.message.text.split('\n');
  if (lines.length < 3) return;

  const [name, content, target] = lines;

  db.prayers.push({
    id: Date.now(),
    name: name.trim(),
    content: content.trim(),
    current: 0,
    target: parseInt(target),
    thread_id: threadId
  });

  saveDB();

  const { text, reply_markup } = renderList(threadId);

  if (!db.messageIdStore[threadId]) {
    const msg = await ctx.reply(text, reply_markup);
    db.messageIdStore[threadId] = msg.message_id;
    saveDB();
  } else {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      db.messageIdStore[threadId],
      null,
      text,
      reply_markup
    );
  }
});

// ===== BUTTON =====
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;

  const [action, id] = data.split('_');
  const item = db.prayers.find(p => p.id == id);

  if (!item) return;

  if (action === 'add1') item.current += 1;
  if (action === 'add2') item.current += 2;

  // đạt target
  if (item.current >= item.target) {
    await ctx.reply(
      `✨ ${item.name} đã đạt ${item.target} lời!\nBạn muốn tiếp tục không?`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('➕ +200', `extend_${item.id}`),
          Markup.button.callback('❌ Xong', `done_${item.id}`)
        ]
      ])
    );
  }

  saveDB();

  const threadId = item.thread_id;
  const { text, reply_markup } = renderList(threadId);

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    db.messageIdStore[threadId],
    null,
    text,
    reply_markup
  );

  await ctx.answerCbQuery('🙏 Đã cộng');
});

// ===== EXTEND =====
bot.action(/extend_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const item = db.prayers.find(p => p.id == id);

  if (!item) return;

  item.target += 200;

  saveDB();

  const threadId = item.thread_id;
  const { text, reply_markup } = renderList(threadId);

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    db.messageIdStore[threadId],
    null,
    text,
    reply_markup
  );

  await ctx.answerCbQuery('➕ Đã thêm 200');
});

// ===== DONE =====
bot.action(/done_(.+)/, async (ctx) => {
  const id = ctx.match[1];

  db.prayers = db.prayers.filter(p => p.id != id);

  saveDB();

  const threadId = ctx.callbackQuery.message.message_thread_id;
  const { text, reply_markup } = renderList(threadId);

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    db.messageIdStore[threadId],
    null,
    text,
    reply_markup
  );

  await ctx.answerCbQuery('✅ Hoàn thành');
});

bot.launch();

console.log('🤖 Bot đang chạy...');