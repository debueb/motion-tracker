// This module is responsible for capturing videos

'use strict';

const config = require('config');
const PiCamera = require('pi-camera');
const path = require('path');
const format = require('date-fns/format')
const dateTimeFormat = require('./DateTimeFormat');

process.on('message', (messageFromParent) => {
  const outputPath = path.resolve(process.argv[2], `${format(new Date(), dateTimeFormat)}.jpg`);

  const myCamera = new PiCamera({
    mode: 'video',
    output: outputPath,
    width: config.get('camera.videoWidth'),
    height: config.get('camera.videoHeight'),
    timeout: config.get('camera.videoTimeout'),
    nopreview: true,
  });

  setTimeout(() => {
    myCamera.record()
      .then((message) => {
        process.send('Video capture was successful');

        process.send({
          result: 'success',
          message,
          error: null,
          path: outputPath,
        });
      })
      .catch((error) => {
        process.send('Video capture failed');

        process.send({
          result: 'failure',
          message: null,
          error,
        });
      });
  }, 500);
});
