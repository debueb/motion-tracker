// This module is responsible for capturing videos

'use strict';

const config = require('config');
const PiCamera = require('pi-camera');
const path = require('path');
const format = require('date-fns/format');
const dateTimeFormat = require('./DateTimeFormat');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

process.on('message', () => {
  const dateStr = format(new Date(), dateTimeFormat);
  const h264Path = path.resolve(process.argv[2], `${ dateStr }.h264`);
  const mp4Filename = `${ dateStr }.mp4`;
  const mp4Path = path.resolve(process.argv[2], mp4Filename);

  const myCamera = new PiCamera({
    mode: 'video',
    output: h264Path,
    width: config.get('camera.videoWidth'),
    height: config.get('camera.videoHeight'),
    timeout: config.get('camera.videoTimeout'),
    nopreview: true,
  });

  setTimeout(() => {
    myCamera.record()
      // eslint-disable-next-line promise/always-return
      .then((message) => {
        ffmpeg(h264Path)
          .outputOptions('-c:v', 'copy') // copy the data instead of reencoding it
          .on('end', function() {
            process.send({
              message,
              filename: mp4Filename,
            });
            fs.unlink(h264Path, (removeFileError) => {
              if (removeFileError) {
                process.send({
                  error: removeFileError,
                });
              }
            });
          })
          .save(mp4Path);
      })
      .catch((error) => {
        process.send({
          error,
        });
      });
  }, 500);
});
