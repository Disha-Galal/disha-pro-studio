/** Coordinates are in viewport space: x grows rightward and y downward. */
export type TextBox = { text: string; x: number; y: number; width: number; height: number; rtl: boolean };

export function itemsToBoxes(items: unknown[], viewport: number[]): TextBox[] {
  return items.flatMap(item => {
    if (!item || typeof item !== 'object' || !('str' in item) || !('transform' in item)) return [];
    const t = item as { str: string; transform: number[]; width: number; height: number; dir?: string };
    if (!t.str.trim() || !Array.isArray(t.transform)) return [];
    const [a,b,c,d,e,f] = viewport;
    const x = a*t.transform[4]+c*t.transform[5]+e;
    const y = b*t.transform[4]+d*t.transform[5]+f;
    return [{text:t.str,x,y,width:Math.abs(t.width)*Math.hypot(a,b),height:Math.max(1,Math.abs(t.height)*Math.hypot(c,d)),rtl:t.dir==='rtl' || /[\u0600-\u06ff]/.test(t.str)}];
  });
}

function gap(boxes: TextBox[], axis: 'x' | 'y') {
  if (!boxes.length) return { size: 0, at: 0 };
  const intervals = boxes.map(b => axis==='x' ? [b.x,b.x+b.width] : [b.y-b.height,b.y]).sort((a,b)=>a[0]-b[0]);
  let end=intervals[0][1], size=0, at=0;
  for (const interval of intervals.slice(1)) {
    if(interval[0]-end>size){size=interval[0]-end;at=(interval[0]+end)/2;}
    end=Math.max(end,interval[1]);
  }
  return {size,at};
}

/** Conservative whitespace cuts preserve columns; unusual layouts still need review. */
export function layoutPage(boxes: TextBox[], depth=0): string {
  if (!boxes.length) return '';
  const heights=boxes.map(b=>b.height).sort((a,b)=>a-b);
  const height=heights[Math.floor(heights.length/2)];
  const rtl=boxes.filter(b=>b.rtl).reduce((n,b)=>n+b.text.length,0)>boxes.reduce((n,b)=>n+b.text.length,0)/2;
  if(depth<12 && boxes.length>1){
    const vertical=gap(boxes,'x');
    if(vertical.size>Math.max(24,height*2)){
      const left=boxes.filter(b=>b.x<vertical.at),right=boxes.filter(b=>b.x>=vertical.at);
      if(left.length && right.length)return (rtl?[right,left]:[left,right]).map(b=>layoutPage(b,depth+1)).join('\n\n');
    }
    const horizontal=gap(boxes,'y');
    if(horizontal.size>height*0.9){
      const top=boxes.filter(b=>b.y<horizontal.at),bottom=boxes.filter(b=>b.y>=horizontal.at);
      if(top.length && bottom.length)return [top,bottom].map(b=>layoutPage(b,depth+1)).join('\n\n');
    }
  }
  const lines: TextBox[][]=[];
  for(const box of [...boxes].sort((a,b)=>a.y-b.y || a.x-b.x)){
    const last=lines.at(-1);
    if(last && Math.abs(last[0].y-box.y)<=Math.max(2,Math.min(last[0].height,box.height)*0.4))last.push(box);
    else lines.push([box]);
  }
  return lines.map(line=>{
    const lineRtl=line.some(b=>b.rtl);
    line.sort((a,b)=>lineRtl?b.x-a.x:a.x-b.x);
    return line.map((box,i)=>{
      if(!i)return box.text;
      const prev=line[i-1];
      const space=lineRtl?prev.x-(box.x+box.width):box.x-(prev.x+prev.width);
      return (space>height*0.12 && !/\s$/.test(prev.text) && !/^\s/.test(box.text)?' ':'')+box.text;
    }).join('');
  }).join('\n');
}
