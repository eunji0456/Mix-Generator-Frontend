import { useState } from 'react';
import { Search, Plus, Users, Music, Radio, ArrowLeft } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';

export interface Room {
  id: string;
  name: string;
  currentTrack: {
    artist: string;
    title: string;
  } | null;
  userCount: number;
  createdAt: Date;
}

interface RadioListProps {
  onRoomSelect: (room: Room) => void;
  onBack?: () => void;
}

const MOCK_ROOMS: Room[] = [
  {
    id: '1',
    name: 'K-POP 히트곡 모음',
    currentTrack: { artist: 'NewJeans', title: 'Super Shy' },
    userCount: 42,
    createdAt: new Date('2026-01-30')
  },
  {
    id: '2',
    name: '90년대 감성 라디오',
    currentTrack: { artist: '서태지와 아이들', title: '하여가' },
    userCount: 28,
    createdAt: new Date('2026-01-29')
  },
  {
    id: '3',
    name: '발라드 천국',
    currentTrack: { artist: '임재현', title: '사랑에 연습이 있었다면' },
    userCount: 65,
    createdAt: new Date('2026-01-31')
  },
  {
    id: '4',
    name: '출근길 에너지 충전',
    currentTrack: { artist: 'BTS', title: 'Dynamite' },
    userCount: 89,
    createdAt: new Date('2026-01-31')
  },
  {
    id: '5',
    name: '힙합 플레이리스트',
    currentTrack: { artist: 'Jay Park', title: 'MOMMAE' },
    userCount: 33,
    createdAt: new Date('2026-01-30')
  },
  {
    id: '6',
    name: '감성 인디 모음',
    currentTrack: { artist: '10cm', title: '봄이 좋냐?' },
    userCount: 51,
    createdAt: new Date('2026-01-29')
  }
];

export function RadioList({ onRoomSelect, onBack }: RadioListProps) {
  const [rooms, setRooms] = useState<Room[]>(MOCK_ROOMS);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateRoom = () => {
    if (newRoomName.trim()) {
      const newRoom: Room = {
        id: Date.now().toString(),
        name: newRoomName,
        currentTrack: null,
        userCount: 1,
        createdAt: new Date()
      };
      setRooms([newRoom, ...rooms]);
      setNewRoomName('');
      setShowCreateDialog(false);
      onRoomSelect(newRoom);
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
        
        <div className="mb-10">
          <h1 className="text-5xl mb-3 font-black tracking-tight">
            <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              라디오
            </span>
          </h1>
          <p className="text-gray-400 text-lg font-light">다른 사람들과 함께 음악을 즐겨보세요</p>
        </div>

        {/* Search and Create */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 size-5" />
            <Input
              placeholder="방 이름으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                <DialogTitle className="text-white">새 라디오 방 만들기</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm mb-1 block text-gray-400">방 이름</label>
                  <Input
                    placeholder="예: 신나는 월요일 모닝 라디오"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateRoom();
                      }
                    }}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-600"
                  />
                </div>
                <Button
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim()}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
                >
                  방 만들기
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Room List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Radio className="size-16 text-gray-800 mx-auto mb-4" />
              <p className="text-gray-600">검색 결과가 없습니다</p>
            </div>
          ) : (
            filteredRooms.map((room) => (
              <Card
                key={room.id}
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
                        <span>{room.userCount}</span>
                      </Badge>
                    </div>
                    <Radio className="size-7 text-pink-500 opacity-30 group-hover:opacity-100 transition-opacity" />
                  </div>
                </CardHeader>
                <CardContent>
                  {room.currentTrack ? (
                    <div className="flex items-start gap-3 p-3 bg-black border border-pink-500/30 rounded-lg">
                      <Music className="size-5 text-pink-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 mb-1">현재 재생 중</p>
                        <p className="font-medium truncate text-sm text-white">{room.currentTrack.title}</p>
                        <p className="text-sm text-gray-400 truncate">{room.currentTrack.artist}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-3 bg-black border border-zinc-700 rounded-lg">
                      <Music className="size-5 text-gray-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-600">재생 중인 곡 없음</p>
                        <p className="text-xs text-gray-700">곡을 추가해보세요</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}