declare global {
  interface Window {
    gtag: (
      command: 'event' | 'config' | 'js',
      action: string,
      params?: {
        [key: string]: any
      }
    ) => void
  }
}

export {} 