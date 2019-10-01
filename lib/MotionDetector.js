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
      pictureInterval: 5000,
    }, options);

    this.continueToCapture = true; // Flag to control internal state of photo capture
    this.capturingPhoto = false; // State of the module capturing photos
  }

  propagateError(error) {
    this.emit('error', error);
  }

  watch() {
    const self = this;

    this.imageCapture = new ImageCapture(this.config.imagePath);
    this.imageCapture.on('error', this.propagateError);
    this.imageCapture.on('imageTaken', () => {
      setTimeout(() => {
        if (this.continueToCapture) {
          this.start();
        }
      }, this.config.pictureInterval);
    });

    this.imageCompare = new ImageCompare(this.config.imagePath);

    this.imageCompare.on('error', this.propagateError);
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

          videoCapture.on('error', this.propagateError);
          videoCapture.on('videoRecorded', (video) => {
            self.emit('motionDetected', firstImage, secondImage, video, diffPercent);
            self.continueToCapture = true;
            setTimeout(() => {
              self.start();
            }, this.config.pictureInterval);
          });
          videoCapture.start();
        }
      }
    });


    // Start the magic
    this.start();
    this.capturingPhoto = true;
    this.imageCapture.start();
  }

  set threshhold(threshhold) {
    this.imageCompare.threshhold = threshhold;
  }

  get threshhold() {
    return this.imageCompare.threshhold;
  }

  stop() {
    this.continueToCapture = false;
  }

  start() {
    if (!this.capturingPhoto) {
      this.capturingPhoto = true;
      this.imageCapture.start();
    }
  }
}

module.exports = MotionDetector;
