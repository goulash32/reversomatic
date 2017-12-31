"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var gf = require("gif-frames");
var ge = require("gifencoder");
var pfs = require("png-file-stream");
var gify_parse_1 = require("gify-parse");
var Stopwatch = require("elapsed-time");
// for recursive cleaning of temp directories
var rimraf = require("rimraf");
var path_1 = require("path");
var fs_1 = require("fs");
var timers_1 = require("timers");
var GifReverseResult = /** @class */ (function () {
    function GifReverseResult(path, frameDelay, duration, processTime) {
        this.path = path;
        this.frameDelay = frameDelay;
        this.duration = duration;
        this.processTime = processTime;
    }
    return GifReverseResult;
}());
var Reversomatic = /** @class */ (function () {
    function Reversomatic(tempDirectory, outputDirectory, maxDurationInMilliseconds, maxSizeInMegabytes) {
        if (maxDurationInMilliseconds === void 0) { maxDurationInMilliseconds = 30000; }
        if (maxSizeInMegabytes === void 0) { maxSizeInMegabytes = 0; }
        if (tempDirectory) {
            this.tempDirectory = tempDirectory;
        }
        else {
            this.tempDirectory = './temp';
        }
        if (outputDirectory) {
            this.outputDirectory = outputDirectory;
        }
        else {
            this.outputDirectory = './output';
        }
        this.maxDurationInMilliseconds = maxDurationInMilliseconds;
        this.maxSizeInBytes = maxSizeInMegabytes * 1000000;
        this.verifyAndCreateDirs();
    }
    Reversomatic.prototype.processGif = function (inputFilename, outputFilename, options, callback) {
        var _this = this;
        timers_1.setTimeout(function () {
            var gifFile;
            // time the process
            var stopwatch = Stopwatch.new();
            stopwatch.start();
            try {
                gifFile = fs_1.readFileSync(inputFilename);
            }
            catch (err) {
                return callback(err, null);
            }
            var gifInfo = gify_parse_1.getInfo(gifFile);
            var fileInfo = fs_1.statSync(inputFilename);
            if (!gifInfo.valid) {
                return callback(Error('Invalid GIF file.'), null);
            }
            var gifImages = gifInfo.images;
            var numFrames = gifImages.length;
            var gifDuration = gifInfo.duration;
            var finalDuration = 0;
            var gifSizeInBytes = fileInfo.size;
            var gifFrameDelay = 0;
            if (gifDuration > _this.maxDurationInMilliseconds) {
                return callback(Error("GIF duration longer than max duration.\n"
                    + (_this.maxDurationInMilliseconds + " ms.")), null);
            }
            if (_this.maxSizeInBytes != 0 && fileInfo.size > _this.maxSizeInBytes) {
                return callback(Error("Input GIF file size is larger than max file size.\n"
                    + ("Max Size: " + _this.maxSizeInBytes / 1000000 + " MB\n")
                    + ("Actual Size: " + fileInfo.size / 1000000 + " MB")));
            }
            if (options.averageFrameDelay) {
                for (var _i = 0, _a = gifInfo.images; _i < _a.length; _i++) {
                    var img = _a[_i];
                    gifFrameDelay += img.delay;
                }
                gifFrameDelay = Math.floor(gifFrameDelay / numFrames);
            }
            else if (options.forcedFrameDelay) {
                gifFrameDelay = options.forcedFrameDelay;
            }
            else {
                gifFrameDelay = gifInfo.images[0].delay;
            }
            finalDuration = gifFrameDelay * numFrames;
            var tempFolderPfx = path_1.join(_this.tempDirectory, 'processGif');
            fs_1.mkdtemp(tempFolderPfx, 'utf8', function (err, folder) {
                if (err)
                    return callback(Error("Unable to create temporary "
                        + ("directory for gif: " + err.message)), null);
                gf({ url: inputFilename, frames: 'all', outputType: 'png', cumulative: true })
                    .then(function (frames) {
                    var imgPrefix = path_1.join(folder, 'image');
                    _this.chainProcessImages(frames, frames.length - 1, imgPrefix, function () {
                        var encoder = new ge(gifInfo.width, gifInfo.height);
                        var ws = fs_1.createWriteStream(path_1.join(_this.outputDirectory, outputFilename));
                        // string of '?' chars for glob in pngFileStream
                        var globChars = Array(_this.getFrameCountDigits(frames) + 1).join('?');
                        pfs(imgPrefix + globChars + ".png")
                            .pipe(encoder.createWriteStream({ delay: gifFrameDelay, repeat: 0, quality: 100 }))
                            .pipe(ws);
                        ws.on('finish', function () {
                            rimraf(folder, function (err) {
                                if (err)
                                    return callback(Error("Unable to remove temporary folder " + folder + "."), null);
                                var fullPath = path_1.join(_this.outputDirectory, outputFilename);
                                var processTime = stopwatch.getValue();
                                return callback(null, new GifReverseResult(fullPath, gifFrameDelay, gifDuration, processTime));
                            });
                        });
                        ws.on('error', function () {
                            rimraf(folder, function (err) {
                                return callback(Error("Unable to write reversed GIF to " + outputFilename + "."), null);
                            });
                        });
                    });
                });
            });
        }, 10);
    };
    Reversomatic.prototype.verifyAndCreateDirs = function () {
        var _this = this;
        fs_1.exists(this.tempDirectory, function (ex) {
            if (!ex) {
                fs_1.mkdirSync(_this.tempDirectory);
            }
            fs_1.exists(_this.outputDirectory, function (ex) {
                if (!ex)
                    fs_1.mkdirSync(_this.outputDirectory);
            });
        });
    };
    Reversomatic.prototype.getFrameCountDigits = function (frames) {
        return Math.log(frames.length) * Math.LOG10E + 1 | 0;
    };
    Reversomatic.prototype.chainProcessImages = function (frames, index, filePrefix, callback) {
        var _this = this;
        if (index < 0)
            return callback();
        // ensure an appropriate number of padding digits are available 
        // for glob bulk read during gif reversal
        var frameCountDigits = this.getFrameCountDigits(frames);
        // number of 'padding zeroes' at end of temporary frame filenames (i.e. a GIF with 300 frames would need '000' to generate suitable frame filenames for the glob-powered GIF encoder)
        var paddingZeros = Array(frameCountDigits + 1).join('0');
        var frameIndex = (paddingZeros + index).slice(-frameCountDigits);
        var element = frames[frames.length - index - 1];
        var filename = "" + filePrefix + frameIndex + ".png";
        var wstr = fs_1.createWriteStream(filename);
        // recursively process the next frame of the GIF
        wstr.on('finish', function () {
            _this.chainProcessImages(frames, --index, filePrefix, callback);
        });
        wstr.on('open', function () {
            element.getImage().pipe(wstr);
        });
    };
    return Reversomatic;
}());
exports.Reversomatic = Reversomatic;
//# sourceMappingURL=reversomatic.js.map