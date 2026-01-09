
import React, { useState, useRef, useCallback } from 'react';
import { Download, Upload, Scissors, RefreshCcw, Video, Grid } from 'lucide-react';
import { GridSegment, ProcessingStatus } from './types';
import { GoogleGenAI } from "@google/genai";

// Lucide icons exported manually if needed, but we'll use standard Tailwind icons or components
const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [segments, setSegments] = useState<GridSegment[]>([]);
  const [error, setError] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRefs = useRef<MediaRecorder[]>([]);
  const chunksRefs = useRef<Blob[][]>(Array.from({ length: 9 }, () => []));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setStatus(ProcessingStatus.IDLE);
      setSegments([]);
      setProgress(0);
      setError('');
    }
  };

  const splitVideo = async () => {
    if (!videoRef.current || !videoUrl) return;

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setError('Could not initialize canvas context');
      setStatus(ProcessingStatus.ERROR);
      return;
    }

    // Wait for metadata to ensure dimensions
    if (video.readyState < 2) {
      await new Promise(resolve => (video.onloadedmetadata = resolve));
    }

    const cellWidth = video.videoWidth / 3;
    const cellHeight = video.videoHeight / 3;
    
    canvas.width = cellWidth;
    canvas.height = cellHeight;

    // Create 9 individual recorders for each segment
    const streams = Array.from({ length: 9 }, () => {
      const c = document.createElement('canvas');
      c.width = cellWidth;
      c.height = cellHeight;
      return { canvas: c, ctx: c.getContext('2d')!, stream: c.captureStream(30) };
    });

    chunksRefs.current = Array.from({ length: 9 }, () => []);
    mediaRecorderRefs.current = streams.map((s, i) => {
      const recorder = new MediaRecorder(s.stream, { mimeType: 'video/webm;codecs=vp8' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRefs.current[i].push(e.data);
      };
      return recorder;
    });

    // Start recording
    mediaRecorderRefs.current.forEach(r => r.start());
    video.currentTime = 0;
    await video.play();

    const processFrame = () => {
      if (video.paused || video.ended) {
        mediaRecorderRefs.current.forEach(r => r.stop());
        finishProcessing();
        return;
      }

      streams.forEach((s, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        s.ctx.drawImage(
          video,
          col * cellWidth, row * cellHeight, cellWidth, cellHeight,
          0, 0, cellWidth, cellHeight
        );
      });

      const currentProgress = (video.currentTime / video.duration) * 100;
      setProgress(Math.round(currentProgress));
      requestAnimationFrame(processFrame);
    };

    requestAnimationFrame(processFrame);
  };

  const finishProcessing = async () => {
    // Small delay to ensure all data-available events fired
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newSegments: GridSegment[] = chunksRefs.current.map((chunks, i) => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      return {
        id: i,
        row: Math.floor(i / 3),
        col: i % 3,
        thumbnail: '', // We can generate a thumbnail later if needed
        blob: blob
      };
    });

    setSegments(newSegments);
    setStatus(ProcessingStatus.COMPLETED);
    setProgress(100);
  };

  const downloadSegment = (segment: GridSegment) => {
    if (!segment.blob) return;
    const url = URL.createObjectURL(segment.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `segment_${segment.row + 1}_${segment.col + 1}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    segments.forEach(s => downloadSegment(s));
  };

  const analyzeWithAI = async () => {
    // This part demonstrates integrating Gemini to "understand" what's in the grids
    // For a real utility, we'd take a snapshot of the grid and ask Gemini to describe each cell
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // This is a placeholder for actual AI logic if the user wanted to "identify" segments
    console.log("AI analysis requested for the video composition...");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Grid size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">GridSplit Pro</h1>
          </div>
          {status === ProcessingStatus.COMPLETED && (
            <button
              onClick={downloadAll}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-medium transition-all shadow-md active:scale-95"
            >
              <Download size={18} />
              Download All (9)
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8">
        {/* Upload Area */}
        {!videoFile && (
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center transition-all hover:border-blue-400">
            <div className="flex flex-col items-center">
              <div className="bg-blue-50 p-4 rounded-full mb-4">
                <Upload className="text-blue-600" size={32} />
              </div>
              <h2 className="text-xl font-semibold mb-2 text-gray-800">Upload Grid Video</h2>
              <p className="text-gray-500 mb-6 max-w-sm">
                Select a video file that contains a 3x3 grid of sub-videos to begin the splitting process.
              </p>
              <label className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold cursor-pointer transition-all shadow-lg active:scale-95">
                Choose MP4 File
                <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
              </label>
            </div>
          </div>
        )}

        {/* Workspace */}
        {videoFile && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-gray-700">
                  <Video size={20} className="text-blue-500" />
                  <span className="font-medium truncate max-w-xs">{videoFile.name}</span>
                </div>
                {status === ProcessingStatus.IDLE && (
                  <button
                    onClick={splitVideo}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium transition-all shadow-md"
                  >
                    <Scissors size={18} />
                    Start Splitting
                  </button>
                )}
                {status === ProcessingStatus.COMPLETED && (
                  <button
                    onClick={() => setVideoFile(null)}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-medium"
                  >
                    <RefreshCcw size={18} />
                    Reset
                  </button>
                )}
              </div>

              {/* Video Preview with Overlay */}
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden group">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  controls={status !== ProcessingStatus.PROCESSING}
                />
                
                {/* Grid Overlay */}
                {status !== ProcessingStatus.PROCESSING && (
                   <div className="absolute inset-0 pointer-events-none border border-white/20 grid grid-cols-3 grid-rows-3 opacity-50">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border border-white/20"></div>
                    ))}
                  </div>
                )}

                {/* Progress Bar */}
                {status === ProcessingStatus.PROCESSING && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-8">
                    <div className="w-full max-w-md bg-gray-700 h-3 rounded-full overflow-hidden mb-4">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-white font-medium text-lg">Splitting Grids... {progress}%</p>
                    <p className="text-gray-400 text-sm mt-2">Processing each frame into 9 separate streams</p>
                  </div>
                )}
              </div>
            </div>

            {/* Results Grid */}
            {status === ProcessingStatus.COMPLETED && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Grid size={20} className="text-blue-600" />
                  Split Results (9 Segments)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {segments.map((seg) => (
                    <div 
                      key={seg.id}
                      className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:border-blue-300 transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-500 uppercase">
                          Pos: R{seg.row + 1}, C{seg.col + 1}
                        </span>
                        <button
                          onClick={() => downloadSegment(seg)}
                          className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                      <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
                         <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                           <Video size={32} strokeWidth={1.5} />
                         </div>
                         {/* We show a preview if possible, but blobs can be heavy */}
                         <video 
                           src={seg.blob ? URL.createObjectURL(seg.blob) : ''} 
                           className="w-full h-full object-cover relative z-10"
                           muted
                           onMouseOver={(e) => (e.currentTarget as HTMLVideoElement).play()}
                           onMouseOut={(e) => {
                             const v = e.currentTarget as HTMLVideoElement;
                             v.pause();
                             v.currentTime = 0;
                           }}
                         />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feature List */}
        {!videoFile && (
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-purple-100 text-purple-600 flex items-center justify-center rounded-xl font-bold text-xl">1</div>
              <h4 className="font-bold">Lossless Logic</h4>
              <p className="text-sm text-gray-500 text-pretty">High-fidelity frame-by-frame extraction using browser-native MediaRecorder API.</p>
            </div>
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-green-100 text-green-600 flex items-center justify-center rounded-xl font-bold text-xl">2</div>
              <h4 className="font-bold">Zero Upload</h4>
              <p className="text-sm text-gray-500 text-pretty">Everything happens in your browser. Your video files never leave your computer.</p>
            </div>
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-orange-100 text-orange-600 flex items-center justify-center rounded-xl font-bold text-xl">3</div>
              <h4 className="font-bold">Auto-Download</h4>
              <p className="text-sm text-gray-500 text-pretty">One click to download all 9 split segments organized and named correctly.</p>
            </div>
          </div>
        )}
      </main>

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl animate-bounce">
          {error}
        </div>
      )}
    </div>
  );
};

export default App;
