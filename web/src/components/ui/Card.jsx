export function Card({ title, children }) {
  return (
    <section className="bg-white/80 dark:bg-gray-900/70 backdrop-blur border border-white/40 dark:border-gray-800/60 rounded-2xl shadow-lg p-6 transition-colors">
      {title ? (
        <h2 className="text-xl font-semibold mb-4 pb-3 border-b border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 transition-colors">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
