const MIN_SENTENCES_TO_SUMMARIZE = 3;
const SUMMARY_SENTENCE_COUNT = 2;
const MIN_FRAGMENT_LENGTH = 5;

// "1. 방문 완료. 2. 견적 발송." 처럼 번호를 매겨 쓴 글은 마침표 뒤 공백만 보고 자르면
// "1.", "2." 같은 의미 없는 조각이 따로 문장 취급된다. 너무 짧은 조각은 다음 조각에 붙인다.
function splitSentences(text) {
  const rawPieces = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const sentences = [];
  let pending = '';
  rawPieces.forEach((piece) => {
    const candidate = pending ? `${pending} ${piece}` : piece;
    if (candidate.length < MIN_FRAGMENT_LENGTH) {
      pending = candidate;
    } else {
      sentences.push(candidate);
      pending = '';
    }
  });
  if (pending) {
    if (sentences.length > 0) {
      sentences[sentences.length - 1] += ` ${pending}`;
    } else {
      sentences.push(pending);
    }
  }
  return sentences;
}

// 형태소 분석기 없이 공백으로만 토큰화하므로 조사가 안 떨어지는 등 완벽하진 않다.
// 2글자 미만(대부분 조사/어미)은 걸러 신호 대 잡음비를 조금 높인다.
function tokenize(sentence) {
  return sentence
    .replace(/[.,!?"'()]/g, '')
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

// ponytail: 의미 이해 없이 단어 등장 빈도로 문장에 점수를 매기는 간단한 추출 요약(Luhn류 알고리즘).
// 위치가 아니라 "다른 문장과 단어를 많이 공유하는" 문장을 뽑으므로, 앞부분만 잘라내는 것보다
// 핵심 문장을 더 잘 잡아낸다. 문장이 몇 개 안 되면(짧은 글) 요약할 이유가 없어 null.
function summarizeActivityContent(activityContent) {
  const sentences = splitSentences(activityContent);
  if (sentences.length < MIN_SENTENCES_TO_SUMMARIZE) {
    return null;
  }

  const wordFreq = {};
  sentences.forEach((sentence) => {
    tokenize(sentence).forEach((word) => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
  });

  const scored = sentences.map((sentence, index) => {
    const words = tokenize(sentence);
    const score = words.length === 0 ? 0 : words.reduce((sum, word) => sum + wordFreq[word], 0) / words.length;
    return { sentence, index, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, SUMMARY_SENTENCE_COUNT)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence)
    .join(' ');
}

module.exports = { summarizeActivityContent };
