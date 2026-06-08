declare module 'simple-uploader.js' {
  export default class Uploader {
    constructor(options: {
      target: string
      chunkSize?: number
      simultaneousUploads?: number
      headers?: Record<string, string>
      query?: () => Record<string, any>
    })
    
    addFile(file: File): void
    upload(): void
    on(event: 'progress' | 'complete' | 'error', callback: (...args: any[]) => void): void
    fileList: Array<{
      chunks?: Array<any>
    }>
  }
}
