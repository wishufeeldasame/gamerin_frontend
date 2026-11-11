'use client';

import { useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { useWebAppInstall } from '@/app/context/WebAppInstallContext';

export default function WebAppInstall({ children }: { children: ReactNode }) {
  const { isInstalled, requestInstall } = useWebAppInstall();
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="demo-header-actions">
      <div className="demo-header-buttons">
        {!isInstalled && (
          <button type="button" className="demo-install-button" onClick={async () => setShowGuide(!(await requestInstall()))}>
            <Download size={16} aria-hidden="true" />
            다운로드
          </button>
        )}
        {children}
      </div>
      {!isInstalled && (
        <div className="demo-install-guide" role="status">
          {showGuide && (
            <p>
              Chrome 메뉴에서 설치할 수 있습니다.{' '}
              <a href="https://support.google.com/chrome/answer/9658361?hl=ko" target="_blank" rel="noreferrer">설치 방법 보기</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
