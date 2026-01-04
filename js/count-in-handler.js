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
    
    playBtn.className = playBtn.className.replace(/Stopped|Paused/g, '') + ' Playing';
    
    // Use the actual metronome MP3 files from GrooveScribe
    playMetronomeSounds(bpm, timeSig.top, callback);
  }
  
  function playMetronomeSounds(bpm, beats, callback) {
    var beatDuration = (60 / bpm) * 1000; // milliseconds per beat
    var currentBeat = 0;
    
    // Preload both sounds
    var sound1 = new Audio('/soundfont/NewDrumSamples/MP3/metronome1Count.mp3');
    var soundClick = new Audio('/soundfont/NewDrumSamples/MP3/metronomeClick.mp3');
    
    console.log('[COUNT-IN] Playing metronome sounds');
    
    function playNextBeat() {
      if (currentBeat >= beats) {
        // Done with count-in
        console.log('[COUNT-IN] Finished, starting groove');
        callback();
        return;
      }
      
      // Play the appropriate sound
      var sound = (currentBeat === 0) ? sound1.cloneNode() : soundClick.cloneNode();
      sound.volume = 1.0;
      sound.play().catch(function(e) {
        console.log('[COUNT-IN] Audio play error:', e);
      });
      
      currentBeat++;
      
      // Schedule next beat
      if (currentBeat < beats) {
        setTimeout(playNextBeat, beatDuration);
      } else {
        // Wait one more beat duration before starting groove
        setTimeout(callback, beatDuration);
      }
    }
    
    // Start immediately
    playNextBeat();
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
    console.log('[COUNT-IN] Building MIDI: BPM=' + bpm + ', ' + top + '/' + bottom);
    
    // Try using existing GrooveScribe MIDI builder
    try {
      // Check if the global GrooveUtils exists and has the method
      if (typeof GrooveUtils !== 'undefined' && GrooveUtils.prototype.MIDI_build_midi_url_count_in_track) {
        // Create temporary instance just for building
        var tempGU = new GrooveUtils();
        
        // The method should build the MIDI with the tempo embedded
        var midiUrl = tempGU.MIDI_build_midi_url_count_in_track(top, bottom);
        
        if (midiUrl) {
          console.log('[COUNT-IN] Built using GrooveUtils method');
          return midiUrl;
        }
      }
    } catch(e) {
      console.log('[COUNT-IN] GrooveUtils failed:', e.message);
    }
    
    // Manual build as fallback
    try {
      console.log('[COUNT-IN] Building manually');
      
      if (typeof Midi === 'undefined') {
        console.log('[COUNT-IN] Midi library not found');
        return null;
      }
      
      var file = new Midi.File();
      var track = new Midi.Track();
      file.addTrack(track);
      
      // Set tempo in the track
      track.setTempo(bpm);
      
      // Percussion channel
      var channel = 9;
      
      // Note duration
      var duration = 128;
      if (bottom == 8) duration = 64;
      else if (bottom == 16) duration = 32;
      
      // Metronome sounds (same as GrooveScribe)
      var highClick = 34;
      var normalClick = 33;
      
      // Dummy note for spacing
      track.addNoteOff(channel, 60, 1);
      
      // First click (high)
      track.addNoteOn(channel, highClick, 0, 100);
      track.addNoteOff(channel, highClick, duration);
      
      // Remaining clicks
      for (var i = 1; i < top; i++) {
        track.addNoteOn(channel, normalClick, 0, 100);
        track.addNoteOff(channel, normalClick, duration);
      }
      
      var bytes = file.toBytes();
      var base64 = btoa(bytes);
      
      console.log('[COUNT-IN] Built ' + top + ' clicks, ' + bytes.length + ' bytes');
      
      return 'data:audio/midi;base64,' + base64;
    } catch(e) {
      console.error('[COUNT-IN] Manual build failed:', e);
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
