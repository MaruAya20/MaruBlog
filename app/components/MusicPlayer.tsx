"use client";
import { useState, useEffect, useRef } from "react";

type MusicInfo = {
  url: string;
  title: string;
  artist: string;
  cover?: string;
};

export default function MusicPlayer() {
  const [currentSong, setCurrentSong] = useState<MusicInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [showFull, setShowFull] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // 播放/暂停控制
  const togglePlayPause = () => {
    if (!currentSong) return;
    
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play().catch(e => console.error("播放失败:", e));
    }
    setIsPlaying(!isPlaying);
  };
  
  // 更新进度
  const updateProgress = () => {
    if (audioRef.current) {
      const percent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(isNaN(percent) ? 0 : percent);
    }
  };
  
  // 跳转进度
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = (parseFloat(e.target.value) / 100) * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
  };
  
  // 音量控制
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };
  
  // 设置播放歌曲
  const playSong = (song: MusicInfo) => {
    setCurrentSong(song);
    // 延迟播放，确保DOM更新完成
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.volume = volume;
        audioRef.current.play().catch(e => console.error("播放失败:", e));
        setIsPlaying(true);
      }
    }, 100);
  };
  
  // 从外部触发播放
  useEffect(() => {
    const handlePlayMusic = (e: CustomEvent<MusicInfo>) => {
      playSong(e.detail);
    };
    
    // 添加事件监听器
    window.addEventListener('playMusic', handlePlayMusic as EventListener);
    
    // 清理函数
    return () => {
      window.removeEventListener('playMusic', handlePlayMusic as EventListener);
    };
  }, []);
  
  return (
    <>
      <audio
        ref={audioRef}
        src={currentSong?.url}
        onTimeUpdate={updateProgress}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            audioRef.current.volume = volume;
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      
      <div
        className="music-player"
        style={{
          position: "fixed",
          left: 80, // 位于FloatingSidebar右侧
          bottom: 24,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
        onMouseEnter={() => setShowFull(true)}
        onMouseLeave={() => setShowFull(false)}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            boxShadow: "0 8px 18px rgba(0,0,0,.35)",
            animation: isPlaying 
              ? "spin 3s linear infinite" 
              : "none",
          }}
        >
          {currentSong?.cover ? (
            <img
              src={currentSong.cover} 
              alt="专辑封面"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              onError={(e) => {
                // 如果封面图片加载失败，使用默认图标
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = '<span style="font-size: 24px; color: var(--brand); display: flex; align-items: center; justify-content: center;">♪</span>';
                }
              }}
            />
          ) : (
            <span style={{ fontSize: 24, color: "var(--brand)" }}>♪</span>
          )}
        </div>
        
        <div
          style={{
            position: "absolute",
            left: 60,
            bottom: 0,
            background: "#fff",
            borderRadius: 12,
            padding: "12px 16px",
            width: showFull ? "320px" : "0",
            opacity: showFull ? 1 : 0,
            visibility: showFull ? "visible" : "hidden",
            overflow: "hidden",
            transition: "all 0.3s ease",
            boxShadow: "0 8px 18px rgba(0,0,0,.25)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {currentSong?.cover ? (
                <img
                  src={currentSong.cover} 
                  alt="专辑封面"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  onError={(e) => {
                    // 如果封面图片加载失败，使用默认图标
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = '<span style="font-size: 18px; display: flex; align-items: center; justify-content: center; color: var(--brand);">♪</span>';
                    }
                  }}
                />
              ) : (
                <div style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(95, 179, 243, 0.1)",
                }}>
                  <span style={{ fontSize: 18, color: "var(--brand)" }}>♪</span>
                </div>
              )}
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div 
                style={{ 
                  fontWeight: 500, 
                  whiteSpace: "nowrap", 
                  overflow: "hidden", 
                  textOverflow: "ellipsis" 
                }}
              >
                {currentSong?.title || "暂无歌曲"}
              </div>
              <div 
                style={{ 
                  fontSize: 12, 
                  color: "var(--muted)", 
                  whiteSpace: "nowrap", 
                  overflow: "hidden", 
                  textOverflow: "ellipsis" 
                }}
              >
                {currentSong?.artist || "未知艺术家"}
              </div>
            </div>
            
            <button
              onClick={togglePlayPause}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "var(--brand)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
          </div>
          
          {currentSong && (
            <div style={{ padding: "0 4px" }}>
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSeek}
                style={{
                  width: "100%",
                  height: 4,
                  borderRadius: 2,
                  background: "#ddd",
                  outline: "none",
                  appearance: "none",
                }}
              />
              
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                fontSize: 12, 
                color: "var(--muted)",
                marginTop: 4
              }}>
                <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
                <span>{formatTime(audioRef.current?.duration || 0)}</span>
              </div>
            </div>
          )}
          
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: "#ddd",
                outline: "none",
                appearance: "none",
              }}
            />
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

// 时间格式化函数
function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}