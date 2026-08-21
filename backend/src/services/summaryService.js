const EXCERPT_LENGTH = 80;

// ponytail: LLM 호출 없이 앞부분만 잘라내는 발췌 방식. 이미 짧으면(잘라낼 게 없으면) null.
function summarizeActivityContent(activityContent) {
  if (activityContent.length <= EXCERPT_LENGTH) {
    return null;
  }
  return `${activityContent.slice(0, EXCERPT_LENGTH)}...`;
}

module.exports = { summarizeActivityContent };
