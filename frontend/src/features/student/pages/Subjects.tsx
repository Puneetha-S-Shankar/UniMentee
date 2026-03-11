/**
 * Student Subjects Page
 * 
 * View for students to see their enrolled subjects
 */
export default function Subjects() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          My Subjects
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          View your enrolled subjects and course details
        </p>
      </div>

      {/* Subjects content will be implemented here */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <p className="text-gray-600 dark:text-gray-400">
          Subject list will be displayed here
        </p>
      </div>
    </div>
  );
}
