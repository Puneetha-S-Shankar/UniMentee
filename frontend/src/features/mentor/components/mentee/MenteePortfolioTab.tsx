export function MenteePortfolioTab() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-14 text-center">
      <p className="text-sm font-medium text-gray-600">
        Portfolio view for mentors is coming soon.
      </p>
      <p className="mt-2 text-xs text-gray-500">
        A dedicated endpoint (for example GET /students/:id/portfolio) will list this mentee&apos;s
        items read-only.
      </p>
    </div>
  );
}
