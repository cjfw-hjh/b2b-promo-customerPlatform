import { useEffect, useState } from 'react';
import { listSalesLogs } from '../../api/salesLogApi';
import { listCustomers } from '../../api/customerApi';
import CustomerSelect from '../../components/salesLog/CustomerSelect';
import SalesLogListItem from '../../components/salesLog/SalesLogListItem';

const ACTIVITY_TYPES = ['외근', '내근', '기타'];
const EMPTY_FILTERS = { from: '', to: '', customerId: '', activityType: '', keyword: '' };

function toQuery(filters) {
  const query = {};
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;
  if (filters.customerId !== '') query.customerId = filters.customerId;
  if (filters.activityType) query.activityType = filters.activityType;
  if (filters.keyword) query.keyword = filters.keyword;
  return query;
}

export default function SalesLogListPage() {
  const [customers, setCustomers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    listCustomers().then(setCustomers);
  }, []);

  async function search(e) {
    e?.preventDefault();
    setLoading(true);
    setLogs(await listSalesLogs(toQuery(filters)));
    setLoading(false);
  }

  // 최초 진입 시 조건 없이 전체 목록(본인 것만)을 보여준다.
  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const customerNameById = Object.fromEntries(customers.map((c) => [c.id, c.name]));

  return (
    <div>
      <h1>내 영업일지 조회/검색</h1>

      <form onSubmit={search} className="sales-log-search">
        <label>
          기간
          <input type="date" value={filters.from} onChange={(e) => updateFilter('from', e.target.value)} />
          ~
          <input type="date" value={filters.to} onChange={(e) => updateFilter('to', e.target.value)} />
        </label>
        <label>
          거래처
          <CustomerSelect
            value={filters.customerId}
            onChange={(value) => updateFilter('customerId', value)}
            includeAllOption
          />
        </label>
        <label>
          영업 형태
          <select value={filters.activityType} onChange={(e) => updateFilter('activityType', e.target.value)}>
            <option value="">전체</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          키워드
          <input value={filters.keyword} onChange={(e) => updateFilter('keyword', e.target.value)} />
        </label>
        <button type="submit">검색</button>
      </form>

      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        <ul className="sales-log-list">
          {logs.map((log) => (
            <SalesLogListItem key={log.id} log={log} customerName={customerNameById[log.customerId]} />
          ))}
        </ul>
      )}
    </div>
  );
}
