import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SalesLogForm from '../../components/salesLog/SalesLogForm';
import { createSalesLog, getSalesLog, updateSalesLog } from '../../api/salesLogApi';

export default function SalesLogFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialValues, setInitialValues] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!id) return;
    getSalesLog(id)
      .then(setInitialValues)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(values) {
    setError('');
    setSubmitting(true);
    try {
      const log = id ? await updateSalesLog(id, values) : await createSalesLog(values);
      navigate(`/salesperson/logs/${log.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>불러오는 중...</p>;
  if (loadError) {
    return (
      <div>
        <p>
          <Link to="/salesperson/logs">&lt; 목록으로</Link>
        </p>
        <p className="form-error">{loadError}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>영업일지 {id ? '수정' : '작성'}</h1>
      <SalesLogForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
        submitting={submitting}
        error={error}
      />
    </div>
  );
}
