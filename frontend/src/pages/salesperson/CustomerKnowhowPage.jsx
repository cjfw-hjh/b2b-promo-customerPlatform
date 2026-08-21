import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCustomerKnowhow } from '../../api/customerApi';
import CustomerSelect from '../../components/salesLog/CustomerSelect';

// RULE-KNOWHOW-003: 코멘트/답변은 BE-11 응답 자체에 없으므로 화면에서도 노출할 여지가 없다.
export default function CustomerKnowhowPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    getCustomerKnowhow(id)
      .then((result) => {
        setLogs(result);
        setLoadError('');
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div>
      <h1>거래처 Know-how 조회</h1>

      <label>
        거래처
        <CustomerSelect
          value={Number(id)}
          onChange={(value) => navigate(`/salesperson/customers/${value}/knowhow`)}
        />
      </label>

      {loading ? (
        <p>불러오는 중...</p>
      ) : loadError ? (
        <p className="form-error">{loadError}</p>
      ) : logs.length === 0 ? (
        <p className="form-hint">등록된 활동 이력이 없습니다.</p>
      ) : (
        <ul className="comment-thread">
          {logs.map((log, idx) => (
            <li key={idx} className="comment-thread__item">
              <div className="comment-thread__meta">
                <span>{log.createdAt.slice(0, 10)}</span>
                <span>{log.authorEmployeeNo}</span>
              </div>
              <p>{log.activityContent}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
