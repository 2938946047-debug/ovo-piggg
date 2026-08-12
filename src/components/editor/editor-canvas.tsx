"use client";

import dynamic from "next/dynamic";

const CanvasStage = dynamic(() => import("./canvas-stage"), {
  ssr: false,
  loading: () => <div className="canvas-loading">正在准备白页</div>,
});

export default CanvasStage;
