'use strict';

const EventEmitter = require('events');
const { fork } = require('child_process');
const path = require('path');
const ImageCompare = require('./ImageCompare');
const VideoCapture = require('./VideoCapture');

class MotionDetectionModule extends EventEmitter {
  constructor(options) {
    super();
    this.config = Object.assign({
      imagePath: null, // Directory to store image captures
      videoPath: null, // Directory to store video captures
      captureVideoOnMotion: false, // Flag to control video capture on motion detection
      interval: 5000,
    }, options);

    this.continueToCapture = true; // Flag to control internal state of photo capture
    this.capturingPhoto = false; // State of the module capturing photos
  }

  watch() {
    const self = this;

    this.imageCaptureChild = fork(path.resolve(__dirname, 'ImageCapture.js'), [ self.config.imagePath ]);

    this.imageCaptureChild.on('message', (message) => {
      if (message.result === 'failure') {
        self.emit('error', message.error);
      }
      else if (message.result === 'success') {
        setTimeout(() => {
          if (self.continueToCapture) {
            self.capturingPhoto = true;
            self.imageCaptureChild.send({});
          }
        }, this.config.interval);
      }
    });

    const imageCompare = new ImageCompare(self.config.imagePath);

    imageCompare.on('error', (error) => {
      self.emit('error', error);
    });

    imageCompare.on('motion', (firstImage, secondImage, diffPercent) => {
      self.continueToCapture = false;
      self.capturingPhoto = false;

      if (self.config.captureVideoOnMotion) {
        if (self.capturingPhoto) {
          // race condition with imageCaptureChild... just send the images and skip video this time
          self.emit('motionDetected', firstImage, secondImage, undefined, diffPercent);
        }
        else {
          const videoCapture = new VideoCapture();

          videoCapture.on('error', (error) => {
            self.emit('error', error);
          });
          videoCapture.on('videoRecorded', (video) => {
            self.emit('motionDetected', firstImage, secondImage, video, diffPercent);
            self.continueToCapture = true;
            self.imageCaptureChild.send({});
          });
          videoCapture.start();
        }
      }
    });


    // Start the magic
    imageCompare.start();
    self.capturingPhoto = true;
    self.imageCaptureChild.send({});
  }
}

module.exports = MotionDetectionModule;
