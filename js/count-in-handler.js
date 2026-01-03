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
    grooveUtils: null,

    /**
     * Initialize count-in handler
     */
    init: function() {
      if (this.initialized) return;
      
      var self = this;
      
      // Wait for GrooveUtils to be available
      var checkInterval = setInterval(function() {
        if (typeof GrooveUtils !== 'undefined' && typeof MIDI !== 'undefined') {
          clearInterval(checkInterval);
          self.hookIntoPlayer();
          self.initialized = true;
        }
      }, 100);
    },

    /**
     * Hook into the player
     */
    hookIntoPlayer: function() {
      var self = this;
      
      // Wait for player to exist
      var waitForPlayer = setInterval(function() {
        var playBtn = document.querySelector('.midiPlayImage');
        if (!playBtn) return;
        
        clearInterval(waitForPlayer);
        
        // Get GrooveUtils instance
        try {
          self.grooveUtils = new GrooveUtils();
        } catch (e) {
          console.error('Could not create GrooveUtils instance:', e);
          return;
        }
        
        // Hook the play button
        self.hookPlayButton(playBtn);
      }, 100);
    },

    /**
     * Hook play button with count-in wrapper
     */
    hookPlayButton: function(playBtn) {
      var self = this;
      
      // Store original onclick
      var originalOnclick = playBtn.onclick;
      
      // Replace with wrapper
      playBtn.onclick = function(event) {
        // Check if count-in is enabled
        var countInBtn = document.querySelector('.midiCountInButton');
        var countInEnabled = countInBtn && countInBtn.classList.contains('active');
        
        // If playing or paused, use normal handler
        if (MIDI.Player.playing || !countInEnabled) {
          if (originalOnclick) {
            return originalOnclick.call(this, event);
          }
          return;
        }
        
        // Start with count-in
        self.playWithCountIn(originalOnclick, this, event);
      };
    },

    /**
     * Play count-in then start groove
     */
    playWithCountIn: function(originalHandler, playBtn, event) {
      var self = this;
      
      // Get time signature
      var timeSigTop = 4;
      var timeSigBottom = 4;
      
      try {
        if (self.grooveUtils && self.grooveUtils.myGrooveData) {
          timeSigTop = self.grooveUtils.myGrooveData.numBeats || 4;
          timeSigBottom = self.grooveUtils.myGrooveData.noteValue || 4;
        }
      } catch (e) {
        // Use defaults
      }
      
      // Build count-in MIDI
      var countInUrl = null;
      try {
        if (self.grooveUtils && self.grooveUtils.MIDI_build_midi_url_count_in_track) {
          countInUrl = self.grooveUtils.MIDI_build_midi_url_count_in_track(timeSigTop, timeSigBottom);
        }
      } catch (e) {
        console.error('Error building count-in:', e);
      }
      
      if (!countInUrl) {
        // Fallback to normal play
        if (originalHandler) {
          originalHandler.call(playBtn, event);
        }
        return;
      }
      
      // Play count-in
      try {
        // Update button to show playing
        playBtn.className = playBtn.className.replace(/Stopped|Paused/g, '') + ' Playing';
        
        MIDI.Player.ctx.resume();
        MIDI.Player.loadFile(countInUrl, function() {
          MIDI.Player.start();
          
          // Listen for end of count-in
          var endListener = function(data) {
            if (data.message === 127) {
              // End of track
              MIDI.Player.removeListener(endListener);
              MIDI.Player.stop();
              
              // Start the actual groove
              setTimeout(function() {
                if (originalHandler) {
                  originalHandler.call(playBtn, event);
                }
              }, 50);
            }
          };
          
          MIDI.Player.addListener(endListener);
        });
      } catch (e) {
        console.error('Count-in playback error:', e);
        // Fallback
        if (originalHandler) {
          originalHandler.call(playBtn, event);
        }
      }
    }
  };

  // Auto-initialize
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
