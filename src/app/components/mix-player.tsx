import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Download, Plus, Music, X, Trash2, Upload } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { Card, CardContent } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';

interface Track {
  id: string;
  artist: string;
  title: string;
  file: File | null;
  fileName: string;
}

interface MixPlayerProps {
  initialTracks: Track[];
  onBack: () => void;
}

export function MixPlayer({ initialTracks, onBack }: MixPlayerProps) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(200); // Mock duration
  const [volume, setVolume] = useState(70);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [newTracks, setNewTracks] = useState<Array<{ id: string; artist: string; title: string; file: File | null; fileName: string }>>([ 
    { id: '1', artist: '', title: '', file: null, fileName: '' }
  ]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentTrack = tracks[currentTrackIndex];

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

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (currentTrackIndex < tracks.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1);
      setCurrentTime(0);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const handlePrevious = () => {
    if (currentTime > 3) {
      setCurrentTime(0);
    } else if (currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1);
      setCurrentTime(0);
    }
  };

  const handleSeek = (value: number[]) => {
    setCurrentTime(value[0]);
  };

  const handleDownload = () => {
    alert('믹스된 음원을 다운로드합니다 (데모 버전)');
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
        file: track.file,
        fileName: track.fileName
      }));
      
      // Insert after current track for smooth mixing
      const newTracksList = [...tracks];
      newTracksList.splice(currentTrackIndex + 1, 0, ...tracksToAdd);
      setTracks(newTracksList);
      
      setNewTracks([{ id: '1', artist: '', title: '', file: null, fileName: '' }]);
      setShowAddDialog(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playedTracks = tracks.slice(0, currentTrackIndex);
  const upcomingTracks = tracks.slice(currentTrackIndex + 1);

  return (
    <div className="min-h-screen bg-black p-8">
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
                  <div className="w-56 h-56 mx-auto mb-8 bg-zinc-800 border border-cyan-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                    <Music className="size-24 text-cyan-400" />
                  </div>
                  <h2 className="text-4xl text-center mb-2 font-black tracking-tight">
                    <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                      {currentTrack?.title || '제목 없음'}
                    </span>
                  </h2>
                  <p className="text-center text-gray-300 text-xl font-light">{currentTrack?.artist || '아티스트 미상'}</p>
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
                          모두 믹스에 추가
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
                <Tabs defaultValue="upcoming" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
                    <TabsTrigger value="upcoming" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-gray-400">
                      다음 곡 ({upcomingTracks.length})
                    </TabsTrigger>
                    <TabsTrigger value="played" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 text-gray-400">
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
                            <Music className="size-4 text-cyan-400 flex-shrink-0 mt-1" />
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
      </div>
    </div>
  );
}