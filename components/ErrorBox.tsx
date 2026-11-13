export function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p className="whitespace-pre-line rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {msg}
    </p>
  );
}
