'use strict';

const fs = require('fs');
const path = require('path');

class HouseKeeper {
  constructor(configs) {
    this.configs = configs;
  }

  init() {
    setInterval(() => {
      this.configs.forEach((config) => {
        fs.readdir(config.path, function(err, files) {
          if (err === null) {
            try {
              files = files.filter((file) => file.indexOf('~') === -1);
              if (files.length > config.maxFiles) {
                const sorted = files.sort((a, b) => {
                  const s1 = fs.statSync(path.resolve(config.path, a));
                  const s2 = fs.statSync(path.resolve(config.path, b));

                  return s1.birthtimeMs > s2.birthtimeMs;
                });

                sorted.slice(0, config.maxFiles - 1).forEach((file) => {
                  fs.unlink(path.resolve(config.path, file), () => {
                    //ignore
                  });
                });
              }
            }
            catch (error) {
              //ignore
            }
          }
        });
      });
    }, 60000);
  }
}

module.exports = HouseKeeper;
