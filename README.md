Reversomatic is a simple utility for reversing GIFs. Setup and usage are straighforward processes.

# Example
```javascript
var Reversomatic = require('reversomatic')

// creates a new instance of Reversomatic with:
// Temp Directory: ./
// Output Directory: ./out
// Max Input GIF Duration: 30000ms (30 seconds)
// Defaults are ./temp, ./output, 30000 respectively
var ro = new Reversomatic('./', './out', 30000)

// reverses a GIF file with arguments:
// Input File: image.gif
// Output File: image-reversed.gif (in the ./out folder)
// Options: empty
// Callback: Provides any errors, if applicable, and gifInfo, which contains the GIF's relative path,
// duration and framerate (both in milliseconds)
ro.processGif('image.gif', 'image-reversed.gif', {}, (err, gifInfo) => {
    if(err) throw err
    console.log(gifInfo.path, gifInfo.duration, gifInfo.frameRate)
})
```

# *processGif* Options
Presently, the only option available is *"averageFrameDelay"* which, when set to *true*, averages the duration of all the input GIF's delays to calculate the framerate of the output GIF. When it is *false* (by default), the framerate of the first frame of the input GIF is used as the framerate of all the ouput GIF's frames.

# Known Bugs
- Certain GIFs do not report the correct duration and/or framerate, and so may not display correctly.
- Does not support GIFs of a variable framerate. Either the first frame's delay is used as the framerate,
or the delays of all frames are averaged.