/**
 * Type definitions for canvas
 * 
 * This is a module declaration file for the canvas package
 * which allows TypeScript to understand the imported module.
 */

declare module 'canvas' {
  export interface Canvas {
    width: number;
    height: number;
    getContext(contextId: '2d'): CanvasRenderingContext2D;
    toBuffer(format?: string, quality?: number): Buffer;
    createPNGStream(options?: any): NodeJS.ReadableStream;
    createJPEGStream(options?: any): NodeJS.ReadableStream;
    createPDFStream(options?: any): NodeJS.ReadableStream;
  }

  export interface Image {
    src: string;
    width: number;
    height: number;
    onload: (() => void) | null;
    onerror: ((err: Error) => void) | null;
  }

  export function createCanvas(width: number, height: number): Canvas;
  export function loadImage(src: string | Buffer): Promise<Image>;
  export const versions: { [key: string]: string };
}
