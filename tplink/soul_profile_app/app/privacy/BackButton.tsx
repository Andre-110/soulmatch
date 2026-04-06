"use client";

import { useRouter } from 'next/navigation';

export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push('/');
      }}
      style={{
        color: 'rgba(255,255,255,0.6)',
        background: 'transparent',
        border: 'none',
        fontSize: '14px',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      ← 返回
    </button>
  );
}
