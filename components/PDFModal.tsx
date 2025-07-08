"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface PDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  page?: number;
  citation?: {
    source: string;
    content: string;
    page?: number;
    startPage?: number;
    endPage?: number;
    filename?: string;
    score?: number;
    sourceType?: 'pdf' | 'web';
    pageRange?: string;
    contextSnippet?: string;
    url?: string;
  };
}

export function PDFModal({ isOpen, onClose, filename, page, citation }: PDFModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full mx-4 flex flex-col">
        {/* Header with Enhanced Page Information */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{filename}</h3>
              <div className="flex items-center gap-2 mt-1">
                {page && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm font-bold rounded-full shadow-sm">
                    📖 Page {page}
                  </span>
                )}
                {citation?.pageRange && citation.pageRange !== `Page ${page}` && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    📄 {citation.pageRange}
                  </span>
                )}
                {citation?.score && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    🎯 {Math.round(citation.score * 100)}% relevant
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 bg-white shadow-sm"
          >
            ✕ Close
          </Button>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 p-4 overflow-auto">
          {citation ? (
            <div className="space-y-4">
              {/* PDF Page Information with Enhanced Details */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-green-100 rounded-full">
                    <span className="text-2xl">📄</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-800 mb-2">{filename}</h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      {citation.page && (
                        <div className="flex items-center gap-2">
                          <span className="px-4 py-2 bg-green-600 text-white text-base font-bold rounded-lg shadow-sm">
                            📖 Page {citation.page}
                          </span>
                          <span className="text-sm text-green-700 font-medium">Primary Location</span>
                        </div>
                      )}
                      
                      {citation.startPage && citation.endPage && citation.startPage !== citation.endPage && (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full border border-purple-200">
                            📄 Spans Pages {citation.startPage}-{citation.endPage}
                          </span>
                          <span className="text-xs text-purple-600">({citation.endPage - citation.startPage + 1} pages)</span>
                        </div>
                      )}
                      
                      {citation.pageRange && (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            📍 {citation.pageRange}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Enhanced Citation Context */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">💬</span>
                  <span className="text-base font-semibold text-gray-800">Content from Page {citation.page || page || 1}</span>
                </div>
                
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-l-4 border-blue-500 p-5 rounded-md shadow-sm">
                  <div className="text-sm text-gray-800 leading-relaxed mb-4">
                    <span className="text-gray-600 text-xs uppercase tracking-wider font-medium block mb-2">EXTRACTED CONTENT:</span>
                    <div className="bg-white p-4 rounded border italic text-gray-900 leading-loose">
                      "{citation.contextSnippet || citation.content}"
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 font-medium">RELEVANCE:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.round((citation.score || 0) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                          {Math.round((citation.score || 0) * 100)}%
                        </span>
                      </div>
                    </div>
                    
                    {citation.sourceType && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full uppercase">
                        {citation.sourceType} Source
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* PDF Viewer Placeholder */}
              <div className="bg-gray-100 rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
                <div className="mb-4">
                  <span className="text-5xl">�</span>
                </div>
                <h4 className="text-lg font-medium text-gray-700 mb-2">PDF Viewer</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Full PDF viewer integration coming soon
                </p>
                <div className="text-xs text-gray-500 bg-white p-3 rounded border">
                  <p className="font-medium mb-1">Implementation roadmap:</p>
                  <div className="text-left">
                    <p>• PDF.js integration for client-side rendering</p>
                    <p>• Direct page navigation and highlighting</p>
                    <p>• Search within document functionality</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-8 text-center">
              <div className="mb-4">
                <span className="text-4xl">📄</span>
              </div>
              <p className="text-gray-600 mb-2">
                <strong>{filename}</strong>{page && ` - Page ${page}`}
              </p>
              <p className="text-sm text-gray-500">
                PDF viewer integration would be implemented here
              </p>
            </div>
          )}
        </div>

        {/* Enhanced Footer with Page Navigation */}
        <div className="p-4 border-t bg-gradient-to-r from-gray-50 to-blue-50 flex justify-between items-center">
          <div className="text-sm text-gray-700">
            {citation ? (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="font-medium">Context found on page {citation.page || page || 1}</span>
                </span>
                {citation.startPage && citation.endPage && citation.startPage !== citation.endPage && (
                  <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                    📄 Content spans {citation.endPage - citation.startPage + 1} pages
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  Relevance: {Math.round((citation.score || 0) * 100)}%
                </span>
              </div>
            ) : (
              <span className="font-medium">PDF document viewer - Page {page || 1}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled className="text-xs">
              ← Previous Page
            </Button>
            <div className="flex items-center gap-2 px-3 py-1 bg-white border rounded text-xs font-medium">
              <span>Page</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-bold">
                {citation?.page || page || 1}
              </span>
            </div>
            <Button variant="outline" size="sm" disabled className="text-xs">
              Next Page →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
