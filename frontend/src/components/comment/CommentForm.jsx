import { useState } from 'react';

// RULE-REPLY-001: 팀장 코멘트가 1건 이상 있어야(disabled=false) 답변 입력이 가능하다.
export default function CommentForm({ onSubmit, disabled, submitting, error }) {
  const [content, setContent] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    const ok = await onSubmit(content);
    if (ok) setContent('');
  }

  return (
    <form onSubmit={handleSubmit} className="comment-form">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="여기에 답변을 입력..."
        disabled={disabled}
        rows={3}
      />
      <button type="submit" disabled={disabled || submitting}>
        등록
      </button>
      {disabled && <p className="form-hint">※ 팀장 코멘트가 1건 이상 있어야 입력 가능합니다.</p>}
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
