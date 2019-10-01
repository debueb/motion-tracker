process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 1;

const path = require('path');
const MotionDetector = require('./lib/MotionDetector');
const TelegramBot = require('node-telegram-bot-api');
const ChatStore = require('./lib/ChatStore');
const HouseKeeper = require('./lib/HouseKeeper');
const fs = require('fs');
const rimraf = require('rimraf');

if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line global-require
  require('dotenv').config();
}

const chatStore = new ChatStore(path.resolve(__dirname, 'chatstore'));
let chatIds = chatStore.init();
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const capturesPath = path.resolve(__dirname, 'captures');
const imagePath = path.resolve(capturesPath, 'images');
const videoPath = path.resolve(capturesPath, 'videos');

rimraf.sync(capturesPath);
fs.mkdirSync(capturesPath);
fs.mkdirSync(imagePath);
fs.mkdirSync(videoPath);

new HouseKeeper([
  {
    path: imagePath,
    maxFiles: 10,
  },
  {
    path: videoPath,
    maxFiles: 10,
  },
]).init();

const motionDetector = new MotionDetector({
  imagePath,
  videoPath,
  captureVideoOnMotion: true,
});

const imageToMedia = (image) => ({
  type: 'photo',
  // caption: diffPercent ? diffPercent : image,
  media: fs.createReadStream(path.resolve(imagePath, image)),
  fileName: image,
  contentType: 'image/jpeg',
});

motionDetector.on('motionDetected', (firstImage, secondImage, video, diff) => {
  chatIds.forEach((chatId) => {
    bot.sendChatAction(chatId, 'record_video');
    const medias = [
      imageToMedia(firstImage),
      imageToMedia(secondImage),
    ];

    if (video) {
      medias.push({
        type: 'video',
        media: fs.createReadStream(path.resolve(videoPath, video)),
        fileName: video,
        contentType: 'video/mp4',
      });
    }
    bot.sendMediaGroup(chatId, medias).catch((error) => {
      bot.sendMessage(chatId, error && error.toString ? error.toString() : 'an unkown error occured');
    });
    bot.sendMessage(chatId, `Motion detected: ${ diff.percent }`);
  });
});

motionDetector.on('error', (error) => {
  chatIds.forEach((chatId) => {
    bot.sendMessage(chatId, error && error.toString ? error.toString() : 'an unkown error occured');
  });
});

motionDetector.watch();

// on every received message, persist the chat id so we can use it later
bot.on('message', (msg) => {
  chatStore.addChatId(msg.chat.id);
});

chatStore.on('chatIdsUpdated', (newChatIds) => {
  chatIds = newChatIds;
});

// send list of videos to pick from
bot.onText(/^(\/)?images$/, (msg) => {
  fs.readdir(imagePath, (err, items) => {
    if (err) {
      bot.sendMessage(msg.chat.id, err);
    }
    else if (items.length === 0) {
      bot.sendMessage(msg.chat.id, 'No images found');
    }
    else {
      const selectItems = items.filter((item) => item.indexOf('~') === -1).map((item) => `image ${ item }`);

      bot.sendMessage(msg.chat.id, `Found ${ items.length } images`, {
        // eslint-disable-next-line camelcase
        reply_markup: {
          keyboard: [ selectItems ],
        },
        // eslint-disable-next-line camelcase
        one_time_keyboard: true,
      });
    }
  });
});

// send individual photo
bot.onText(/^(\/)?image (.*)$/, (msg, match) => {
  const imageName = match[2].trim();
  const pathToImage = path.resolve(imagePath, imageName);

  fs.access(pathToImage, fs.F_OK, (err) => {
    if (err) {
      bot.sendMessage(msg.chat.id, `Cannot find image ${ imageName }`);
    }
    else {
      bot.sendChatAction(msg.chat.id, 'upload_photo');
      bot.sendPhoto(msg.chat.id, fs.createReadStream(pathToImage), { caption: imageName });
    }
  });
});

// send list of videos to pick from
bot.onText(/^(\/)?videos$/, (msg) => {
  fs.readdir(videoPath, (err, items) => {
    if (err) {
      bot.sendMessage(msg.chat.id, err);
    }
    else if (items.length === 0) {
      bot.sendMessage(msg.chat.id, 'No videos found');
    }
    else {
      const selectItems = items.filter((item) => item.indexOf('~') === -1 && item.indexOf('h264' === -1)).map((item) => `video ${ item }`);

      bot.sendMessage(msg.chat.id, `Found ${ items.length } videos`, {
        // eslint-disable-next-line camelcase
        reply_markup: {
          keyboard: [ selectItems ],
        },
        // eslint-disable-next-line camelcase
        one_time_keyboard: true,
      });
    }
  });
});

// send individual video
bot.onText(/^(\/)?video (.*)/, (msg, match) => {
  const pathToFile = path.resolve(videoPath, match[2].trim());

  fs.access(pathToFile, fs.F_OK, (err) => {
    if (err) {
      bot.sendMessage(msg.chat.id, `Cannot find video ${ match[2].trim() }`);
    }
    else {
      bot.sendChatAction(msg.chat.id, 'upload_video');
      bot.sendVideo(msg.chat.id, fs.createReadStream(pathToFile));
    }
  });
});

bot.onText(/^(\/)?start$/, (msg) => {
  motionDetector.start();
  bot.sendMessage(msg.chat.id, 'Motion tracking started');
});

bot.onText(/^(\/)?stop$/, (msg) => {
  motionDetector.stop();
  bot.sendMessage(msg.chat.id, 'Motion tracking stopped');
});

bot.onText(/^(\/)?status$/, (msg) => {
  bot.sendMessage(msg.chat.id, motionDetector.status() ? 'Motion tracking active' : 'Motion tracking inactive');
});

bot.onText(/^(\/)?threshhold (.*)$/, (msg, match) => {
  motionDetector.threshhold = parseFloat(match[2]) || motionDetector.threshhold;
  bot.sendMessage(msg.chat.id, `Threshhold changed to ${ motionDetector.threshhold } `);
});

bot.onText(/^(\/)?threshhold$/, (msg) => {
  bot.sendMessage(msg.chat.id, `Current threshhold is ${ motionDetector.threshhold }`);
});
