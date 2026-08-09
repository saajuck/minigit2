import { useRef, type MouseEvent as ReactMouseEvent } from "react";

interface Props {
  onResize: (deltaX: number) => void;
  className?: string;
}

export default function ResizableDivider({ onResize, className }: Props) {
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);

  function handleMouseDown(e: ReactMouseEvent) {
    draggingRef.current = true;
    lastXRef.current = e.clientX;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    e.preventDefault();
  }

  function handleMouseMove(e: globalThis.MouseEvent) {
    if (!draggingRef.current) return;
    const delta = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    onResize(delta);
  }

  function handleMouseUp() {
    draggingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }

  return (
    <div
      className={`resizable-divider${className ? ` ${className}` : ""}`}
      onMouseDown={handleMouseDown}
    />
  );
}
