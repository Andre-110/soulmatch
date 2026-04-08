"use client";

import { useRouter } from 'next/navigation';

/** 逐渐替换 Link 的隐私跳转，确保在同一标签页内导航并支持返回 */
export function PrivacyNavLink({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="ref-privacy-link"
      onClick={() => router.push('/privacy')}
    >
      {children}
    </button>
  );
}
