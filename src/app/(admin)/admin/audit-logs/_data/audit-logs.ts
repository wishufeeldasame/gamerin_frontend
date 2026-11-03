import type { AdminAuditLog } from '@/types/admin';

export const auditLogs: AdminAuditLog[] = [
  { id: 'AUD-1208', administrator: '관리자 김민수', action: '신고 처리 완료', targetType: '신고', targetId: 'RPT-1022', reason: '사칭 계정으로 확인되어 경고 및 콘텐츠 숨김 처리', createdAt: '2026.07.23 15:44' },
  { id: 'AUD-1207', administrator: '관리자 김민수', action: '콘텐츠 숨김', targetType: '게시글', targetId: 'post-1', reason: '신고 처리 결정에 따른 콘텐츠 숨김', createdAt: '2026.07.23 15:44' },
  { id: 'AUD-1206', administrator: '관리자 이서연', action: '신고 검토 시작', targetType: '신고', targetId: 'RPT-1023', reason: '반복 홍보 여부 검토 시작', createdAt: '2026.07.23 13:02' },
  { id: 'AUD-1205', administrator: '관리자 김민수', action: '사용자 정지', targetType: '사용자', targetId: 'usr_02', reason: '욕설 및 운영 방해 누적에 따른 7일 정지', createdAt: '2026.07.23 11:24' },
  { id: 'AUD-1204', administrator: '관리자 이서연', action: '신고 반려', targetType: '신고', targetId: 'RPT-1021', reason: '대화 맥락상 거래 피해 증거가 부족함', createdAt: '2026.07.23 10:05' },
  { id: 'AUD-1203', administrator: '관리자 김민수', action: '콘텐츠 복구', targetType: '댓글', targetId: 'comment-4', reason: '오탐 확인 후 작성자 이의 내용 반영', createdAt: '2026.07.22 19:40' },
  { id: 'AUD-1202', administrator: '관리자 이서연', action: '사용자 경고', targetType: '사용자', targetId: 'usr_05', reason: '사칭 가능성이 있는 프로필 문구 수정 요청', createdAt: '2026.07.22 17:11' },
  { id: 'AUD-1201', administrator: '관리자 김민수', action: '정지 해제', targetType: '사용자', targetId: 'usr_08', reason: '정지 기간 만료 전 오처리 확인', createdAt: '2026.07.22 14:36' },
  { id: 'AUD-1200', administrator: '관리자 김민수', action: '신고 처리 완료', targetType: '신고', targetId: 'RPT-1019', reason: '반복 욕설 확인 및 댓글 숨김 처리', createdAt: '2026.07.22 12:18' },
  { id: 'AUD-1199', administrator: '관리자 이서연', action: '콘텐츠 숨김', targetType: '게시글', targetId: 'post-2', reason: '외부 홍보 링크 반복 게시', createdAt: '2026.07.21 14:11' },
  { id: 'AUD-1198', administrator: '관리자 이서연', action: '신고 검토 시작', targetType: '신고', targetId: 'RPT-1018', reason: '대리 게임 홍보 내용 검토', createdAt: '2026.07.21 13:55' },
  { id: 'AUD-1197', administrator: '관리자 김민수', action: '사용자 정지', targetType: '사용자', targetId: 'usr_04', reason: '광고성 게시물 누적에 따른 30일 정지', createdAt: '2026.07.21 11:20' },
];
