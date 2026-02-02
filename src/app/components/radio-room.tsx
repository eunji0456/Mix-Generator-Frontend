import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, Volume2, Plus, Music, Users, ArrowLeft, Send, Trash2, Upload } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import type { Room } from './radio-list';

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

const MOCK_PLAYED_TRACKS: Track[] = [
  { id: '1', artist: 'IU', title: '좋은 날', addedBy: '유저1' },
  { id: '2', artist: '아이유', title: 'Blueming', addedBy: '유저2' },
  { id: '3', artist: 'AKMU', title: '200%', addedBy: '유저3' }
];

const MOCK_UPCOMING_TRACKS: Track[] = [
  { id: '5', artist: '멜로망스', title: '좋은 밤 좋은 꿈', addedBy: '유저4' },
  { id: '6', artist: '폴킴', title: '모든 날, 모든 순간', addedBy: '유저5' },
  { id: '7', artist: '벤', title: '열애중', addedBy: '유저1' }
];

export function RadioRoom({ room, onBack }: RadioRoomProps) {
  const [isPlaying, setIsPlaying] = useState(room.currentTrack ? true : false);
  const [currentTime, setCurrentTime] = useState(room.currentTrack ? 87 : 0);
  const [duration, setDuration] = useState(240);
  const [volume, setVolume] = useState(70);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [newTracks, setNewTracks] = useState<Array<{ id: string; artist: string; title: string; file: File | null; fileName: string }>>([
    { id: '1', artist: '', title: '', file: null, fileName: '' }
  ]);
  const [playedTracks, setPlayedTracks] = useState<Track[]>(room.currentTrack ? MOCK_PLAYED_TRACKS : []);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(
    room.currentTrack 
      ? {
          id: '4',
          artist: room.currentTrack.artist,
          title: room.currentTrack.title,
          addedBy: '유저2'
        }
      : null
  );
  const [upcomingTracks, setUpcomingTracks] = useState<Track[]>(room.currentTrack ? MOCK_UPCOMING_TRACKS : []);
  const [userCount, setUserCount] = useState(room.userCount);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatMessage, setChatMessage] = useState('');

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            handleNext();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, duration]);

  // Simulate user count changes
  useEffect(() => {
    const interval = setInterval(() => {
      setUserCount(prev => prev + Math.floor(Math.random() * 3) - 1);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (upcomingTracks.length > 0) {
      if (currentTrack) {
        setPlayedTracks([...playedTracks, currentTrack]);
      }
      setCurrentTrack(upcomingTracks[0]);
      setUpcomingTracks(upcomingTracks.slice(1));
      setCurrentTime(0);
      setDuration(180 + Math.random() * 120);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0]);
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

  const handleAddTracks = () => {
    const validTracks = newTracks.filter(track => track.artist && track.title);
    
    if (validTracks.length > 0) {
      const tracksToAdd: Track[] = validTracks.map(track => ({
        id: Date.now().toString() + Math.random(),
        artist: track.artist,
        title: track.title,
        addedBy: `유저${userCount}`,
        file: track.file || undefined,
        fileName: track.fileName
      }));

      // If no current track, set first as current and rest as upcoming
      if (!currentTrack && tracksToAdd.length > 0) {
        setCurrentTrack(tracksToAdd[0]);
        setCurrentTime(0);
        setDuration(180 + Math.random() * 120);
        setIsPlaying(true);
        if (tracksToAdd.length > 1) {
          setUpcomingTracks([...upcomingTracks, ...tracksToAdd.slice(1)]);
        }
      } else {
        // Mix naturally into upcoming tracks
        setUpcomingTracks([...upcomingTracks, ...tracksToAdd]);
      }
      
      setNewTracks([{ id: '1', artist: '', title: '', file: null, fileName: '' }]);
      setShowAddDialog(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = (message: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      username: `유저${userCount}`,
      message: message,
      timestamp: new Date()
    };
    setMessages([...messages, newMessage]);
    setChatMessage('');
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
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

        <div className="mb-8">
          <h1 className="text-3xl text-white font-bold">{room.name}</h1>
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
                  <div className="w-56 h-56 mx-auto mb-8 bg-zinc-800 border border-pink-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(236,72,153,0.2)]">
                    <Music className="size-24 text-pink-400" />
                  </div>
                  {currentTrack ? (
                    <>
                      <h2 className="text-4xl text-center mb-2 text-white font-bold">{currentTrack.title}</h2>
                      <p className="text-center text-gray-400 text-xl mb-2">{currentTrack.artist}</p>
                      <p className="text-center text-gray-500 text-sm">추가한 사람: {currentTrack.addedBy}</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-3xl text-center mb-3 text-gray-500">추가된 곡 없음</h2>
                      <p className="text-center text-gray-600 text-base">곡을 추가해보세요</p>
                    </>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                  <Slider
                    value={[currentTime]}
                    max={duration}
                    step={1}
                    onValueChange={handleSeek}
                    className="mb-3"
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
                        disabled={newTracks.every(track => !track.artist || !track.title)}
                        className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                      >
                        모두 믹스에 추가
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
                              <p className="text-xs text-gray-500 truncate mt-0.5">추가: {track.addedBy}</p>
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
                              <p className="text-xs text-gray-700 truncate mt-0.5">추가: {track.addedBy}</p>
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
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSendMessage(e.target.value);
                      e.target.value = '';
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