import { useState, useRef, useEffect } from 'react';
import { Volume2, Plus, Music, Users, ArrowLeft, Send, Trash2, Upload, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { Card, CardContent } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import type { Room } from './radio-list';
import { apiClient, TrackMetadata } from '@/app/api/client';

// WebSocket types
interface WSRoomSnapshot {
  type: 'room_snapshot';
  your_name: string;
  room: {
    room_id: string;
    name: string;
    created_at: string;
    participant_count: number;
  };
  play_started_at_epoch_ms: number;
  server_now_epoch_ms: number;
  current_revision?: {
    revision_no: number;
    switchover_ms: number;
    length_ms: number;
    audio_url: string;
  };
  tracklist: WSTrackSegment[];
  chat_recent: WSChatMessage[];
}

interface WSTrackSegment {
  position: number;
  start_ms: number;
  end_ms: number;
  source_start_ms: number;
  song_name: string;
  artist_name: string;
  sender_name?: string; // 업로더 이름 필드 추가
}

interface WSChatMessage {
  type: 'chat_message';
  seq?: number;
  sender_name: string;
  message: string;
  created_at: string;
}

interface WSParticipantCount {
  type: 'participant_count_update';
  participant_count: number;
}

interface WSRevisionReady {
  type: 'revision_ready';
  revision: {
    revision_no: number;
    switchover_ms: number;
    length_ms: number;
    audio_url: string;
  };
  tracklist: WSTrackSegment[];
}

type WSMessage = WSRoomSnapshot | WSChatMessage | WSParticipantCount | WSRevisionReady;

interface Track {
  id: string;
  artist: string;
  title: string;
  addedBy?: string;
  file?: File;
  fileName?: string;
}

interface Message {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
}

interface RadioRoomProps {
  room: Room;
  onBack: () => void;
}

export function RadioRoom({ room, onBack }: RadioRoomProps) {
  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // UI State
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [wsError, setWsError] = useState<string | null>(null);
  const [localRoom, setLocalRoom] = useState<Room>(room);

  // Data State
  const [myUsername, setMyUsername] = useState<string>('');
  const [userCount, setUserCount] = useState(Math.max(localRoom.participant_count || 0, 1));
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [upcomingTracks, setUpcomingTracks] = useState<Track[]>([]);
  const [playedTracks, setPlayedTracks] = useState<Track[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  // Input State
  const [chatMessage, setChatMessage] = useState('');
  const [newTracks, setNewTracks] = useState<Array<{ id: string; artist: string; title: string; file: File | null; fileName: string }>>([
    { id: '1', artist: '', title: '', file: null, fileName: '' }
  ]);

  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for stable time/track sync
  const serverTimeOffsetRef = useRef<number>(0);
  const playStartedAtRef = useRef<number>(0);
  const tracklistRef = useRef<WSTrackSegment[]>([]);

  const getSvrNow = () => Date.now() + serverTimeOffsetRef.current;

  // Initialize WebSocket
  useEffect(() => {
    const BACKEND_IP = '3.35.71.175';
    if (!room?.room_id) {
      setWsError('방 정보를 찾을 수 없습니다.');
      return;
    }
    const wsUrl = `ws://${BACKEND_IP}/v1/rooms/${room.room_id}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        setWsError('연결 시간이 초과되었습니다.');
        setWsStatus('closed');
        ws.close();
      }
    }, 5000);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      setWsStatus('open');
      setWsError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        handleWSMessage(data);
      } catch (e) {
        console.error('Failed to parse WS message:', e);
      }
    };

    ws.onerror = () => setWsError('서버 연결 중 오류 발생');
    ws.onclose = () => setWsStatus('closed');

    return () => {
      clearTimeout(connectionTimeout);
      ws.close();
      if (audioRef.current) audioRef.current.pause();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [room.room_id]);

  // Sync Input States
  useEffect(() => {
    if (!showAddDialog) {
      setNewTracks([{ id: '1', artist: '', title: '', file: null, fileName: '' }]);
    }
  }, [showAddDialog]);

  // Audio Playback Logic
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    // Update volume
    audio.volume = volume / 100;

    // Audio error handling
    audio.onerror = () => {
      const errorNames = ["UNKNOWN", "MEDIA_ERR_ABORTED", "MEDIA_ERR_NETWORK", "MEDIA_ERR_DECODE", "MEDIA_ERR_SRC_NOT_SUPPORTED"];
      const code = audio.error?.code || 0;
      console.error(`Radio Audio internal error: ${errorNames[code]} (${code})`, {
        src: audio.src,
        error: audio.error
      });
    };

    if (isPlaying && audio.paused && audio.src) {
      // Small delay to ensure browser processed src
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsAutoplayBlocked(false);
          })
          .catch(e => {
            console.warn("Playback blocked or failed", e);
            if (e.name === 'NotAllowedError') {
              setIsAutoplayBlocked(true);
            }
          });
      }
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, volume, currentAudioUrl]);

  // Fetch Room Status periodically as fallback
  useEffect(() => {
    const fetchRoomUpdate = async () => {
      try {
        const roomsRes = await apiClient.getRooms();
        // Map the new nested structure back to Room objects for searching
        const allRooms = roomsRes.rooms.map(item => item.room);
        const found = allRooms.find(r => r.room_id === room.room_id);
        if (found) {
          setLocalRoom(found);
          setUserCount(prev => Math.max(prev, found.participant_count));
        }
      } catch (e) {
        console.error("Failed to fetch room update", e);
      }
    };
    fetchRoomUpdate();
    const pollInterval = setInterval(fetchRoomUpdate, 15000); // 15s fallback
    return () => clearInterval(pollInterval);
  }, [room.room_id]);

  // Sync Timer & UI Update
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
          // Periodically update track progress based on time
          updateTrackInfo(tracklistRef.current, playStartedAtRef.current, getSvrNow());
        }
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  const handleWSMessage = (data: WSMessage) => {
    switch (data.type) {
      case 'room_snapshot':
        setMyUsername(data.your_name);
        setUserCount(data.room.participant_count);

        serverTimeOffsetRef.current = data.server_now_epoch_ms - Date.now();
        playStartedAtRef.current = data.play_started_at_epoch_ms;
        tracklistRef.current = data.tracklist;

        const history = data.chat_recent.map((msg, idx) => ({
          id: `hist-${idx}`,
          username: msg.sender_name,
          message: msg.message,
          timestamp: new Date(msg.created_at)
        }));
        setMessages(history);

        if (data.current_revision) {
          setupAudio(data.current_revision.audio_url, data.current_revision.length_ms);
        }

        // Always update track info if list exists, even without active revision
        if (data.tracklist) {
          updateTrackInfo(data.tracklist, playStartedAtRef.current, getSvrNow());
        }
        break;

      case 'chat_message':
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          username: data.sender_name,
          message: data.message,
          timestamp: new Date(data.created_at)
        }]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        break;

      case 'participant_count_update':
        setUserCount(data.participant_count);
        break;

      case 'revision_ready':
        if (audioRef.current && audioRef.current.src !== data.revision.audio_url) {
          // Keep using the existing playStartedAtRef.current for live sync
          const nowSvr = getSvrNow();
          tracklistRef.current = data.tracklist;

          updateTrackInfo(data.tracklist, playStartedAtRef.current, nowSvr);
          setupAudio(data.revision.audio_url, data.revision.length_ms);
        }
        break;
    }
  };

  const syncPlaybackToLive = (durationSecOverride?: number) => {
    if (!audioRef.current || !playStartedAtRef.current) return;
    const audio = audioRef.current;

    // Use state duration or override if called during setupAudio
    const durSec = durationSecOverride !== undefined ? durationSecOverride : duration;
    if (durSec <= 0) return;

    const nowSvr = getSvrNow();
    const realElapsedMs = nowSvr - playStartedAtRef.current;
    const seekTime = Math.max(0, realElapsedMs / 1000);

    console.log("Syncing to Live:", { nowSvr, playStartedAt: playStartedAtRef.current, realElapsedMs, seekTime, durSec });

    if (seekTime < durSec) {
      audio.currentTime = seekTime;
      setCurrentTime(seekTime);
      setIsPlaying(true);
      setIsAutoplayBlocked(false);
    } else {
      setIsPlaying(false);
    }
  };

  const setupAudio = (url: string, durationMs: number) => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    // Use relative path to let Vite proxy handle it
    let finalUrl = url;

    console.log("Setting Radio Audio Source:", finalUrl);

    if (audio.src !== finalUrl) {
      audio.src = finalUrl;
      audio.load();
    }
    setCurrentAudioUrl(finalUrl);
    setDuration(durationMs / 1000);

    const durSec = durationMs / 1000;

    if (audio.readyState >= 1) {
      syncPlaybackToLive(durSec);
    } else {
      audio.onloadedmetadata = () => {
        syncPlaybackToLive(durSec);
        audio.onloadedmetadata = null;
      };
    }
  };

  const updateTrackInfo = (tracklist: WSTrackSegment[], playStartedAt: number, serverNow: number) => {
    const elapsedMs = serverNow - playStartedAt;
    const sorted = [...tracklist].sort((a, b) => a.start_ms - b.start_ms);

    const played: Track[] = [];
    const upcoming: Track[] = [];
    let current: Track | null = null;

    const activeIdx = sorted.findIndex(t => elapsedMs >= t.start_ms && elapsedMs < t.end_ms);

    if (activeIdx >= 0) {
      const t = sorted[activeIdx];
      current = {
        id: `seg-${t.position}`,
        title: t.song_name,
        artist: t.artist_name,
        addedBy: t.sender_name || '시스템'
      };

      for (let i = 0; i < activeIdx; i++) {
        const t = sorted[i];
        played.push({
          id: `seg-${t.position}`,
          title: t.song_name,
          artist: t.artist_name,
          addedBy: t.sender_name || '시스템'
        });
      }
      for (let i = activeIdx + 1; i < sorted.length; i++) {
        const t = sorted[i];
        upcoming.push({
          id: `seg-${t.position}`,
          title: t.song_name,
          artist: t.artist_name,
          addedBy: t.sender_name || '시스템'
        });
      }
    } else {
      if (sorted.length > 0 && elapsedMs < sorted[0].start_ms) {
        upcoming.push(...sorted.map(s => ({
          id: `seg-${s.position}`,
          title: s.song_name,
          artist: s.artist_name,
          addedBy: s.sender_name || '시스템'
        })));
      } else {
        played.push(...sorted.map(s => ({
          id: `seg-${s.position}`,
          title: s.song_name,
          artist: s.artist_name,
          addedBy: s.sender_name || '시스템'
        })));
      }
    }

    setCurrentTrack(current);
    setPlayedTracks(played);
    setUpcomingTracks(upcoming);
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleSendMessage = (message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_send',
        message: message
      }));
      setChatMessage('');
    }
  };

  const addNewTrackSlot = () => {
    setNewTracks([
      ...newTracks,
      { id: Date.now().toString(), artist: '', title: '', file: null, fileName: '' }
    ]);
  };

  const removeNewTrack = (id: string) => {
    if (newTracks.length > 1) {
      setNewTracks(newTracks.filter(track => track.id !== id));
    }
  };

  const updateNewTrack = (id: string, field: 'artist' | 'title', value: string) => {
    setNewTracks(newTracks.map(track =>
      track.id === id ? { ...track, [field]: value } : track
    ));
  };

  const handleFileChangeForTrack = (id: string, file: File | null) => {
    setNewTracks(newTracks.map(track =>
      track.id === id ? { ...track, file, fileName: file?.name || '' } : track
    ));
  };

  const handleAddTracks = async () => {
    const validTracks = newTracks.filter(track => track.artist && track.title && track.file);

    if (validTracks.length > 0) {
      setUploading(true);
      try {
        const files: File[] = [];
        const metadatas: TrackMetadata[] = [];
        validTracks.forEach(t => { if (t.file) { files.push(t.file); metadatas.push({ artist: t.artist, title: t.title }); } });
        const playhead = Math.floor(currentTime * 1000);

        await apiClient.uploadRoomTracks(room.room_id, files, metadatas, playhead);

        alert("곡이 업로드되었습니다! 서버에서 믹싱 중이며, 완료되면 자동으로 재생 목록에 추가됩니다.");
        setNewTracks([{ id: '1', artist: '', title: '', file: null, fileName: '' }]);
        setShowAddDialog(false);
      } catch (e) {
        console.error("Upload failed", e);
        alert("곡 업로드에 실패했습니다.");
      } finally {
        setUploading(false);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={onBack} className="text-gray-400 hover:text-white hover:bg-zinc-900">
            <ArrowLeft className="size-4 mr-2" />
            뒤로
          </Button>

          <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-2 shadow-[0_0_15px_rgba(236,72,153,0.3)]">
            <Users className="size-4 mr-2" />
            {userCount}명 접속 중
          </Badge>
        </div>

        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl text-white font-bold">{room.name}</h1>
          {myUsername && <span className="text-zinc-500 text-sm">사용자: {myUsername}</span>}
        </div>

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
                      className="text-gray-400 hover:text-pink-400 hover:bg-zinc-800 transition-colors"
                    >
                      <Volume2 className="size-5" />
                    </Button>

                    {showVolumeControl && (
                      <div className="absolute top-12 right-0 w-12 bg-zinc-800 border border-pink-500/30 rounded-lg p-2 shadow-[0_0_30px_rgba(236,72,153,0.3)] z-50">
                        <div className="flex flex-col items-center gap-2 h-36">
                          <span className="text-xs text-pink-400 font-medium">{volume}%</span>
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
                  <div className="w-56 h-56 mx-auto mb-8 bg-zinc-800 border border-pink-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(236,72,153,0.2)] relative overflow-hidden group">
                    {isAutoplayBlocked ? (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-4 transition-all duration-300">
                        <Button
                          onClick={() => {
                            if (audioRef.current) {
                              syncPlaybackToLive();
                              audioRef.current.play();
                            }
                          }}
                          className="bg-pink-500 hover:bg-pink-600 text-white rounded-full p-6 shadow-[0_0_20px_rgba(236,72,153,0.5)]"
                        >
                          재생 시작하기
                        </Button>
                        <p className="text-[10px] text-gray-400 mt-3 text-center leading-tight">
                          브라우저 정책으로 인해<br />클릭 후 재생이 시작됩니다
                        </p>
                      </div>
                    ) : null}
                    {wsStatus === 'connecting' || (currentTrack === null && !duration) ? (
                      <Loader2 className="size-24 text-pink-400 animate-spin" />
                    ) : (
                      <Music className="size-24 text-pink-400" />
                    )}
                  </div>
                  {wsError ? (
                    <>
                      <h2 className="text-3xl text-center mb-3 text-red-400">연결 오류</h2>
                      <p className="text-center text-gray-500 text-base mb-6 px-4">{wsError}</p>
                      <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                        className="mx-auto flex items-center gap-2 border-zinc-700 text-gray-400 hover:text-white"
                      >
                        <RefreshCw className="size-4" />
                        다시 시도
                      </Button>
                    </>
                  ) : wsStatus === 'connecting' ? (
                    <>
                      <h2 className="text-3xl text-center mb-3 text-gray-500">연결 중...</h2>
                      <p className="text-center text-gray-600 text-base">서버와 통신하고 있습니다</p>
                    </>
                  ) : currentTrack ? (
                    <>
                      <h2 className="text-4xl text-center mb-2 text-white font-bold">{currentTrack.title}</h2>
                      <p className="text-center text-gray-400 text-xl mb-2">{currentTrack.artist}</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-3xl text-center mb-3 text-pink-400 animate-pulse">믹싱 중...</h2>
                      <p className="text-center text-gray-400 text-base">첫 번째 곡을 고품질로 믹스하고 있습니다</p>
                      <p className="text-center text-gray-600 text-sm mt-2">서버 상태에 따라 최대 30초까지 걸릴 수 있습니다</p>
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
                    className="mb-3"
                    disabled={true} // 사용자가 조절하지 못하도록 비활성화
                  />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Add Track Button */}
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-gray-300 border border-zinc-700">
                      <Plus className="size-4 mr-2" />
                      곡 추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-900 border-zinc-800 max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-white">새 곡 추가</DialogTitle>
                      <DialogDescription className="sr-only">
                        라디오 방에 추가할 새로운 곡 정보를 입력하고 파일을 업로드합니다.
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
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateNewTrack(track.id, 'artist', e.target.value)}
                              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-600"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">곡 이름</label>
                            <Input
                              placeholder="곡 이름"
                              value={track.title}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateNewTrack(track.id, 'title', e.target.value)}
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
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleFileChangeForTrack(track.id, file);
                                  }
                                }}
                              />
                              <label
                                htmlFor={`file-${track.id}`}
                                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md cursor-pointer hover:border-pink-500 transition-colors text-gray-300"
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
                        disabled={newTracks.every(track => !track.artist || !track.title || !track.file) || uploading}
                        className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            업로드 중...
                          </>
                        ) : '모두 믹스에 추가'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>

          {/* Playlist Tabs */}
          <div>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-0">
                <Tabs defaultValue="upcoming" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
                    <TabsTrigger value="upcoming" className="data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-400 text-gray-400">
                      다음 곡 ({upcomingTracks.length})
                    </TabsTrigger>
                    <TabsTrigger value="played" className="data-[state=active]:bg-pink-500/20 data-[state=active]:text-pink-400 text-gray-400">
                      재생됨 ({playedTracks.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="upcoming" className="p-4">
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {upcomingTracks.length === 0 ? (
                        <p className="text-sm text-gray-600 text-center py-8">다음 곡이 없습니다</p>
                      ) : (
                        upcomingTracks.map((track, index) => (
                          <div key={track.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-800 transition-colors">
                            <span className="text-xs text-gray-600 w-6 mt-1">{index + 1}</span>
                            <Music className="size-4 text-pink-400 flex-shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-white">{track.title}</p>
                              <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="played" className="p-4">
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {playedTracks.length === 0 ? (
                        <p className="text-sm text-gray-600 text-center py-8">재생된 곡이 없습니다</p>
                      ) : (
                        [...playedTracks].reverse().map((track) => (
                          <div key={track.id} className="flex items-start gap-3 p-3 rounded-lg opacity-40">
                            <Music className="size-4 text-gray-600 flex-shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-gray-400">{track.title}</p>
                              <p className="text-xs text-gray-600 truncate">{track.artist}</p>
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

        {/* Chat Section */}
        <div className="mt-8">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-8">채팅 메시지가 없습니다</p>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className="flex items-start gap-3 p-3 rounded-lg">
                      <span className="text-xs text-gray-600 w-6 mt-1">{message.username}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-white">{message.message}</p>
                        <p className="text-xs text-gray-400 truncate">{message.timestamp.toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="flex items-center mt-4">
                <Input
                  placeholder="메시지 입력..."
                  value={chatMessage}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatMessage(e.target.value)}
                  onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      handleSendMessage(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-600 flex-1"
                />
                <Button
                  onClick={() => {
                    if (chatMessage) {
                      handleSendMessage(chatMessage);
                    }
                  }}
                  className="ml-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}