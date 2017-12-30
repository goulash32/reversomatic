"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var gf = require("gif-frames");
var ge = require("gifencoder");
var pfs = require("png-file-stream");
var gify_parse_1 = require("gify-parse");
// for recursive cleaning of temp directories
var rimraf = require("rimraf");
var path_1 = require("path");
var fs_1 = require("fs");
var timers_1 = require("timers");
var GifReverseResult = /** @class */ (function () {
    function GifReverseResult(path, frameRate, duration) {
        this.path = path;
        this.frameRate = frameRate;
        this.duration = duration;
    }
    return GifReverseResult;
}());
var Reversomatic = /** @class */ (function () {
    function Reversomatic(tempDirectory, outputDirectory, maxDuration) {
        if (maxDuration === void 0) { maxDuration = 30000; }
        var _this = this;
        this.chainProcessImages = function (frames, index, filePrefix, callback) {
            if (index < 0)
                return callback();
            // ensure an appropriate number of padding digits are available 
            // for glob bulk read during gif reversal
            var frameCountDigits = _this.getFrameCountDigits(frames);
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
        this.maxDuration = maxDuration;
        this.verifyAndCreateDirs();
    }
    Reversomatic.prototype.processGif = function (inputFilename, outputFilename, options, callback) {
        var _this = this;
        timers_1.setTimeout(function () {
            var gifFile;
            try {
                gifFile = fs_1.readFileSync(inputFilename);
            }
            catch (err) {
                return callback(err, null);
            }
            var gifInfo = gify_parse_1.getInfo(gifFile);
            if (!gifInfo.valid) {
                return callback(Error('Invalid GIF file.'), null);
            }
            var gifDuration = gifInfo.duration;
            var gifFrameRate = 0;
            if (options.averageFrameDuration) {
                for (var _i = 0, _a = gifInfo.images; _i < _a.length; _i++) {
                    var img = _a[_i];
                    gifFrameRate += img.delay;
                }
                gifFrameRate = gifFrameRate / gifInfo.images.length;
            }
            else {
                gifFrameRate = gifInfo.images[0].delay;
            }
            if (gifDuration > _this.maxDuration) {
                return callback(Error("GIF duration longer than max duration of " + _this.maxDuration + " milliseconds."), null);
            }
            var tempFolderPfx = path_1.join(_this.tempDirectory, 'processGif');
            fs_1.mkdtemp(tempFolderPfx, 'utf8', function (err, folder) {
                if (err)
                    return callback(Error("Unable to create temporary directory for gif: " + err.message), null);
                gf({ url: inputFilename, frames: 'all', outputType: 'png', cumulative: true }).then(function (frames) {
                    var imgPrefix = path_1.join(folder, 'image');
                    _this.chainProcessImages(frames, frames.length - 1, imgPrefix, function () {
                        var encoder = new ge(gifInfo.width, gifInfo.height);
                        var ws = fs_1.createWriteStream(path_1.join(_this.outputDirectory, outputFilename));
                        // string of '?' chars for glob in pngFileStream
                        var globChars = Array(_this.getFrameCountDigits(frames) + 1).join('?');
                        pfs(imgPrefix + globChars + ".png")
                            .pipe(encoder.createWriteStream({ delay: gifFrameRate, repeat: 0, quality: 100 }))
                            .pipe(ws);
                        ws.on('finish', function () {
                            rimraf(folder, function (err) {
                                if (err)
                                    return callback(Error("Unable to remove temporary folder " + folder + "."), null);
                                var fullPath = path_1.join(_this.outputDirectory, outputFilename);
                                return callback(null, new GifReverseResult(fullPath, gifFrameRate, gifDuration));
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
    return Reversomatic;
}());
exports.Reversomatic = Reversomatic;
//# sourceMappingURL=reversomatic.js.map