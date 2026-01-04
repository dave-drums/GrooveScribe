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
    var bpm = 120; // Default
    
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
    
    // Set the tempo in GrooveUtils BEFORE building count-in MIDI
    if (grooveUtils.setTempo) {
      grooveUtils.setTempo(bpm);
    }
    
    // Build count-in MIDI using GrooveUtils method (same as groove_writer.js line 3356)
    var countInURL = grooveUtils.MIDI_build_midi_url_count_in_track(timeSig.top, timeSig.bottom);
    
    if (!countInURL) {
      console.log('[COUNT-IN] Failed to build, skipping');
      callback();
      return;
    }
    
    // Calculate expected duration for fallback
    var expectedDuration = (60000 / bpm) * timeSig.top + 300;
    
    // Make sure MIDI is ready
    if (MIDI.Player.ctx && MIDI.Player.ctx.state === 'suspended') {
      MIDI.Player.ctx.resume();
    }
    
    // Completely stop and clear any existing playback
    MIDI.Player.stop();
    MIDI.Player.clearAnimation();
    
    console.log('[COUNT-IN] Loading count-in MIDI...');
    
    var callbackCalled = false;
    
    MIDI.Player.loadFile(countInURL, function() {
      console.log('[COUNT-IN] MIDI loaded, starting playback...');
      
      // Set up one-time listener for track completion
      var completionListener = function(data) {
        // MIDI event message 127 = end of track
        if (data.message === 127 && !callbackCalled) {
          console.log('[COUNT-IN] Track complete (message 127)');
          callbackCalled = true;
          
          MIDI.Player.removeListener(completionListener);
          
          // Completely stop and clear before starting groove
          MIDI.Player.stop();
          MIDI.Player.clearAnimation();
          
          console.log('[COUNT-IN] Calling callback to start groove');
          
          // Small delay to ensure clean state
          setTimeout(function() {
            callback();
          }, 150);
        }
      };
      
      MIDI.Player.addListener(completionListener);
      MIDI.Player.start();
      
      // Fallback timeout in case MIDI event doesn't fire
      setTimeout(function() {
        if (!callbackCalled) {
          console.log('[COUNT-IN] Fallback timeout triggered');
          callbackCalled = true;
          
          MIDI.Player.removeListener(completionListener);
          MIDI.Player.stop();
          MIDI.Player.clearAnimation();
          
          setTimeout(function() {
            callback();
          }, 150);
        }
      }, expectedDuration);
    });
  }

  window.GrooveCountIn = { init: init };
})();
