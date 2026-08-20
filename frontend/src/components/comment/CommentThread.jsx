// 서버가 이미 시간순(created_at ASC)으로 정렬해 내려주므로 그대로 렌더링한다.
export default function CommentThread({ comments }) {
  if (comments.length === 0) {
    return <p className="form-hint">아직 등록된 코멘트가 없습니다.</p>;
  }

  return (
    <ul className="comment-thread">
      {comments.map((comment) => (
        <li key={comment.id} className="comment-thread__item">
          <div className="comment-thread__meta">
            <span
              className={`comment-type comment-type--${comment.type === '팀장 코멘트' ? 'manager' : 'reply'}`}
            >
              [{comment.type}]
            </span>
            <span>{comment.createdAt.slice(0, 10)}</span>
          </div>
          <p>{comment.content}</p>
        </li>
      ))}
    </ul>
  );
}
