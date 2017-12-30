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
import { setTimeout } from 'timers';

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
    averageFrameDelay?: boolean
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

    processGif(inputFilename: string, outputFilename: string, options: GifReverseOptions, callback) {
        setTimeout( () => {
            let gifFile: Buffer

            try {
                gifFile = readFileSync(inputFilename)
            } 
            catch(err) {
                return callback(err, null)
            }

            const gifInfo = getInfo(gifFile)

            if(!gifInfo.valid) {
                return callback(Error('Invalid GIF file.'), null)
            }

            const gifDuration = gifInfo.duration
            let gifFrameRate = 0
            
            if(options.averageFrameDelay) {
                for(const img of gifInfo.images) {
                    gifFrameRate += img.delay
                }

                gifFrameRate = gifFrameRate / gifInfo.images.length
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
                    const imgPrefix = join(folder, 'image')
                    this.chainProcessImages(frames, frames.length - 1, imgPrefix, () => {
                        const encoder = new ge(gifInfo.width, gifInfo.height)
                        const ws = createWriteStream(join(this.outputDirectory, outputFilename))

                        // string of '?' chars for glob in pngFileStream
                        const globChars = Array(this.getFrameCountDigits(frames) + 1).join('?')
                        pfs(`${ imgPrefix + globChars }.png`)
                            .pipe(encoder.createWriteStream({ delay: gifFrameRate, repeat: 0, quality: 100 }))
                            .pipe(ws)
                        ws.on('finish', () => {
                            rimraf(folder, err => {
                                if(err) return callback(Error(`Unable to remove temporary folder ${ folder }.`), null)

                                const fullPath = join(this.outputDirectory, outputFilename)

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
        }, 10) 
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
        const frameCountDigits = this.getFrameCountDigits(frames)
        const paddingZeros: string = Array(frameCountDigits + 1).join('0')

        const frameIndex = (paddingZeros + index).slice(-frameCountDigits)
        const element = frames[frames.length - index - 1]
        
        const filename = `${ filePrefix }${ frameIndex }.png`
        const wstr = createWriteStream(filename)
        
        // recursively process the next frame of the GIF
        wstr.on('finish', () => {
            this.chainProcessImages(frames, --index, filePrefix, callback)
        })
        wstr.on('open', () => {
            element.getImage().pipe(wstr)
        })
    }
}