import type { Metadata } from 'next';
import Exhibition from './_components/Exhibition';
import './demo.css';

export const metadata: Metadata = {
  title: 'GamerIN | 60초 전시',
  description: '전적을 연결하고, 플레이를 나누고, 멘토와 함께 성장하는 60초 이야기.',
};

export default function DemoPage() {
  return <Exhibition />;
}
