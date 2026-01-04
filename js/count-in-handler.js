/**
 * count-in-handler.js - FINAL
 * Clean implementation using MP3 metronome sounds with Web Audio scheduling
 */

(function() {
  'use strict';

  var hookedButtons = [];
  var countInInProgress = {};

  function init() {
    var attempts = 0;
    var check = setInterval(function() {
      attempts++;
      
      if (hookAll()) {
        clearInterval(check);
      } else if (attempts > 50) {
        clearInterval(check);
      }
    }, 100);
  }

  function hookAll() {
    var plays = document.querySelectorAll('.midiPlayImage');
    var countIns = document.querySelectorAll('.midiCountInButton');
    
    if (plays.length === 0 || plays.length !== countIns.length) return false;
    
    for (var i = 0; i < plays.length; i++) {
      if (!plays[i].onclick) return false;
    }
    
    for (var i = 0; i < plays.length; i++) {
      hook(plays[i], countIns[i], i);
    }
    
    return true;
  }

  function hook(playBtn, countInBtn, idx) {
    if (hookedButtons.indexOf(playBtn) !== -1) return;
    hookedButtons.push(playBtn);
    
    var originalClick = playBtn.onclick;
    var grooveUtils = new GrooveUtils();
    
    countInInProgress[idx] = false;
    
    playBtn.onclick = function(e) {
      var needsCountIn = countInBtn.classList.contains('active');
      
      if (countInInProgress[idx]) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      
      if (MIDI.Player.playing || !needsCountIn) {
        return originalClick.call(this, e);
      }
      
      countInInProgress[idx] = true;
      playBtn.style.opacity = '0.5';
      playBtn.style.cursor = 'not-allowed';
      playBtn.style.pointerEvents = 'none';
      
      e.preventDefault();
      e.stopPropagation();
      
      var self = this;
      
      doCountIn(grooveUtils, playBtn, function() {
        playBtn.style.opacity = '';
        playBtn.style.cursor = '';
        playBtn.style.pointerEvents = '';
        
        countInInProgress[idx] = false;
        
        setTimeout(function() {
          if (originalClick) {
            var fakeEvent = {
              preventDefault: function() {},
              stopPropagation: function() {},
              target: self,
              currentTarget: self,
              type: 'click'
            };
            originalClick.call(self, fakeEvent);
          }
        }, 50);
      });
      
      return false;
    };
  }

  function doCountIn(grooveUtils, playBtn, callback) {
    var container = playBtn.closest('.playerControl');
    var bpm = 120;
    
    if (container) {
      var tempoField = container.querySelector('.tempoTextField');
      if (tempoField && tempoField.value) {
        bpm = parseInt(tempoField.value, 10);
        if (isNaN(bpm) || bpm < 30 || bpm > 300) {
          bpm = 120;
        }
      }
    }
    
    var timeSig = { top: 4, bottom: 4 };
    try {
      if (grooveUtils.myGrooveData) {
        timeSig.top = grooveUtils.myGrooveData.numBeats || 4;
        timeSig.bottom = grooveUtils.myGrooveData.noteValue || 4;
      }
    } catch(e) {}
    
    playMetronomeMP3(bpm, timeSig.top, callback);
  }

  function playMetronomeMP3(bpm, beats, callback) {
    var beatDuration = 60 / bpm;
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    var sound1URL = '/soundfont/NewDrumSamples/MP3/metronome1Count.mp3';
    var soundClickURL = '/soundfont/NewDrumSamples/MP3/metronomeClick.mp3';
    
    var buffers = { high: null, normal: null };
    var loadCount = 0;
    
    function loadSound(url, key) {
      fetch(url)
        .then(function(response) { return response.arrayBuffer(); })
        .then(function(arrayBuffer) { return audioContext.decodeAudioData(arrayBuffer); })
        .then(function(audioBuffer) {
          buffers[key] = audioBuffer;
          loadCount++;
          if (loadCount === 2) {
            playScheduledBeats();
          }
        })
        .catch(function() {
          playFallbackMetronome(bpm, beats, callback);
        });
    }
    
    function playScheduledBeats() {
      var startTime = audioContext.currentTime + 0.01;
      
      for (var i = 0; i < beats; i++) {
        var buffer = (i === 0) ? buffers.high : buffers.normal;
        var source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        
        var playTime = startTime + (i * beatDuration);
        source.start(playTime);
      }
      
      var allBeatsFinishTime = startTime + (beats * beatDuration);
      var delay = (allBeatsFinishTime - audioContext.currentTime) * 1000 - 80;
      
      if (delay < 0) delay = 0;
      
      setTimeout(function() {
        audioContext.close();
        callback();
      }, delay);
    }
    
    function playFallbackMetronome(bpm, beats, callback) {
      var beatDuration = (60 / bpm) * 1000;
      var currentBeat = 0;
      
      function playNext() {
        if (currentBeat >= beats) {
          callback();
          return;
        }
        
        var sound = new Audio(currentBeat === 0 ? sound1URL : soundClickURL);
        sound.play();
        currentBeat++;
        
        if (currentBeat < beats) {
          setTimeout(playNext, beatDuration);
        } else {
          setTimeout(callback, 50);
        }
      }
      
      playNext();
    }
    
    loadSound(sound1URL, 'high');
    loadSound(soundClickURL, 'normal');
  }

  window.GrooveCountIn = { init: init };
})();
