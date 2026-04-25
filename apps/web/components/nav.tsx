import Image from "next/image";

const links = [
  { label: "Features", href: "#features" },
  { label: "Download", href: "#download" },
  { label: "Requirements", href: "#requirements" },
];

export default function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur border-b border-gray-800/50">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-3">
        <a href="#" className="flex items-center gap-2">
          <Image src="/images/logo.png" alt="Sleepier" width={32} height={32} />
          <span className="text-lg font-bold tracking-tight">Sleepier</span>
        </a>
        <div className="flex items-center gap-6">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
