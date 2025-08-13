"use client"

import { Label } from "@/components/ui/label"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, FileText, ChevronLeft, ChevronRight } from "lucide-react"

interface PDFModalProps {
  isOpen: boolean
  onClose: () => void
  filename: string
  page?: number
  citation?: {
    source: string
    content: string
    page?: number
    startPage?: number
    endPage?: number
    filename?: string
    score?: number
    sourceType?: "pdf" | "web"
    pageRange?: string
    contextSnippet?: string
    url?: string
  }
}

export function PDFModal({ isOpen, onClose, filename, page, citation }: PDFModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg max-w-4xl max-h-[90vh] w-full flex flex-col border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/50 dark:to-indigo-950/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <FileText className="size-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold">{filename}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {page && <Badge className="bg-blue-600 hover:bg-blue-600">📖 Page {page}</Badge>}
                  {citation?.pageRange && citation.pageRange !== `Page ${page}` && (
                    <Badge variant="outline" className="text-xs">
                      📄 {citation.pageRange}
                    </Badge>
                  )}
                  {citation?.score && (
                    <Badge variant="secondary" className="text-xs">
                      🎯 {Math.round(citation.score * 100)}% relevant
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {citation ? (
            <div className="space-y-6">
              {/* Citation Context */}
              <Card className="border-border/40 bg-gradient-to-b from-background to-muted/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="size-4 text-blue-600" />
                    Content from Page {citation.page || page || 1}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/40">
                    <div className="text-sm leading-relaxed">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium block mb-2">
                        Extracted Content:
                      </Label>
                      <div className="bg-background p-4 rounded border italic">
                        "{citation.contextSnippet || citation.content}"
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-border/40">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium">Relevance:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.round((citation.score || 0) * 100)}%` }}
                            ></div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {Math.round((citation.score || 0) * 100)}%
                          </Badge>
                        </div>
                      </div>

                      {citation.sourceType && (
                        <Badge variant="outline" className="text-xs uppercase">
                          {citation.sourceType} Source
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PDF Viewer Placeholder */}
              <Card className="border-dashed border-2 border-muted">
                <CardContent className="p-8 text-center">
                  <div className="mb-4">
                    <FileText className="size-12 text-muted-foreground mx-auto" />
                  </div>
                  <h4 className="text-lg font-medium mb-2">PDF Viewer</h4>
                  <p className="text-sm text-muted-foreground mb-4">Full PDF viewer integration coming soon</p>
                  <div className="text-xs text-muted-foreground bg-muted/50 p-4 rounded border">
                    <p className="font-medium mb-2">Implementation roadmap:</p>
                    <div className="text-left space-y-1">
                      <p>• PDF.js integration for client-side rendering</p>
                      <p>• Direct page navigation and highlighting</p>
                      <p>• Search within document functionality</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-dashed border-2 border-muted">
              <CardContent className="p-8 text-center">
                <FileText className="size-12 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium mb-2">
                  {filename}
                  {page && ` - Page ${page}`}
                </p>
                <p className="text-sm text-muted-foreground">PDF viewer integration would be implemented here</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex justify-between items-center">
          <div className="text-sm">
            {citation ? (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">Context found on page {citation.page || page || 1}</span>
                </span>
                {citation.startPage && citation.endPage && citation.startPage !== citation.endPage && (
                  <Badge variant="outline" className="text-xs">
                    📄 Content spans {citation.endPage - citation.startPage + 1} pages
                  </Badge>
                )}
              </div>
            ) : (
              <span className="font-medium">PDF document viewer - Page {page || 1}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <div className="flex items-center gap-2 px-3 py-1 bg-background border rounded text-sm font-medium">
              <span>Page</span>
              <Badge variant="secondary">{citation?.page || page || 1}</Badge>
            </div>
            <Button variant="outline" size="sm" disabled>
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
