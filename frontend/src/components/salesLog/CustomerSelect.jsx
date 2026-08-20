import { useEffect, useState } from 'react';
import { listCustomers } from '../../api/customerApi';

// RULE-CUSTOMER-001/002: 사전 등록된 거래처 중에서만 선택, 신규 등록 UI는 없음.
export default function CustomerSelect({ value, onChange }) {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    listCustomers().then(setCustomers);
  }, []);

  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} required>
      <option value="" disabled>
        거래처 선택
      </option>
      {customers.map((customer) => (
        <option key={customer.id} value={customer.id}>
          {customer.name}
        </option>
      ))}
    </select>
  );
}
