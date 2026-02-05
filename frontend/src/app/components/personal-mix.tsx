import { useState } from 'react';
import { Plus, Upload, Trash2, Music, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { apiClient, TrackMetadata, MixResponse } from '@/app/api/client';

interface Track {
  id: string;
  artist: string;
  title: string;
  file: File | null;
  fileName: string;
}

interface PersonalMixProps {
  onMixCreated: (mixId: string, initialData?: MixResponse) => void;
  onBack?: () => void;
}

export function PersonalMix({ onMixCreated, onBack }: PersonalMixProps) {
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

  const updateTrack = (id: string, field: 'artist' | 'title', value: string) => {
    setTracks(tracks.map(track =>
      track.id === id ? { ...track, [field]: value } : track
    ));
  };

  const handleFileChange = (id: string, file: File | null) => {
    setTracks(tracks.map(track =>
      track.id === id ? { ...track, file, fileName: file?.name || '' } : track
    ));
  };

  const handleMix = async () => {
    const validTracks = tracks.filter(track => track.artist && track.title && track.file);
    if (validTracks.length > 0) {
      setIsCreating(true);
      try {
        const files: File[] = [];
        const metadatas: TrackMetadata[] = [];

        validTracks.forEach(t => {
          if (t.file) {
            files.push(t.file);
            metadatas.push({
              artist: t.artist,
              title: t.title
            });
          }
        });

        const response = await apiClient.createMix(files, metadatas);
        // Pass full response for instant display
        onMixCreated(response.mix_id, response);
      } catch (err) {
        console.error('Failed to create mix:', err);
        alert('믹스 생성에 실패했습니다.');
      } finally {
        setIsCreating(false);
      }
    }
  };

  const canMix = tracks.some(track => track.artist && track.title && track.file);

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-4xl mx-auto">
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
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              개인 믹스
            </span>
          </h1>
          <p className="text-gray-400 text-lg font-light">곡을 추가하고 자연스러운 순서로 믹스하세요</p>
        </div>

        <Card className="mb-8 bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">곡 목록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tracks.map((track) => (
                <div key={track.id} className="flex gap-3 items-start p-4 bg-black rounded-lg border border-zinc-800 hover:border-cyan-500/50 transition-colors">
                  <div className="flex-shrink-0 w-10 h-10 bg-zinc-800 border border-cyan-500/50 rounded-lg flex items-center justify-center">
                    <Music className="size-5 text-cyan-400" />
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">가수</label>
                      <Input
                        placeholder="가수 이름"
                        value={track.artist}
                        onChange={(e) => updateTrack(track.id, 'artist', e.target.value)}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-600 focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">곡 이름</label>
                      <Input
                        placeholder="곡 이름"
                        value={track.title}
                        onChange={(e) => updateTrack(track.id, 'title', e.target.value)}
                        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-600 focus:border-cyan-500"
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
                          onChange={(e) => handleFileChange(track.id, e.target.files?.[0] || null)}
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

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTrack(track.id)}
                    disabled={tracks.length === 1}
                    className="flex-shrink-0 text-gray-500 hover:text-pink-400 hover:bg-pink-500/10"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              onClick={addTrack}
              variant="outline"
              className="w-full mt-4 bg-black border-zinc-800 text-gray-400 hover:bg-zinc-900 hover:border-cyan-500 hover:text-cyan-400"
            >
              <Plus className="size-4 mr-2" />
              곡 추가
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            onClick={handleMix}
            disabled={!canMix || isCreating}
            size="lg"
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-12 disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                믹스 생성 중...
              </>
            ) : (
              '믹스 생성'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}