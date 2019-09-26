'use strict';

const EventEmitter = require('events');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const ImageCompare = require('./ImageCompare');

class MotionDetectionModule extends EventEmitter {
  constructor(options) {
    super();
    this.config = Object.assign({
      imagePath: null, // Directory to store image captures
      videoPath: null, // Directory to store video captures
      continueAfterMotion: false, // Flag to control if motion detection will continue after detection
      captureVideoOnMotion: false, // Flag to control video capture on motion detection
    }, options);

    this.continueToCapture = true; // Flag to control internal state of photo capture
    this.capturingPhoto = false; // State of the module capturing photos

    // Verify and create (if needed) capture directories
    checkDir(this.config.imagePath);
    checkDir(this.config.videoPath);
  }

  watch() {
    const self = this;
    const imageCaptureChild = fork(path.resolve(__dirname, 'ImageCapture.js'), [ self.config.imagePath ]);
    const videoCaptureChild = fork(path.resolve(__dirname, 'VideoCapture.js'), [ self.config.videoPath ]);
    
    // todo: cleanup videos and images older than certain threshold

    const imageCompare = new ImageCompare(self.config.imagePath);

    imageCaptureChild.on('message', (message) => {
      if (message.result === 'failure') {
        self.emit('error', message.error);
      }
      else if (message.result === 'success') {
        // console.log('Captured photo');
        if (self.continueToCapture) {
          self.capturingPhoto = true;
          imageCaptureChild.send({});
        }
      }
      else {
        // console.log(`Message from imageCaptureChild: ${ message }`);
      }
    });

    imageCompare.on('motion', (imageName) => {
      self.capturingPhoto = false;
      self.continueToCapture = false;
      self.emit('imageRecorded', imageName);

      if (self.config.captureVideoOnMotion) {
        if (self.capturingPhoto) {
          self.emit('error', 'Hit possible race condition, not capturing video at this time.');
        }
        else {
          // console.log('It should be safe to capture video');
          videoCaptureChild.send({});
        }
      }
    });
    imageCompare.on('error', (error) => {
      self.emit('error', error);
    });

    videoCaptureChild.on('message', (message) => {
      if (message.result === 'failure') {
        self.emit('error', message.error);
      }
      else if (message.result === 'success') {
        self.continueToCapture = true;
        imageCaptureChild.send({});
        self.emit('videoRecorded', message.path);
      }
      else {
        // console.log(`Message from videoCaptureChild: ${ message }`);
      }
    });

    // Start the magic
    imageCompare.start();
    self.capturingPhoto = true;
    imageCaptureChild.send({});
  }
}

function checkDir(base) {
  if (!base) {
    throw new Error(`'captureDirectory' can't be null`);
  }

  try {
    fs.accessSync(base);
  }
  catch (e) {
    // Doesn't exist, create it
    fs.mkdirSync(base);
  }
}

module.exports = MotionDetectionModule;
