import type { Metadata } from 'next';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  LegalList,
  LegalNotice,
  LegalSection,
} from '../_components/LegalDocument';

export const metadata: Metadata = { title: '이용약관 | GamerIN' };

export default function TermsPage() {
  return (
    <>
      <header className="space-y-4">
        <h1 className="text-3xl font-black tracking-tight text-black">이용약관</h1>
        <LegalNotice />
      </header>

      <LegalSection title="제1조 목적">
        <p>
          이 약관은 GamerIN 프로젝트 팀(이하 &quot;운영팀&quot;)이 졸업 캡스톤 프로젝트로 운영하는 게임 커뮤니티 서비스
          GamerIN(이하 &quot;서비스&quot;)의 이용 조건과 이용자·운영팀의 권리와 의무를 정합니다.
        </p>
      </LegalSection>

      <LegalSection title="제2조 약관의 효력과 변경">
        <LegalList
          items={[
            '이 약관은 서비스 화면에 게시하며, 이용자가 가입 시 동의하면 효력이 생깁니다.',
            '운영팀은 약관을 변경할 수 있으며, 변경 내용과 시행일을 시행 전에 서비스 화면으로 알립니다.',
            '이용자는 변경에 동의하지 않으면 탈퇴할 수 있습니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="제3조 회원가입">
        <LegalList
          items={[
            '서비스는 만 14세 이상만 가입할 수 있습니다.',
            '이용자는 이메일 또는 Google 계정으로 가입할 수 있으며, 사실대로 정보를 입력해야 합니다.',
            '다른 사람의 정보로 가입하거나 만 14세 미만이 가입한 사실이 확인되면 계정을 제한하거나 삭제할 수 있습니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="제4조 계정 관리">
        <LegalList
          items={[
            '이용자는 자신의 계정과 비밀번호를 직접 관리하며, 다른 사람에게 양도하거나 빌려줄 수 없습니다.',
            '계정이 도용된 것을 알게 되면 비밀번호를 바꾸고 운영팀에 알려 주세요.',
          ]}
        />
      </LegalSection>

      <LegalSection title="제5조 게시물">
        <LegalList
          items={[
            '이용자가 작성한 게시물의 저작권은 작성자에게 있습니다.',
            '이용자는 운영팀이 서비스 제공과 시연에 필요한 범위에서 게시물을 저장·표시하는 것을 허락합니다.',
            '이용자는 자신의 게시물에 대한 책임을 지며, 다른 사람의 권리를 침해해서는 안 됩니다.',
            '게시글·댓글·DM은 저장 전에 자동 검사를 거치며, 유해 콘텐츠로 판정되면 저장되지 않습니다. 자세한 내용은 개인정보 처리방침을 확인해 주세요.',
          ]}
        />
      </LegalSection>

      <LegalSection title="제6조 금지 행위">
        <LegalList
          items={[
            '괴롭힘, 혐오 표현, 불법 정보, 성적 콘텐츠, 자해 조장 콘텐츠 게시',
            '다른 사람의 개인정보를 동의 없이 게시하거나 수집하는 행위',
            '다른 사람이나 운영팀을 사칭하는 행위',
            '서비스 취약점 악용, 자동화된 대량 요청, 정상 운영을 방해하는 행위',
            '마일리지·멘토링·신고 기능을 부정하게 이용하는 행위',
          ]}
        />
      </LegalSection>

      <LegalSection title="제7조 신고와 이용 제한">
        <p>
          운영팀은 신고나 확인을 거쳐 약관을 위반한 게시물을 숨기거나 계정 이용을 일시 또는 영구 정지할 수 있습니다.
          이의가 있으면 제13조 연락처로 알려 주세요.
        </p>
      </LegalSection>

      <LegalSection title="제8조 마일리지와 멤버십">
        <LegalList
          items={[
            '결제는 카카오페이 시험 결제로만 동작하며 실제 대금이 청구되지 않습니다.',
            '마일리지와 멤버십은 서비스 안에서만 쓰는 시연용 기능이며 현금 가치가 없습니다.',
            '남은 마일리지는 탈퇴 또는 프로젝트 종료 시 소멸하며 환급되지 않습니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="제9조 멘토링">
        <LegalList
          items={[
            '멘토는 운영팀의 승인을 받아 프로그램을 게시할 수 있습니다.',
            '멘토링 이용료는 마일리지로 처리하며 수수료가 적용될 수 있습니다.',
            '멘토링 내용은 멘토와 멘티가 직접 정하며, 운영팀은 그 내용이나 결과를 보증하지 않습니다.',
            '진행 중이거나 정산 전인 멘토링이 있으면 탈퇴할 수 없습니다.',
          ]}
        />
      </LegalSection>

      <LegalSection title="제10조 탈퇴">
        <p>
          이용자는 설정 화면에서 언제든 탈퇴할 수 있습니다. 탈퇴 후 정보 처리는 개인정보 처리방침을 따르며, 탈퇴한 계정은
          되돌릴 수 없습니다.
        </p>
      </LegalSection>

      <LegalSection title="제11조 서비스 변경과 종료">
        <p>
          서비스는 개발 단계의 프로젝트이며 오류가 발생하거나 데이터가 변경될 수 있습니다. 운영팀은 기능을 바꾸거나
          서비스를 중단할 수 있고, 프로젝트가 끝나면 서비스를 종료합니다. 종료 전에 서비스 화면으로 알립니다.
        </p>
      </LegalSection>

      <LegalSection title="제12조 책임의 제한">
        <p>
          운영팀은 비상업 프로젝트로 서비스를 무상 제공하며, 법령이 허용하는 범위에서 서비스 이용으로 생긴 손해나 이용자
          사이의 분쟁에 책임을 지지 않습니다. 운영팀의 고의 또는 중대한 과실로 생긴 손해는 그렇지 않습니다.
        </p>
      </LegalSection>

      <LegalSection title="제13조 문의">
        <p>서비스와 약관에 관한 문의는 {LEGAL_CONTACT_EMAIL}로 보내 주세요.</p>
      </LegalSection>

      <LegalList items={['버전: 1.0', `시행일: ${LEGAL_EFFECTIVE_DATE}`]} />
    </>
  );
}
