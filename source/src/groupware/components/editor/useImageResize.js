import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_WIDTH = 80;
const MAX_WIDTH = 2560;

const clamp = (value) => Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value)));

// 이미지 모서리를 끌어 크기를 바꾼다.
//
// 끄는 동안에는 화면만 바꾸고, 손을 뗄 때 한 번만 문서에 반영한다. 매 픽셀마다
// updateAttributes 를 부르면 되돌리기 기록이 수백 개 쌓여 Ctrl+Z 가 쓸모없어진다.
//
// 포인터 이벤트를 쓰므로 마우스와 터치가 같은 경로를 탄다. 창 전체에서 움직임을
// 듣기 때문에 빠르게 끌어 커서가 이미지 밖으로 나가도 놓치지 않는다.
export default function useImageResize({ width, alignment, onCommit }) {
  const figureRef = useRef(null);
  const [dragWidth, setDragWidth] = useState(null);
  const dragRef = useRef(null);   // 끄는 동안의 최신 너비. 화면 갱신과 별개로 들고 있는다.
  const startRef = useRef(null);  // 잡은 순간의 기준값
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const [dragging, setDragging] = useState(false);

  const startResize = useCallback((event, handle) => {
    if (event.button !== undefined && event.button !== 0) return;
    const figure = figureRef.current;
    if (!figure) return;
    event.preventDefault();
    event.stopPropagation();

    const startWidth = figure.getBoundingClientRect().width;
    startRef.current = { startX: event.clientX, startWidth, handle };
    dragRef.current = clamp(startWidth);
    setDragWidth(dragRef.current);
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (event) => {
      const start = startRef.current;
      if (!start) return;
      const delta = event.clientX - start.startX;
      // 어느 손잡이를 잡았는지, 그리고 이미지가 어느 쪽에 붙어 있는지에 따라
      // 오른쪽으로 끄는 것이 "키우기"일 수도 "줄이기"일 수도 있다.
      let direction = start.handle === 'right' ? 1 : -1;
      if (alignment === 'center') direction *= 2; // 가운데 정렬은 양쪽이 같이 벌어진다
      dragRef.current = clamp(start.startWidth + delta * direction);
      setDragWidth(dragRef.current);
    };

    // 손을 뗄 때 딱 한 번 기록한다. 상태 업데이터 안이 아니라 여기서 부른다.
    const onEnd = () => {
      const next = dragRef.current;
      startRef.current = null;
      dragRef.current = null;
      setDragging(false);
      setDragWidth(null);
      if (next != null) commitRef.current(next);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [dragging, alignment]);

  // 키보드로도 조절할 수 있어야 한다. 손잡이에 초점을 두고 좌우 화살표를 누른다.
  const nudge = useCallback((event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.shiftKey ? 50 : 10;
    const base = figureRef.current?.getBoundingClientRect().width ?? width ?? 640;
    commitRef.current(clamp(base + (event.key === 'ArrowRight' ? step : -step)));
  }, [width]);

  return { figureRef, dragWidth, startResize, nudge, isResizing: dragging };
}
