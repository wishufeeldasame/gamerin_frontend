import { describe, expect, it } from 'vitest';
import {
  validateEmail,
  validateHandle,
  validateNickname,
  validatePassword,
} from '../auth-validation';

describe('validateHandle', () => {
  it.each(['abc', 'a_1', 'a'.repeat(20), '_'.repeat(3)])('%s는 통과한다', (value) => {
    expect(validateHandle(value)).toBeNull();
  });

  it('앞뒤 공백은 무시한다', () => {
    expect(validateHandle(' abc ')).toBeNull();
  });

  it.each(['', 'ab', 'a'.repeat(21)])('길이를 어기면 길이 안내를 한다: %s', (value) => {
    expect(validateHandle(value)).toBe('아이디는 3~20자로 입력해주세요.');
  });

  it.each(['Abc', 'ab.c', 'ab c', '아이디1'])('문자를 어기면 문자 안내를 한다: %s', (value) => {
    expect(validateHandle(value)).toBe('아이디는 영문 소문자, 숫자, 밑줄(_)만 사용할 수 있습니다.');
  });
});

describe('validateNickname', () => {
  it.each(['가나', 'a'.repeat(20), ' ab '])('%s는 통과한다', (value) => {
    expect(validateNickname(value)).toBeNull();
  });

  it.each(['', '가', ' a ', 'a'.repeat(21)])('%s는 길이를 어긴다', (value) => {
    expect(validateNickname(value)).toBe('닉네임은 2~20자로 입력해주세요.');
  });
});

describe('validateEmail', () => {
  it('형식에 맞으면 통과한다', () => {
    expect(validateEmail('demo@gamerin.test')).toBeNull();
  });

  it.each(['', 'demo', 'demo@gamerin', '@gamerin.test', 'de mo@gamerin.test'])('%s는 거절한다', (value) => {
    expect(validateEmail(value)).not.toBeNull();
  });
});

describe('validatePassword', () => {
  it.each(['abcd123!', `${'a1!'.repeat(6)}ab`])('%s는 통과한다', (value) => {
    expect(value.length).toBeGreaterThanOrEqual(8);
    expect(validatePassword(value)).toBeNull();
  });

  it('경계 길이를 확인한다', () => {
    expect(validatePassword('abcd12!')).toBe('비밀번호는 8~20자로 입력해주세요.');
    expect(validatePassword('abcd123!')).toBeNull();
    expect(validatePassword(`${'a'.repeat(17)}12!`)).toBeNull();
    expect(validatePassword(`${'a'.repeat(18)}12!`)).toBe('비밀번호는 8~20자로 입력해주세요.');
  });

  it.each(['abcdefgh1', 'abcdefg!', '12345678!', 'ABCDEFGH', '12345678'])(
    '영문·숫자·특수문자 중 빠진 조합은 거절한다: %s',
    (value) => {
      expect(validatePassword(value)).toBe('비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.');
    },
  );

  it('앞뒤 공백을 지우지 않는다', () => {
    expect(validatePassword(' abc123 ')).toBeNull();
  });
});
