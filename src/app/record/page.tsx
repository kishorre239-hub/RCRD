'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Monitor, Mic, Camera, Play, Square, Download, RotateCcw, UploadCloud, CheckCircle, AlertCircle, Folder } from 'lucide-react';
import { useRecorder } from '@/hooks/useRecorder';
import { uploadVideo, getCourses } from '@/lib/api';

interface Course {
  id: string;
  name: string;
}

export default function RecordPage() {
  const router = useRouter();
  const [options, setOptions] = useState({
    screen: true,
    microphone: true,
    camera: false,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  useEffect(() => {
    getCourses().then(setCourses).catch(console.error);
  }, []);

  const {
    isRecording,
    recordingTime,
    mediaBlobUrl,
    mediaBlob,
    error,
    startRecording,
    stopRecording,
    clearRecording
  } = useRecorder();

  const handleStart = () => {
    setUploadSuccess(false);
    setUploadError(null);
    setUploadProgress(0);
    setVideoId(null);
    startRecording(options);
  };

  const handleStop = () => {
    stopRecording();
  };

  const handleUpload = async () => {
    if (!mediaBlob) return;
    
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    
    try {
      const response = await uploadVideo(mediaBlob, selectedCourseId || null, (percent) => {
        setUploadProgress(percent);
      });
      
      setUploadSuccess(true);
      setVideoId(response.videoId);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-[#F9FAFB] dark:bg-[#0f1115] text-slate-900 dark:text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white dark:bg-[#16181d] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
          <h1 className="text-2xl font-bold mb-6">Recording Studio</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium">
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

              <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                {!isRecording ? (
                  <button 
                    onClick={handleStart}
                    className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                  >
                    <Play className="fill-white w-6 h-6" />
                    Start Recording
                  </button>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="text-4xl font-mono font-bold mb-6 flex items-center gap-4">
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                      {formatTime(recordingTime)}
                    </div>
                    <button 
                      onClick={handleStop}
                      className="flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg shadow-red-600/30 transition-all active:scale-95"
                    >
                      <Square className="fill-white w-6 h-6" />
                      Stop Recording
                    </button>
                  </div>
                )}
                
                <p className="mt-6 text-sm text-slate-500 text-center max-w-md">
                  {!isRecording 
                    ? "Select your desired sources above and click Start. You will be prompted to grant browser permissions." 
                    : "Recording is currently active. Click stop when you are finished."}
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Preview Mode */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-4">Preview Recording</h2>
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black aspect-video relative">
                  <video 
                    src={mediaBlobUrl} 
                    controls 
                    className="w-full h-full object-contain"
                    autoPlay
                  />
                </div>
              </div>
              
              {uploadSuccess ? (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl mb-6">
                  <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                  <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">Upload Complete!</h3>
                  <p className="text-green-600 dark:text-green-500 text-center mb-6">Your video has been successfully saved to your library.</p>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => router.push(videoId ? `/s/${videoId}` : '/')}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      {videoId ? 'View Video' : 'Go to Dashboard'}
                    </button>
                    <button 
                      onClick={() => {
                        clearRecording();
                        setUploadSuccess(false);
                      }}
                      className="bg-white text-green-700 border border-green-200 hover:bg-green-50 px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Record Another
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {uploadError && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-7 sm:ml-0">
                        {uploadError.toLowerCase().includes('storage limit') && (
                          <button
                            onClick={() => router.push('/settings?tab=billing')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-sm"
                          >
                            Upgrade Plan 💳
                          </button>
                        )}
                        <button 
                          onClick={handleUpload}
                          className="text-red-700 dark:text-red-300 hover:underline font-bold text-xs"
                          disabled={isUploading}
                        >
                          Retry Upload
                        </button>
                      </div>
                    </div>
                  )}

                  {isUploading && (
                    <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2 font-medium">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                        <div 
                          className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {!isUploading && courses.length > 0 && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                        <Folder className="w-4 h-4" /> Select Video Folder (Optional)
                      </label>
                      <select 
                        value={selectedCourseId}
                        onChange={(e) => setSelectedCourseId(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#16181d] focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Personal Library (Default)</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button 
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="flex-1 flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm shadow-indigo-600/30"
                    >
                      <UploadCloud className="w-5 h-5" />
                      {isUploading ? 'Uploading...' : 'Upload Video'}
                    </button>
                    <a 
                      href={mediaBlobUrl} 
                      download={`recording-${new Date().getTime()}.webm`}
                      className={`flex-1 flex justify-center items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-lg font-medium transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                    >
                      <Download className="w-5 h-5" />
                      Save Locally
                    </a>
                    <button 
                      onClick={clearRecording}
                      disabled={isUploading}
                      className="flex justify-center items-center p-3 bg-slate-100 dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-lg transition-colors"
                      title="Discard & Record Again"
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
          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500' 
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#16181d]'
      }`}
    >
      <div className={`p-2 rounded-lg ${active ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
        {icon}
      </div>
      <div className="font-semibold">{title}</div>
      <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
        {active && <div className="w-2 h-2 bg-white rounded-full"></div>}
      </div>
    </button>
  );
}
