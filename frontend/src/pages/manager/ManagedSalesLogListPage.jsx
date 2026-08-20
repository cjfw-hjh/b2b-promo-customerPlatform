import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listManagedSalesLogs } from '../../api/salesLogApi';
import { listCustomers } from '../../api/customerApi';
import StatusBadge from '../../components/salesLog/StatusBadge';

// RULE-ORG-008: 서버가 이미 자신에게 매핑된 영업사원의 일지만 반환하므로 프론트에서 추가 필터링은 없다.
export default function ManagedSalesLogListPage() {
  const [logs, setLogs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listManagedSalesLogs(), listCustomers()]).then(([logsResult, customersResult]) => {
      setLogs(logsResult);
      setCustomers(customersResult);
      setLoading(false);
    });
  }, []);

  if (loading) return <p>불러오는 중...</p>;

  const customerNameById = Object.fromEntries(customers.map((c) => [c.id, c.name]));

  return (
    <div>
      <h1>팀원 영업일지 목록</h1>
      <ul className="sales-log-list">
        {logs.map((log) => (
          <li key={log.id} className="sales-log-list-item">
            <Link to={`/manager/logs/${log.id}`}>
              <span>{log.authorEmployeeNo}</span>
              <span>{customerNameById[log.customerId]}</span>
              <span>{log.activityType}</span>
              <span>{log.createdAt.slice(0, 10)}</span>
              <StatusBadge status={log.status} />
              {/* PRD 5.11: 새 상태값을 만들지 않고, 코멘트 미작성 "작성 완료" 건만 별표로 강조한다. */}
              {log.status === '작성 완료' && <span title="코멘트 미작성">★</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
