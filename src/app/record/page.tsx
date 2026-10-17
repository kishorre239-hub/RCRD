'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Monitor, 
  Mic, 
  Camera, 
  Play, 
  Square, 
  Download, 
  RotateCcw, 
  UploadCloud, 
  CheckCircle, 
  AlertCircle, 
  Folder, 
  Maximize2, 
  Minimize2, 
  Upload, 
  FileVideo, 
  Plus, 
  Check, 
  ExternalLink, 
  HardDrive 
} from 'lucide-react';
import { useRecorder } from '@/hooks/useRecorder';
import { uploadVideo, getCourses, createCourse } from '@/lib/api';

interface Course {
  id: string;
  name: string;
}

export default function RecordPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [options, setOptions] = useState({
    screen: true,
    microphone: true,
    camera: false,
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  
  // New folder creation state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isFolderSubmitting, setIsFolderSubmitting] = useState(false);

  useEffect(() => {
    getCourses().then(setCourses).catch(console.error);
  }, []);

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const {
    isRecording,
    recordingTime,
    mediaBlobUrl,
    mediaBlob,
    error,
    startRecording,
    stopRecording,
    clearRecording,
    setMediaFile,
  } = useRecorder();

  // Set default video title when recording completes or media is ready
  useEffect(() => {
    if (mediaBlob && !videoTitle) {
      const timer = setTimeout(() => {
        if (selectedFileName) {
          setVideoTitle(selectedFileName.replace(/\.[^/.]+$/, ''));
        } else {
          const d = new Date();
          const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          setVideoTitle(`Screen Recording · ${dateStr} (${timeStr})`);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [mediaBlob, videoTitle, selectedFileName]);

  const handleStart = () => {
    setUploadSuccess(false);
    setUploadError(null);
    setUploadProgress(0);
    setVideoId(null);
    setSelectedFileName(null);
    setVideoTitle('');
    startRecording(options);
  };

  const handleStop = () => {
    stopRecording();
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFileName(file.name);
      setVideoTitle(file.name.replace(/\.[^/.]+$/, ''));
      setUploadSuccess(false);
      setUploadError(null);
      setUploadProgress(0);
      setVideoId(null);
      setMediaFile(file);
    }
    // Reset file input so same file can be re-selected if desired
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateNewFolder = async () => {
    if (!newFolderName.trim() || isFolderSubmitting) return;
    setIsFolderSubmitting(true);
    try {
      const created = await createCourse(newFolderName.trim());
      setCourses(prev => {
        if (prev.some(c => c.id === created.id)) return prev;
        return [...prev, created];
      });
      setSelectedCourseId(created.id);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err) {
      console.error('Failed to create folder:', err);
    } finally {
      setIsFolderSubmitting(false);
    }
  };

  const handleUpload = async () => {
    if (!mediaBlob) return;
    
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    
    const selectedCourse = courses.find(c => c.id === selectedCourseId);
    const finalTitle = videoTitle.trim() || `Screen Recording · ${new Date().toLocaleDateString('en-US')}`;

    try {
      const response = await uploadVideo(
        mediaBlob, 
        selectedCourseId || null, 
        (percent) => {
          setUploadProgress(percent);
        },
        finalTitle,
        {
          folderName: selectedCourse?.name,
          isMeeting: selectedCourseId === 'MEETING'
        }
      );
      
      setUploadSuccess(true);
      setVideoId(response.videoId);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload video to Google Drive');
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentFolder = courses.find(c => c.id === selectedCourseId);
  const currentFolderName = currentFolder?.name || (selectedCourseId === 'MEETING' ? 'MEETING' : 'Personal Library (Root)');

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-[#F9FAFB] dark:bg-[#0f1115] text-[#20262E] dark:text-white p-6 sm:p-8">
      {/* Hidden file input for file selection */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelection} 
        accept="video/*" 
        className="hidden" 
      />

      <div className="max-w-4xl mx-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center text-sm font-semibold text-[#57636E] hover:text-[#20262E] dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>

          {/* Switch to Full Screen Button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#16181d] border border-[#E2E7EC] dark:border-slate-800 hover:bg-[#F5F6F8] dark:hover:bg-slate-800/80 rounded-xl text-xs font-bold text-[#20262E] dark:text-slate-200 transition-all shadow-sm hover:shadow"
            title={isFullscreen ? 'Exit Full Screen' : 'Switch to Full Screen'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 text-[#0C5325] dark:text-indigo-400" />
                <span>Exit Full Screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 text-[#0C5325] dark:text-indigo-400" />
                <span>Switch to Full Screen</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-white dark:bg-[#16181d] rounded-2xl shadow-sm border border-[#E2E7EC] dark:border-slate-800 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Recording Studio</h1>
            <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-[#0C5325] dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-800/50">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Google Drive Connected</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-[#0CAA41]/10 dark:bg-red-900/20 text-[#0CAA41] dark:text-[#0CAA41] rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {!mediaBlobUrl ? (
            <>
              {/* Recording Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <OptionCard 
                  icon={<Monitor />} 
                  title="Screen" 
                  active={options.screen} 
                  onClick={() => setOptions(o => ({ ...o, screen: !o.screen }))}
                  disabled={isRecording}
                />
                <OptionCard 
                  icon={<Mic />} 
                  title="Microphone" 
                  active={options.microphone} 
                  onClick={() => setOptions(o => ({ ...o, microphone: !o.microphone }))}
                  disabled={isRecording}
                />
                <OptionCard 
                  icon={<Camera />} 
                  title="Camera" 
                  active={options.camera} 
                  onClick={() => setOptions(o => ({ ...o, camera: !o.camera }))}
                  disabled={isRecording}
                />
              </div>

              <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-[#E2E7EC] dark:border-slate-700 rounded-2xl bg-[#F5F6F8] dark:bg-slate-800/40">
                {!isRecording ? (
                  <div className="flex flex-col items-center gap-5 w-full max-w-md">
                    <button 
                      onClick={handleStart}
                      className="w-full flex items-center justify-center gap-3 bg-[#0C5325] hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
                    >
                      <Play className="fill-white w-5 h-5" />
                      Start Recording
                    </button>

                    {/* Or choose file from computer */}
                    <div className="flex items-center gap-3 w-full my-1">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                      <span className="text-xs uppercase font-bold text-[#57636E] tracking-wider">or</span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2.5 bg-white dark:bg-[#16181d] border-2 border-indigo-200 dark:border-indigo-900/60 hover:border-[#72BAA9] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-[#0C5325] dark:text-indigo-400 py-3.5 px-6 rounded-2xl text-sm font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <FileVideo className="w-5 h-5 text-[#0C5325] dark:text-indigo-400" />
                      Select Video File from Computer
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="text-4xl font-mono font-bold mb-6 flex items-center gap-4">
                      <div className="w-4 h-4 bg-[#0CAA41] rounded-full animate-pulse"></div>
                      {formatTime(recordingTime)}
                    </div>
                    <button 
                      onClick={handleStop}
                      className="flex items-center gap-3 bg-[#0CAA41] hover:bg-[#0C5325] text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg shadow-red-600/30 transition-all active:scale-95 cursor-pointer"
                    >
                      <Square className="fill-white w-6 h-6" />
                      Stop Recording
                    </button>
                  </div>
                )}
                
                <p className="mt-6 text-sm text-[#57636E] text-center max-w-md">
                  {!isRecording 
                    ? "Select your desired sources above and click Start, or choose an existing video file to upload directly to Google Drive." 
                    : "Recording is currently active across your selected screen and microphone. Click Stop when finished."}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Preview Mode */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Preview Video</h2>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#0C5325] dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Select a Different Video File
                  </button>
                </div>
                <div className="rounded-2xl overflow-hidden border border-[#E2E7EC] dark:border-slate-700 bg-black aspect-video relative shadow-inner">
                  <video 
                    src={mediaBlobUrl} 
                    controls 
                    className="w-full h-full object-contain"
                    autoPlay
                  />
                </div>
              </div>
              
              {uploadSuccess ? (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-[#72BAA9]/30 bg-[#E6F6EC]/40 dark:bg-emerald-950/20 dark:border-emerald-800 rounded-2xl mb-6 text-center animate-in fade-in zoom-in-95 duration-200">
                  <CheckCircle className="w-14 h-14 text-[#72BAA9] mb-4" />
                  <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mb-2">Saved to Google Drive Successfully!</h3>
                  <p className="text-[#0C5325] dark:text-[#E6F6EC] max-w-md mb-2 text-sm">
                    <span className="font-semibold">{videoTitle}</span> has been uploaded directly to Google Drive under folder <span className="font-semibold">&quot;{currentFolderName}&quot;</span>.
                  </p>
                  <p className="text-[#57636E] dark:text-[#57636E] text-xs mb-6">Your video is immediately accessible in your library and ready to share.</p>
                  
                  <div className="flex flex-wrap gap-3 justify-center">
                    <button 
                      onClick={() => router.push(videoId ? `/video/${videoId}` : '/library')}
                      className="bg-[#72BAA9] hover:bg-[#0C5325] text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View Video
                    </button>
                    <button 
                      onClick={() => router.push('/library')}
                      className="bg-white dark:bg-slate-800 text-[#20262E] dark:text-slate-200 border border-[#E2E7EC] dark:border-slate-700 hover:bg-[#F5F6F8] dark:hover:bg-slate-700 px-6 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                    >
                      Go to Library
                    </button>
                    <button 
                      onClick={() => {
                        clearRecording();
                        setUploadSuccess(false);
                        setVideoTitle('');
                        setSelectedFileName(null);
                      }}
                      className="bg-[#E6F6EC] hover:bg-emerald-200 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-6 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                    >
                      Record / Upload Another
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {uploadError && (
                    <div className="mb-6 p-4 bg-[#0CAA41]/10 dark:bg-red-900/20 text-[#0CAA41] dark:text-[#0CAA41] rounded-xl text-sm font-medium flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-[#0CAA41]/30 dark:border-red-800">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-7 sm:ml-0">
                        {uploadError.toLowerCase().includes('storage limit') && (
                          <button
                            onClick={() => router.push('/settings?tab=billing')}
                            className="bg-[#0CAA41] hover:bg-[#0C5325] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
                          >
                            Upgrade Plan
                          </button>
                        )}
                        <button 
                          onClick={handleUpload}
                          className="text-[#0C5325] dark:text-red-300 hover:underline font-bold text-xs cursor-pointer"
                          disabled={isUploading}
                        >
                          Retry Upload
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Upload Progress Bar */}
                  {isUploading && (
                    <div className="mb-6 p-4 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                      <div className="flex justify-between text-sm mb-2 font-bold text-indigo-700 dark:text-indigo-300">
                        <span className="flex items-center gap-2">
                          <UploadCloud className="w-4 h-4 animate-bounce" />
                          Uploading to Google Drive...
                        </span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className="bg-[#0C5325] h-3 rounded-full transition-all duration-300 shadow-sm"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Metadata Configuration Section */}
                  <div className="bg-[#F5F6F8] dark:bg-slate-800/40 rounded-2xl p-5 mb-6 border border-[#E2E7EC] dark:border-slate-700/60 space-y-4">
                    {/* Video Title / File Name Field */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#57636E] dark:text-[#57636E] mb-1.5">
                        Video / File Name
                      </label>
                      <input 
                        type="text"
                        value={videoTitle}
                        onChange={(e) => setVideoTitle(e.target.value)}
                        placeholder="e.g. Project Architecture Walkthrough"
                        disabled={isUploading}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#E2E7EC] dark:border-slate-700 bg-white dark:bg-[#16181d] text-[#20262E] dark:text-white font-medium text-sm focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all disabled:opacity-60"
                      />
                    </div>

                    {/* Google Drive Folder Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#57636E] dark:text-[#57636E] flex items-center gap-1.5">
                          <Folder className="w-3.5 h-3.5 text-[#72BAA9]" />
                          Google Drive Destination Folder
                        </label>
                        {!isCreatingFolder && !isUploading && (
                          <button
                            type="button"
                            onClick={() => setIsCreatingFolder(true)}
                            className="text-xs font-bold text-[#0C5325] dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            New Folder
                          </button>
                        )}
                      </div>

                      {/* Inline New Folder Form */}
                      {isCreatingFolder && (
                        <div className="mb-3 p-3 bg-white dark:bg-[#16181d] border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center gap-2">
                          <input 
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Enter new Google Drive folder name..."
                            autoFocus
                            disabled={isFolderSubmitting}
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#E2E7EC] dark:border-slate-700 bg-[#F5F6F8] dark:bg-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateNewFolder();
                              if (e.key === 'Escape') setIsCreatingFolder(false);
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleCreateNewFolder}
                            disabled={!newFolderName.trim() || isFolderSubmitting}
                            className="px-3 py-1.5 bg-[#0C5325] hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Create
                          </button>
                          <button
                            type="button"
                            onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                            className="px-2.5 py-1.5 text-xs text-[#57636E] hover:text-[#20262E] dark:hover:text-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <select 
                        value={selectedCourseId}
                        onChange={(e) => setSelectedCourseId(e.target.value)}
                        disabled={isUploading}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#E2E7EC] dark:border-slate-700 bg-white dark:bg-[#16181d] text-[#20262E] dark:text-white font-medium text-sm focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all cursor-pointer disabled:opacity-60"
                      >
                        <option value="">Personal Library (Root Google Drive)</option>
                        {courses
                          .filter(c => c.id !== '1Oexp7mpRPLqN1YhvPAaIBEXeC14IRcaW')
                          .map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} (Google Drive)
                            </option>
                          ))}
                      </select>

                      {/* Google Drive Breadcrumb Path Preview */}
                      <div className="flex items-center gap-1.5 text-xs text-[#57636E] dark:text-[#57636E] mt-2">
                        <span className="font-bold text-[#57636E] dark:text-slate-300">Upload Path:</span>
                        <span className="bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono">
                          Google Drive / {currentFolderName} / {videoTitle || 'recording.webm'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="flex-1 flex justify-center items-center gap-2.5 bg-[#0C5325] hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-indigo-600/30 cursor-pointer active:scale-[0.98]"
                    >
                      <UploadCloud className="w-5 h-5" />
                      {isUploading ? 'Uploading to Google Drive...' : 'Save to Google Drive'}
                    </button>
                    <a 
                      href={mediaBlobUrl} 
                      download={`${(videoTitle || 'recording').replace(/[^a-zA-Z0-9_\-]/g, '_')}.webm`}
                      className={`flex justify-center items-center gap-2 bg-white dark:bg-slate-800 border border-[#E2E7EC] dark:border-slate-700 hover:bg-[#F5F6F8] dark:hover:bg-slate-700 text-[#20262E] dark:text-slate-200 px-5 py-3.5 rounded-xl font-bold text-sm transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                    >
                      <Download className="w-4 h-4" />
                      Download Copy
                    </a>
                    <button 
                      onClick={() => {
                        clearRecording();
                        setVideoTitle('');
                        setSelectedFileName(null);
                      }}
                      disabled={isUploading}
                      className="flex justify-center items-center p-3.5 bg-slate-100 dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 text-[#20262E] dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
                      title="Discard & Start Over"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OptionCard({ icon, title, active, onClick, disabled }: { icon: React.ReactNode, title: string, active: boolean, onClick: () => void, disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'
      } ${
        active 
          ? 'border-indigo-600 bg-indigo-50 dark:bg-[#0C5325]/10 dark:border-[#72BAA9]' 
          : 'border-[#E2E7EC] dark:border-slate-700 bg-white dark:bg-[#16181d]'
      }`}
    >
      <div className={`p-2 rounded-lg ${active ? 'bg-indigo-100 dark:bg-indigo-900/50 text-[#0C5325] dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-[#57636E]'}`}>
        {icon}
      </div>
      <div className="font-semibold">{title}</div>
      <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-indigo-600 bg-[#0C5325]' : 'border-[#E2E7EC] dark:border-slate-600'}`}>
        {active && <div className="w-2 h-2 bg-white rounded-full"></div>}
      </div>
    </button>
  );
}
