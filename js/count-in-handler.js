/**
 * count-in-handler.js
 * Handles count-in functionality for GrooveScribe player
 * Each iframe hooks its own player independently
 */

(function() {
  'use strict';

  window.GrooveCountIn = {
    initialized: false,
    hooked: false,

    init: function() {
      if (this.initialized) {
        return; // Already initialized in this iframe
      }
      
      this.initialized = true;
      var self = this;
      
      // Wait for dependencies
      var attempts = 0;
      var checkDeps = setInterval(function() {
        attempts++;
        
        if (typeof GrooveUtils !== 'undefined' && typeof MIDI !== 'undefined') {
          clearInterval(checkDeps);
          self.hookPlayer();
        } else if (attempts > 50) {
          clearInterval(checkDeps);
          console.error('Count-in: Timeout waiting for dependencies');
        }
      }, 100);
    },

    hookPlayer: function() {
      var self = this;
      
      if (self.hooked) {
        return; // Already hooked
      }
      
      // Wait for THIS iframe's player to be ready
      var attempts = 0;
      var checkPlayer = setInterval(function() {
        attempts++;
        
        var playBtn = document.querySelector('.midiPlayImage');
        var countInBtn = document.querySelector('.midiCountInButton');
        
        // Wait for both buttons
        if (!playBtn || !countInBtn) {
          if (attempts > 100) {
            clearInterval(checkPlayer);
          }
          return;
        }
        
        // Wait for onclick
        if (!playBtn.onclick) {
          if (attempts > 100) {
            clearInterval(checkPlayer);
          }
          return;
        }
        
        // Found everything, hook it
        clearInterval(checkPlayer);
        self.hooked = true;
        
        // Create GrooveUtils for this player
        var grooveUtils;
        try {
          grooveUtils = new GrooveUtils();
        } catch (e) {
          console.error('Count-in: GrooveUtils error', e);
          return;
        }
        
        // Store original onclick
        var originalOnclick = playBtn.onclick;
        
        // Replace with wrapper
        playBtn.onclick = function(event) {
          var isActive = countInBtn.classList.contains('active');
          
          // If not active or already playing, use normal handler
          if (!isActive || MIDI.Player.playing) {
            if (originalOnclick) {
              return originalOnclick.call(this, event);
            }
            return;
          }
          
          // Play with count-in
          event.preventDefault();
          event.stopPropagation();
          
          self.playCountIn(playBtn, grooveUtils, function() {
            if (originalOnclick) {
              originalOnclick.call(playBtn, event);
            }
          });
          
          return false;
        };
        
        console.log('Count-in: Player hooked');
      }, 100);
    },

    playCountIn: function(playBtn, grooveUtils, callback) {
      // Get BPM
      var bpm = this.getBPM(playBtn);
      
      // Get time signature
      var timeSig = this.getTimeSig(grooveUtils);
      
      console.log('Count-in: BPM=' + bpm + ', Time=' + timeSig.top + '/' + timeSig.bottom);
      
      // Build MIDI
      var midi = this.buildMidi(bpm, timeSig.top, timeSig.bottom, grooveUtils);
      if (!midi) {
        callback();
        return;
      }
      
      // Calculate duration
      var msPerBeat = 60000 / bpm;
      var duration = msPerBeat * timeSig.top + 200;
      
      // Update button state
      playBtn.className = playBtn.className.replace(/Stopped|Paused/g, '');
      if (playBtn.className.indexOf('Playing') === -1) {
        playBtn.className += ' Playing';
      }
      
      // Play count-in
      MIDI.Player.ctx.resume();
      MIDI.Player.stop();
      MIDI.Player.clearAnimation();
      
      MIDI.Player.loadFile(midi, function() {
        MIDI.Player.start();
        
        // Stop after duration
        setTimeout(function() {
          MIDI.Player.stop();
          MIDI.Player.clearAnimation();
          
          setTimeout(callback, 100);
        }, duration);
      });
    },

    getBPM: function(playBtn) {
      var container = playBtn.closest('.playerControlsRow') || playBtn.closest('.playerControl');
      if (container) {
        var field = container.querySelector('.tempoTextField');
        if (field && field.value) {
          var val = parseInt(field.value, 10);
          if (!isNaN(val) && val >= 30 && val <= 300) {
            return val;
          }
        }
        
        var slider = container.querySelector('input[type="range"]');
        if (slider && slider.value) {
          var val = parseInt(slider.value, 10);
          if (!isNaN(val) && val >= 30 && val <= 300) {
            return val;
          }
        }
      }
      
      return 120;
    },

    getTimeSig: function(grooveUtils) {
      try {
        if (grooveUtils && grooveUtils.myGrooveData) {
          return {
            top: grooveUtils.myGrooveData.numBeats || 4,
            bottom: grooveUtils.myGrooveData.noteValue || 4
          };
        }
      } catch (e) {}
      
      return { top: 4, bottom: 4 };
    },

    buildMidi: function(bpm, timeSigTop, timeSigBottom, grooveUtils) {
      try {
        if (grooveUtils && grooveUtils.MIDI_build_midi_url_count_in_track) {
          var oldTempo = grooveUtils.getTempo ? grooveUtils.getTempo() : null;
          
          if (grooveUtils.setTempo) {
            grooveUtils.setTempo(bpm);
          }
          
          var url = grooveUtils.MIDI_build_midi_url_count_in_track(timeSigTop, timeSigBottom);
          
          if (oldTempo && grooveUtils.setTempo) {
            grooveUtils.setTempo(oldTempo);
          }
          
          if (url) return url;
        }
        
        if (typeof Midi === 'undefined') return null;
        
        var file = new Midi.File();
        var track = new Midi.Track();
        file.addTrack(track);
        
        track.setTempo(bpm);
        track.setInstrument(0, 0x13);
        track.addNoteOff(9, 60, 1);
        
        var delay = 128;
        if (timeSigBottom == 8) delay = 64;
        else if (timeSigBottom == 16) delay = 32;
        
        track.addNoteOn(9, 34, 0, 100);
        track.addNoteOff(9, 34, delay);
        
        for (var i = 1; i < timeSigTop; i++) {
          track.addNoteOn(9, 33, 0, 100);
          track.addNoteOff(9, 33, delay);
        }
        
        return 'data:audio/midi;base64,' + btoa(file.toBytes());
      } catch (e) {
        return null;
      }
    }
  };
})();
