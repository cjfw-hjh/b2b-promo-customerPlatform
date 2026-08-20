import { useState } from 'react';
import CustomerSelect from './CustomerSelect';

const ACTIVITY_TYPES = ['외근', '내근', '기타'];
// PRINCIPLE-ACTIVITY-001: 자동 차단 로직 없이 안내 문구만 둔다 — 입력란 위/아래에 동일 문구 노출.
const ACTIVITY_GUIDE = '※ 가격·계약조건이 아닌, 고객 관계를 위해 한 행동을 적어주세요';

function formatDate(isoString) {
  return (isoString || new Date().toISOString()).slice(0, 10);
}

export default function SalesLogForm({ initialValues, onSubmit, onCancel, submitting, error }) {
  const [customerId, setCustomerId] = useState(initialValues?.customerId ?? '');
  const [activityType, setActivityType] = useState(initialValues?.activityType ?? ACTIVITY_TYPES[0]);
  const [activityContent, setActivityContent] = useState(initialValues?.activityContent ?? '');

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ customerId, activityType, activityContent });
  }

  return (
    <form onSubmit={handleSubmit} className="sales-log-form">
      <label>
        거래처
        <CustomerSelect value={customerId} onChange={setCustomerId} />
      </label>

      <fieldset>
        <legend>영업 형태</legend>
        {ACTIVITY_TYPES.map((type) => (
          <label key={type}>
            <input
              type="radio"
              name="activityType"
              value={type}
              checked={activityType === type}
              onChange={() => setActivityType(type)}
            />
            {type}
          </label>
        ))}
      </fieldset>

      <label>
        활동 내역
        <p className="form-hint">{ACTIVITY_GUIDE}</p>
        <textarea
          value={activityContent}
          onChange={(e) => setActivityContent(e.target.value)}
          rows={6}
          required
        />
        <p className="form-hint">{ACTIVITY_GUIDE}</p>
      </label>

      <p className="form-static">
        작성일 {formatDate(initialValues?.createdAt)} (시스템이 자동 기록, 수정 불가)
      </p>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          취소
        </button>
        <button type="submit" disabled={submitting}>
          저장
        </button>
      </div>
    </form>
  );
}
