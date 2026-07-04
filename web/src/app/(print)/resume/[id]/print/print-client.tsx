"use client";

import { useEffect, useRef } from "react";

export function PrintClient() {
  const didPrint = useRef(false);

  useEffect(() => {
    if (didPrint.current) return;
    didPrint.current = true;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="print-toolbar" aria-label="PDF export controls">
      <p>打印对话框中选择“保存为 PDF”。</p>
      <button type="button" onClick={() => window.print()}>
        打印 / 保存为 PDF
      </button>
    </div>
  );
}
