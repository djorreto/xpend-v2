import { supabaseBrowser } from './supabase'

export interface FileUploadOptions {
  bucket: string
  path: string
  file: File
  options?: {
    cacheControl?: string
    upsert?: boolean
  }
}

export interface FileDownloadOptions {
  bucket: string
  path: string
}

export class StorageService {
  // Upload file to Supabase Storage
  static async uploadFile({ bucket, path, file, options }: FileUploadOptions) {
    const supabase = supabaseBrowser()
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: options?.cacheControl || '3600',
          upsert: options?.upsert || false,
        })

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error uploading file:', error)
      return { data: null, error }
    }
  }

  // Download file from Supabase Storage
  static async downloadFile({ bucket, path }: FileDownloadOptions) {
    const supabase = supabaseBrowser()
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(path)

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error downloading file:', error)
      return { data: null, error }
    }
  }

  // Get public URL for file
  static getPublicUrl(bucket: string, path: string) {
    const supabase = supabaseBrowser()
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return data.publicUrl
  }

  // Delete file from Supabase Storage
  static async deleteFile(bucket: string, path: string) {
    const supabase = supabaseBrowser()
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .remove([path])

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error deleting file:', error)
      return { data: null, error }
    }
  }

  // List files in bucket
  static async listFiles(bucket: string, path?: string) {
    const supabase = supabaseBrowser()
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path)

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error listing files:', error)
      return { data: null, error }
    }
  }

  // Get file info
  static async getFileInfo(bucket: string, path: string) {
    const supabase = supabaseBrowser()
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path.split('/').slice(0, -1).join('/'), {
          search: path.split('/').pop()
        })

      if (error) {
        throw error
      }

      return { data: data?.[0] || null, error: null }
    } catch (error) {
      console.error('Error getting file info:', error)
      return { data: null, error }
    }
  }
}

// Bucket names
export const BUCKETS = {
  PROJECT_FILES: 'project-files',
  LICITACION_DOCUMENTS: 'licitacion-documents',
  SPEND_DATA: 'spend-data',
  USER_AVATARS: 'user-avatars',
  REPORTS: 'reports'
} as const

// Helper functions for specific use cases
export const ProjectFileService = {
  upload: (projectId: string, file: File) => {
    const path = `${projectId}/${Date.now()}-${file.name}`
    return StorageService.uploadFile({
      bucket: BUCKETS.PROJECT_FILES,
      path,
      file
    })
  },

  download: (filePath: string) => {
    return StorageService.downloadFile({
      bucket: BUCKETS.PROJECT_FILES,
      path: filePath
    })
  },

  delete: (filePath: string) => {
    return StorageService.deleteFile(BUCKETS.PROJECT_FILES, filePath)
  },

  getUrl: (filePath: string) => {
    return StorageService.getPublicUrl(BUCKETS.PROJECT_FILES, filePath)
  }
}

export const LicitacionDocumentService = {
  upload: (licitacionId: string, file: File) => {
    const path = `${licitacionId}/${Date.now()}-${file.name}`
    return StorageService.uploadFile({
      bucket: BUCKETS.LICITACION_DOCUMENTS,
      path,
      file
    })
  },

  download: (filePath: string) => {
    return StorageService.downloadFile({
      bucket: BUCKETS.LICITACION_DOCUMENTS,
      path: filePath
    })
  },

  delete: (filePath: string) => {
    return StorageService.deleteFile(BUCKETS.LICITACION_DOCUMENTS, filePath)
  },

  getUrl: (filePath: string) => {
    return StorageService.getPublicUrl(BUCKETS.LICITACION_DOCUMENTS, filePath)
  }
}

export const SpendDataService = {
  upload: (companyId: string, file: File) => {
    const path = `${companyId}/${Date.now()}-${file.name}`
    return StorageService.uploadFile({
      bucket: BUCKETS.SPEND_DATA,
      path,
      file
    })
  },

  download: (filePath: string) => {
    return StorageService.downloadFile({
      bucket: BUCKETS.SPEND_DATA,
      path: filePath
    })
  },

  delete: (filePath: string) => {
    return StorageService.deleteFile(BUCKETS.SPEND_DATA, filePath)
  },

  getUrl: (filePath: string) => {
    return StorageService.getPublicUrl(BUCKETS.SPEND_DATA, filePath)
  }
}

