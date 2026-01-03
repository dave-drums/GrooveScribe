/**
 * count-in-handler.js
 * Handles count-in functionality for GrooveScribe player
 */

(function() {
  'use strict';

  window.GrooveCountIn = {
    initialized: false,
    grooveUtils: null,
    originalStartFunction: null,

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
        
        // Store reference to original startMIDI_playback
        if (self.grooveUtils.startMIDI_playback) {
          self.originalStartFunction = self.grooveUtils.startMIDI_playback;
        }
        
        // Replace play button onclick
        var originalOnclick = playBtn.onclick;
        playBtn.onclick = function(event) {
          var countInBtn = document.querySelector('.midiCountInButton');
          var needsCountIn = countInBtn && countInBtn.classList.contains('active');
          
          // If playing or paused, use normal behavior
          if (MIDI.Player.playing) {
            if (originalOnclick) {
              return originalOnclick.call(this, event);
            }
            return;
          }
          
          // If no count-in needed, use normal behavior
          if (!needsCountIn) {
            if (originalOnclick) {
              return originalOnclick.call(this, event);
            }
            return;
          }
          
          // Play count-in then groove
          self.playWithCountIn(originalOnclick, this, event);
        };
      }, 100);
    },

    getCurrentBPM: function() {
      // Get from visible BPM field
      var tempoField = document.querySelector('.tempoTextField');
      if (tempoField && tempoField.value) {
        var bpm = parseInt(tempoField.value, 10);
        if (!isNaN(bpm) && bpm >= 30 && bpm <= 300) {
          return bpm;
        }
      }
      
      // Fallback to GrooveUtils
      try {
        if (this.grooveUtils && this.grooveUtils.getTempo) {
          return this.grooveUtils.getTempo();
        }
      } catch (e) {}
      
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

    playWithCountIn: function(originalOnclick, playBtn, event) {
      var self = this;
      
      var bpm = self.getCurrentBPM();
      var timeSig = self.getTimeSig();
      
      // Update button to show playing
      playBtn.className = playBtn.className.replace(/Stopped|Paused/g, '');
      if (playBtn.className.indexOf('Playing') === -1) {
        playBtn.className += ' Playing';
      }
      
      // Calculate count-in duration
      var beatDurationMs = 60000 / bpm;
      var countInDurationMs = beatDurationMs * timeSig.top;
      
      // Build and play count-in MIDI
      var countInMidi = self.buildCountInMidi(bpm, timeSig.top, timeSig.bottom);
      
      if (!countInMidi) {
        // Fallback to normal play
        if (originalOnclick) {
          originalOnclick.call(playBtn, event);
        }
        return;
      }
      
      // Play count-in
      MIDI.Player.ctx.resume();
      MIDI.Player.stop();
      MIDI.Player.clearAnimation();
      
      MIDI.Player.loadFile(countInMidi, function() {
        MIDI.Player.start();
        
        // After count-in duration, stop and start groove
        setTimeout(function() {
          MIDI.Player.stop();
          MIDI.Player.clearAnimation();
          
          // Start the groove
          setTimeout(function() {
            if (originalOnclick) {
              originalOnclick.call(playBtn, event);
            }
          }, 50);
        }, countInDurationMs);
      });
    },

    buildCountInMidi: function(bpm, timeSigTop, timeSigBottom) {
      try {
        // Use GrooveUtils method if available
        if (this.grooveUtils && this.grooveUtils.MIDI_build_midi_url_count_in_track) {
          // Temporarily set tempo
          var oldTempo = null;
          if (this.grooveUtils.getTempo) {
            oldTempo = this.grooveUtils.getTempo();
          }
          
          if (this.grooveUtils.setTempo) {
            this.grooveUtils.setTempo(bpm);
          }
          
          var midiUrl = this.grooveUtils.MIDI_build_midi_url_count_in_track(timeSigTop, timeSigBottom);
          
          // Restore old tempo
          if (oldTempo !== null && this.grooveUtils.setTempo) {
            this.grooveUtils.setTempo(oldTempo);
          }
          
          return midiUrl;
        }
        
        // Manual fallback
        if (typeof Midi !== 'undefined') {
          var midiFile = new Midi.File();
          var midiTrack = new Midi.Track();
          midiFile.addTrack(midiTrack);
          
          midiTrack.setTempo(bpm);
          midiTrack.setInstrument(0, 0x13);
          
          // Blank note for spacing
          midiTrack.addNoteOff(9, 60, 1);
          
          // Calculate note delay
          var noteDelay = 128; // Quarter notes for x/4
          if (timeSigBottom == 8) {
            noteDelay = 64;
          } else if (timeSigBottom == 16) {
            noteDelay = 32;
          }
          
          // Add count-in clicks
          var METRONOME_HIGH = 34;
          var METRONOME_NORMAL = 33;
          var VELOCITY = 100;
          
          // First beat (high click)
          midiTrack.addNoteOn(9, METRONOME_HIGH, 0, VELOCITY);
          midiTrack.addNoteOff(9, METRONOME_HIGH, noteDelay);
          
          // Remaining beats (normal clicks)
          for (var i = 1; i < timeSigTop; i++) {
            midiTrack.addNoteOn(9, METRONOME_NORMAL, 0, VELOCITY);
            midiTrack.addNoteOff(9, METRONOME_NORMAL, noteDelay);
          }
          
          return 'data:audio/midi;base64,' + btoa(midiFile.toBytes());
        }
        
        return null;
      } catch (e) {
        console.error('Error building count-in MIDI:', e);
        return null;
      }
    }
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        window.GrooveCountIn.init();
      }, 1000);
    });
  } else {
    setTimeout(function() {
      window.GrooveCountIn.init();
    }, 1000);
  }
})();
