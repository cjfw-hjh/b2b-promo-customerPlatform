import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup } from '../../api/authApi';

const ROLE_SALESPERSON = 'salesperson';
const ROLE_MANAGER = 'manager';

export default function SignupPage() {
  const [employeeNo, setEmployeeNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(ROLE_SALESPERSON);
  const [managerEmail, setManagerEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // RULE-ORG-006: 팀장 가입 시 팀장 이메일은 입력란 자체가 없으므로 보내지 않는다.
      await signup({
        employeeNo,
        email,
        password,
        role,
        ...(role === ROLE_SALESPERSON ? { managerEmail } : {}),
      });
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>정성을 보여줘</h1>
      <h2>회원가입</h2>
      <form onSubmit={handleSubmit}>
        <label>
          사번 (6자리)
          <input
            value={employeeNo}
            onChange={(e) => setEmployeeNo(e.target.value)}
            maxLength={6}
            required
          />
        </label>
        <label>
          이메일
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          비밀번호 (7자리 이상)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <fieldset>
          <legend>역할</legend>
          <label>
            <input
              type="radio"
              name="role"
              value={ROLE_SALESPERSON}
              checked={role === ROLE_SALESPERSON}
              onChange={() => setRole(ROLE_SALESPERSON)}
            />
            영업사원
          </label>
          <label>
            <input
              type="radio"
              name="role"
              value={ROLE_MANAGER}
              checked={role === ROLE_MANAGER}
              onChange={() => setRole(ROLE_MANAGER)}
            />
            팀장
          </label>
        </fieldset>

        {role === ROLE_SALESPERSON && (
          <label>
            팀장 이메일
            <input
              type="email"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              required
            />
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          회원가입
        </button>
      </form>
      <p>
        이미 계정이 있으신가요? <Link to="/login">로그인</Link>
      </p>
    </div>
  );
}
