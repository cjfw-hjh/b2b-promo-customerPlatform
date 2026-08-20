import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteSalesLog, getSalesLog } from '../../api/salesLogApi';
import { createComment, listComments } from '../../api/commentApi';
import { listCustomers } from '../../api/customerApi';
import CommentThread from '../../components/comment/CommentThread';
import CommentForm from '../../components/comment/CommentForm';

export default function SalesLogDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteError, setDeleteError] = useState('');
  const [commentError, setCommentError] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    Promise.all([getSalesLog(id), listComments(id), listCustomers()]).then(
      ([logResult, commentsResult, customersResult]) => {
        setLog(logResult);
        setComments(commentsResult);
        setCustomers(customersResult);
        setLoading(false);
      }
    );
  }, [id]);

  async function handleDelete() {
    setDeleteError('');
    try {
      await deleteSalesLog(id);
      navigate('/salesperson/logs');
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  // RULE-REPLY-005 / RULE-FEEDBACK-004: 저장 성공 시 서버가 돌려준 코멘트를 그대로 스레드에 붙인다.
  async function handleAddComment(content) {
    setCommentError('');
    setSubmittingComment(true);
    try {
      const comment = await createComment(id, content);
      setComments((prev) => [...prev, comment]);
      return true;
    } catch (err) {
      setCommentError(err.message);
      return false;
    } finally {
      setSubmittingComment(false);
    }
  }

  if (loading) return <p>불러오는 중...</p>;

  // RULE-LOG-005 / RULE-REPLY-001: 백엔드도 코멘트 유형을 구분하지 않고 개수만으로 판단한다.
  const hasComments = comments.length > 0;
  const customerName = customers.find((c) => c.id === log.customerId)?.name;

  return (
    <div>
      <p>
        <Link to="/salesperson/logs">&lt; 목록으로</Link> 상태: {log.status}
      </p>

      <p>
        거래처: {customerName} 영업 형태: {log.activityType}
      </p>
      <p className="form-static">
        작성일: {log.createdAt.slice(0, 10)} (수정해도 최초 작성일은 변경되지 않음)
      </p>

      <h2>활동 내역</h2>
      <p>{log.activityContent}</p>

      <div className="form-actions">
        <button type="button" onClick={() => navigate(`/salesperson/logs/${id}/edit`)}>
          수정
        </button>
        <button type="button" onClick={handleDelete} disabled={hasComments}>
          삭제{hasComments ? ' (비활성화)' : ''}
        </button>
      </div>
      {deleteError && <p className="form-error">{deleteError}</p>}

      <h2>코멘트 스레드</h2>
      <CommentThread comments={comments} />

      <h3>답변 입력</h3>
      <CommentForm
        onSubmit={handleAddComment}
        disabled={!hasComments}
        submitting={submittingComment}
        error={commentError}
      />
    </div>
  );
}
