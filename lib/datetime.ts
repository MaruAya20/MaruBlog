export function pad2(n: number){ return n < 10 ? `0${n}` : String(n); }

export function formatYMDHM(input: string | Date){
  const d = (input instanceof Date) ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const Y = d.getFullYear();
  const M = pad2(d.getMonth() + 1);
  const D = pad2(d.getDate());
  const h = pad2(d.getHours());
  const m = pad2(d.getMinutes());
  return `${Y}.${M}.${D}  ${h}:${m}`; // 两个空格分隔
}
