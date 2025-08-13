"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, Trash2, AlertCircle, CheckCircle } from "lucide-react"

export function PDFManager() {
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>("")
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== "application/pdf") {
      setUploadStatus("Please select a PDF file")
      return
    }

    setUploading(true)
    setUploadStatus("Uploading PDF...")

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/pdf", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setUploadStatus(`${result.filename} uploaded successfully!`)
        setUploadedFiles((prev) => [...prev, result.filename])

        setTimeout(() => setUploadStatus(""), 3000)
      } else {
        setUploadStatus(`Upload failed: ${result.error}`)
      }
    } catch (error) {
      setUploadStatus("Upload failed: Network error")
      console.error("Upload error:", error)
    } finally {
      setUploading(false)
      if (event.target) {
        event.target.value = ""
      }
    }
  }

  const handleDeleteFile = async (filename: string) => {
    try {
      const response = await fetch(`/api/pdf?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (response.ok) {
        setUploadedFiles((prev) => prev.filter((f) => f !== filename))
        setUploadStatus(`${filename} deleted successfully!`)
        setTimeout(() => setUploadStatus(""), 3000)
      } else {
        setUploadStatus(`Delete failed: ${result.error}`)
      }
    } catch (error) {
      setUploadStatus("Delete failed: Network error")
      console.error("Delete error:", error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">PDF Knowledge Base</Label>
        <Badge variant="secondary" className="text-xs">
          Upload PDFs for AI reference
        </Badge>
      </div>

      {/* Upload Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
            id="pdf-upload"
          />
          <Label
            htmlFor="pdf-upload"
            className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm border rounded-lg transition-colors ${
              uploading
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-background hover:bg-muted border-border hover:border-border/80"
            }`}
          >
            <Upload className="size-4" />
            {uploading ? "Uploading..." : "Upload PDF"}
          </Label>
        </div>

        {/* Status Message */}
        {uploadStatus && (
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
            {uploadStatus.includes("successfully") ? (
              <CheckCircle className="size-4 text-green-600" />
            ) : (
              <AlertCircle className="size-4 text-amber-600" />
            )}
            <span className="text-sm">{uploadStatus}</span>
          </div>
        )}

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Uploaded Documents:</Label>
            {uploadedFiles.map((filename, index) => (
              <Card key={index} className="border-border/40">
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-blue-600" />
                    <span className="text-sm font-medium truncate">{filename}</span>
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFile(filename)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <AlertCircle className="size-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Uploaded PDFs will be used to provide context-aware responses during interviews.
          </p>
        </div>
      </div>
    </div>
  )
}
