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
      
      // Prevent default to stop normal playback from starting
      e.preventDefault();
      e.stopPropagation();
      
      var self = this;
      
      doCountIn(grooveUtils, playBtn, function() {
        console.log('[COUNT-IN] Player ' + idx + ' count-in complete');
        
        // Clear the flag so the next click goes through
        countInInProgress[idx] = false;
        
        // Trigger a new click to start the groove
        // This time it will bypass count-in and use normal handler
        setTimeout(function() {
          self.click();
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
    
    // Build count-in MIDI manually with the correct BPM
    var countInURL = buildCountInMidi(bpm, timeSig.top, timeSig.bottom);
    
    if (!countInURL) {
      console.log('[COUNT-IN] Failed to build MIDI');
      callback();
      return;
    }
    
    // Calculate expected duration
    var expectedDuration = (60000 / bpm) * timeSig.top + 300;
    
    // Prepare MIDI player
    if (MIDI.Player.ctx && MIDI.Player.ctx.state === 'suspended') {
      MIDI.Player.ctx.resume();
    }
    
    MIDI.Player.stop();
    MIDI.Player.clearAnimation();
    
    console.log('[COUNT-IN] Playing count-in...');
    
    var callbackCalled = false;
    
    MIDI.Player.loadFile(countInURL, function() {
      // Listen for completion
      var completionListener = function(data) {
        if (data.message === 127 && !callbackCalled) {
          console.log('[COUNT-IN] Complete');
          callbackCalled = true;
          
          MIDI.Player.removeListener(completionListener);
          MIDI.Player.stop();
          MIDI.Player.clearAnimation();
          
          setTimeout(callback, 150);
        }
      };
      
      MIDI.Player.addListener(completionListener);
      MIDI.Player.start();
      
      // Fallback
      setTimeout(function() {
        if (!callbackCalled) {
          console.log('[COUNT-IN] Fallback timeout');
          callbackCalled = true;
          MIDI.Player.removeListener(completionListener);
          MIDI.Player.stop();
          MIDI.Player.clearAnimation();
          setTimeout(callback, 150);
        }
      }, expectedDuration);
    });
  }

  function buildCountInMidi(bpm, timeSigTop, timeSigBottom) {
    try {
      if (typeof Midi === 'undefined') {
        console.log('[COUNT-IN] Midi library not available');
        return null;
      }
      
      var file = new Midi.File();
      var track = new Midi.Track();
      file.addTrack(track);
      
      // Set tempo
      track.setTempo(bpm);
      
      // Percussion channel (channel 10 in MIDI = index 9)
      var channel = 9;
      
      // Note duration based on time signature bottom
      var duration = 128; // Quarter notes for x/4
      if (timeSigBottom == 8) duration = 64;
      else if (timeSigBottom == 16) duration = 32;
      
      // Metronome sounds (same as GrooveScribe uses)
      var highClick = 34; // First beat
      var normalClick = 33; // Other beats
      var velocity = 100;
      
      // Blank note for spacing (GrooveScribe does this)
      track.addNoteOff(channel, 60, 1);
      
      // First beat (high click)
      track.addNoteOn(channel, highClick, 0, velocity);
      track.addNoteOff(channel, highClick, duration);
      
      // Remaining beats (normal clicks)
      for (var i = 1; i < timeSigTop; i++) {
        track.addNoteOn(channel, normalClick, 0, velocity);
        track.addNoteOff(channel, normalClick, duration);
      }
      
      var bytes = file.toBytes();
      var base64 = btoa(bytes);
      
      console.log('[COUNT-IN] Built MIDI (' + bytes.length + ' bytes)');
      
      return 'data:audio/midi;base64,' + base64;
    } catch(e) {
      console.error('[COUNT-IN] Build error:', e);
      return null;
    }
  }

  window.GrooveCountIn = { init: init };
})();
