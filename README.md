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
// duration and frame delay (both in milliseconds)
ro.processGif('image.gif', 'image-reversed.gif', {}, (err, gifInfo) => {
    if(err) throw err
    console.log(gifInfo.path, gifInfo.duration, gifInfo.frameDelay)
})
```

# *processGif* Options
Presently, the only option available is *"averageFrameDelay"* which, when set to *true*, averages the delays of all the input GIF's frames to calculate the frame delay of the output GIF. When it is *false* (by default), the frame delay of the first frame of the input GIF is used as the delay for all of the ouput GIF's frames.

# Known Bugs
- Certain GIFs do not report the correct duration and/or frame delay, and so may not display correctly.
- Does not support GIFs with a variable frame delay. Either the first frame's delay is used as the delay for the entire GIF, or the delays of all frames are averaged.
