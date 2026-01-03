/**
 * count-in-handler.js
 * Handles count-in functionality for GrooveScribe player
 */

(function() {
  'use strict';

  window.GrooveCountIn = {
    initialized: false,
    grooveUtils: null,

    init: function() {
      if (this.initialized) return;
      
      var self = this;
      var checkInterval = setInterval(function() {
        if (typeof GrooveUtils !== 'undefined' && typeof MIDI !== 'undefined') {
          clearInterval(checkInterval);
          self.setup();
          self.initialized = true;
        }
      }, 100);
    },

    setup: function() {
      var self = this;
      
      var waitForPlayer = setInterval(function() {
        var playBtn = document.querySelector('.midiPlayImage');
        if (!playBtn) return;
        
        clearInterval(waitForPlayer);
        
        try {
          self.grooveUtils = new GrooveUtils();
        } catch (e) {
          console.error('GrooveUtils error:', e);
          return;
        }
        
        // Hook play button
        var originalOnclick = playBtn.onclick;
        playBtn.onclick = function(event) {
          var countInBtn = document.querySelector('.midiCountInButton');
          var hasActiveClass = countInBtn ? countInBtn.classList.contains('active') : false;
          
          console.log('Play clicked. Count-in button found:', !!countInBtn, 'Active:', hasActiveClass);
          
          // If already playing, use normal behavior
          if (MIDI.Player.playing) {
            console.log('Already playing, using normal handler');
            if (originalOnclick) {
              return originalOnclick.call(this, event);
            }
            return;
          }
          
          // If no count-in needed, use normal behavior
          if (!hasActiveClass) {
            console.log('Count-in not active, using normal handler');
            if (originalOnclick) {
              return originalOnclick.call(this, event);
            }
            return;
          }
          
          // Play count-in
          console.log('Starting count-in...');
          event.preventDefault();
          event.stopPropagation();
          
          self.doCountIn(function() {
            console.log('Count-in callback, starting groove...');
            // After count-in, start normal playback
            if (originalOnclick) {
              originalOnclick.call(playBtn, event);
            }
          });
          
          return false;
        };
        
        console.log('Count-in handler ready');
      }, 100);
    },

    getBPM: function() {
      // Read from visible BPM field
      var field = document.querySelector('.tempoTextField, input[id*="tempoTextField"]');
      if (field && field.value) {
        var val = parseInt(field.value, 10);
        if (!isNaN(val) && val >= 30 && val <= 300) {
          console.log('BPM from text field:', val);
          return val;
        }
      }
      
      // Read from slider as fallback
      var slider = document.querySelector('input[type="range"][id*="tempoInput"]');
      if (slider && slider.value) {
        var val = parseInt(slider.value, 10);
        if (!isNaN(val) && val >= 30 && val <= 300) {
          console.log('BPM from slider:', val);
          return val;
        }
      }
      
      // Fallback to GrooveUtils
      try {
        if (this.grooveUtils && this.grooveUtils.getTempo) {
          var val = this.grooveUtils.getTempo();
          console.log('BPM from GrooveUtils:', val);
          return val;
        }
      } catch (e) {}
      
      console.log('BPM fallback to default: 120');
      return 120;
    },

    getTimeSig: function() {
      try {
        if (this.grooveUtils && this.grooveUtils.myGrooveData) {
          return {
            top: this.grooveUtils.myGrooveData.numBeats || 4,
            bottom: this.grooveUtils.myGrooveData.noteValue || 4
          };
        }
      } catch (e) {}
      
      return { top: 4, bottom: 4 };
    },

    doCountIn: function(callback) {
      var self = this;
      
      var bpm = self.getBPM();
      var timeSig = self.getTimeSig();
      
      console.log('=== COUNT-IN START ===');
      console.log('Count-in: BPM=' + bpm + ', TimeSig=' + timeSig.top + '/' + timeSig.bottom);
      
      // Build MIDI with correct BPM
      var midi = self.buildMidi(bpm, timeSig.top, timeSig.bottom);
      if (!midi) {
        console.error('Failed to build count-in MIDI');
        callback();
        return;
      }
      
      // Calculate duration (60000ms per minute / BPM = ms per beat)
      var msPerBeat = 60000 / bpm;
      var duration = msPerBeat * timeSig.top + 200; // Add buffer
      
      console.log('Count-in duration: ' + duration + 'ms (' + msPerBeat + 'ms per beat)');
      
      // Update play button visual
      var playBtn = document.querySelector('.midiPlayImage');
      if (playBtn) {
        playBtn.className = playBtn.className.replace(/Stopped|Paused/g, '');
        if (playBtn.className.indexOf('Playing') === -1) {
          playBtn.className += ' Playing';
        }
      }
      
      // Play count-in
      MIDI.Player.ctx.resume();
      MIDI.Player.stop();
      MIDI.Player.clearAnimation();
      
      console.log('Loading count-in MIDI...');
      
      MIDI.Player.loadFile(midi, function() {
        console.log('Count-in MIDI loaded, starting playback...');
        MIDI.Player.start();
        
        // Stop after duration
        setTimeout(function() {
          console.log('Count-in timeout reached, stopping...');
          MIDI.Player.stop();
          MIDI.Player.clearAnimation();
          
          console.log('Count-in finished, calling callback...');
          
          // Start groove
          setTimeout(callback, 100);
        }, duration);
      });
    },

    buildMidi: function(bpm, timeSigTop, timeSigBottom) {
      try {
        // Try GrooveUtils method first
        if (this.grooveUtils && this.grooveUtils.MIDI_build_midi_url_count_in_track) {
          // Save current tempo
          var originalTempo = this.grooveUtils.getTempo ? this.grooveUtils.getTempo() : null;
          
          // Set count-in tempo
          if (this.grooveUtils.setTempo) {
            this.grooveUtils.setTempo(bpm);
          }
          
          var url = this.grooveUtils.MIDI_build_midi_url_count_in_track(timeSigTop, timeSigBottom);
          
          // Restore original tempo
          if (originalTempo && this.grooveUtils.setTempo) {
            this.grooveUtils.setTempo(originalTempo);
          }
          
          if (url) return url;
        }
        
        // Manual build as fallback
        if (typeof Midi === 'undefined') return null;
        
        var file = new Midi.File();
        var track = new Midi.Track();
        file.addTrack(track);
        
        track.setTempo(bpm);
        track.setInstrument(0, 0x13);
        
        // Blank note for spacing
        track.addNoteOff(9, 60, 1);
        
        // Note delay based on time signature
        var delay = 128; // Quarter notes
        if (timeSigBottom == 8) delay = 64;
        else if (timeSigBottom == 16) delay = 32;
        
        // High click on beat 1
        track.addNoteOn(9, 34, 0, 100);
        track.addNoteOff(9, 34, delay);
        
        // Normal clicks on remaining beats
        for (var i = 1; i < timeSigTop; i++) {
          track.addNoteOn(9, 33, 0, 100);
          track.addNoteOff(9, 33, delay);
        }
        
        return 'data:audio/midi;base64,' + btoa(file.toBytes());
      } catch (e) {
        console.error('Build MIDI error:', e);
        return null;
      }
    }
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() { window.GrooveCountIn.init(); }, 1000);
    });
  } else {
    setTimeout(function() { window.GrooveCountIn.init(); }, 1000);
  }
})();
