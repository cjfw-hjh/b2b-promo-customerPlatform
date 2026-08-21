const { summarizeActivityContent } = require('./summaryService');

describe('summarizeActivityContent', () => {
  test('문장이 3개 미만이면 요약할 이유가 없어 null을 반환한다', () => {
    expect(summarizeActivityContent('짧은 문장.')).toBeNull();
    expect(summarizeActivityContent('문장 하나. 문장 둘.')).toBeNull();
  });

  test('다른 문장과 단어를 가장 많이 공유하는 문장들을 위치 순서대로 뽑는다', () => {
    // 가나다/라마바는 여기서만 등장(점수 1), 사과/바나나는 두 문장에 걸쳐 등장(점수 2),
    // 다른어휘는 한 번뿐이라 세 번째 문장 점수를 살짝 끌어내린다.
    const content = '가나다 라마바. 사과 바나나. 사과 바나나 다른어휘.';
    expect(summarizeActivityContent(content)).toBe('사과 바나나. 사과 바나나 다른어휘.');
  });

  test('가장 낮은 점수의 문장은 요약에서 빠진다', () => {
    const content = '가나다 라마바. 사과 바나나. 사과 바나나 다른어휘.';
    expect(summarizeActivityContent(content)).not.toContain('가나다');
  });
});
