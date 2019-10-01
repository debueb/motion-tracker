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

  watch() {
    const self = this;

    const propagateError = (error) => {
      self.emit('error', error);
    };

    this.imageCapture = new ImageCapture(this.config.imagePath);
    this.imageCapture.on('error', propagateError);
    this.imageCapture.on('imageTaken', () => {
      setTimeout(() => {
        if (self.continueToCapture) {
          self.imageCapture.start();
        }
      }, self.config.pictureInterval);
    });

    this.imageCompare = new ImageCompare(this.config.imagePath);

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
            setTimeout(() => {
              self.start();
            }, self.config.pictureInterval);
          });
          videoCapture.start();
        }
      }
    });


    // Start the magic
    this.imageCompare.start();
    this.start();
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
    this.continueToCapture = true;
    this.capturingPhoto = true;
    this.imageCapture.start();
  }

  status() {
    return this.continueToCapture;
  }
}

module.exports = MotionDetector;
