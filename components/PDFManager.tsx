"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function PDFManager() {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadStatus("❌ Please select a PDF file");
      return;
    }

    setUploading(true);
    setUploadStatus("📄 Uploading PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/pdf", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus(`✅ ${result.filename} uploaded successfully!`);
        setUploadedFiles(prev => [...prev, result.filename]);
        
        // Clear status after 3 seconds
        setTimeout(() => setUploadStatus(""), 3000);
      } else {
        setUploadStatus(`❌ Upload failed: ${result.error}`);
      }
    } catch (error) {
      setUploadStatus("❌ Upload failed: Network error");
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
      // Reset file input
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleDeleteFile = async (filename: string) => {
    try {
      const response = await fetch(`/api/pdf?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (response.ok) {
        setUploadedFiles(prev => prev.filter(f => f !== filename));
        setUploadStatus(`✅ ${filename} deleted successfully!`);
        setTimeout(() => setUploadStatus(""), 3000);
      } else {
        setUploadStatus(`❌ Delete failed: ${result.error}`);
      }
    } catch (error) {
      setUploadStatus("❌ Delete failed: Network error");
      console.error("Delete error:", error);
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <Label className="text-green-800 font-medium">📚 PDF Knowledge Base</Label>
        <span className="text-xs text-gray-500">Upload PDFs for AI to reference</span>
      </div>
      
      <div className="space-y-3">
        {/* Upload Section */}
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
            className={`cursor-pointer inline-flex items-center px-3 py-2 text-xs border rounded 
              ${uploading 
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
          >
            {uploading ? "⏳ Uploading..." : "📄 Upload PDF"}
          </Label>
        </div>

        {/* Status Message */}
        {uploadStatus && (
          <div className="text-xs p-2 rounded bg-white border">
            {uploadStatus}
          </div>
        )}

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-gray-600 font-medium">Uploaded Documents:</div>
            {uploadedFiles.map((filename, index) => (
              <div key={index} className="flex items-center justify-between bg-white p-2 rounded border text-xs">
                <span className="text-gray-700">📄 {filename}</span>
                <button
                  onClick={() => handleDeleteFile(filename)}
                  className="text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                >
                  🗑️ Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-gray-500">
          💡 Uploaded PDFs will be used to provide context-aware responses during interviews.
        </div>
      </div>
    </div>
  );
}
