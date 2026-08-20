import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

export default function SalesLogListItem({ log, customerName }) {
  return (
    <li className="sales-log-list-item">
      <Link to={`/salesperson/logs/${log.id}`}>
        <span>{log.createdAt.slice(0, 10)}</span>
        <span>{customerName}</span>
        <span>{log.activityType}</span>
        <StatusBadge status={log.status} />
      </Link>
    </li>
  );
}
