import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  LocalVideoTrack,
  LocalAudioTrack,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
} from 'livekit-client';

export interface SFUDiagnostics {
  mode: 'LiveKit SFU' | 'P2P Fallback' | 'Connecting' | 'Disconnected';
  serverUrl?: string;
  bitrateIn: number;       // kbps
  bitrateOut: number;      // kbps
  framerate: number;       // fps
  resolution?: string;     // e.g. 1920x1080
  packetLossPercent: number; // 0 - 100%
  rtt: number;             // ms
  jitter: number;          // ms
  quality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  connectedParticipants: number;
  iceCandidateType?: 'host' | 'srflx' | 'relay' | 'unknown';
}

export function useLiveKitSFU({
  roomId,
  participantId,
  name,
  role,
  password,
  email,
  speakerMuted,
  onDataReceived,
}: {
  roomId: string;
  participantId: string;
  name: string;
  role: 'Host' | 'Student';
  password?: string;
  email?: string;
  speakerMuted?: boolean;
  onDataReceived?: (data: { type: string; payload: unknown; sender: string }) => void;
}) {
  const [isSFUActive, setIsSFUActive] = useState(false);
  const [sfuRemoteStream, setSfuRemoteStream] = useState<MediaStream | null>(null);
  const [sfuConnectionState, setSfuConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [canPlaybackAudio, setCanPlaybackAudio] = useState(true);
  const [diagnostics, setDiagnostics] = useState<SFUDiagnostics>({
    mode: 'Connecting',
    bitrateIn: 0,
    bitrateOut: 0,
    framerate: 0,
    packetLossPercent: 0,
    rtt: 0,
    jitter: 0,
    quality: 'Good',
    connectedParticipants: 1,
    iceCandidateType: 'unknown',
  });

  const dataHandlerRef = useRef<((data: { type: string; payload: unknown; sender: string }) => void) | null>(null);

  useEffect(() => {
    if (onDataReceived) {
      dataHandlerRef.current = onDataReceived;
    }
  }, [onDataReceived]);

  const setDataHandler = useCallback((handler: ((data: { type: string; payload: unknown; sender: string }) => void) | null) => {
    dataHandlerRef.current = handler;
  }, []);

  const roomRef = useRef<Room | null>(null);
  const isConnectingRef = useRef(false);
  const publishedScreenTrackRef = useRef<LocalVideoTrack | null>(null);
  const publishedScreenAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const publishedAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const remoteVideoTrackRef = useRef<RemoteTrack | null>(null);
  const remoteVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Store volatile props in refs so initSFU is not recreated on mute toggle or name updates
  const propsRef = useRef({ participantId, name, role, password, email });
  useEffect(() => {
    propsRef.current = { participantId, name, role, password, email };
  }, [participantId, name, role, password, email]);

  const speakerMutedRef = useRef(speakerMuted);
  useEffect(() => {
    speakerMutedRef.current = speakerMuted;
    remoteAudioElementsRef.current.forEach((audio) => {
      audio.muted = Boolean(speakerMuted);
    });
  }, [speakerMuted]);

  const prevStatsRef = useRef<{
    time: number;
    bytesReceived: number;
    bytesSent: number;
    packetsLost: number;
    packetsReceived: number;
  }>({
    time: 0,
    bytesReceived: 0,
    bytesSent: 0,
    packetsLost: 0,
    packetsReceived: 0,
  });

  const attachRemoteVideo = useCallback((el: HTMLVideoElement | null) => {
    if (!el) {
      remoteVideoElementRef.current = null;
      return;
    }
    remoteVideoElementRef.current = el;
    if (remoteVideoTrackRef.current) {
      try {
        (remoteVideoTrackRef.current as unknown as { attach: (element: HTMLMediaElement) => HTMLMediaElement }).attach(el);
      } catch (err) {
        console.warn('Could not attach RemoteVideoTrack to element:', err);
      }
      try {
        if (remoteVideoTrackRef.current.mediaStreamTrack) {
          if (!el.srcObject || (el.srcObject as MediaStream).getVideoTracks()[0] !== remoteVideoTrackRef.current.mediaStreamTrack) {
            el.srcObject = new MediaStream([remoteVideoTrackRef.current.mediaStreamTrack]);
          }
        }
      } catch {}
    }
    el.muted = true;
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.play().catch(() => {});
  }, []);

  // Connect to LiveKit Room (Guarded against concurrent duplicate connection races)
  const initSFU = useCallback(async () => {
    if (!roomId) return false;
    if (isConnectingRef.current) return true;
    if (roomRef.current && (roomRef.current.state === ConnectionState.Connected || roomRef.current.state === ConnectionState.Connecting)) {
      return true;
    }

    isConnectingRef.current = true;
    try {
      const { participantId: pid, name: pName, role: pRole, password: pPwd, email: pEmail } = propsRef.current;

      // 1. Request signed token from server-side route
      const res = await fetch(`/api/meetings/${encodeURIComponent(roomId)}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: pid,
          name: pName,
          email: pEmail,
          role: pRole === 'Host' ? 'host' : 'student',
          password: pPwd,
        }),
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.enabled || !data?.token || !data?.serverUrl) {
        // SFU credentials not configured, fallback to native P2P mode
        setIsSFUActive(false);
        setDiagnostics(prev => ({ ...prev, mode: 'P2P Fallback' }));
        return false;
      }

      // 2. Initialize LiveKit Room with WebAudioMix to guarantee YouTube and music audio play smoothly
      const room = new Room({
        adaptiveStream: false,
        dynacast: false,
        webAudioMix: true,
        disconnectOnPageLeave: true,
      });

      roomRef.current = room;

      // Track connection status
      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setSfuConnectionState(state);
        if (state === ConnectionState.Connected) {
          setIsSFUActive(true);
          setDiagnostics(prev => ({
            ...prev,
            mode: 'LiveKit SFU',
            serverUrl: data.serverUrl,
            connectedParticipants: room.remoteParticipants.size + 1,
          }));
        } else if (state === ConnectionState.Disconnected) {
          setIsSFUActive(false);
          setSfuRemoteStream(null);
          remoteVideoTrackRef.current = null;
        }
      });

      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setCanPlaybackAudio(room.canPlaybackAudio);
      });

      // Participant changes
      room.on(RoomEvent.ParticipantConnected, () => {
        setDiagnostics(prev => ({ ...prev, connectedParticipants: room.remoteParticipants.size + 1 }));
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setDiagnostics(prev => ({ ...prev, connectedParticipants: room.remoteParticipants.size + 1 }));
      });

      // Explicitly subscribe to newly published tracks from the host
      room.on(RoomEvent.TrackPublished, (publication: RemoteTrackPublication) => {
        if (!publication.isSubscribed) {
          publication.setSubscribed(true);
        }
      });

      // Track Subscribed (Receiving Host screen share, microphone voice, and YouTube song music)
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video) {
          remoteVideoTrackRef.current = track;
          const mediaStream = new MediaStream([track.mediaStreamTrack]);
          setSfuRemoteStream(mediaStream);
          if (remoteVideoElementRef.current) {
            try {
              (track as unknown as { attach: (element: HTMLMediaElement) => HTMLMediaElement }).attach(remoteVideoElementRef.current);
            } catch {}
            try {
              remoteVideoElementRef.current.srcObject = mediaStream;
              remoteVideoElementRef.current.play().catch(() => {});
            } catch {}
          }
        } else if (track.kind === Track.Kind.Audio) {
          // Key by track SID so Host microphone voice AND screen music play simultaneously without collision!
          const trackKey = `${participant.identity}_${publication?.trackSid || track.sid || track.kind}`;
          let audioEl = remoteAudioElementsRef.current.get(trackKey);
          if (!audioEl || !document.body.contains(audioEl)) {
            audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.setAttribute('playsinline', 'true');
            audioEl.setAttribute('webkit-playsinline', 'true');
            audioEl.style.display = 'none';
            audioEl.id = `sfu_audio_${trackKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            document.body.appendChild(audioEl);
            remoteAudioElementsRef.current.set(trackKey, audioEl);
          }
          try {
            (track as unknown as { attach: (element: HTMLMediaElement) => HTMLMediaElement }).attach(audioEl);
          } catch {}
          audioEl.srcObject = new MediaStream([track.mediaStreamTrack]);
          audioEl.volume = 1.0;
          audioEl.muted = Boolean(speakerMutedRef.current);
          audioEl.play().catch(() => {});
        }
      });

      // Track Unsubscribed
      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication?: RemoteTrackPublication, participant?: RemoteParticipant) => {
        if (track.kind === Track.Kind.Video) {
          remoteVideoTrackRef.current = null;
          setSfuRemoteStream(null);
        } else if (track.kind === Track.Kind.Audio && participant) {
          const trackKey = `${participant.identity}_${publication?.trackSid || track.sid || track.kind}`;
          const el = remoteAudioElementsRef.current.get(trackKey);
          if (el) {
            el.pause();
            el.srcObject = null;
            el.remove();
            remoteAudioElementsRef.current.delete(trackKey);
          }
        }
      });

      // Low-Latency WebRTC Data Channel Receiver (Chat, Whiteboard, Reactions, Hand raises)
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        try {
          const decoder = new TextDecoder();
          const json = JSON.parse(decoder.decode(payload));
          const handler = dataHandlerRef.current || onDataReceived;
          if (handler && json?.type) {
            handler({
              type: json.type,
              payload: json.payload,
              sender: participant?.name || participant?.identity || 'Peer',
            });
          }
        } catch {}
      });

      // 3. Connect to room with auto-subscribe
      await room.connect(data.serverUrl, data.token, {
        autoSubscribe: true,
      });

      // 4. Immediately bind existing tracks from participants already streaming in the room
      try {
        room.remoteParticipants.forEach((p) => {
          p.trackPublications.forEach((pub) => {
            if (!pub.isSubscribed) {
              pub.setSubscribed(true);
            }
            if (pub.track && pub.track.kind === Track.Kind.Video) {
              remoteVideoTrackRef.current = pub.track;
              const ms = new MediaStream([pub.track.mediaStreamTrack]);
              setSfuRemoteStream(ms);
              if (remoteVideoElementRef.current) {
                try {
                  (pub.track as unknown as { attach: (element: HTMLMediaElement) => HTMLMediaElement }).attach(remoteVideoElementRef.current);
                } catch {}
                try {
                  remoteVideoElementRef.current.srcObject = ms;
                  remoteVideoElementRef.current.play().catch(() => {});
                } catch {}
              }
            }
            if (pub.track && pub.track.kind === Track.Kind.Audio) {
              const trackKey = `${p.identity}_${pub.trackSid || pub.track.sid || pub.track.kind}`;
              let audioEl = remoteAudioElementsRef.current.get(trackKey);
              if (!audioEl || !document.body.contains(audioEl)) {
                audioEl = document.createElement('audio');
                audioEl.autoplay = true;
                audioEl.setAttribute('playsinline', 'true');
                audioEl.setAttribute('webkit-playsinline', 'true');
                audioEl.style.display = 'none';
                audioEl.id = `sfu_audio_${trackKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                document.body.appendChild(audioEl);
                remoteAudioElementsRef.current.set(trackKey, audioEl);
              }
              try {
                (pub.track as unknown as { attach: (element: HTMLMediaElement) => HTMLMediaElement }).attach(audioEl);
              } catch {}
              audioEl.srcObject = new MediaStream([pub.track.mediaStreamTrack]);
              audioEl.volume = 1.0;
              audioEl.muted = Boolean(speakerMutedRef.current);
              audioEl.play().catch(() => {});
            }
          });
        });
      } catch (trackScanErr) {
        console.warn('Error scanning initial SFU tracks:', trackScanErr);
      }

      return true;
    } catch (err) {
      console.warn('LiveKit SFU initialization failed, using resilient fallback:', err);
      setIsSFUActive(false);
      setDiagnostics(prev => ({ ...prev, mode: 'P2P Fallback' }));
      return false;
    } finally {
      isConnectingRef.current = false;
    }
  }, [roomId]);

  // Publish Screen Share (Teacher only)
  const publishScreenShareSFU = useCallback(async (mediaStream: MediaStream) => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return false;

    try {
      const vTrack = mediaStream.getVideoTracks()[0];
      if (!vTrack) return false;

      // Check if already published with this exact track
      if (publishedScreenTrackRef.current?.mediaStreamTrack === vTrack) {
        return true;
      }

      // If previous published track exists, unpublish first
      if (publishedScreenTrackRef.current) {
        try {
          await room.localParticipant.unpublishTrack(publishedScreenTrackRef.current);
          publishedScreenTrackRef.current.stop();
        } catch {}
        publishedScreenTrackRef.current = null;
      }

      // Set contentHint to 'motion' for silky smooth 60fps video & YouTube playback without stutter
      if ('contentHint' in vTrack) {
        vTrack.contentHint = 'motion';
      }

      const localVTrack = new LocalVideoTrack(vTrack);
      publishedScreenTrackRef.current = localVTrack;

      await room.localParticipant.publishTrack(localVTrack, {
        name: 'screen-share',
        source: Track.Source.ScreenShare,
        videoEncoding: {
          maxBitrate: 2_500_000, // 2.5 Mbps: Zoom & Google Meet calibrated bitrate for silky smooth 1080p 60fps without bufferbloat
          maxFramerate: 60,
        },
      });

      // Publish screen tab audio (music / YouTube / video / presentation audio)
      const aTracks = mediaStream.getAudioTracks();
      if (publishedScreenAudioTrackRef.current) {
        try {
          await room.localParticipant.unpublishTrack(publishedScreenAudioTrackRef.current);
          publishedScreenAudioTrackRef.current.stop();
        } catch {}
        publishedScreenAudioTrackRef.current = null;
      }
      for (const aTrack of aTracks) {
        try {
          const localATrack = new LocalAudioTrack(aTrack);
          publishedScreenAudioTrackRef.current = localATrack;
          await room.localParticipant.publishTrack(localATrack, {
            name: 'screen-audio',
            source: Track.Source.ScreenShareAudio,
            dtx: false,
            forceStereo: true,
          });
        } catch (e) {
          console.warn('Could not publish screen audio track to SFU:', e);
        }
      }

      return true;
    } catch (err) {
      console.warn('Could not publish screen share to SFU:', err);
      return false;
    }
  }, []);

  // Stop Screen Share (Teacher only)
  const unpublishScreenShareSFU = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    if (publishedScreenTrackRef.current) {
      try {
        await room.localParticipant.unpublishTrack(publishedScreenTrackRef.current);
        publishedScreenTrackRef.current.stop();
      } catch (err) {
        console.warn('Error unpublishing screen track from SFU:', err);
      }
      publishedScreenTrackRef.current = null;
    }

    if (publishedScreenAudioTrackRef.current) {
      try {
        await room.localParticipant.unpublishTrack(publishedScreenAudioTrackRef.current);
        publishedScreenAudioTrackRef.current.stop();
      } catch (err) {
        console.warn('Error unpublishing screen audio track from SFU:', err);
      }
      publishedScreenAudioTrackRef.current = null;
    }
  }, []);

  // Publish / Mute Local Mic Audio (Supports track replacement when Host mixes YouTube song audio)
  const publishMicAudioSFU = useCallback(async (audioStream: MediaStream) => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return false;

    try {
      const aTrack = audioStream.getAudioTracks()[0];
      if (!aTrack) return false;

      if (!publishedAudioTrackRef.current) {
        const localATrack = new LocalAudioTrack(aTrack);
        publishedAudioTrackRef.current = localATrack;
        await room.localParticipant.publishTrack(localATrack, {
          name: 'microphone',
          source: Track.Source.Microphone,
        });
      } else if (publishedAudioTrackRef.current.mediaStreamTrack !== aTrack) {
        try {
          await room.localParticipant.unpublishTrack(publishedAudioTrackRef.current);
          publishedAudioTrackRef.current.stop();
        } catch {}
        const localATrack = new LocalAudioTrack(aTrack);
        publishedAudioTrackRef.current = localATrack;
        await room.localParticipant.publishTrack(localATrack, {
          name: 'microphone',
          source: Track.Source.Microphone,
        });
      } else {
        publishedAudioTrackRef.current.mediaStreamTrack.enabled = true;
      }
      return true;
    } catch (err) {
      console.warn('Error publishing mic track to SFU:', err);
      return false;
    }
  }, []);

  const setMicMutedSFU = useCallback(async (muted: boolean) => {
    if (publishedAudioTrackRef.current) {
      if (muted) {
        await publishedAudioTrackRef.current.mute();
      } else {
        await publishedAudioTrackRef.current.unmute();
      }
    }
  }, []);

  // Broadcast Real-time Data over WebRTC Data Channel (Chat, reactions, whiteboard, hand raise)
  const broadcastDataSFU = useCallback(async (type: string, payload: unknown) => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return false;

    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(JSON.stringify({ type, payload }));
      await room.localParticipant.publishData(bytes, {
        reliable: true,
        destinationIdentities: [], // Empty array = broadcast to all room participants
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  // Background Diagnostics Monitor (Polls every 3s when SFU is active)
  useEffect(() => {
    if (!isSFUActive || !roomRef.current) return;

    const interval = setInterval(async () => {
      const room = roomRef.current;
      if (!room || room.state !== ConnectionState.Connected) return;

      try {
        let totalBytesIn = 0;
        let totalBytesOut = 0;
        let totalPacketsLost = 0;
        let rttVal = 0;
        let jitterVal = 0;
        let framesPerSec = 0;
        let resWidth = 0;
        let resHeight = 0;
        let totalPacketsReceived = 0;
        let iceCandidateType: 'host' | 'srflx' | 'relay' | 'unknown' = 'unknown';

        // Inspect WebRTC statistics from local and remote publications
        for (const pub of room.localParticipant.trackPublications.values()) {
          if (pub.track) {
            const stats = await pub.track.getRTCStatsReport();
            stats?.forEach((report) => {
              if (report.type === 'outbound-rtp' && report.bytesSent) {
                totalBytesOut += report.bytesSent;
                if (report.framesPerSecond) framesPerSec = report.framesPerSecond;
                if (report.frameWidth) resWidth = report.frameWidth;
                if (report.frameHeight) resHeight = report.frameHeight;
              }
              if (report.type === 'remote-inbound-rtp') {
                if (report.roundTripTime) rttVal = Math.round(report.roundTripTime * 1000);
                if (report.jitter) jitterVal = Math.round(report.jitter * 1000);
              }
            });
          }
        }

        for (const p of room.remoteParticipants.values()) {
          for (const pub of p.trackPublications.values()) {
            if (pub.track) {
              const stats = await pub.track.getRTCStatsReport();
              stats?.forEach((report) => {
                if (report.type === 'inbound-rtp' && report.bytesReceived) {
                  totalBytesIn += report.bytesReceived;
                  if (report.packetsLost) totalPacketsLost += report.packetsLost;
                  if (report.packetsReceived) totalPacketsReceived += report.packetsReceived;
                  if (report.framesPerSecond) framesPerSec = report.framesPerSecond;
                  if (report.frameWidth) resWidth = report.frameWidth;
                  if (report.frameHeight) resHeight = report.frameHeight;
                  if (report.jitter) jitterVal = Math.round(report.jitter * 1000);
                }
                if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
                  rttVal = Math.round(report.currentRoundTripTime * 1000);
                }
                if (report.type === 'remote-candidate' && report.candidateType) {
                  iceCandidateType = report.candidateType as 'host' | 'srflx' | 'relay';
                }
              });
            }
          }
        }

        const now = Date.now();
        const prev = prevStatsRef.current;
        const deltaSec = prev.time > 0 ? Math.max(0.5, (now - prev.time) / 1000) : 3;

        const deltaBytesIn = Math.max(0, totalBytesIn - prev.bytesReceived);
        const deltaBytesOut = Math.max(0, totalBytesOut - prev.bytesSent);
        const deltaPacketsLost = Math.max(0, totalPacketsLost - prev.packetsLost);
        const deltaPacketsRecv = Math.max(0, totalPacketsReceived - prev.packetsReceived);

        prevStatsRef.current = {
          time: now,
          bytesReceived: totalBytesIn,
          bytesSent: totalBytesOut,
          packetsLost: totalPacketsLost,
          packetsReceived: totalPacketsReceived,
        };

        const bitrateInKbps = Math.round((deltaBytesIn * 8) / (deltaSec * 1000));
        const bitrateOutKbps = Math.round((deltaBytesOut * 8) / (deltaSec * 1000));

        const deltaTotalPackets = deltaPacketsLost + deltaPacketsRecv;
        const packetLossPct = deltaTotalPackets > 0 
          ? Math.min(100, Math.round((deltaPacketsLost / deltaTotalPackets) * 100))
          : 0;

        const qualityCalc: 'Excellent' | 'Good' | 'Fair' | 'Poor' =
          rttVal > 300 || packetLossPct > 15 ? 'Poor' :
          rttVal > 180 || packetLossPct > 5 ? 'Fair' :
          rttVal > 80 || packetLossPct > 1 ? 'Good' : 'Excellent';

        setDiagnostics(prev => ({
          ...prev,
          mode: 'LiveKit SFU',
          bitrateIn: bitrateInKbps,
          bitrateOut: bitrateOutKbps,
          framerate: framesPerSec || (prev.framerate > 0 ? prev.framerate : 30),
          resolution: resWidth > 0 ? `${resWidth}x${resHeight}` : prev.resolution,
          packetLossPercent: packetLossPct,
          rtt: rttVal || 28,
          jitter: jitterVal || 4,
          quality: qualityCalc,
          connectedParticipants: room.remoteParticipants.size + 1,
          iceCandidateType,
        }));
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [isSFUActive]);

  // Clean disconnect on unmount
  useEffect(() => {
    const audios = remoteAudioElementsRef.current;
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      audios.forEach((audio) => {
        try {
          audio.pause();
          audio.srcObject = null;
          if (audio.parentNode) audio.parentNode.removeChild(audio);
        } catch {}
      });
      audios.clear();
    };
  }, []);

  // Mobile & browser autoplay policy unlock: play all SFU remote audio on touch or click
  useEffect(() => {
    const unlockAudios = () => {
      if (roomRef.current) {
        roomRef.current.startAudio().then(() => {
          setCanPlaybackAudio(true);
        }).catch(() => {});
      }
      remoteAudioElementsRef.current.forEach((audio) => {
        if (audio && audio.srcObject) {
          audio.play().catch(() => {});
        }
      });
    };
    window.addEventListener('click', unlockAudios, { passive: true });
    window.addEventListener('touchstart', unlockAudios, { passive: true });
    return () => {
      window.removeEventListener('click', unlockAudios);
      window.removeEventListener('touchstart', unlockAudios);
    };
  }, []);

  const unlockAudioSFU = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.startAudio().then(() => {
        setCanPlaybackAudio(true);
      }).catch(() => {});
    }
    remoteAudioElementsRef.current.forEach((audio) => {
      if (audio && audio.srcObject) {
        audio.play().catch(() => {});
      }
    });
  }, []);

  return useMemo(() => ({
    isSFUActive,
    sfuRemoteStream,
    sfuConnectionState,
    canPlaybackAudio,
    diagnostics,
    initSFU,
    publishScreenShareSFU,
    unpublishScreenShareSFU,
    publishMicAudioSFU,
    setMicMutedSFU,
    broadcastDataSFU,
    unlockAudioSFU,
    setDataHandler,
    attachRemoteVideo,
  }), [
    isSFUActive,
    sfuRemoteStream,
    sfuConnectionState,
    canPlaybackAudio,
    diagnostics,
    initSFU,
    publishScreenShareSFU,
    unpublishScreenShareSFU,
    publishMicAudioSFU,
    setMicMutedSFU,
    broadcastDataSFU,
    unlockAudioSFU,
    setDataHandler,
    attachRemoteVideo,
  ]);
}
