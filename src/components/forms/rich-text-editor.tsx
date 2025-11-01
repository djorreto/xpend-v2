'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import 'react-quill/dist/quill.snow.css'

// Importar React Quill dinámicamente para evitar SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  readOnly?: boolean
}

export function RichTextEditor({ value, onChange, placeholder, readOnly = false }: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Configuración del editor
  const modules = {
    toolbar: readOnly ? false : [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link'],
      ['clean']
    ],
  }

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'list', 'bullet',
    'indent',
    'align',
    'blockquote', 'code-block',
    'link',
  ]

  if (!mounted) {
    return (
      <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-500">
        Cargando editor...
      </div>
    )
  }

  return (
    <div className="rich-text-editor">
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
        className={readOnly ? 'read-only' : ''}
      />

      <style jsx global>{`
        .rich-text-editor .ql-container {
          min-height: 300px;
          font-size: 15px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .rich-text-editor .ql-editor {
          min-height: 300px;
          max-height: 600px;
          overflow-y: auto;
        }

        .rich-text-editor .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background: #f9fafb;
          border-color: #e5e7eb;
        }

        .rich-text-editor .ql-container {
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          border-color: #e5e7eb;
        }

        .rich-text-editor .read-only .ql-container {
          border: none;
        }

        .rich-text-editor .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: italic;
        }

        /* Estilos para mejor legibilidad */
        .rich-text-editor .ql-editor h1 {
          font-size: 2em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        .rich-text-editor .ql-editor h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        .rich-text-editor .ql-editor h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        .rich-text-editor .ql-editor ul,
        .rich-text-editor .ql-editor ol {
          padding-left: 1.5em;
        }

        .rich-text-editor .ql-editor blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          color: #6b7280;
        }

        .rich-text-editor .ql-editor code-block {
          background: #f3f4f6;
          padding: 1em;
          border-radius: 0.375rem;
          font-family: 'Monaco', 'Courier New', monospace;
        }
      `}</style>
    </div>
  )
}

