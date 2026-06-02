"use client"

import { useState, useEffect } from "react"
import { Plus, Search, BookOpen, ExternalLink, Trash2, Edit2, Loader2, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { getMagazineIssues, MagazineIssue } from "@/lib/magazine-service"
import Link from "next/link"

export default function AdminMagazinePage() {
  const [issues, setIssues] = useState<MagazineIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    async function loadIssues() {
      const data = await getMagazineIssues()
      setIssues(data)
      setLoading(false)
    }
    loadIssues()
  }, [])

  const filteredIssues = issues.filter(issue => 
    issue.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">Magazine Management</h1>
          <p className="text-muted-foreground mt-1">Create, edit, and publish digital editions.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-white gap-2">
          <Plus className="h-4 w-4" />
          Create New Issue
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Issues Archive</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search issues..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="text-muted-foreground">Loading issues...</p>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="text-center py-20">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground italic text-lg">No issues found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredIssues.map((issue) => (
                  <div 
                    key={issue.id}
                    className="flex items-center gap-6 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/5 transition-colors group"
                  >
                    <div className="relative h-24 w-18 aspect-[3/4] rounded-lg overflow-hidden border bg-muted shrink-0 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={issue.coverImage} 
                        alt={issue.title} 
                        className="h-full w-full object-cover"
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-serif font-bold text-xl truncate">{issue.title}</h3>
                        {issue.isLatest && (
                          <Badge className="bg-accent text-white border-none text-[10px] py-0">LIVE</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{issue.description}</p>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                          <Plus className="h-3 w-3" /> Published: {new Date(issue.publishDate).toLocaleDateString()}
                        </span>
                        <div className="flex gap-2">
                          {issue.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-accent" asChild title="Preview in Reader">
                        <Link href={`/magazine/issue/${issue.id}`} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-accent" title="Edit Content">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" title="Delete Issue">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-accent/20 bg-accent/5">
            <CardHeader>
              <CardTitle className="text-lg">Quick Guide</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4 text-muted-foreground leading-relaxed">
              <p>
                <strong>1. Upload Files:</strong> Drag and drop your Photoshop (.psd) or JPEG files. The system automatically converts PSDs for the web.
              </p>
              <p>
                <strong>2. Build Pages:</strong> Use the editorial builder to define page layouts, headlines, and interviews.
              </p>
              <p>
                <strong>3. Monetize:</strong> Tag specific products or corporate sponsors directly in the digital spreads.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Storage Usage</CardTitle>
              <CardDescription>Google Cloud Storage Status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Magazine Assets</span>
                  <span className="font-mono">1.2 GB</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent w-1/3" />
                </div>
                <Button variant="outline" className="w-full gap-2 text-xs h-9">
                  <ImageIcon className="h-3 w-3" />
                  View Media Library
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
