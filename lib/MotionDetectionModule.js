'use strict';

const EventEmitter = require('events');
const { fork } = require('child_process');
const path = require('path');
const ImageCompare = require('./ImageCompare');

class MotionDetectionModule extends EventEmitter {
  constructor(options) {
    super();
    this.config = Object.assign({
      imagePath: null, // Directory to store image captures
      videoPath: null, // Directory to store video captures
      continueAfterMotion: false, // Flag to control if motion detection will continue after detection
      captureVideoOnMotion: false, // Flag to control video capture on motion detection
      interval: 5000,
    }, options);

    this.continueToCapture = true; // Flag to control internal state of photo capture
    this.capturingPhoto = false; // State of the module capturing photos
  }

  watch() {
    const self = this;

    this.imageCaptureChild = fork(path.resolve(__dirname, 'ImageCapture.js'), [ self.config.imagePath ]);
    this.videoCaptureChild = fork(path.resolve(__dirname, 'VideoCapture.js'), [ self.config.videoPath ]);

    // todo: cleanup videos and images older than certain threshold

    const imageCompare = new ImageCompare(self.config.imagePath);

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

    imageCompare.on('motion', (imageName) => {
      self.continueToCapture = false;
      self.capturingPhoto = false;
      self.emit('imageRecorded', imageName);

      if (self.config.captureVideoOnMotion) {
        if (self.capturingPhoto) {
          self.emit('error', 'Hit possible race condition, not capturing video at this time.');
        }
        else {
          self.videoCaptureChild.send({});
        }
      }
    });
    imageCompare.on('error', (error) => {
      self.emit('error', error);
    });

    this.videoCaptureChild.on('message', (message) => {
      if (message.error) {
        self.emit('error', message.error);
      }
      else {
        self.emit('videoRecorded', message.filename);
        self.continueToCapture = true;
        self.imageCaptureChild.send({});
      }
    });

    // Start the magic
    imageCompare.start();
    self.capturingPhoto = true;
    self.imageCaptureChild.send({});
  }

  stop() {
    if (this.scheduleImageCapture) {
      this.scheduleImageCapture.cancel();
    }
    if (this.imageCaptureChild) {
      this.imageCaptureChild.kill('SIGTERM');
    }
    if (this.videoCaptureChild) {
      this.videoCaptureChild.kill('SIGTERM');
    }
  }
}

module.exports = MotionDetectionModule;
