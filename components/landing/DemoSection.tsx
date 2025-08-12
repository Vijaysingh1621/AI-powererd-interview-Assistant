"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Volume2, Maximize } from "lucide-react";

export function DemoSection() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section id="demo" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            See InterviewAI in Action
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Watch how our AI assistant transforms a typical technical interview
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="overflow-hidden shadow-2xl">
            <CardContent className="p-0">
              <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 aspect-video flex items-center justify-center">
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="relative z-10 text-center">
                  <Button
                    size="lg"
                    className="w-20 h-20 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? (
                      <Pause className="w-8 h-8 text-white" />
                    ) : (
                      <Play className="w-8 h-8 text-white ml-1" />
                    )}
                  </Button>
                  <p className="text-white mt-4 text-lg">
                    Watch 3-minute demo
                  </p>
                </div>
                
                {/* Demo Controls */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                      <Volume2 className="w-4 h-4" />
                    </Button>
                    <span className="text-white text-sm">0:00 / 3:24</span>
                  </div>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    <Maximize className="w-4 h-4" />
                  </Button>
                </div>

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div className="h-full bg-blue-500 w-1/3"></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demo Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold mb-2">Real-time Transcription</h3>
              <p className="text-gray-600 text-sm">
                See how our system captures and transcribes interviewer speech with 95%+ accuracy
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-indigo-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold mb-2">AI-Powered Insights</h3>
              <p className="text-gray-600 text-sm">
                Watch the AI analyze questions and provide intelligent, context-aware responses
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">Smart Citations</h3>
              <p className="text-gray-600 text-sm">
                See how RAG technology provides sources and citations for transparent, trustworthy responses
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}