import * as gf from 'gif-frames'
import * as ge from 'gifencoder'
import * as pfs from 'png-file-stream'
import { getInfo } from 'gify-parse'

import * as Stopwatch from 'elapsed-time'

// for recursive cleaning of temp directories
import * as rimraf from 'rimraf'

import { join } from 'path'
import { createReadStream, 
         createWriteStream, 
         exists,
         mkdirSync, 
         readFile,
         mkdtemp,
         stat 
        } from 'fs'
import { setTimeout } from 'timers';
import { debug } from 'util';

class GifReverseResult {
    path: string
    frameDelay: number
    duration: number
    processTime: number

    constructor(path: string, frameDelay: number, duration: number, processTime: number) {
        this.path           = path
        this.frameDelay     = frameDelay
        this.duration       = duration
        this.processTime    = processTime
    }
}

interface GifReverseOptions {
    averageFrameDelay?: boolean
    forcedFrameDelay?: number
}

export class Reversomatic {
    private tempDirectory: string
    private outputDirectory: string
    private maxDurationInMilliseconds: number
    private maxSizeInBytes: number

    constructor(tempDirectory?: string, outputDirectory?: string, 
    maxDurationInMilliseconds: number = 30000, maxSizeInMegabytes: number = 0) {
        if(tempDirectory) {
            this.tempDirectory = tempDirectory
        } else {
            this.tempDirectory = './temp'
        }
        
        if(outputDirectory) {
            this.outputDirectory = outputDirectory
        } else {
            this.outputDirectory = './output'
        }

        this.maxDurationInMilliseconds  = maxDurationInMilliseconds
        this.maxSizeInBytes             = maxSizeInMegabytes * 1000000
        this._verifyAndCreateDirs();
    }

    processGif(inputFilename: string, outputFilename: string, 
    options: GifReverseOptions, callback) {
        setTimeout(() => { this._processGif(inputFilename, outputFilename, options, callback) }
        , 0) 
    }

    // (private) called asynchronousy by processGif()
    private _processGif(inputFilename: string, outputFilename: string, 
        options: GifReverseOptions, callback) {
        try {
            let gifFile: Buffer
            
            // time the process
            const stopwatch = Stopwatch.new()
            stopwatch.start()
            readFile(inputFilename, (err, gifFile) => { 
                this._fileLoaded(stopwatch, err, gifFile, inputFilename, 
                    outputFilename, options, callback)
            })   
        } catch(err) {
            return callback(err, null)
        }
    }

    // (private) called after the async file load is successful
    private _fileLoaded(stopwatch, err, gifFile, inputFilename, 
        outputFilename, options, callback) {
        const gifInfo   = getInfo(gifFile)
        // get file stats
        stat(inputFilename, (err, fileInfo) => {
            this._finishFile(stopwatch, err, fileInfo, gifInfo, inputFilename, 
                outputFilename, options, callback)
        })
    }

    // (private) called when file stats are avaiable
    private _finishFile(stopwatch, err, fileInfo, gifInfo, inputFilename, 
        outputFilename, options, callback) {
        if(err) return callback(err, null)

        if(!gifInfo.valid) {
            return callback(Error('Invalid GIF file.'), null)
        }
         
        const gifImages         = gifInfo.images
        const numFrames         = gifImages.length
        const gifDuration       = gifInfo.duration
        let finalDuration       = 0
        const gifSizeInBytes    = fileInfo.size
        let gifFrameDelay       = 0

        if(gifDuration > this.maxDurationInMilliseconds) {
            return callback(Error(`GIF duration longer than max duration.\n`
            + `Max Duration: ${ this.maxDurationInMilliseconds } ms.\n`
            + `Actual Duration: ${ gifDuration }`), null)
        }

        if(this.maxSizeInBytes != 0 && fileInfo.size > this.maxSizeInBytes) {
            return callback(Error(`Input GIF file size is larger than max file size.\n` 
            + `Max Size: ${ this.maxSizeInBytes / 1000000 } MB\n` 
            + `Actual Size: ${ fileInfo.size / 1000000 } MB`))
        }

        if(options.averageFrameDelay) {
            for(const img of gifInfo.images) {
                gifFrameDelay += img.delay
            }

            gifFrameDelay = Math.floor(gifFrameDelay / numFrames)
        } else if(options.forcedFrameDelay) {
            gifFrameDelay = Math.floor(options.forcedFrameDelay)
        }
        else {
            gifFrameDelay = gifInfo.images[0].delay
        }

        finalDuration = gifFrameDelay * numFrames
        const tempFolderPfx = join(this.tempDirectory, 'processGif')
        mkdtemp(tempFolderPfx, 'utf8', (err, folder) => {
            if(err) return callback(Error(`Unable to create temporary `
            +`directory for gif: ${ err.message }`), null)

            gf({ url: inputFilename, frames: 'all', outputType: 'png', cumulative: true })
            .then(frames => {
                const imgPrefix = join(folder, 'image')
                this._chainProcessImages(frames, frames.length - 1, imgPrefix, () => {
                    const encoder = new ge(gifInfo.width, gifInfo.height)
                    const ws = createWriteStream(join(this.outputDirectory, outputFilename))

                    // string of '?' chars for glob in pngFileStream
                    const globChars = Array(this._getFrameCountDigits(frames) + 1).join('?')
                    pfs(`${ imgPrefix + globChars }.png`)
                        .pipe(encoder.createWriteStream({ delay: gifFrameDelay, repeat: 0, quality: 100 }))
                        .pipe(ws)
                    ws.on('finish', () => {
                        rimraf(folder, err => {
                            if(err) return callback(Error(`Unable to remove temporary folder ${ folder }.`), null)

                            const fullPath = join(this.outputDirectory, outputFilename)
                            const processTime = stopwatch.getValue()
                            
                            return callback(null, new GifReverseResult(fullPath, gifFrameDelay, finalDuration,
                            processTime)) 
                        })
                    })
                    ws.on('error', () => {
                        rimraf(folder, err => {
                            return callback(Error(`Unable to write reversed GIF to ${ outputFilename }.`), null)
                        })
                    })
                })
            })
        })  
    }

    private _verifyAndCreateDirs() {
        exists(this.tempDirectory, (ex) => {
            if(!ex) {
                mkdirSync(this.tempDirectory)
            }

            exists(this.outputDirectory, (ex) => {
                if(!ex) mkdirSync(this.outputDirectory)
            })
        })
    }

    private _getFrameCountDigits(frames: Array<any>) {
        return Math.log(frames.length) * Math.LOG10E + 1 | 0
    }

    private _chainProcessImages(frames, index, filePrefix, callback) {
        if(index < 0) return callback()
        
        // ensure an appropriate number of padding digits are available 
        // for glob bulk read during gif reversal
        const frameCountDigits      = this._getFrameCountDigits(frames)

        // number of 'padding zeroes' at end of temporary frame filenames (i.e. a GIF with 300 frames would need '000' to generate suitable frame filenames for the glob-powered GIF encoder)
        const paddingZeros          = Array(frameCountDigits + 1).join('0')
        const frameIndex            = (paddingZeros + index).slice(-frameCountDigits)
        const element               = frames[frames.length - index - 1]
        const filename              = `${ filePrefix }${ frameIndex }.png`
        const wstr                  = createWriteStream(filename)
        
        // recursively process the next frame of the GIF
        wstr.on('finish', () => {
            this._chainProcessImages(frames, --index, filePrefix, callback)
        })
        wstr.on('open', () => {
            element.getImage().pipe(wstr)
        })
    }
}