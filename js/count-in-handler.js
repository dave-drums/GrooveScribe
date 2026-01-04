/**
 * count-in-handler.js - FINAL
 * Clean implementation using MIDI.Player event system
 * Matches GrooveScribe editor pattern from groove_writer.js lines 3354-3368
 */

(function() {
  'use strict';

  var hookedButtons = [];
  var countInInProgress = {}; // Track which players are doing count-in

  function init() {
    console.log('[COUNT-IN] Init');
    
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
    
    console.log('[COUNT-IN] Hooked ' + plays.length + ' players');
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
      
      // If already playing, currently doing count-in, or no count-in needed, use normal behavior
      if (MIDI.Player.playing || countInInProgress[idx] || !needsCountIn) {
        return originalClick.call(this, e);
      }
      
      // Do count-in then groove
      console.log('[COUNT-IN] Player ' + idx + ' starting count-in');
      
      // Mark that we're doing count-in
      countInInProgress[idx] = true;
      
      // Prevent default
      e.preventDefault();
      e.stopPropagation();
      
      var self = this;
      
      doCountIn(grooveUtils, playBtn, function() {
        console.log('[COUNT-IN] Player ' + idx + ' starting groove');
        
        // Clear flag
        countInInProgress[idx] = false;
        
        // Call the original handler DIRECTLY - don't click which would go through our wrapper again
        setTimeout(function() {
          if (originalClick) {
            // Create a fake event object
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
    // Get BPM from the player's tempo field
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
    
    // Get time signature
    var timeSig = { top: 4, bottom: 4 };
    try {
      if (grooveUtils.myGrooveData) {
        timeSig.top = grooveUtils.myGrooveData.numBeats || 4;
        timeSig.bottom = grooveUtils.myGrooveData.noteValue || 4;
      }
    } catch(e) {}
    
    console.log('[COUNT-IN] BPM=' + bpm + ', TimeSig=' + timeSig.top + '/' + timeSig.bottom);
    
    // Use MP3 metronome sounds (guaranteed to work)
    playMetronomeMP3(bpm, timeSig.top, callback);
  }

  function playMetronomeMP3(bpm, beats, callback) {
    var beatDuration = 60 / bpm; // seconds per beat
    
    console.log('[COUNT-IN] Playing metronome with Web Audio');
    
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Load and decode both sounds
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
        .catch(function(e) {
          console.log('[COUNT-IN] Load error:', e);
          // Fallback to simple Audio if Web Audio fails
          playFallbackMetronome(bpm, beats, callback);
        });
    }
    
    function playScheduledBeats() {
      var startTime = audioContext.currentTime + 0.05; // Small offset to ensure ready
      
      // Schedule all beats with precise Web Audio timing
      for (var i = 0; i < beats; i++) {
        var buffer = (i === 0) ? buffers.high : buffers.normal;
        var source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        
        // Schedule this beat at exact time (no setTimeout drift!)
        var playTime = startTime + (i * beatDuration);
        source.start(playTime);
      }
      
      // Start groove AFTER all beats finish (not when last beat starts)
      var allBeatsFinishTime = startTime + (beats * beatDuration);
      var delay = (allBeatsFinishTime - audioContext.currentTime) * 1000 + 50; // Small buffer
      
      setTimeout(function() {
        console.log('[COUNT-IN] Complete');
        audioContext.close();
        callback();
      }, delay);
    }
    
    function playFallbackMetronome(bpm, beats, callback) {
      // Simple fallback if Web Audio fails
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
    
    // Load both sounds
    loadSound(sound1URL, 'high');
    loadSound(soundClickURL, 'normal');
  }

  function buildCountInMidi(bpm, timeSigTop, timeSigBottom) {
    // Not used anymore - using MP3 instead
    return null;
  }

  window.GrooveCountIn = { init: init };
})();
