# Groove Lab

**By Dave Drums**

Create. Play. Explore.

Groove Lab is based on the open-source GrooveScribe project by Lou Montulli and Mike Johnston. The existing GPL v2 licence and original attributions are preserved. See [About](gscribe_about.html), [LICENSE.txt](LICENSE.txt) and [branding audit](BRANDING-AUDIT.md). Internal file names and the historical setup instructions below are unchanged.

---

How to get the cordova build going

Copy the necessary files from the root of the groovescribe directory into cordova/www

    index.html
    gscribe_help.html
    gscribe_about.html
    js/
    css/
    images/
    MIDI.js/
    soundfont/
    font-awesome/
    
    cordova platform add android
    ...
    
Use the cordova/css/groove_writer_orange.css for now.   
    
Sorry this isn't automated.   I'm just starting on this, so it's rough
    
cordova run
