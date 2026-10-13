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
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false, // System audio might not be supported on all browsers, we'll rely on mic
        });
        
        // If user clicks "Stop sharing" via browser UI, we should stop recording
        screenStream.getVideoTracks()[0].onended = () => {
          stopRecording();
        };

        screenStream.getTracks().forEach((track) => combinedStream.addTrack(track));
      }

      // 2. Get Camera/Mic Stream
      if (options.microphone || options.camera) {
        const avStream = await navigator.mediaDevices.getUserMedia({
          video: options.camera ? true : false,
          audio: options.microphone ? true : false,
        });
        
        avStream.getTracks().forEach((track) => {
          // If we are doing screen + camera, we might want both video tracks.
          // Note: MediaRecorder typically only records the first video track in standard formats like webm.
          // For a true picture-in-picture, we'd need to composite them onto a Canvas.
          // For an MVP, we'll just add the tracks and let the browser handle standard merging.
          combinedStream.addTrack(track);
        });
      }

      if (combinedStream.getTracks().length === 0) {
        throw new Error('No media tracks selected');
      }

      streamRef.current = combinedStream;

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm; codecs=vp8,opus'
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
      mediaRecorder.start(200); // chunk size in ms

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
    clearRecording
  };
};
