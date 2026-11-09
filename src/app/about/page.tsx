import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, Bookmark, Check, Gamepad2, Hash, MessageSquare, Search, WalletCards } from 'lucide-react';
import { DemoScene } from './_components/DemoScenes';
import './about.css';

export const metadata: Metadata = {
  title: 'GamerIN 둘러보기 | 플레이 그다음의 연결',
  description: '전적 프로필부터 커뮤니티, 1:1 멘토링, 메시지까지. 게이머를 위한 GamerIN을 움직이는 데모로 만나보세요.',
};

export default function AboutPage() {
  return (
    <div className="gamerin-demo">
      <a href="#demo-main" className="demo-skip">본문으로 바로가기</a>
      <header className="demo-header">
        <Link href="/about" className="demo-wordmark" aria-label="GamerIN 소개"><Image src="/logo.png" alt="" width={30} height={30} /><span>GamerIN<span className="demo-wordmark-dot">.</span></span></Link>
        <nav aria-label="소개 페이지 메뉴"><a href="#features">기능 둘러보기</a><Link href="/" className="demo-header-cta">GamerIN 시작하기<ArrowUpRight size={16} /></Link></nav>
      </header>
      <main id="demo-main">
        <section className="demo-hero" aria-labelledby="demo-title">
          <div className="demo-hero-copy">
            <div className="demo-eyebrow"><span />BEYOND THE GAME</div>
            <h1 id="demo-title">플레이는 끝나도,<br />연결은 <em>계속되니까.</em></h1>
            <p>나의 실력을 기록하고, 같은 게임을 사랑하는<br className="demo-desktop-break" /> 사람들과 함께 다음 플레이를 만들어가세요.</p>
            <div className="demo-hero-actions"><Link href="/" className="demo-primary">GamerIN 시작하기<ArrowRight size={17} /></Link><a href="#features" className="demo-text-link">기능 살펴보기<ArrowDown size={15} /></a></div>
            <div className="demo-hero-proof"><span><Check size={13} />게임으로 증명하고</span><span><Check size={13} />플레이로 연결되는 곳</span></div>
          </div>
          <div className="demo-hero-visual"><div className="demo-visual-label"><span>YOUR GAME. YOUR IDENTITY.</span><span>01 / 04</span></div><DemoScene name="profile" /></div>
        </section>

        <div className="demo-game-strip" aria-label="전적 연동 지원 게임"><span>나를 보여주는<br /><strong>게임의 기록들</strong></span><div>{[
          ['lol', '리그 오브 레전드'], ['valorant', '발로란트'], ['pubg', '배틀그라운드'], ['rainbow6', '레인보우 식스'],
        ].map(([image, name]) => <div key={image}><Image src={`/images/games/${image}.png`} alt="" width={image === 'lol' ? 1200 : 28} height={image === 'lol' ? 630 : 28} sizes="28px" style={{ width: 28, height: 'auto' }} /><span>{name}</span></div>)}</div><span className="demo-strip-note">내 플레이가<br />나의 프로필이 됩니다.</span></div>

        <section id="features" className="demo-features" aria-labelledby="demo-features-title">
          <div className="demo-section-heading"><div><div className="demo-eyebrow">MADE FOR YOUR NEXT PLAY</div><h2 id="demo-features-title">혼자 하는 게임에서,<br />함께하는 플레이로.</h2></div><p>기록하고, 나누고, 배우고, 연결되는 경험.<br />GamerIN 안에서 자연스럽게 이어집니다.</p></div>

          <article className="demo-feature" aria-labelledby="feed-title"><div className="demo-feature-copy"><span className="demo-feature-index">02 <span>/ COMMUNITY</span></span><div className="demo-feature-icon"><Gamepad2 size={24} /></div><h3 id="feed-title">좋은 플레이는<br />나눌수록 커지니까.</h3><p>오늘의 하이라이트와 나만의 공략.<br />게이머들의 이야기를 피드에서 만나고,<br />다시 볼 순간은 컬렉션에 담아두세요.</p><div className="demo-feature-tags"><span>게임 피드</span><span>북마크 컬렉션</span></div></div><DemoScene name="feed" /></article>

          <article className="demo-feature demo-feature-reverse" aria-labelledby="mentoring-title"><div className="demo-feature-copy"><span className="demo-feature-index">03 <span>/ LEVEL UP</span></span><div className="demo-feature-icon"><ArrowUpRight size={24} /></div><h3 id="mentoring-title">다음 티어로 가는 길,<br />함께 찾을 수 있도록.</h3><p>내 게임에 맞는 멘토를 찾아보세요.<br />1:1 리플레이 피드백으로<br />막혔던 플레이에 새로운 길을 만드세요.</p><div className="demo-feature-tags"><span>게임별 멘토</span><span>1:1 멘토링</span></div></div><DemoScene name="mentoring" /></article>

          <article className="demo-feature" aria-labelledby="messages-title"><div className="demo-feature-copy"><span className="demo-feature-index">04 <span>/ STAY CONNECTED</span></span><div className="demo-feature-icon"><MessageSquare size={24} /></div><h3 id="messages-title">“같이 한 판?”<br />그 한마디부터.</h3><p>잘 맞는 듀오도, 함께 성장할 동료도.<br />메시지로 이야기를 나누며<br />게임 밖에서도 연결을 이어가세요.</p><div className="demo-feature-tags"><span>다이렉트 메시지</span><span>읽음 확인</span></div></div><DemoScene name="messages" /></article>
        </section>

        <section className="demo-extras" aria-labelledby="demo-extras-title"><div className="demo-eyebrow">AND A LITTLE MORE</div><h2 id="demo-extras-title">게이머의 일상을 더 편하게.</h2><div className="demo-extras-grid"><div><Search size={21} /><h3>관심사가 통하는 발견</h3><p>사용자, 게시물, 해시태그 검색으로<br />내 게임의 이야기를 찾아보세요.</p><span><Hash size={13} />지금 관심 있는 게임부터</span></div><div><Bookmark size={21} /><h3>나만의 플레이북</h3><p>공략부터 영감이 된 플레이까지.<br />북마크 컬렉션으로 한곳에 모으세요.</p><span>저장하고, 다시 꺼내보고</span></div><div><WalletCards size={21} /><h3>성장으로 이어지는 선택</h3><p>마일리지로 멘토링을 이용하고,<br />멤버십 혜택도 만나보세요.</p><span>충전부터 이용 내역까지 한눈에</span></div></div></section>

        <section className="demo-final" aria-labelledby="demo-final-title"><div className="demo-eyebrow">READY FOR THE NEXT GAME?</div><h2 id="demo-final-title">당신의 다음 플레이,<br /><span>여기서 시작해요.</span></h2><Link href="/" className="demo-primary">GamerIN 시작하기<ArrowRight size={17} /></Link><p>로그인 없이 먼저 피드를 둘러볼 수 있어요.</p></section>
      </main>
      <footer className="demo-footer"><Link href="/" className="demo-footer-brand">GamerIN.</Link><p>예시 데이터로 구성한 데모입니다. 실제 전적 조회·신청·메시지 전송·결제는 발생하지 않습니다.</p><div><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보처리방침</Link></div></footer>
    </div>
  );
}
