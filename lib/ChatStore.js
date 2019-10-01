'use strict';

const fs = require('fs');
const EventEmitter = require('events');
const path = require('path');

class ChatStore extends EventEmitter {
  constructor(base) {
    super();
    this.base = base;
    this.file = path.resolve(base, 'chatstore.txt');
  }

  init() {
    try {
      this.chatIds = fs.readFileSync(this.file, 'utf-8').split('\n').filter((entry) => entry !== '').map((entry) => parseInt(entry, 10));
    }
    catch (e) {
      // create folder if it does not exist
      try {
        fs.mkdirSync(this.base);
      }
      catch (err) {
        //ignore already existing dir
      }
      //create file if it does not exist, making sure not to overwrite it
      fs.openSync(this.file, 'a');
      this.chatIds = [];
    }

    return this.chatIds;
  }

  addChatId(chatId) {
    if (!this.chatIds.includes(chatId)) {
      this.chatIds.push(chatId);
      fs.appendFile(this.file, `${ chatId }\n`, () => {
        this.emit('chatIdsUpdated', this.chatIds);
      });
    }
  }
}

module.exports = ChatStore;
