"use client";
import { useToast } from "./ToastProvider";

export default function SubnavChips(){
  const { showToast } = useToast();
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    showToast('分区栏待定，稍后上线~', 'info');
  };
  return (
    <div className="subnav">
      <a href="#" className="chip" onClick={onClick}>科技</a>
      <a href="#" className="chip" onClick={onClick}>生活</a>
      <a href="#" className="chip" onClick={onClick}>随笔</a>
    </div>
  );
}
