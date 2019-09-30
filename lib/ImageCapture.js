'use strict';

const config = require('config');
const EventEmitter = require('events');
const PiCamera = require('pi-camera');
const path = require('path');
const format = require('date-fns/format');
const dateTimeFormat = require('./DateTimeFormat');

class ImageCapture extends EventEmitter {
  constructor(imagePath) {
    super();
    this.imagePath = imagePath;
  }
  start() {
    const self = this;
    const outputPath = path.resolve(this.imagePath, `${ format(new Date(), dateTimeFormat) }.jpg`);

    const myCamera = new PiCamera({
      mode: 'photo',
      output: outputPath,
      width: config.get('camera.photoWidth'),
      height: config.get('camera.photoHeight'),
      timeout: config.get('camera.photoTimeout'),
      timestamp: true,
      nopreview: true,
    });

    myCamera.snap()
      // eslint-disable-next-line promise/always-return
      .then((message) => {
        self.emit('imageTaken', message);
      })
      .catch((error) => {
        self.emit('error', error);
      });
  }
}

module.exports = ImageCapture;
