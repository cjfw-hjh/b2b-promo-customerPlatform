import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSalesLog } from '../../api/salesLogApi';
import { createComment, listComments } from '../../api/commentApi';
import { listCustomers } from '../../api/customerApi';
import CommentThread from '../../components/comment/CommentThread';
import CommentForm from '../../components/comment/CommentForm';

// 팀장은 영업일지 자체를 읽기만 한다 — 수정/삭제 버튼은 이 화면에 두지 않는다(권한 없음, SalesLogDetailPage와 대비).
export default function SalesLogReviewPage() {
  const { id } = useParams();
  const [log, setLog] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // RULE-FEEDBACK-001/002: 팀장 코멘트는 횟수 제한도, 최초 코멘트 선행 조건도 없다 — 항상 활성.
  async function handleAddComment(content) {
    setCommentError('');
    setSubmittingComment(true);
    try {
      const comment = await createComment(id, content);
      setComments((prev) => [...prev, comment]);
      // 첫 코멘트라면 상태가 "작성 완료" -> "코멘트 진행중"으로 바뀌므로 서버 값을 다시 반영한다.
      getSalesLog(id).then(setLog);
      return true;
    } catch (err) {
      setCommentError(err.message);
      return false;
    } finally {
      setSubmittingComment(false);
    }
  }

  if (loading) return <p>불러오는 중...</p>;

  const customerName = customers.find((c) => c.id === log.customerId)?.name;

  return (
    <div>
      <p>
        <Link to="/manager/logs">&lt; 목록으로</Link> 작성자: {log.authorEmployeeNo} 상태: {log.status}
      </p>

      <p>
        거래처: {customerName} 영업 형태: {log.activityType}
      </p>
      <p className="form-static">작성일: {log.createdAt.slice(0, 10)}</p>

      <h2>활동 내역 (읽기 전용)</h2>
      <p>{log.activityContent}</p>

      <h2>코멘트 스레드</h2>
      <CommentThread comments={comments} />

      <h3>코멘트 입력</h3>
      <CommentForm
        onSubmit={handleAddComment}
        disabled={false}
        submitting={submittingComment}
        error={commentError}
        placeholder="여기에 코멘트를 입력..."
      />
    </div>
  );
}
