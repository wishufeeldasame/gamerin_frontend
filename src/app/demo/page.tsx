import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BarChart3, BookOpen, Gamepad2, MessageSquare, Video } from 'lucide-react';
import Showcase from './_components/Showcase';
import WebAppInstall from './_components/WebAppInstall';
import './showcase.css';

export const metadata: Metadata = {
  title: 'GamerIN | 소개',
  description: '전적을 연동하고, 플레이를 나누고, 멘토와 이어지는 GamerIN 소개 화면.',
};

const FEATURES = [
  { icon: Gamepad2, title: '전적 연동', text: '게임 계정을 연결하면 인증된 전적과 대표 티어가 프로필에 표시됩니다.' },
  { icon: BarChart3, title: '주간 전적 리포트', text: '멤버십 회원은 매주 월요일, 지난주와 비교한 AI 리포트를 받습니다.' },
  { icon: Video, title: '플레이 공유', text: '클립과 글을 피드에 올리고 좋아요와 댓글로 이야기합니다.' },
  { icon: BookOpen, title: '1:1 멘토링', text: '멘토의 프로그램을 마일리지로 신청하고 함께 다음 티어를 준비합니다.' },
  { icon: MessageSquare, title: '메시지', text: '신청이 수락되면 멘토와 바로 대화를 시작합니다.' },
];

const TEAM = [
  { name: '전준범', role: '팀장 · 프론트엔드' },
  { name: '김신의', role: '프론트엔드' },
  { name: '서장호', role: '기획 · 테스트 · 백엔드' },
  { name: '방경식', role: '백엔드' },
  { name: '이상혁', role: '백엔드' },
];

const Logo = () => <span className="demo-logo"><Image src="/logo.png" alt="" width={28} height={28} /><span>Gamer<em>IN</em></span></span>;
const Go = () => <Link href="/" className="demo-go">GamerIN 바로가기<ArrowRight size={16} aria-hidden="true" /></Link>;

export default function ShowcasePage() {
  return (
    <div className="demo-page">
      <header className="demo-header">
        <div className="demo-wrap">
          <Logo />
          <WebAppInstall><Go /></WebAppInstall>
        </div>
      </header>
      <main>
        <div className="demo-wrap">
          <div className="demo-hero">
            <h1>게임 속 나를, 게임 밖에서도.</h1>
            <p>전적을 연동하고, 플레이를 나누고, 멘토와 함께 성장하는 게이머 커뮤니티 GamerIN을 1분 영상으로 소개합니다.</p>
          </div>
          <Showcase />
          <p className="demo-caption">영상 속 계정·전적·게시물·리포트는 모두 예시입니다.</p>
          <p className="sr-only">프로필에서 발로란트 전적을 연동하면 닉네임 옆에 대표 티어가 표시됩니다. 멤버십 콘텐츠에서 지난주와 비교한 주간 전적 AI 리포트를 봅니다. 피드에 게임 클립을 올리면 영상이 재생되고 좋아요와 댓글이 달립니다. 멘토링 프로그램을 신청하고 멘토와 메시지로 대화합니다.</p>
          <section className="demo-section" aria-labelledby="demo-team">
            <h2 id="demo-team">팀 소개</h2>
            <p>다섯 명이 기획부터 프론트엔드·백엔드·테스트까지 나눠 맡아 GamerIN을 함께 만들고 있습니다.</p>
            <ul className="demo-team">
              {TEAM.map(({ name, role }) => <li key={name}><strong>{name}</strong><span>{role}</span></li>)}
            </ul>
          </section>
          <section className="demo-section" aria-labelledby="demo-service">
            <h2 id="demo-service">서비스 소개</h2>
            <p>GamerIN은 게임 전적을 중심으로 게이머가 서로를 알아보고, 플레이를 나누고, 배우는 커뮤니티입니다.</p>
            <ul className="demo-features">
              {FEATURES.map(({ icon: Icon, title, text }) => <li key={title}><Icon size={22} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></li>)}
            </ul>
          </section>
        </div>
      </main>
      <footer className="demo-footer">
        <div className="demo-wrap">
          <div><Logo /><p>© 2026 GamerIN</p></div>
          <nav aria-label="바로가기"><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보처리방침</Link><Go /></nav>
        </div>
      </footer>
    </div>
  );
}
