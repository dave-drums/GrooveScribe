/**
 * count-in-handler.js
 * Handles count-in functionality for MULTIPLE GrooveScribe players on same page
 */

(function() {
  'use strict';

  window.GrooveCountIn = {
    initialized: false,
    hookedButtons: [], // Track which buttons we've hooked

    init: function() {
      if (this.initialized) {
        console.log('Count-in: Already initialized');
        return;
      }
      
      var self = this;
      
      // Wait for dependencies
      var checkInterval = setInterval(function() {
        if (typeof GrooveUtils !== 'undefined' && typeof MIDI !== 'undefined') {
          clearInterval(checkInterval);
          self.initialized = true;
          self.hookAllPlayers();
        }
      }, 100);
    },

    hookAllPlayers: function() {
      var self = this;
      
      // Wait for all players to be ready
      var attempts = 0;
      var checkPlayers = setInterval(function() {
        attempts++;
        
        // Find all play buttons
        var allPlayBtns = document.querySelectorAll('.midiPlayImage');
        // Find all count-in buttons
        var allCountInBtns = document.querySelectorAll('.midiCountInButton');
        
        // If counts match and we have buttons, hook them
        if (allPlayBtns.length > 0 && allPlayBtns.length === allCountInBtns.length) {
          clearInterval(checkPlayers);
          
          console.log('Count-in: Found ' + allPlayBtns.length + ' players');
          
          // Hook each player
          for (var i = 0; i < allPlayBtns.length; i++) {
            self.hookPlayer(allPlayBtns[i], allCountInBtns[i], i);
          }
          
          console.log('Count-in: All players hooked');
        } else if (attempts > 50) {
          clearInterval(checkPlayers);
          console.log('Count-in: Timeout (found ' + allPlayBtns.length + ' play btns, ' + allCountInBtns.length + ' count-in btns)');
        }
      }, 100);
    },

    hookPlayer: function(playBtn, countInBtn, index) {
      var self = this;
      
      // Check if already hooked
      if (self.hookedButtons.indexOf(playBtn) !== -1) {
        console.log('Count-in: Player ' + index + ' already hooked');
        return;
      }
      
      // Mark as hooked
      self.hookedButtons.push(playBtn);
      
      // Store original onclick
      var originalOnclick = playBtn.onclick;
      
      if (!originalOnclick) {
        console.error('Count-in: Player ' + index + ' has no onclick');
        return;
      }
      
      // Create GrooveUtils instance for this player
      var grooveUtils;
      try {
        grooveUtils = new GrooveUtils();
      } catch (e) {
        console.error('Count-in: GrooveUtils error for player ' + index, e);
        return;
      }
      
      // Replace onclick with wrapper
      playBtn.onclick = function(event) {
        var isActive = countInBtn && countInBtn.classList.contains('active');
        
        // If not active or already playing, use normal handler
        if (!isActive || MIDI.Player.playing) {
          if (originalOnclick) {
            return originalOnclick.call(this, event);
          }
          return;
        }
        
        // Play with count-in
        console.log('Count-in: Player ' + index + ' starting count-in');
        event.preventDefault();
        event.stopPropagation();
        
        self.playCountIn(playBtn, grooveUtils, function() {
          console.log('Count-in: Player ' + index + ' starting groove');
          if (originalOnclick) {
            originalOnclick.call(playBtn, event);
          }
        });
        
        return false;
      };
      
      console.log('Count-in: Player ' + index + ' hooked');
    },

    playCountIn: function(playBtn, grooveUtils, callback) {
      var self = this;
      
      // Get BPM
      var bpm = self.getBPM(playBtn);
      
      // Get time signature
      var timeSig = self.getTimeSig(grooveUtils);
      
      console.log('Count-in: BPM=' + bpm + ', TimeSig=' + timeSig.top + '/' + timeSig.bottom);
      
      // Build MIDI
      var midi = self.buildMidi(bpm, timeSig.top, timeSig.bottom, grooveUtils);
      if (!midi) {
        console.error('Count-in: Failed to build MIDI');
        callback();
        return;
      }
      
      // Calculate duration
      var msPerBeat = 60000 / bpm;
      var duration = msPerBeat * timeSig.top + 200;
      
      console.log('Count-in: Duration ' + duration + 'ms');
      
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
          
          console.log('Count-in: Finished, starting groove');
          
          setTimeout(callback, 100);
        }, duration);
      });
    },

    getBPM: function(playBtn) {
      // Find the tempo field closest to this play button
      var container = playBtn.closest('.playerControlsRow') || playBtn.closest('.playerControl');
      if (container) {
        var field = container.querySelector('.tempoTextField, input[id*="tempoTextField"]');
        if (field && field.value) {
          var val = parseInt(field.value, 10);
          if (!isNaN(val) && val >= 30 && val <= 300) {
            console.log('Count-in: BPM from field: ' + val);
            return val;
          }
        }
        
        var slider = container.querySelector('input[type="range"]');
        if (slider && slider.value) {
          var val = parseInt(slider.value, 10);
          if (!isNaN(val) && val >= 30 && val <= 300) {
            console.log('Count-in: BPM from slider: ' + val);
            return val;
          }
        }
      }
      
      console.log('Count-in: BPM fallback: 120');
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
        // Try GrooveUtils method
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
        
        // Manual build
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
        console.error('Count-in: Build MIDI error', e);
        return null;
      }
    }
  };

  // Don't auto-init
})();
