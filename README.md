# motion-tracker

motion tracker for raspberry pi with camera module that sends photos and videos on motion detection to a given telegram chat bot

## how to use

- install [telegram](https://telegram.org/) on your device
- create your own [telegram bot](https://core.telegram.org/bots)
- clone this repo to your pi
- create a `.env` file
  ```
  BOT_TOKEN=[YOUR_BOT_TOKEN]
  ```
- install [node](https://nodejs.org/en/)
- install dependencies
  - `npm i`
- start app
  - `npm run start`
- [optional] for development, install [nodemon](https://www.npmjs.com/package/nodemon) 
- [optional] for production, install [forever]([forever](https://www.npmjs.com/package/forever))
- [optional] for automatic start on reboot, use crontab
  ```
    @reboot BOT_TOKEN=[YOUR-BOT-TOKEN] forever start /path/to/project/index.js
  ```