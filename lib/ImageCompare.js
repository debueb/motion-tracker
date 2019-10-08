'use strict';

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const EventEmitter = require('events');

class ImageCompare extends EventEmitter {
  constructor(capturesDir) {
    super();
    this.capturesDir = capturesDir;
    this.controlFileName = null;
    this.compareFileName = null;
    this.COMPARE_THRESHOLD = 0.1;
    this.COMPARE_PERCENT_DIFF = 0.04;
  }

  start() {
    const self = this;

    const handleError = (err) => {
      if (err !== null) {
        self.emit('error', err);
      }
    };

    fs.watch(self.capturesDir, (eventType, filename) => {
      // On most platforms, 'rename' is emitted whenever a filename appears or disappears in the directory.
      if (filename.indexOf('.jpg') > -1 && filename.indexOf('~') === -1) {
        fs.access(path.resolve(self.capturesDir, filename), fs.constants.R_OK, (error) => {
          if (error === null) {
            self.controlFileName = self.controlFileName ? self.controlFileName : filename;
            self.compareFileName = self.controlFileName && !self.compareFileName && filename !== self.controlFileName ? filename : null;

            if (self.controlFileName && self.compareFileName) {
              const controlFilePath = path.resolve(self.capturesDir, self.controlFileName);
              const compareFilePath = path.resolve(self.capturesDir, self.compareFileName);

              Jimp.read(controlFilePath, (controlFileError, controlFile) => {
                if (controlFileError) {
                  self.emit('error', controlFileError);
                }

                Jimp.read(compareFilePath, (compareFileError, compareFile) => {
                  if (compareFileError) {
                    self.emit('error', compareFileError);
                  }

                  const diff = Jimp.diff(controlFile, compareFile, self.COMPARE_THRESHOLD);
                  const motionDetected = diff.percent > self.COMPARE_PERCENT_DIFF;

                  if (motionDetected) {
                    // do not delete images. they will be removed by HouseKeeper.js based on LIFO
                    self.emit('motion', self.controlFileName, self.compareFileName, diff);
                    self.controlFileName = null;
                    self.compareFileName = null;
                  }
                  else {
                    fs.unlink(path.resolve(self.capturesDir, self.controlFileName), (removeFileError) => {
                      handleError(removeFileError);
                      self.controlFileName = self.compareFileName;
                      self.compareFileName = null;
                    });
                  }
                });
              });
            }
          }
        });
      }
    });
  }

  set threshhold(diff) {
    this.COMPARE_PERCENT_DIFF = diff;
  }

  get threshhold() {
    return this.COMPARE_PERCENT_DIFF;
  }
}

module.exports = ImageCompare;
