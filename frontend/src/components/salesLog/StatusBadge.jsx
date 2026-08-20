// 상태는 서버가 comments 개수로 계산해 내려주는 값을 그대로 표시한다 — 프론트에서 재계산하지 않는다.
export default function StatusBadge({ status }) {
  const variant = status === '코멘트 진행중' ? 'commented' : 'done';
  return <span className={`status-badge status-badge--${variant}`}>{status}</span>;
}
