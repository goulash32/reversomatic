Reversomatic is a simple utility for reversing GIFs. Setup and usage are straighforward processes.

# Example
```javascript
var Reversomatic = require('reversomatic')

// creates a new instance of Reversomatic with:
// Temp Directory: ./
// Output Directory: ./out
// Max Input GIF Duration (in milliseconds): 30000 (30 seconds)
// Max Input GIF Size (in MB, 0 for unlimited): 25 MB
// Defaults are ./temp, ./output, 30000ms, and unlimited, respectively
var ro = new Reversomatic('./', './out', 30000, 25)

// reverses a GIF file with arguments:
// Input File: image.gif
// Output File: image-reversed.gif (in the ./out folder)
// Options: forcedFrameDelay: 90 (milliseconds)
// Callback: Provides any errors, if applicable, and gifInfo, which contains the GIF's relative path,
// duration and frame delay (which are both in milliseconds)
ro.processGif('image.gif', 'image-reversed.gif', { forcedFrameDelay: 90 }, (err, gifInfo) => {
    if(err) throw err
    console.log(gifInfo.path, gifInfo.duration, gifInfo.frameDelay)
})
```

# Notes
Reversomatic will create a temporary folder, inside the specified temp directory, for every call to *processGif()* with a valid input GIF. This folder is used to store the temporary frames (in .png format) of the input GIF during the reversal process. The folder will be cleaned up before control is passed to the callback provided to *processGif()*, whether the reversal was successful or otherwise. 

Every call to *processGif()* runs asynchronously, and neither performs disk space checks nor keeps a 'thread pool' or similar mechanism. The responsibility falls to the user to ensure that usage is kept to within available system resources.

# *processGif()* Options
```typescript
averageFrameDelay: boolean
```
<blockquote>Reversomatic will average the delay of each of the input GIF's frames to determine the output GIF's frame delay rate if <em>averageFrameDelay</em> is <em>true</em>. <em>averageFrameDelay takes precedence over all other delay settings if enabled</em>.</blockquote>

```typescript
forcedFrameDelay: number
```
<blockquote>Reversomatic will floor the value provided in <em>forcedFrameDelay</em> and use it as the constant frame delay in the output GIF.</blockquote>

If neither of the above options are set, Reversomatic will use the input GIF's first frame delay to determine the output GIF's constant frame delay.

# Known Bugs & Limitations
- Certain GIFs do not report the correct duration and/or frame delay, and so may not display correctly, or may falsely trigger your duration limit
- Does not support GIFs with a variable frame delay. Either the first frame's delay is used as the delay for the entire GIF, or the delays of all frames are averaged.

# Contributors
Please make every effort to adhere to the established code style.

Global prerequesites (TypeScript, uglify, and npm-watch) can be installed by running:
```
npm run preinstall_global_deps
```
A file watcher can be started, after installing the prerequesites, by running:
```
npm run watch
```
Which will build *.ts* files in the *src* folder and put them in *reversomatic.js* in the *lib* folder.

# Changelog
*1.0.7 & 1.0.7b/c/d - December 31, 2017*
- Added additional option, *forcedFrameDelay*, to *processGif()* options
- (c) Removed unnecessary dependencies
- (d) Remembered to actually build ;)
- README updates

*1.0.6 & 1.0.6b - December 30, 2017*
- Made unlimited input file size the default so as not to cause any surprises
- README updates

*1.0.5 - December 30, 2017*
- Code style updates and fixes
- Fixed GIF duration calculation
- Added max input GIF size (4th constructor argument)
- Removed mangling option in uglify (to get descriptive argument names for Intellisense and similar)
- README updates
