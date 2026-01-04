/**
 * count-in-handler.js v2
 * SIMPLIFIED - hooks play buttons after GrooveScribe loads
 */

(function() {
  'use strict';

  var hookedButtons = [];

  function hookAllPlayers() {
    var playButtons = document.querySelectorAll('.midiPlayImage');
    var countInButtons = document.querySelectorAll('.midiCountInButton');
    
    if (playButtons.length === 0) {
      console.log('[COUNT-IN] No players found yet');
      return false;
    }
    
    if (playButtons.length !== countInButtons.length) {
      console.log('[COUNT-IN] Waiting for all count-in buttons...');
      return false;
    }
    
    // Check if all have onclick
    for (var i = 0; i < playButtons.length; i++) {
      if (!playButtons[i].onclick) {
        console.log('[COUNT-IN] Waiting for onclick handlers...');
        return false;
      }
    }
    
    console.log('[COUNT-IN] Hooking ' + playButtons.length + ' players');
    
    for (var i = 0; i < playButtons.length; i++) {
      hookSinglePlayer(playButtons[i], countInButtons[i], i);
    }
    
    console.log('[COUNT-IN] Ready!');
    return true;
  }

  function hookSinglePlayer(playBtn, countInBtn, index) {
    if (hookedButtons.indexOf(playBtn) !== -1) return;
    hookedButtons.push(playBtn);
    
    var originalClick = playBtn.onclick;
    
    playBtn.onclick = function(e) {
      var active = countInBtn.classList.contains('active');
      
      if (!active || MIDI.Player.playing) {
        return originalClick.call(this, e);
      }
      
      // Do count-in
      console.log('[COUNT-IN] Player ' + index + ' starting');
      e.preventDefault();
      e.stopPropagation();
      
      doCountIn(playBtn, function() {
        console.log('[COUNT-IN] Player ' + index + ' -> groove');
        originalClick.call(playBtn, e);
      });
      
      return false;
    };
  }

  function doCountIn(playBtn, callback) {
    var bpm = getBPM(playBtn);
    var timeSig = getTimeSig();
    
    console.log('[COUNT-IN] BPM=' + bpm + ' TimeSig=' + timeSig.top + '/' + timeSig.bottom);
    
    var midi = buildMidi(bpm, timeSig.top, timeSig.bottom);
    if (!midi) {
      console.log('[COUNT-IN] Failed to build MIDI, skipping');
      callback();
      return;
    }
    
    var duration = (60000 / bpm) * timeSig.top + 200;
    
    playBtn.className = playBtn.className.replace(/Stopped|Paused/g, '') + ' Playing';
    
    // Make sure audio context is running
    if (MIDI.Player.ctx && MIDI.Player.ctx.state === 'suspended') {
      console.log('[COUNT-IN] Resuming audio context');
      MIDI.Player.ctx.resume();
    }
    
    MIDI.Player.stop();
    MIDI.Player.clearAnimation();
    
    console.log('[COUNT-IN] Loading MIDI...');
    MIDI.Player.loadFile(midi, function() {
      console.log('[COUNT-IN] MIDI loaded, playing...');
      
      // Set volume high
      if (MIDI.setVolume) {
        MIDI.setVolume(0, 127); // Channel 0, max volume
      }
      
      MIDI.Player.start();
      
      setTimeout(function() {
        console.log('[COUNT-IN] Stopping...');
        MIDI.Player.stop();
        MIDI.Player.clearAnimation();
        setTimeout(callback, 100);
      }, duration);
    });
  }

  function getBPM(playBtn) {
    var container = playBtn.closest('.playerControl');
    if (container) {
      var field = container.querySelector('.tempoTextField');
      if (field && field.value) {
        var v = parseInt(field.value, 10);
        if (v >= 30 && v <= 300) return v;
      }
    }
    return 120;
  }

  function getTimeSig() {
    try {
      var gu = new GrooveUtils();
      if (gu.myGrooveData) {
        return {
          top: gu.myGrooveData.numBeats || 4,
          bottom: gu.myGrooveData.noteValue || 4
        };
      }
    } catch(e) {}
    return { top: 4, bottom: 4 };
  }

  function buildMidi(bpm, top, bottom) {
    try {
      // Use GrooveUtils built-in method (most reliable)
      var gu = new GrooveUtils();
      
      // Set the tempo first
      if (gu.setTempo) {
        gu.setTempo(bpm);
      }
      
      // Build count-in with GrooveUtils
      if (gu.MIDI_build_midi_url_count_in_track) {
        console.log('[COUNT-IN] Using GrooveUtils method');
        return gu.MIDI_build_midi_url_count_in_track(top, bottom);
      }
    } catch(e) {
      console.log('[COUNT-IN] GrooveUtils method failed:', e);
    }
    
    // Fallback: manual MIDI build with CORRECT timing
    try {
      console.log('[COUNT-IN] Using manual MIDI build');
      var f = new Midi.File();
      var t = new Midi.Track();
      f.addTrack(t);
      
      t.setTempo(bpm);
      t.setInstrument(0, 0);
      
      var channel = 9; // Percussion
      
      // Calculate note duration in MIDI ticks
      var noteDuration = 128; // Quarter notes for x/4
      if (bottom == 8) noteDuration = 64;   // 8th notes for x/8
      else if (bottom == 16) noteDuration = 32; // 16th notes for x/16
      
      // Use the SAME percussion sounds GrooveScribe uses
      // constant_OUR_MIDI_METRONOME_1 = 34 (high click)
      // constant_OUR_MIDI_METRONOME_NORMAL = 33 (normal click)
      var highClick = 34;
      var normalClick = 33;
      var velocity = 100; // Match GrooveScribe velocity
      
      // Blank note at start (GrooveScribe does this)
      t.addNoteOff(channel, 60, 1);
      
      // First beat (high click)
      t.addNoteOn(channel, highClick, 0, velocity);
      t.addNoteOff(channel, highClick, noteDuration);
      
      // Remaining beats (normal clicks)
      for (var i = 1; i < top; i++) {
        t.addNoteOn(channel, normalClick, 0, velocity); // 0 = immediately after last event
        t.addNoteOff(channel, normalClick, noteDuration); // noteDuration = length of note
      }
      
      console.log('[COUNT-IN] Built MIDI with ' + top + ' clicks');
      return 'data:audio/midi;base64,' + btoa(f.toBytes());
    } catch(e) {
      console.error('[COUNT-IN] MIDI build error:', e);
      return null;
    }
  }

  // Initialize
  window.GrooveCountIn = {
    init: function() {
      console.log('[COUNT-IN] Init called');
      
      var attempts = 0;
      var interval = setInterval(function() {
        attempts++;
        
        if (hookAllPlayers()) {
          clearInterval(interval);
        } else if (attempts > 50) {
          clearInterval(interval);
          console.log('[COUNT-IN] Timeout');
        }
      }, 100);
    }
  };
})();
