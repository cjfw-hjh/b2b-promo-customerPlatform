import { useEffect, useState } from 'react';
import { listCustomers } from '../../api/customerApi';

// RULE-CUSTOMER-001/002: 사전 등록된 거래처 중에서만 선택, 신규 등록 UI는 없음.
// includeAllOption: 검색 화면의 "전체" 필터처럼 미선택 상태를 허용할 때 사용.
export default function CustomerSelect({ value, onChange, includeAllOption = false }) {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    listCustomers().then(setCustomers);
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      required={!includeAllOption}
    >
      {includeAllOption ? (
        <option value="">전체</option>
      ) : (
        <option value="" disabled>
          거래처 선택
        </option>
      )}
      {customers.map((customer) => (
        <option key={customer.id} value={customer.id}>
          {customer.name}
        </option>
      ))}
    </select>
  );
}
