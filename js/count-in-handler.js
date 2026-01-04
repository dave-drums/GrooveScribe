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
    
    var duration = (60000 / bpm) * timeSig.top + 200;
    
    playBtn.className = playBtn.className.replace(/Stopped|Paused/g, '') + ' Playing';
    
    // Try MIDI first
    if (midi && MIDI && MIDI.Player) {
      tryMidiCountIn(midi, duration, bpm, timeSig, playBtn, callback);
    } else {
      // Fallback to Web Audio beeps
      console.log('[COUNT-IN] Using Web Audio beeps (MIDI unavailable)');
      playBeepCountIn(bpm, timeSig.top, callback);
    }
  }
  
  function tryMidiCountIn(midi, duration, bpm, timeSig, playBtn, callback) {
    // Make sure audio context is running
    if (MIDI.Player.ctx && MIDI.Player.ctx.state === 'suspended') {
      console.log('[COUNT-IN] Resuming audio context');
      MIDI.Player.ctx.resume();
    }
    
    MIDI.Player.stop();
    MIDI.Player.clearAnimation();
    
    console.log('[COUNT-IN] Loading MIDI...');
    
    var soundPlayed = false;
    var fallbackTimer = null;
    
    MIDI.Player.loadFile(midi, function() {
      console.log('[COUNT-IN] MIDI loaded, playing...');
      
      // Set volume high
      if (MIDI.setVolume) {
        MIDI.setVolume(0, 127);
      }
      
      MIDI.Player.start();
      
      // Check if sound is actually playing
      setTimeout(function() {
        if (MIDI.Player.playing) {
          soundPlayed = true;
        } else {
          // MIDI didn't work, fall back to beeps
          console.log('[COUNT-IN] MIDI silent, using beeps');
          MIDI.Player.stop();
          playBeepCountIn(bpm, timeSig.top, function() {
            playBtn.className = playBtn.className.replace('Playing', 'Stopped');
            callback();
          });
          return;
        }
      }, 100);
      
      setTimeout(function() {
        if (soundPlayed) {
          console.log('[COUNT-IN] Stopping...');
          MIDI.Player.stop();
          MIDI.Player.clearAnimation();
          setTimeout(callback, 100);
        }
      }, duration);
    });
  }
  
  function playBeepCountIn(bpm, beats, callback) {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var beatDuration = 60 / bpm; // seconds
    var currentBeat = 0;
    
    function playBeep(isFirst) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // High beep for first beat, lower for others
      osc.frequency.value = isFirst ? 1000 : 800;
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    }
    
    function playNextBeep() {
      if (currentBeat < beats) {
        playBeep(currentBeat === 0);
        currentBeat++;
        
        if (currentBeat < beats) {
          setTimeout(playNextBeep, beatDuration * 1000);
        } else {
          setTimeout(function() {
            ctx.close();
            callback();
          }, beatDuration * 1000);
        }
      }
    }
    
    console.log('[COUNT-IN] Playing ' + beats + ' beeps');
    playNextBeep();
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
