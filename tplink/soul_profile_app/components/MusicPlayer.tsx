'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  musicUrl: string;
  title?: string;
};

export function MusicPlayer({ musicUrl, title = '根据报告生成的专属音乐' }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(musicUrl);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.3;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [musicUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.error('播放失败:', err);
      });
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '50px',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        backdropFilter: 'blur(10px)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
      onClick={togglePlay}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <div
        style={{
          fontSize: '20px',
          animation: isPlaying ? 'spin 2s linear infinite' : 'none',
        }}
      >
        🎵
      </div>
      <div
        style={{
          fontSize: '13px',
          color: '#6b48ff',
          fontWeight: 600,
          maxWidth: '150px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: '18px',
          color: '#6b48ff',
        }}
      >
        {isPlaying ? '⏸' : '▶️'}
      </div>
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
