'use strict';

const config = require('config');
const PiCamera = require('pi-camera');
const path = require('path');
const format = require('date-fns/format');
const dateTimeFormat = require('./DateTimeFormat');

process.on('message', () => {
  const outputPath = path.resolve(process.argv[2], `${ format(new Date(), dateTimeFormat) }.h264`);

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
      process.send({
        result: 'success',
        message,
        error: null,
      });
    })
    .catch((error) => {
      process.send({
        result: 'failure',
        message: null,
        error,
      });
    });
});
