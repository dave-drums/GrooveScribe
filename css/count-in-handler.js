/**
 * count-in-handler.js
 * Handles count-in functionality for GrooveScribe player
 * 
 * Hooks into GrooveUtils to play 1 bar of metronome clicks
 * before starting the groove playback.
 */

(function() {
  'use strict';

  window.GrooveCountIn = {
    initialized: false,
    originalStartMIDI: null,
    countInPlaying: false,

    /**
     * Initialize count-in handler
     * Call this after GrooveScribe player is ready
     */
    init: function() {
      if (this.initialized) return;

      // Wait for GrooveUtils to be available
      var self = this;
      var checkInterval = setInterval(function() {
        if (typeof GrooveUtils !== 'undefined') {
          clearInterval(checkInterval);
          self.hookIntoPlayer();
          self.initialized = true;
        }
      }, 100);
    },

    /**
     * Hook into GrooveUtils playback system
     */
    hookIntoPlayer: function() {
      var self = this;

      // Wait for GrooveUtils instance to exist
      var waitForInstance = setInterval(function() {
        // Try to find the GrooveUtils instance
        // It's created when groove is displayed
        var elements = document.querySelectorAll('[id^="playerControl"]');
        if (elements.length === 0) return;

        // Get the unique index from the player control element
        var playerControl = elements[0];
        var id = playerControl.id;
        var indexMatch = id.match(/\d+$/);
        if (!indexMatch) return;

        var index = indexMatch[0];

        // Access the global GrooveUtils instance
        // GrooveUtils creates instances and stores methods on root
        if (typeof GrooveUtils === 'undefined') return;

        clearInterval(waitForInstance);

        // Hook into play button click
        self.hookPlayButton(index);
      }, 100);
    },

    /**
     * Hook the play button to intercept clicks
     */
    hookPlayButton: function(index) {
      var self = this;
      var playBtn = document.getElementById('midiPlayImage' + index);
      if (!playBtn) return;

      // Store original onclick
      var originalOnclick = playBtn.onclick;

      // Replace with our handler
      playBtn.onclick = function(event) {
        self.handlePlayClick(index, originalOnclick, event);
      };
    },

    /**
     * Handle play button click with count-in support
     */
    handlePlayClick: function(index, originalHandler, event) {
      var self = this;

      // Check if count-in is enabled
      var countInBtn = document.querySelector('.midiCountInButton');
      var countInEnabled = countInBtn && countInBtn.getAttribute('data-count-in') === 'true';

      // If MIDI is already playing or count-in disabled, use original handler
      if (!countInEnabled || (typeof MIDI !== 'undefined' && MIDI.Player && MIDI.Player.playing)) {
        if (originalHandler) {
          originalHandler.call(this, event);
        }
        return;
      }

      // Count-in is enabled and we're starting playback
      self.playWithCountIn(index, originalHandler, event);
    },

    /**
     * Play count-in then start the groove
     */
    playWithCountIn: function(index, originalHandler, event) {
      var self = this;

      // Get time signature from groove data
      var timeSigTop = 4;
      var timeSigBottom = 4;

      // Try to get actual time signature from GrooveUtils
      try {
        // Access global GrooveUtils methods
        if (typeof GrooveUtils !== 'undefined') {
          var grooveUtils = new GrooveUtils();
          if (grooveUtils.myGrooveData) {
            timeSigTop = grooveUtils.myGrooveData.numBeats || 4;
            timeSigBottom = grooveUtils.myGrooveData.noteValue || 4;
          }
        }
      } catch (e) {
        // Fallback to 4/4
        console.log('Using default 4/4 time signature for count-in');
      }

      // Build count-in track
      var countInUrl = this.buildCountInTrack(timeSigTop, timeSigBottom);
      if (!countInUrl) {
        // Fallback to normal playback if count-in fails
        if (originalHandler) {
          originalHandler.call(this, event);
        }
        return;
      }

      // Play count-in track
      self.countInPlaying = true;
      
      try {
        MIDI.Player.ctx.resume();
        MIDI.Player.loadFile(countInUrl, function() {
          MIDI.Player.start();

          // Update play button state
          var playBtn = document.getElementById('midiPlayImage' + index);
          if (playBtn) {
            playBtn.className = playBtn.className.replace('Stopped', 'Playing').replace('Paused', 'Playing');
            if (playBtn.className.indexOf('Playing') === -1) {
              playBtn.className += ' Playing';
            }
          }

          // When count-in finishes, start the actual groove
          MIDI.Player.addListener(function(data) {
            if (data.message === 127) { // End of track
              self.countInPlaying = false;
              MIDI.Player.clearAnimation();
              MIDI.Player.stop();

              // Start the actual groove
              if (originalHandler) {
                // Small delay to ensure clean transition
                setTimeout(function() {
                  originalHandler.call(playBtn, event);
                }, 50);
              }
            }
          });
        });
      } catch (e) {
        console.error('Count-in playback error:', e);
        self.countInPlaying = false;
        
        // Fallback to normal playback
        if (originalHandler) {
          originalHandler.call(this, event);
        }
      }
    },

    /**
     * Build count-in MIDI track (1 bar of metronome clicks)
     * Based on GrooveUtils.MIDI_build_midi_url_count_in_track
     */
    buildCountInTrack: function(timeSigTop, timeSigBottom) {
      try {
        // Use GrooveUtils method if available
        if (typeof GrooveUtils !== 'undefined') {
          var grooveUtils = new GrooveUtils();
          if (grooveUtils.MIDI_build_midi_url_count_in_track) {
            return grooveUtils.MIDI_build_midi_url_count_in_track(timeSigTop, timeSigBottom);
          }
        }

        // Fallback: build manually if needed
        if (typeof Midi !== 'undefined') {
          var midiFile = new Midi.File();
          var midiTrack = new Midi.Track();
          midiFile.addTrack(midiTrack);

          // Get current tempo
          var tempo = 120; // Default
          try {
            var grooveUtils = new GrooveUtils();
            tempo = grooveUtils.getTempo() || 120;
          } catch (e) {
            // Use default
          }

          midiTrack.setTempo(tempo);
          midiTrack.setInstrument(0, 0x13);

          // Blank note for spacing (MIDI player bug workaround)
          midiTrack.addNoteOff(9, 60, 1);

          // Calculate note delay based on time signature
          var noteDelay = 128; // Quarter notes for x/4
          if (timeSigBottom == 8) {
            noteDelay = 64; // 8th notes for x/8
          } else if (timeSigBottom == 16) {
            noteDelay = 32; // 16th notes for x/16
          }

          // Add count-in clicks (1 bar)
          var METRONOME_1 = 34; // High click
          var METRONOME_NORMAL = 33; // Normal click
          var VELOCITY = 100;

          midiTrack.addNoteOn(9, METRONOME_1, 0, VELOCITY);
          midiTrack.addNoteOff(9, METRONOME_1, noteDelay);

          for (var i = 1; i < timeSigTop; i++) {
            midiTrack.addNoteOn(9, METRONOME_NORMAL, 0, VELOCITY);
            midiTrack.addNoteOff(9, METRONOME_NORMAL, noteDelay);
          }

          return 'data:audio/midi;base64,' + btoa(midiFile.toBytes());
        }

        return null;
      } catch (e) {
        console.error('Error building count-in track:', e);
        return null;
      }
    }
  };

  // Auto-initialize when GrooveUtils is ready
  // (GrooveEmbed.html will also call init after injection is complete)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        window.GrooveCountIn.init();
      }, 500);
    });
  } else {
    setTimeout(function() {
      window.GrooveCountIn.init();
    }, 500);
  }
})();
