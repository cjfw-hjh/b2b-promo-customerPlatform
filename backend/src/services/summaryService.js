const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

// 영업일지 저장을 막으면 안 되므로(notificationService.js의 RULE-NOTIFICATION-001과 동일한 원칙),
// 실패 시(API 키 없음, 네트워크 오류 등) 에러를 삼키고 null을 반환한다.
async function summarizeActivityContent(activityContent) {
  try {
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 500,
      output_config: { effort: 'low' },
      messages: [
        {
          role: 'user',
          content: `다음은 영업사원이 작성한 영업일지 활동 내역이다. 핵심만 2~3문장으로 한국어로 요약해줘. 요약 문장만 출력하고 다른 말은 덧붙이지 마.\n\n${activityContent}`,
        },
      ],
    });
    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock ? textBlock.text.trim() : null;
  } catch (err) {
    console.error('[summary] 요약 생성 실패:', err.message);
    return null;
  }
}

module.exports = { summarizeActivityContent };
