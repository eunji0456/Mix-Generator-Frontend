import { useState, useEffect } from 'react';
import { Search, Plus, Users, Music, Radio, ArrowLeft, Loader2, RefreshCw, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { apiClient, Room as ApiRoom } from '@/app/api/client';

// Extend the API Room type to include local UI state if needed, 
// or simply map it. Ideally we should use the API type.
// But the UI expects currentTrack. For now, since API doesn't give it, we'll make it optional/null.
export interface Room extends ApiRoom {
  // UI specific fields can be added here
}

interface RadioListProps {
  onRoomSelect: (room: Room) => void;
  onBack?: () => void;
}

interface Track {
  id: string;
  artist: string;
  title: string;
  file: File | null;
  fileName: string;
}

export function RadioList({ onRoomSelect, onBack }: RadioListProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [tracks, setTracks] = useState<Track[]>([
    { id: '1', artist: '', title: '', file: null, fileName: '' }
  ]);
  const [isCreating, setIsCreating] = useState(false);

  const addTrack = () => {
    setTracks([
      ...tracks,
      { id: Date.now().toString(), artist: '', title: '', file: null, fileName: '' }
    ]);
  };

  const removeTrack = (id: string) => {
    if (tracks.length > 1) {
      setTracks(tracks.filter(track => track.id !== id));
    }
  };

  const updateTrackState = (id: string, field: 'artist' | 'title', value: string) => {
    setTracks(tracks.map(track =>
      track.id === id ? { ...track, [field]: value } : track
    ));
  };

  const handleTrackFileChange = (id: string, file: File | null) => {
    setTracks(tracks.map(track =>
      track.id === id ? { ...track, file, fileName: file?.name || '' } : track
    ));
  };

  const fetchRooms = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.getRooms();
      const allRooms: Room[] = response.rooms;

      // 인원이 0명인 방 식별
      const emptyRooms = allRooms.filter(room => room.participant_count === 0);

      // 빈 방 자동 삭제 요청 (비동기 처리)
      if (emptyRooms.length > 0) {
        Promise.all(emptyRooms.map(room =>
          apiClient.deleteRoom(room.room_id)
            .catch(err => console.error(`Failed to delete empty room ${room.room_id}:`, err))
        ));
      }

      // 인원이 1명 이상인 방만 표시
      const validRooms = allRooms.filter(room => room.participant_count > 0);
      setRooms(validRooms);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
      setError('방 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (!showCreateDialog) {
      setNewRoomName('');
      setTracks([{ id: '1', artist: '', title: '', file: null, fileName: '' }]);
    }
  }, [showCreateDialog]);

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    room.participant_count > 0
  );

  const handleCreateRoom = async () => {
    if (newRoomName.trim()) {
      const validTracks = tracks.filter(track => track.artist && track.title && track.file);
      if (validTracks.length === 0) {
        alert('최소 한 곡 이상의 정보를 입력하고 파일을 업로드해주세요.');
        return;
      }

      setIsCreating(true);
      try {
        const files: File[] = [];
        const metadatas = validTracks.map(t => {
          files.push(t.file!);
          return { artist: t.artist, title: t.title };
        });

        const newRoom = await apiClient.createRoom(
          newRoomName,
          files,
          metadatas
        );

        const uiRoom: Room = newRoom;
        setRooms([uiRoom, ...rooms]);
        setNewRoomName('');
        setTracks([{ id: '1', artist: '', title: '', file: null, fileName: '' }]);
        setShowCreateDialog(false);
        onRoomSelect(uiRoom);
      } catch (err) {
        console.error('Failed to create room:', err);
        alert('방 생성에 실패했습니다.');
      } finally {
        setIsCreating(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-6xl mx-auto">
        {onBack && (
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="mb-6 text-gray-400 hover:text-white hover:bg-zinc-800"
          >
            <ArrowLeft className="size-4 mr-2" />
            뒤로
          </Button>
        )}

        <div className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-5xl mb-3 font-black tracking-tight">
              <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                라디오
              </span>
            </h1>
            <p className="text-gray-400 text-lg font-light">다른 사람들과 함께 음악을 즐겨보세요</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchRooms}
            className="text-gray-400 hover:text-white mb-2"
            disabled={isLoading}
          >
            <RefreshCw className={`size-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Search and Create */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 size-5" />
            <Input
              placeholder="방 검색..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-gray-600 focus:border-pink-500"
            />
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                <Plus className="size-4 mr-2" />
                새 방 만들기
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-white">새 방 만들기</DialogTitle>
                <DialogDescription className="sr-only">
                  새로운 라디오 방의 이름과 첫 곡 정보를 입력하여 방을 생성합니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm mb-1 block text-gray-400">방 이름</label>
                  <Input
                    placeholder="예: 신나는 월요일 모닝 라디오"
                    value={newRoomName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRoomName(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-600 mb-4"
                  />

                  <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                    <p className="text-xs text-gray-500 font-medium sticky top-0 bg-zinc-900 py-1 z-10">곡 목록</p>
                    {tracks.map((track) => (
                      <div key={track.id} className="p-4 bg-black rounded-lg border border-zinc-800 space-y-3 relative group/track">
                        <div className="flex justify-between items-center">
                          <label className="text-xs text-gray-500">곡 정보</label>
                          {tracks.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeTrack(track.id)}
                              className="size-6 text-gray-500 hover:text-red-400"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">가수</label>
                          <Input
                            placeholder="가수 이름"
                            value={track.artist}
                            onChange={(e) => updateTrackState(track.id, 'artist', e.target.value)}
                            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-600"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">곡 이름</label>
                          <Input
                            placeholder="곡 이름"
                            value={track.title}
                            onChange={(e) => updateTrackState(track.id, 'title', e.target.value)}
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
                              onChange={(e) => handleTrackFileChange(track.id, e.target.files?.[0] || null)}
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
                      onClick={addTrack}
                      variant="outline"
                      className="w-full bg-transparent border-zinc-800 text-gray-400 hover:bg-zinc-800 hover:text-white"
                    >
                      <Plus className="size-4 mr-2" />
                      곡 추가
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim() || tracks.every(t => !t.artist || !t.title || !t.file) || isCreating}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    '방 만들기'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Room List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="size-10 text-pink-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">
            {error}
            <div className="mt-4">
              <Button variant="outline" onClick={fetchRooms} className="border-red-400 text-red-400 hover:bg-red-400/10">다시 시도</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Radio className="size-16 text-gray-800 mx-auto mb-4" />
                <p className="text-gray-600">
                  {searchQuery ? '검색 결과가 없습니다' : '생성된 방이 없습니다. 첫 번째 방을 만들어보세요!'}
                </p>
              </div>
            ) : (
              filteredRooms.map((room) => (
                <Card
                  key={room.room_id}
                  className="cursor-pointer bg-zinc-900 border-zinc-800 hover:border-pink-500/50 transition-all duration-300 group"
                  onClick={() => onRoomSelect(room)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2 text-white group-hover:text-pink-400 transition-colors">
                          {room.name}
                        </CardTitle>
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit bg-zinc-800 text-gray-400 border-zinc-700">
                          <Users className="size-3" />
                          <span>{room.participant_count}</span>
                        </Badge>
                      </div>
                      <Radio className="size-7 text-pink-500 opacity-30 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3 p-3 bg-black border border-zinc-800 rounded-lg group-hover:border-pink-500/30 transition-colors">
                      <Music className="size-5 text-gray-600 group-hover:text-pink-400 flex-shrink-0 mt-0.5 transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 mb-0.5">현재 재생 정보</p>
                        <p className="font-medium truncate text-sm text-gray-300 group-hover:text-white transition-colors">
                          준비 중이거나 곡 정보가 없습니다
                        </p>
                        <p className="text-xs text-gray-600 mt-1">방에 입장하여 확인하세요</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}