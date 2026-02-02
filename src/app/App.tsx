import { useState } from 'react';
import { Music, Radio as RadioIcon } from 'lucide-react';
import { PersonalMix } from '@/app/components/personal-mix';
import { MixPlayer } from '@/app/components/mix-player';
import { RadioList, Room } from '@/app/components/radio-list';
import { RadioRoom } from '@/app/components/radio-room';
import { Button } from '@/app/components/ui/button';

type Page = 'home' | 'personal-mix' | 'mix-player' | 'radio-list' | 'radio-room';

interface Track {
  id: string;
  artist: string;
  title: string;
  file: File | null;
  fileName: string;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [mixTracks, setMixTracks] = useState<Track[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const handleMixCreated = (tracks: Track[]) => {
    setMixTracks(tracks);
    setCurrentPage('mix-player');
  };

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    setCurrentPage('radio-room');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'personal-mix':
        return <PersonalMix onMixCreated={handleMixCreated} onBack={() => setCurrentPage('home')} />;
      
      case 'mix-player':
        return (
          <MixPlayer
            initialTracks={mixTracks}
            onBack={() => setCurrentPage('personal-mix')}
          />
        );
      
      case 'radio-list':
        return <RadioList onRoomSelect={handleRoomSelect} onBack={() => setCurrentPage('home')} />;
      
      case 'radio-room':
        return selectedRoom ? (
          <RadioRoom
            room={selectedRoom}
            onBack={() => setCurrentPage('radio-list')}
          />
        ) : null;
      
      default:
        return (
          <div className="min-h-screen bg-black flex items-center justify-center p-8">
            <div className="max-w-5xl w-full">
              <div className="text-center mb-16">
                <div className="mb-6">
                  <h1 className="text-7xl mb-3 font-black tracking-tight">
                    <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      Music Mixer
                    </span>
                  </h1>
                  <div className="h-1 w-32 mx-auto bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                </div>
                <p className="text-xl text-gray-400">
                  스마트 알고리즘으로 완벽하게 믹스된 음악을 즐겨보세요
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                {/* Personal Mix Card */}
                <button
                  onClick={() => setCurrentPage('personal-mix')}
                  className="group relative bg-zinc-900 rounded-2xl p-8 border border-zinc-800 hover:border-cyan-500/50 transition-all duration-300 text-left overflow-hidden"
                >
                  {/* Neon glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-cyan-500/0 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-zinc-800 border border-cyan-500/50 rounded-xl flex items-center justify-center mb-6 group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all duration-300">
                      <Music className="size-8 text-cyan-400" />
                    </div>
                    
                    <h2 className="text-2xl mb-3 text-white font-semibold">개인 믹스</h2>
                    <p className="text-gray-400 mb-6 leading-relaxed">
                      나만의 플레이리스트를 만들고<br/>최적의 순서로 자동 믹스합니다
                    </p>
                    
                    <div className="flex items-center text-cyan-400 font-medium">
                      시작하기
                      <span className="ml-2 group-hover:ml-4 transition-all duration-300">→</span>
                    </div>
                  </div>
                </button>

                {/* Radio Card */}
                <button
                  onClick={() => setCurrentPage('radio-list')}
                  className="group relative bg-zinc-900 rounded-2xl p-8 border border-zinc-800 hover:border-pink-500/50 transition-all duration-300 text-left overflow-hidden"
                >
                  {/* Neon glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 via-pink-500/0 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
                  
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-zinc-800 border border-pink-500/50 rounded-xl flex items-center justify-center mb-6 group-hover:border-pink-400 group-hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-300">
                      <RadioIcon className="size-8 text-pink-400" />
                    </div>
                    
                    <h2 className="text-2xl mb-3 text-white font-semibold">라디오</h2>
                    <p className="text-gray-400 mb-6 leading-relaxed">
                      다른 사람들과 함께<br/>실시간으로 음악을 공유하고 즐겨보세요
                    </p>
                    
                    <div className="flex items-center text-pink-400 font-medium">
                      시작하기
                      <span className="ml-2 group-hover:ml-4 transition-all duration-300">→</span>
                    </div>
                  </div>
                </button>
              </div>

              {/* Feature List */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                  <div className="text-4xl mb-3">🎵</div>
                  <h3 className="text-lg mb-2 text-white font-medium">스마트 믹싱</h3>
                  <p className="text-sm text-gray-400">분위기와 템포를 분석해 자연스럽게 연결</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                  <div className="text-4xl mb-3">⚡</div>
                  <h3 className="text-lg mb-2 text-white font-medium">실시간 추가</h3>
                  <p className="text-sm text-gray-400">재생 중에도 곡을 추가하면 자동으로 믹스</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                  <div className="text-4xl mb-3">👥</div>
                  <h3 className="text-lg mb-2 text-white font-medium">함께 듣기</h3>
                  <p className="text-sm text-gray-400">라디오 방에서 친구들과 음악 공유</p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return <>{renderPage()}</>;
}