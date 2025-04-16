/**
 * Type definitions for gifencoder
 * 
 * This is a module declaration file for the gifencoder package
 * which allows TypeScript to understand the imported module.
 */

declare module 'gifencoder' {
  interface GIFEncoder {
    start(): void;
    setRepeat(repeat: number): void;
    setDelay(delay: number): void;
    setQuality(quality: number): void;
    setFrameRate(frameRate: number): void;
    setDispose(dispose: number): void;
    addFrame(ctx: any): void;
    finish(): void;
    createReadStream(): NodeJS.ReadableStream;
  }

  export default class GIFEncoder implements GIFEncoder {
    constructor(width: number, height: number);
    
    createReadStream(): NodeJS.ReadableStream;
    start(): void;
    setRepeat(repeat: number): void; // 0 = loop forever, -1 = no repeat, n = loop n times
    setDelay(delay: number): void; // ms
    setQuality(quality: number): void; // 1-30, lower is better
    setDispose(dispose: number): void; // frame disposal code
    setFrameRate(frameRate: number): void; // fps
    addFrame(ctx: any): void;
    finish(): void;
  }
}
