import { redirect } from 'next/navigation';

// 전시 화면을 추가하기 전까지 기존 소개 경로를 유지한다.
export default function DemoPage() {
  redirect('/about');
}
