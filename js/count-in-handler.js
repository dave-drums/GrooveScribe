/**
 * count-in-handler.js - FINAL
 * Clean implementation using MIDI.Player event system
 * Matches GrooveScribe editor pattern from groove_writer.js lines 3354-3368
 */

(function() {
  'use strict';

  var hookedButtons = [];

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
    
    playBtn.onclick = function(e) {
      var needsCountIn = countInBtn.classList.contains('active');
      
      // If already playing or no count-in, use normal behavior
      if (MIDI.Player.playing || !needsCountIn) {
        return originalClick.call(this, e);
      }
      
      // Do count-in then groove (matching groove_writer.js pattern)
      console.log('[COUNT-IN] Starting count-in for player ' + idx);
      e.preventDefault();
      
      doCountIn(grooveUtils, playBtn, function() {
        console.log('[COUNT-IN] Count-in complete, starting groove');
        // Trigger original play - this loads and plays the groove
        originalClick.call(playBtn, e);
      });
      
      return false;
    };
  }

  function doCountIn(grooveUtils, playBtn, callback) {
    // Get time signature
    var timeSig = { top: 4, bottom: 4 };
    try {
      if (grooveUtils.myGrooveData) {
        timeSig.top = grooveUtils.myGrooveData.numBeats || 4;
        timeSig.bottom = grooveUtils.myGrooveData.noteValue || 4;
      }
    } catch(e) {}
    
    // Build count-in MIDI using GrooveUtils method (same as groove_writer.js line 3356)
    var countInURL = grooveUtils.MIDI_build_midi_url_count_in_track(timeSig.top, timeSig.bottom);
    
    if (!countInURL) {
      console.log('[COUNT-IN] Failed to build, skipping');
      callback();
      return;
    }
    
    // Update button state
    playBtn.className = playBtn.className.replace(/Stopped|Paused/g, '') + ' Playing';
    
    // Play count-in track
    MIDI.Player.stop();
    MIDI.Player.clearAnimation();
    
    if (MIDI.Player.ctx) {
      MIDI.Player.ctx.resume();
    }
    
    MIDI.Player.loadFile(countInURL, function() {
      // Set up one-time listener for track completion
      var completionListener = function(data) {
        // MIDI event message 127 = end of track
        if (data.message === 127) {
          MIDI.Player.removeListener(completionListener);
          MIDI.Player.stop();
          MIDI.Player.clearAnimation();
          
          // Small delay then start groove
          setTimeout(function() {
            callback();
          }, 100);
        }
      };
      
      MIDI.Player.addListener(completionListener);
      MIDI.Player.start();
    });
  }

  window.GrooveCountIn = { init: init };
})();
