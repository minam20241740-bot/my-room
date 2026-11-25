/* Projects the actual editable model mesh, including exported expression deltas. */
window.MelluPortrait=class {
  constructor(canvas,{parts=window.MELLU_MODEL,scale=2.42,center=1}={}){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.parts=parts;this.scale=scale;this.center=center;
    this.blink=0;this.talk=0;this.motion=true;
  }
  draw(now=0){
    const ctx=this.ctx,c=this.canvas,W=c.width,H=c.height,s=Math.min(W,H)/this.scale;
    ctx.clearRect(0,0,W,H);
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t=now/1000,cycle=t%4.4;
    const blink=this.blink||(this.motion&&!reduced?Math.max(0,1-Math.abs(cycle-3.7)/.12):0);
    const tilt=this.motion&&!reduced?Math.sin(t*.8)*.012:0;
    for(const part of this.parts||[]){
      const vertices=part.vertices.map((v,i)=>{
        let x=v[0],z=v[2];
        for(const [name,amount] of [['Blink',blink],['Talk',this.talk]]){
          const d=part.morphs?.[name]?.[i];if(d){x+=d[0]*amount;z+=d[2]*amount;}
        }
        if(part.bone==='head'){const a=x,b=z-.716;x=a*Math.cos(tilt)-b*Math.sin(tilt);z=.716+a*Math.sin(tilt)+b*Math.cos(tilt);}
        return [W/2+x*s,H/2-(z-this.center)*s];
      });
      ctx.beginPath();
      for(const face of part.faces){face.forEach((idx,i)=>{const p=vertices[idx];i?ctx.lineTo(...p):ctx.moveTo(...p);});ctx.closePath();}
      const srgb=x=>255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055);
      if(part.gradient){
        const g=part.gradient;
        let top=H/2-(g.top-this.center)*s,bottom=H/2-(g.bottom-this.center)*s;
        if(part.morphs?.Blink){const axis=H/2-((553-258)/250-this.center)*s;top=axis+(top-axis)*(1-.985*blink);bottom=axis+(bottom-axis)*(1-.985*blink);}
        const fill=ctx.createLinearGradient(0,top,0,bottom);
        for(const [offset,color] of g.stops)fill.addColorStop(offset,`rgb(${color.map(srgb).join(',')})`);
        ctx.fillStyle=fill;
      }else ctx.fillStyle=`rgb(${part.color.map(srgb).join(',')})`;
      ctx.fill();
    }
  }
};
