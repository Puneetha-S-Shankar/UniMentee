import type { AttendanceToggle } from './attendanceTypes';

type Props = {
  usn: string;
  name: string;
  status: AttendanceToggle;
  disabled?: boolean;
  onChange: (status: AttendanceToggle) => void;
};

const btn =
  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export default function AttendanceToggleRow({ usn, name, status, disabled, onChange }: Props) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="whitespace-nowrap px-3 py-2 font-mono text-sm text-gray-900 dark:text-gray-100">{usn}</td>
      <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{name}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('PRESENT')}
            className={`${btn} ${
              status === 'PRESENT'
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-600 ring-offset-1 dark:ring-offset-gray-900'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200'
            }`}
          >
            Present
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('ABSENT')}
            className={`${btn} ${
              status === 'ABSENT'
                ? 'bg-red-600 text-white ring-2 ring-red-600 ring-offset-1 dark:ring-offset-gray-900'
                : 'bg-red-50 text-red-800 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-200'
            }`}
          >
            Absent
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('LATE')}
            className={`${btn} ${
              status === 'LATE'
                ? 'bg-amber-500 text-white ring-2 ring-amber-500 ring-offset-1 dark:ring-offset-gray-900'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100'
            }`}
          >
            Late
          </button>
        </div>
      </td>
    </tr>
  );
}
