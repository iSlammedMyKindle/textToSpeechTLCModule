# TTS for twitchListenerCore

An OBS module for text to speech! Makes use of the [speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) on most modern web browsers, plus [`twitchListenerCore`](https://github.com/iSlammedMyKindle/twitchListenerCore).

Usage: create a webpage source in OBS, with the url pointing to this static file. Add parameters to it that invoke things like language, voice, pitch, and speed. An endpoint that goes to listenerCore is also required.

```
./link/to/index.html?lang=en-us

./link/to/index.html?voice=george

./link/to/index.html?voice=george&pitch=2&speed=1.5
```

**There isn't a need to use npm i on this project** except if you are using dummyServer.mjs to test the program without twitch