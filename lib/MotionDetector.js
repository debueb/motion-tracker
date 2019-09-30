'use strict';

const EventEmitter = require('events');
const ImageCapture = require('./ImageCapture');
const ImageCompare = require('./ImageCompare');
const VideoCapture = require('./VideoCapture');

class MotionDetector extends EventEmitter {
  constructor(options) {
    super();
    this.config = Object.assign({
      imagePath: null, // Directory to store image captures
      videoPath: null, // Directory to store video captures
      captureVideoOnMotion: false, // Flag to control video capture on motion detection
      pictureInterval: 10000,
    }, options);

    this.continueToCapture = true; // Flag to control internal state of photo capture
    this.capturingPhoto = false; // State of the module capturing photos
  }

  watch() {
    const self = this;
    const propagateError = (error) => {
      self.emit('error', error);
    };

    this.imageCapture = new ImageCapture(self.config.imagePath);
    this.imageCapture.on('error', propagateError);
    this.imageCapture.on('imageTaken', () => {
      setTimeout(() => {
        if (self.continueToCapture) {
          self.capturingPhoto = true;
          self.imageCapture.start();
        }
      }, this.config.pictureInterval);
    });

    this.imageCompare = new ImageCompare(self.config.imagePath);

    this.imageCompare.on('error', propagateError);
    this.imageCompare.on('motion', (firstImage, secondImage, diffPercent) => {
      self.continueToCapture = false;
      self.capturingPhoto = false;

      if (self.config.captureVideoOnMotion) {
        if (self.capturingPhoto) {
          // race condition with imageCapture... just send the images and skip video this time
          self.emit('motionDetected', firstImage, secondImage, undefined, diffPercent);
        }
        else {
          const videoCapture = new VideoCapture(self.config.videoPath);

          videoCapture.on('error', propagateError);
          videoCapture.on('videoRecorded', (video) => {
            self.emit('motionDetected', firstImage, secondImage, video, diffPercent);
            self.continueToCapture = true;
            self.imageCapture.start();
          });
          videoCapture.start();
        }
      }
    });


    // Start the magic
    this.imageCompare.start();
    self.capturingPhoto = true;
    self.imageCapture.start();
  }

  set threshhold(threshhold) {
    this.imageCompare.COMPARE_PERCENT_DIFF = threshhold;
  }

  get threshhold() {
    return this.imageCompare.COMPARE_PERCENT_DIFF;
  }
}

module.exports = MotionDetector;
