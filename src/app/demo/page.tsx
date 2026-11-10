import type { Metadata } from 'next';
import Showcase from './_components/Showcase';
import './showcase.css';

export const metadata: Metadata = {
  title: 'GamerIN | 소개',
  description: '전적을 연동하고, 플레이를 나누고, 멘토와 이어지는 GamerIN 소개 화면.',
};

export default function ShowcasePage() {
  return <Showcase />;
}
