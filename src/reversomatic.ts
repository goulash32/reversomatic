import * as gf from 'gif-frames'
import * as ge from 'gifencoder'
import * as pfs from 'png-file-stream'
import { getInfo } from 'gify-parse'

// for recursive cleaning of temp directories
import * as rimraf from 'rimraf'

import { join } from 'path'
import { createReadStream, 
         createWriteStream, 
         exists, 
         mkdirSync, 
         readFileSync,
         mkdtemp 
        } from 'fs'

class GifReverseResult {
    path: string
    frameRate: number
    duration: number

    constructor(path: string, frameRate: number, duration: number) {
        this.path = path
        this.frameRate = frameRate
        this.duration = duration
    }
}

interface GifReverseOptions {
    averageFrameDuration?: boolean
}

export class Reversomatic {
    private tempDirectory: string
    private outputDirectory: string
    private maxDuration: number

    constructor(tempDirectory?: string, outputDirectory?: string, maxDuration: number = 30000) {
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

        this.maxDuration = maxDuration

        this.verifyAndCreateDirs();
    }

    processGif(inputFilename: string, outputFilename:string, options: GifReverseOptions, callback) {
        let gifFile: Buffer

        try {
            gifFile = readFileSync(inputFilename)
        } 
        catch(err) {
            return callback(err, null)
        }

        let gifInfo = getInfo(gifFile)

        if(!gifInfo.valid) {
            return callback(Error('Invalid GIF file.'), null)
        }

        let gifDuration = gifInfo.isBrowserDuration ? gifInfo.duration : gifInfo.duration / 10
        let gifFrameRate 
        
        if(options.averageFrameDuration) {
            gifFrameRate = gifDuration / gifInfo.images.length
        } else {
            gifFrameRate = gifInfo.images[0].delay
        }

        if(gifDuration > this.maxDuration) {
            return callback(Error(`GIF duration longer than max duration of ${ this.maxDuration } milliseconds.`), null)
        }

        let tempFolderPfx = join(this.tempDirectory, 'processGif')
        mkdtemp(tempFolderPfx, 'utf8', (err, folder) => {
            if(err) return callback(Error(`Unable to create temporary directory for gif: ${ err.message }`), null)

            gf({ url: inputFilename, frames: 'all', outputType: 'png', cumulative: true }).then(frames => {
                let imgPrefix = join(folder, 'image')
                this.chainProcessImages(frames, frames.length - 1, imgPrefix, () => {
                    let encoder = new ge(gifInfo.width, gifInfo.height)
                    let ws = createWriteStream(join(this.outputDirectory, outputFilename))

                    // string of '?' chars for glob in pngFileStream
                    let globChars = Array(this.getFrameCountDigits(frames) + 1).join('?')
                    pfs(`${ imgPrefix + globChars }.png`)
                        .pipe(encoder.createWriteStream({ delay: gifFrameRate, repeat: 0, quality: 100 }))
                        .pipe(ws)
                    ws.on('finish', () => {
                        rimraf(folder, err => {
                            if(err) return callback(Error(`Unable to remove temporary folder ${ folder }.`), null)
                            let fullPath = join(this.outputDirectory, outputFilename)
                            return callback(null, new GifReverseResult(fullPath, gifFrameRate, gifDuration))  
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

    private verifyAndCreateDirs() {
        exists(this.tempDirectory, (ex) => {
            if(!ex) {
                mkdirSync(this.tempDirectory)
            }

            exists(this.outputDirectory, (ex) => {
                if(!ex) mkdirSync(this.outputDirectory)
            })
        })
    }

    private getFrameCountDigits(frames: Array<any>) {
        return Math.log(frames.length) * Math.LOG10E + 1 | 0
    }

    private chainProcessImages = (frames, index, filePrefix, callback) => {
        if(index < 0) return callback()
        
        // ensure an appropriate number of padding digits are available 
        // for glob bulk read during gif reversal
        let frameCountDigits = this.getFrameCountDigits(frames)
        let paddingZeros: string = Array(frameCountDigits + 1).join('0')

        let frameIndex = (paddingZeros + index).slice(-frameCountDigits)
        let element = frames[frames.length - index - 1]
        
        let filename = `${ filePrefix }${ frameIndex }.png`
        let wstr = createWriteStream(filename)
        
        // recursively process the next frame of the GIF
        wstr.on('finish', () => {
            this.chainProcessImages(frames, --index, filePrefix, callback)
        })
        wstr.on('open', () => {
            element.getImage().pipe(wstr)
        })
    }
}