import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Download, Plus, Music, Trash2, Upload, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { Card, CardContent } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { apiClient, TrackMetadata, MixResponse } from '@/app/api/client';

interface Track {
  id: string;
  artist: string;
  title: string;
  file?: File | null;
  fileName?: string;
  startMs?: number;
  endMs?: number;
}

interface MixPlayerProps {
  mixId: string;
  initialData?: MixResponse;
  onBack: () => void;
}

export function MixPlayer({ mixId, initialData, onBack }: MixPlayerProps) {
  console.log("Current Mix ID:", mixId); // 터미널 조회를 위해 추가
  const [tracks, setTracks] = useState<Track[]>(() => {
    if (initialData?.tracklist) {
      return [...initialData.tracklist]
        .sort((a, b) => (a.start_ms || 0) - (b.start_ms || 0))
        .map((seg, idx) => ({
          id: `seg-${idx}`,
          artist: seg.artist_name || '알 수 없는 아티스트',
          title: seg.song_name || '제목 없음',
          startMs: seg.start_ms,
          endMs: seg.end_ms
        }));
    }
    return [];
  });
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true); // 자동 재생을 위해 true로 시작
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialData?.revision?.length_ms ? initialData.revision.length_ms / 1000 : 0);
  const [volume, setVolume] = useState(70);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [newTracks, setNewTracks] = useState<Array<{ id: string; artist: string; title: string; file: File | null; fileName: string }>>([
    { id: '1', artist: '', title: '', file: null, fileName: '' }
  ]);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialData?.revision?.audio_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [fetchErrorCount, setFetchErrorCount] = useState(0);
  const [currentRevisionNo, setCurrentRevisionNo] = useState<number | null>(initialData?.revision?.revision_no || null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollIntervalRef = useRef<any>(null);
  const tracksRef = useRef<Track[]>(tracks);

  // Keep tracksRef in sync with tracks
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const setupAudio = useCallback((url: string | null, lengthMs: number, preservePlaybackPosition: boolean = false) => {
    if (!url) return;

    let processedUrl = url;
    if (url.includes('15.165.41.165')) {
      try {
        const u = new URL(url);
        processedUrl = u.pathname + u.search;
      } catch (e) { }
    }

    const normalizePath = (u: string) => {
      if (!u) return "";
      let path = u.split('?')[0].split('#')[0];
      if (path.includes('://')) {
        try { path = new URL(path).pathname; } catch (e) { }
      }
      if (!path.startsWith('/')) path = '/' + path;
      if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
      return path;
    };

    const newPath = normalizePath(processedUrl);

    setAudioUrl(prev => {
      const currentPath = normalizePath(prev || "");
      if (currentPath !== newPath || !prev) {
        const finalUrl = `${processedUrl}${processedUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
        console.log("🎵 [AudioEngine] Source updated:", { from: currentPath, to: newPath, preservePosition: preservePlaybackPosition });

        // Save current playback state if requested
        if (preservePlaybackPosition && audioRef.current) {
          const savedTime = audioRef.current.currentTime;
          const savedTimeMs = savedTime * 1000;
          const wasPlaying = !audioRef.current.paused;

          // Find current track to preserve it across tracklist changes
          const currentTrack = tracksRef.current.find(t =>
            t.startMs !== undefined && t.endMs !== undefined &&
            savedTimeMs >= t.startMs && savedTimeMs < t.endMs
          );

          console.log("💾 Saving playback state:", {
            time: savedTime,
            playing: wasPlaying,
            currentTrack: currentTrack ? `${currentTrack.artist} - ${currentTrack.title}` : 'none',
            offsetInTrack: currentTrack && currentTrack.startMs !== undefined ? savedTimeMs - currentTrack.startMs : 0
          });

          // Restore position after new audio loads
          const restorePosition = () => {
            if (audioRef.current) {
              let targetTime = savedTime;

              // If we had a current track, try to find it in the new tracklist
              if (currentTrack) {
                const newTrack = tracksRef.current.find(t =>
                  t.title === currentTrack.title && t.artist === currentTrack.artist
                );

                if (newTrack && newTrack.startMs !== undefined && currentTrack.startMs !== undefined) {
                  // Calculate offset within the track
                  const offsetInTrack = savedTimeMs - currentTrack.startMs;
                  targetTime = (newTrack.startMs + offsetInTrack) / 1000;
                  console.log("🎯 Found same track in new position:", {
                    track: `${newTrack.artist} - ${newTrack.title}`,
                    oldStart: currentTrack.startMs,
                    newStart: newTrack.startMs,
                    offset: offsetInTrack,
                    targetTime
                  });
                }
              }

              audioRef.current.currentTime = targetTime;
              setCurrentTime(targetTime);
              if (wasPlaying) {
                audioRef.current.play().catch(e => console.warn("Auto-play blocked:", e));
              }
              console.log("▶️ Restored playback position:", targetTime);
              audioRef.current.removeEventListener('loadedmetadata', restorePosition);
            }
          };

          if (audioRef.current) {
            audioRef.current.addEventListener('loadedmetadata', restorePosition);
          }
        }

        return finalUrl;
      }
      return prev;
    });
    setDuration(lengthMs / 1000);
  }, []);

  const updateTrackData = useCallback((newTracklist: any[]) => {
    if (!newTracklist || newTracklist.length === 0) return;

    const mappedTracks: Track[] = [...newTracklist]
      .sort((a, b) => (a.start_ms || 0) - (b.start_ms || 0))
      .map((seg, idx) => ({
        id: `seg-${idx}`,
        artist: seg.artist_name || '알 수 없는 아티스트',
        title: seg.song_name || '제목 없음',
        startMs: seg.start_ms,
        endMs: seg.end_ms
      }));

    setTracks(prev => {
      if (JSON.stringify(mappedTracks) !== JSON.stringify(prev)) return mappedTracks;
      return prev;
    });
  }, []);

  const fetchMix = useCallback(async () => {
    try {
      // Step 1: Get current revision number
      const mix = await apiClient.getMix(mixId) as any;
      console.log("📡 Mix metadata:", mix);

      const readyRevisionNo = mix.current_ready_revision_no || mix.ready_revision_no;

      if (!readyRevisionNo) {
        console.log("⏳ No ready revision yet, will retry...");
        return;
      }

      // Step 2: Fetch the actual revision data with tracklist
      console.log(`📥 Fetching revision ${readyRevisionNo}...`);
      const revisionData = await apiClient.getMixRevision(mixId, readyRevisionNo) as any;
      console.log("📦 Revision data:", revisionData);

      // Extract tracks
      const rawTracks = revisionData.tracklist || revisionData.tracks || [];
      if (Array.isArray(rawTracks) && rawTracks.length > 0) {
        updateTrackData(rawTracks);
      }

      // Extract audio info
      const revision = revisionData.revision || revisionData;
      const urlToUse = revision.audio_url || revisionData.audio_url;
      const lengthToUse = revision.length_ms || revisionData.length_ms;
      const revisionNo = revision.revision_no || readyRevisionNo;

      if (urlToUse) {
        setIsLoading(false);
        setFetchErrorCount(0);

        // CRITICAL: Only update audio if revision actually changed
        // This prevents resetting playback position during polling
        const isNewRevision = revisionNo !== null && revisionNo !== currentRevisionNo;

        if (isNewRevision) {
          console.log("✨ New mix revision detected!", { oldRevision: currentRevisionNo, newRevision: revisionNo });
          // Pass true to preserve playback position (new tracks are added AFTER current position)
          setupAudio(urlToUse, lengthToUse || 0, true);
          setCurrentRevisionNo(revisionNo);
        } else {
          console.log("📌 Same revision, skipping audio reload", { revisionNo });
        }
      } else if (tracks.length > 0 || audioUrl) {
        setIsLoading(false);
      }
    } catch (e) {
      console.error("❌ Failed to fetch mix:", e);
      setFetchErrorCount(prev => prev + 1);
      if (tracks.length > 0 || audioUrl) setIsLoading(false);
    }
  }, [mixId, updateTrackData, setupAudio, currentRevisionNo, audioUrl]);

  useEffect(() => {
    fetchMix();
    const interval = setInterval(fetchMix, 2000);
    pollIntervalRef.current = interval;
    const safety = setTimeout(() => setIsLoading(false), 8000);
    return () => {
      clearInterval(interval);
      clearTimeout(safety);
    };
  }, [fetchMix]);

  // Track Index ref to avoid effect dependency re-runs
  const trackIdxRef = useRef(currentTrackIndex);
  useEffect(() => { trackIdxRef.current = currentTrackIndex; }, [currentTrackIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      audio.currentTime = 0;
      setCurrentTime(0);
      setCurrentTrackIndex(0);
    };

    let rafId: number | null = null;
    const handleTimeUpdate = () => {
      if (rafId !== null) return; // Already scheduled

      rafId = requestAnimationFrame(() => {
        rafId = null;
        const time = audio.currentTime;
        setCurrentTime(time);
        const timeMs = time * 1000;
        const idx = tracksRef.current.findIndex(t => t.startMs !== undefined && t.endMs !== undefined && timeMs >= t.startMs && timeMs < t.endMs);
        if (idx !== -1 && idx !== trackIdxRef.current) {
          setCurrentTrackIndex(idx);
        }
      });
    };

    const handleError = (e: any) => {
      console.error("Audio Engine Error:", audio.error);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (isPlaying && audio.paused) {
      audio.play().catch(e => {
        if (e.name === 'NotAllowedError') setIsAutoplayBlocked(true);
      });
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, audioUrl]);

  const handlePlayPause = () => setIsPlaying(!isPlaying);

  const handleNext = () => {
    console.log("⏭️ Next button clicked");
    const audio = audioRef.current;
    if (!audio || tracks.length === 0) {
      console.warn("❌ Cannot skip: no audio or no tracks", { hasAudio: !!audio, trackCount: tracks.length });
      return;
    }
    const timeMs = audio.currentTime * 1000;
    console.log("📍 Current position:", { timeMs, currentTime: audio.currentTime, readyState: audio.readyState });

    let currentIdx = tracks.findIndex(t => t.startMs !== undefined && t.endMs !== undefined && timeMs >= t.startMs && timeMs < t.endMs);

    if (currentIdx === -1) {
      const nextStartIdx = tracks.findIndex(t => t.startMs !== undefined && t.startMs > timeMs);
      currentIdx = nextStartIdx !== -1 ? nextStartIdx - 1 : tracks.length - 1;
    }

    const nextIdx = currentIdx + 1;
    console.log("🎯 Skipping to next track:", { currentIdx, nextIdx, totalTracks: tracks.length });

    if (nextIdx < tracks.length) {
      const seekTime = (tracks[nextIdx].startMs || 0) / 1000;
      console.log("⏩ Seeking to:", { track: tracks[nextIdx].title, seekTime, readyState: audio.readyState });

      // Ensure audio is ready before seeking
      if (audio.readyState >= 2) { // HAVE_CURRENT_DATA or better
        audio.currentTime = seekTime;
        console.log("✅ Seek applied immediately");
      } else {
        console.log("⏳ Waiting for audio to be ready...");
        const handleCanPlay = () => {
          audio.currentTime = seekTime;
          console.log("✅ Seek applied after ready");
          audio.removeEventListener('canplay', handleCanPlay);
        };
        audio.addEventListener('canplay', handleCanPlay);
      }

      if (!isPlaying) setIsPlaying(true);
    } else {
      console.log("🔚 Reached end of playlist, resetting");
      audio.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handlePrevious = () => {
    console.log("⏮️ Previous button clicked");
    const audio = audioRef.current;
    if (!audio || tracks.length === 0) {
      console.warn("❌ Cannot skip: no audio or no tracks", { hasAudio: !!audio, trackCount: tracks.length });
      return;
    }
    const timeMs = audio.currentTime * 1000;
    console.log("📍 Current position:", { timeMs, currentTime: audio.currentTime, readyState: audio.readyState });

    let currentIdx = tracks.findIndex(t => t.startMs !== undefined && t.endMs !== undefined && timeMs >= t.startMs && timeMs < t.endMs);

    if (currentIdx === -1) {
      const nextStartIdx = tracks.findIndex(t => t.startMs !== undefined && t.startMs > timeMs);
      currentIdx = nextStartIdx !== -1 ? nextStartIdx - 1 : 0;
    }

    if (currentIdx < 0) currentIdx = 0;
    const trackStart = tracks[currentIdx]?.startMs || 0;

    if (timeMs - trackStart > 3000) {
      const seekTime = trackStart / 1000;
      console.log("⏪ Restarting current track:", { track: tracks[currentIdx].title, seekTime });

      if (audio.readyState >= 2) {
        audio.currentTime = seekTime;
      } else {
        const handleCanPlay = () => {
          audio.currentTime = seekTime;
          audio.removeEventListener('canplay', handleCanPlay);
        };
        audio.addEventListener('canplay', handleCanPlay);
      }
    } else {
      const prevIdx = currentIdx - 1;
      if (prevIdx >= 0) {
        const seekTime = (tracks[prevIdx].startMs || 0) / 1000;
        console.log("⏪ Seeking to previous track:", { track: tracks[prevIdx].title, seekTime });

        if (audio.readyState >= 2) {
          audio.currentTime = seekTime;
        } else {
          const handleCanPlay = () => {
            audio.currentTime = seekTime;
            audio.removeEventListener('canplay', handleCanPlay);
          };
          audio.addEventListener('canplay', handleCanPlay);
        }

        if (!isPlaying) setIsPlaying(true);
      } else {
        console.log("🔚 Already at first track");
        audio.currentTime = 0;
      }
    }
  };

  const handleDownload = () => {
    if (audioUrl) window.open(audioUrl, '_blank');
    else alert('다운로드할 오디오가 없습니다.');
  };

  const addNewTrackSlot = () => {
    setNewTracks([...newTracks, { id: Date.now().toString(), artist: '', title: '', file: null, fileName: '' }]);
  };

  const removeNewTrack = (id: string) => {
    if (newTracks.length > 1) setNewTracks(newTracks.filter(track => track.id !== id));
  };

  const updateNewTrack = (id: string, field: 'artist' | 'title', value: string) => {
    setNewTracks(newTracks.map(track => track.id === id ? { ...track, [field]: value } : track));
  };

  const handleFileChangeForTrack = (id: string, file: File | null) => {
    setNewTracks(newTracks.map(track => track.id === id ? { ...track, file, fileName: file?.name || '' } : track));
  };

  const handleAddTracks = async () => {
    const validTracks = newTracks.filter(track => track.artist && track.title && track.file);
    if (validTracks.length > 0) {
      setIsUploading(true);
      try {
        const files: File[] = [];
        const metadatas: TrackMetadata[] = [];
        validTracks.forEach(t => { if (t.file) { files.push(t.file); metadatas.push({ artist: t.artist, title: t.title }); } });
        const playhead = Math.floor(currentTime * 1000);

        await apiClient.addTracksToMix(mixId, files, metadatas, playhead);

        alert("곡이 추가되었습니다. 새 믹스가 준비되는 대로 자동으로 반영됩니다.");
        setShowAddDialog(false);
        setNewTracks([{ id: '1', artist: '', title: '', file: null, fileName: '' }]);

        // [New] Resume polling to catch the new revision
        if (!pollIntervalRef.current) {
          console.log("🔄 Resuming polling for new mix revision...");
          fetchMix();
          pollIntervalRef.current = setInterval(fetchMix, 2000);
        }
      } catch (e) {
        console.error("Failed to add tracks:", e);
        alert("곡 추가 실패");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  if (isLoading && tracks.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="size-10 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8">
      {/* Hidden Audio Element - The Heart of Playback */}
      <audio
        ref={audioRef}
        src={audioUrl || ''}
        preload="auto"
        className="hidden"
      />

      <div className="max-w-6xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-6 text-gray-400 hover:text-white hover:bg-zinc-900">
          ← 뒤로
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Player Card */}
          <div className="lg:col-span-2">
            <Card className="bg-zinc-900 border-zinc-800 relative overflow-visible">
              <CardContent className="p-10 overflow-visible">
                {/* Volume Control - Top Right */}
                <div className="absolute top-6 right-6 z-50">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowVolumeControl(!showVolumeControl)}
                      className="text-gray-400 hover:text-cyan-400 hover:bg-zinc-800 transition-colors"
                    >
                      <Volume2 className="size-5" />
                    </Button>

                    {showVolumeControl && (
                      <div className="absolute top-12 right-0 w-12 bg-zinc-800 border border-cyan-500/30 rounded-lg p-2 shadow-[0_0_30px_rgba(34,211,238,0.3)] z-50">
                        <div className="flex flex-col items-center gap-2 h-36">
                          <span className="text-xs text-cyan-400 font-medium">{volume}%</span>
                          <Slider
                            value={[volume]}
                            max={100}
                            step={1}
                            onValueChange={(value) => setVolume(value[0])}
                            orientation="vertical"
                            className="!min-h-28 !h-28"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-10">
                  <div className="w-56 h-56 mx-auto mb-8 bg-zinc-800 border border-cyan-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.2)] relative overflow-hidden">
                    {isAutoplayBlocked ? (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-4">
                        <Button
                          onClick={() => {
                            if (audioRef.current) {
                              audioRef.current.play();
                              setIsPlaying(true);
                              setIsAutoplayBlocked(false);
                            }
                          }}
                          className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full p-6 shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                        >
                          재생 시작하기
                        </Button>
                      </div>
                    ) : null}
                    {!audioUrl ? (
                      <Loader2 className="size-24 text-cyan-400 animate-spin" />
                    ) : (
                      <Music className="size-24 text-cyan-400" />
                    )}
                  </div>
                  {audioUrl ? (
                    <>
                      <h2 className="text-4xl text-center mb-2 font-black tracking-tight">
                        <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                          {tracks.length > 0 ? (tracks[currentTrackIndex]?.title || '재생 중') : '곡 없음'}
                        </span>
                      </h2>
                      <p className="text-center text-gray-300 text-xl font-light">
                        {tracks.length > 0 ? (tracks[currentTrackIndex]?.artist || '') : ''}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-3xl text-center mb-3 text-cyan-400 animate-pulse font-bold">믹싱 중...</h2>
                      <p className="text-center text-gray-400 text-base">최적의 믹스를 구성하고 있습니다</p>
                      <p className="text-center text-gray-600 text-sm mt-4 mb-2">잠시만 기다려 주세요 (최대 30초)</p>
                      <div className="flex justify-center mt-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchMix()}
                          className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                        >
                          <RefreshCw className="size-4 mr-2" />
                          상태 새로고침
                        </Button>
                      </div>
                      {fetchErrorCount > 3 && (
                        <p className="text-center text-red-400 text-xs mt-4">서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.</p>
                      )}
                    </>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={1}
                    onValueChange={handleSeek}
                    disabled={!duration}
                    className="mb-3"
                  />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-6 mb-8">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevious}
                    className="text-gray-400 hover:text-white hover:bg-zinc-800 w-12 h-12"
                  >
                    <SkipBack className="size-6" />
                  </Button>

                  <Button
                    size="icon"
                    onClick={handlePlayPause}
                    disabled={!audioUrl}
                    className="size-20 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-full shadow-[0_0_30px_rgba(34,211,238,0.5)]"
                  >
                    {isPlaying ? <Pause className="size-9" /> : <Play className="size-9 ml-1" />}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNext}
                    className="text-gray-400 hover:text-white hover:bg-zinc-800 w-12 h-12"
                  >
                    <SkipForward className="size-6" />
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleDownload}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-gray-300 border border-zinc-700"
                  >
                    <Download className="size-4 mr-2" />
                    다운로드
                  </Button>

                  <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                      <Button className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-gray-300 border border-zinc-700">
                        <Plus className="size-4 mr-2" />
                        곡 추가
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-900 border-zinc-800 max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-white">새 곡 추가</DialogTitle>
                        <DialogDescription className="sr-only">
                          새로운 곡 정보를 입력하고 파일을 업로드하여 믹스에 추가합니다.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        {newTracks.map((track, index) => (
                          <div key={track.id} className="p-4 bg-black rounded-lg border border-zinc-800 space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-400">곡 {index + 1}</span>
                              {newTracks.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeNewTrack(track.id)}
                                  className="text-gray-500 hover:text-pink-400 hover:bg-pink-500/10 h-6 w-6"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">가수</label>
                              <Input
                                placeholder="가수 이름"
                                value={track.artist}
                                onChange={(e) => updateNewTrack(track.id, 'artist', e.target.value)}
                                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-600"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">곡 이름</label>
                              <Input
                                placeholder="곡 이름"
                                value={track.title}
                                onChange={(e) => updateNewTrack(track.id, 'title', e.target.value)}
                                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-600"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">파일</label>
                              <div className="relative">
                                <Input
                                  type="file"
                                  accept="audio/*"
                                  className="hidden"
                                  id={`file-${track.id}`}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleFileChangeForTrack(track.id, file);
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`file-${track.id}`}
                                  className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md cursor-pointer hover:border-cyan-500 transition-colors text-gray-300"
                                >
                                  <Upload className="size-4" />
                                  <span className="text-sm truncate">
                                    {track.fileName || '파일 선택'}
                                  </span>
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}

                        <Button
                          onClick={addNewTrackSlot}
                          className="w-full bg-zinc-800 hover:bg-zinc-700 text-gray-300 border border-zinc-700"
                        >
                          <Plus className="size-4 mr-2" />
                          곡 추가
                        </Button>

                        <Button
                          onClick={handleAddTracks}
                          disabled={newTracks.every(track => !track.artist || !track.title)}
                          className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              처리 중...
                            </>
                          ) : '모두 믹스에 추가'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Playlist */}
          <div>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-0">
                <Tabs defaultValue="tracks" className="w-full">
                  <TabsList className="grid w-full grid-cols-1 bg-zinc-800">
                    <TabsTrigger value="tracks" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-gray-400">
                      트랙 목록 ({tracks.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="tracks" className="p-4">
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {tracks.length === 0 ? (
                        <p className="text-sm text-gray-600 text-center py-8">트랙이 없습니다</p>
                      ) : (
                        tracks.map((track, index) => (
                          <div key={track.id || index} className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${index === currentTrackIndex ? 'bg-zinc-800 border border-cyan-500/30' : 'hover:bg-zinc-800'}`}>
                            <span className="text-xs text-gray-600 w-6 mt-1">{index + 1}</span>
                            <Music className={`size-4 flex-shrink-0 mt-1 ${index === currentTrackIndex ? 'text-cyan-400' : 'text-gray-600'}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${index === currentTrackIndex ? 'text-white' : 'text-gray-400'}`}>{track.title}</p>
                              <p className="text-xs text-gray-500 truncate">{track.artist}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}