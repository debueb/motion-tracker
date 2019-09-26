process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 1;

const path = require('path');
const MotionDetectionModule = require('./lib/MotionDetectionModule');
const TelegramBot = require('node-telegram-bot-api');
const ChatStore = require('./lib/ChatStore');
const fs = require('fs');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const chatStore = new ChatStore(path.resolve(__dirname, 'chatstore'));
let chatIds = chatStore.init();
const bot = new TelegramBot(process.env.BOT_TOKEN, {polling: true});

const capturesPath = path.resolve(__dirname, 'captures');
const imagePath = path.resolve(capturesPath, 'images')
const videoPath = path.resolve(capturesPath, 'videos')

const motionDetector = new MotionDetectionModule({
  imagePath,
  videoPath,
  captureVideoOnMotion: true,
  continueAfterMotion: true,
});

motionDetector.on('imageRecorded', (filename) => {
  console.log(`image recorded at ${filename}`);
  this.chatIds.forEach((chatId) => {
    bot.sendPhoto(chatId, fs.createReadStream(path.resolve(imagePath, filename)))
  });
});

motionDetector.on('videoRecorded', (filename) => {
  console.log(`video recorded at ${filename}!`);
  this.chatIds.forEach((chatId) => {
    bot.sendVideo(chatId, fs.createReadStream(path.resolve(videoPath, filename)))
  });
});

motionDetector.on('error', (error) => {
  console.log(error);
});

motionDetector.watch();


// on every received message, persist the chat id so we can use it later
bot.on('message', (msg) => {
  chatStore.addChatId(msg.chat.id);
})

chatStore.on('chatIdsUpdated', (newChatIds) => {
  console.log('new chat ids received');
  chatIds = newChatIds
})

// images | image [filename]
bot.onText(/image(.*)/, (msg, match) => {
  //todo: check if image exists
  if(match[0] === 'images') {
    fs.readdir(imagePath, (err, items) => {
      if (err){
        bot.sendMessage(msg.chat.id, err);
      } else {
        if (items.length == 0){
          bot.sendMessage(msg.chat.id, "No images found");
        } else {
          const selectItems = items.map((item) => `image ${item}`);
          bot.sendMessage (msg.chat.id, `Found ${items.length} images`, {
            reply_markup: {
              keyboard: [selectItems]
            },
            one_time_keyboard: true
          });
        }
      }
    });
  } else {
    // send individual photo
    bot.sendPhoto(msg.chat.id, fs.createReadStream(path.resolve(imagePath, match[1].trim()))); 
  }
});

// videos | video [filename]
bot.onText(/video(.*)/, (msg, match) => {

  // send list of videos to pick from
  if (match[0] === 'videos') {
    fs.readdir(videoPath, (err, items) => {
      if (err){
        bot.sendMessage(msg.chat.id, err);
      } else {
        if (items.length == 0){
          bot.sendMessage(msg.chat.id, "No videos found");
        } else {
          const selectItems = items.map((item) => `video ${item}`);
          bot.sendMessage (msg.chat.id, `Found ${items.length} videos`, {
            reply_markup: {
              keyboard: [selectItems]
            },
            one_time_keyboard: true
          });
        }
      }
    });
  } else {
    // send individual video
    // todo: check if video exists
    bot.sendVideo(msg.chat.id, fs.createReadStream(path.resolve(videoPath, match[1].trim()))); 
  }
});