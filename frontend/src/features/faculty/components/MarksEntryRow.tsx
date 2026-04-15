type Props = {
  usn: string;
  name: string;
  maxMarks: number;
  marksObtained: number | null;
  isAbsent: boolean;
  disabled: boolean;
  onMarksChange: (value: number | null) => void;
  onAbsentChange: (absent: boolean) => void;
  onCommit: () => void;
};

export default function MarksEntryRow({
  usn,
  name,
  maxMarks,
  marksObtained,
  isAbsent,
  disabled,
  onMarksChange,
  onAbsentChange,
  onCommit,
}: Props) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="whitespace-nowrap px-3 py-2 font-mono text-sm">{usn}</td>
      <td className="px-3 py-2 text-sm">{name}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          max={maxMarks}
          step={0.5}
          disabled={disabled || isAbsent}
          value={marksObtained === null || marksObtained === undefined ? '' : marksObtained}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') {
              onMarksChange(null);
              return;
            }
            const n = Number(v);
            if (Number.isNaN(n)) return;
            onMarksChange(Math.min(maxMarks, Math.max(0, n)));
          }}
          onBlur={onCommit}
          className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 disabled:opacity-50"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={isAbsent}
          disabled={disabled}
          onChange={(e) => {
            onAbsentChange(e.target.checked);
          }}
          className="h-4 w-4 rounded border-gray-300"
        />
      </td>
    </tr>
  );
}
