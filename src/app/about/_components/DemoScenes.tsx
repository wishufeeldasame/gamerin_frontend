'use client';

import { DemoPlayer } from './DemoPlayer';
import dynamic from 'next/dynamic';

const loading = () => <div className="demo-stage-loading">미리보기를 준비하고 있어요.</div>;
const ProfileDemo = dynamic(() => import('./ProfileDemo'), { ssr: false, loading });
const FeedDemo = dynamic(() => import('./FeedDemo'), { ssr: false, loading });
const MentoringDemo = dynamic(() => import('./MentoringDemo'), { ssr: false, loading });
const MessageDemo = dynamic(() => import('./MessageDemo'), { ssr: false, loading });

const scenes = {
  profile: { scene: ProfileDemo, label: '전적 프로필', description: '새벽의듀오 프로필에서 전적을 새로고침합니다. 연결된 리그 오브 레전드 계정의 다이아몬드 II 티어, 승률 62%, KDA 4.28이 표시됩니다.' },
  feed: { scene: FeedDemo, label: '커뮤니티 피드', description: '게임 게시물의 저장 버튼을 누르고 다시 볼 플레이 컬렉션을 선택합니다. 컬렉션에 저장했다는 확인이 표시됩니다.' },
  mentoring: { scene: MentoringDemo, label: '1:1 멘토링', description: '리그 오브 레전드 필터로 멘토링을 찾습니다. 프로그램 상세에서 신청하면 접수 상태와 멘토의 수락을 기다린다는 안내가 표시됩니다.' },
  messages: { scene: MessageDemo, label: '다이렉트 메시지', description: '포지션메이트와의 대화에서 저는 서포터요. 같이 한 판 해요!라는 메시지를 보냅니다. 새 말풍선과 읽음 상태가 표시됩니다.' },
};

export function DemoScene({ name }: { name: keyof typeof scenes }) {
  return <DemoPlayer {...scenes[name]} id={`demo-${name}`} />;
}
