export default function Footer() {
  return (
    <footer className="border-t border-gray-800 py-8 px-6 text-center">
      <p className="text-sm text-gray-500">
        Sleepier is not affiliated with or endorsed by Sleeper.com.
      </p>
      <p className="text-xs text-gray-600 mt-2">
        &copy; {new Date().getFullYear()} Sleepier
      </p>
    </footer>
  );
}
