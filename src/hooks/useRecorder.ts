import { useState, useRef, useCallback, useEffect } from 'react';

type RecordingOptions = {
  screen: boolean;
  microphone: boolean;
  camera: boolean;
};

export const useRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaBlobUrl, setMediaBlobUrl] = useState<string | null>(null);
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // We need to stop all tracks to fully release the hardware
  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async (options: RecordingOptions) => {
    try {
      setError(null);
      setMediaBlobUrl(null);
      setMediaBlob(null);
      mediaChunksRef.current = [];
      setRecordingTime(0);

      const combinedStream = new MediaStream();

      // 1. Get Screen Stream
      if (options.screen) {
        const displayMediaOptions = {
          video: {
            displaySurface: 'monitor',
            frameRate: { ideal: 12, max: 15 },
          },
          audio: true, // Capture system audio if shared by user
          selfBrowserSurface: 'include',
          surfaceSwitching: 'include',
          systemAudio: 'include',
        } as unknown as DisplayMediaStreamOptions;

        const screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
        
        // If user clicks "Stop sharing" via browser UI, stop recording
        screenStream.getVideoTracks()[0].onended = () => {
          stopRecording();
        };

        screenStream.getTracks().forEach((track) => combinedStream.addTrack(track));
      }

      // 2. Get Camera/Mic Stream
      // If screen is active, only add microphone audio to avoid conflicting video tracks
      const shouldGetCamera = options.camera && !options.screen;
      const shouldGetMic = options.microphone;

      if (shouldGetMic || shouldGetCamera) {
        const avStream = await navigator.mediaDevices.getUserMedia({
          video: shouldGetCamera ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 12, max: 15 } } : false,
          audio: shouldGetMic ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 16000 } : false,
        });
        
        avStream.getTracks().forEach((track) => {
          // If screen was already captured, only add audio tracks from getUserMedia
          if (options.screen && track.kind === 'video') return;
          combinedStream.addTrack(track);
        });
      }

      if (combinedStream.getTracks().length === 0) {
        throw new Error('No media tracks selected');
      }

      streamRef.current = combinedStream;

      const getOptimalMimeType = () => {
        const candidates = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp8',
          'video/webm',
        ];
        for (const c of candidates) {
          if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
        }
        return 'video/webm';
      };

      combinedStream.getVideoTracks().forEach((t) => {
        if ('contentHint' in t) {
          t.contentHint = 'detail';
        }
      });

      // Ultra-efficient storage compression: 16 kbps video + 6 kbps Opus voice
      // Exactly ~10 MB per 1 full 60-minute lecture (~340 KB for 2 minutes instead of 16 MB)
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: getOptimalMimeType(),
        videoBitsPerSecond: 16000,
        audioBitsPerSecond: 6000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setMediaBlob(blob);
        setMediaBlobUrl(url);
        stopAllTracks();
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // 1-second cluster chunk size

      setIsRecording(true);
      
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Permission denied to access screen or media devices.');
      } else if (err instanceof Error) {
        setError(err.message || 'An unknown error occurred while starting recording.');
      } else {
        setError('An unknown error occurred while starting recording.');
      }
      stopAllTracks();
    }
  }, [stopAllTracks, stopRecording]);

  const setMediaFile = useCallback((fileOrBlob: Blob) => {
    if (mediaBlobUrl) {
      URL.revokeObjectURL(mediaBlobUrl);
    }
    const url = URL.createObjectURL(fileOrBlob);
    setMediaBlob(fileOrBlob);
    setMediaBlobUrl(url);
    setError(null);
  }, [mediaBlobUrl]);

  const clearRecording = useCallback(() => {
    if (mediaBlobUrl) {
      URL.revokeObjectURL(mediaBlobUrl);
    }
    setMediaBlobUrl(null);
    setMediaBlob(null);
    mediaChunksRef.current = [];
    setRecordingTime(0);
    setError(null);
  }, [mediaBlobUrl]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAllTracks();
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaBlobUrl) URL.revokeObjectURL(mediaBlobUrl);
    };
  }, [stopAllTracks, mediaBlobUrl]);

  return {
    isRecording,
    recordingTime,
    mediaBlobUrl,
    mediaBlob,
    error,
    startRecording,
    stopRecording,
    clearRecording,
    setMediaFile,
  };
};
