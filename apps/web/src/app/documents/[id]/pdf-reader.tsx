// Read the official PDF in the page with PDF.js: original layout, selectable text, zoom, and page tracking.
"use client";

import "pdfjs-dist/web/pdf_viewer.css";
import { useEffect, useRef, useState } from "react";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { Loader } from "../../loader";

let workerPort: Worker | null = null;

/** Shows one PDF; calls `onFail` when it cannot be loaded so the page can fall back to plain text. */
export function PdfReader({ url, title, onFail }: { url: string; title: string; onFail: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<PDFViewer | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | undefined;
    const fitWidth = () => { if (viewer.current) viewer.current.currentScaleValue = "page-width"; };
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      // The viewer module reads PDF.js from this global when it loads.
      (globalThis as { pdfjsLib?: unknown }).pdfjsLib = pdfjs;
      const { EventBus, PDFLinkService, PDFViewer } = await import("pdfjs-dist/web/pdf_viewer.mjs");
      workerPort ??= new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
      pdfjs.GlobalWorkerOptions.workerPort = workerPort;
      const task = pdfjs.getDocument({ url });
      destroy = () => task.destroy();
      const pdf = await task.promise;
      if (cancelled || !container.current) return;
      const eventBus = new EventBus();
      const linkService = new PDFLinkService({ eventBus });
      viewer.current = new PDFViewer({ container: container.current, eventBus, linkService });
      linkService.setViewer(viewer.current);
      eventBus.on("pagesinit", fitWidth);
      eventBus.on("pagechanging", ({ pageNumber }: { pageNumber: number }) => setPage(pageNumber));
      eventBus.on("scalechanging", ({ scale }: { scale: number }) => setZoom(Math.round(scale * 100)));
      viewer.current.setDocument(pdf);
      linkService.setDocument(pdf);
      setPages(pdf.numPages);
      setReady(true);
    })().catch(() => { if (!cancelled) onFail(); });
    window.addEventListener("resize", fitWidth);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", fitWidth);
      viewer.current = null;
      void destroy?.();
    };
  }, [url, onFail]);

  return <div className="pdf-reader">
    <div className="pdf-toolbar" aria-label="PDF controls" role="toolbar">
      <span aria-live="polite">{pages ? `Page ${page} of ${pages}` : "Official PDF"}</span>
      <span className="pdf-spacer" />
      <button type="button" aria-label="Zoom out" disabled={!ready} onClick={() => viewer.current?.decreaseScale()}>−</button>
      <span>{zoom}%</span>
      <button type="button" aria-label="Zoom in" disabled={!ready} onClick={() => viewer.current?.increaseScale()}>+</button>
      <button type="button" disabled={!ready} onClick={() => { if (viewer.current) viewer.current.currentScaleValue = "page-width"; }}>Fit width</button>
      <a href={url} download>Download</a>
    </div>
    <div className="pdf-stage">
      <div className="pdf-scroll" ref={container} tabIndex={0} aria-label={`Official PDF of ${title}`}><div className="pdfViewer" /></div>
      {!ready && <Loader label="Loading the official PDF…" />}
    </div>
  </div>;
}
