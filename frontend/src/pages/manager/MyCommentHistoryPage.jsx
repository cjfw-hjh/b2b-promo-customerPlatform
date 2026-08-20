import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listManagedComments } from '../../api/commentApi';

// 서버가 이미 최신순(created_at DESC)으로 반환하므로 그대로 렌더링한다. 별도 필터/정렬 없음(와이어프레임 9번).
export default function MyCommentHistoryPage() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listManagedComments().then((result) => {
      setComments(result);
      setLoading(false);
    });
  }, []);

  if (loading) return <p>불러오는 중...</p>;

  return (
    <div>
      <h1>내가 남긴 코멘트 이력</h1>
      <ul className="sales-log-list">
        {comments.map((comment) => (
          <li key={comment.id} className="sales-log-list-item">
            <Link to={`/manager/logs/${comment.salesLogId}`}>
              <span>{comment.createdAt.slice(0, 10)}</span>
              <span>{comment.authorEmployeeNo}</span>
              <span>{comment.customerName}</span>
              <span>{comment.content}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
