import "./print.css";

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="print-shell min-h-screen bg-white text-[#0b1c30]">{children}</div>;
}
