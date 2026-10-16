import { Drawing, square, type Vertex } from "./primitives.ts"
import { hash } from "./land.ts"
import { block, stone } from "./workshops.ts"
import { blossom, leaf } from "./park-furnishings.ts"

export function parkPaving(d:Drawing,u:number,v:number,z:number){
  d.face(square(u,v,.5,z),0xc7cdbf,0)
  const px=.25,py=.2
  for(let row=Math.floor((v-.5)/py);row<Math.ceil((v+.5)/py);row++){
    const shift=Math.abs(row%2)*px/2
    for(let col=Math.floor((u-.5-shift)/px);col<Math.ceil((u+.5-shift)/px);col++){
      const l=Math.max(u-.5,col*px+shift),r=Math.min(u+.5,(col+1)*px+shift),b=Math.max(v-.5,row*py),t=Math.min(v+.5,(row+1)*py)
      if(r-l<.025||t-b<.025)continue
      const h=hash(col,row),top=h<.25?0xdce1d4:h<.65?0xe6e8dd:0xeeeede
      d.box((l+r)/2,(b+t)/2,(r-l)/2-.004,(t-b)/2-.004,z,.3,top,0xc5cdbd,0xb8c3b4,.3,0x9aa895)
      if(h<.18)d.line([[l+.025,b+.035,z+.31],[l+.055,b+.035,z+.31]],.22,0xb8c1ad)
    }
  }
}

export function turf(d:Drawing,u:number,v:number,z:number,x:number,y:number){
  for(let i=0;i<5;i++){
    const a=u-.4+hash(x*7+i,y*3)*.8,b=v-.4+hash(y*5+i,x*2)*.8
    for(let j=0;j<3;j++){
      const theta=j*2.1+i,h=.55+hash(x+i,y+j)*.65,dx=Math.cos(theta)*.025,dy=Math.sin(theta)*.025
      d.face([[a-dy*.3,b+dx*.3,z+.02],[a+dx*.35,b+dy*.35,z+h],[a+dy*.3,b-dx*.3,z+.02]],j%2?0xa8bf94:0xb6cba2,0)
    }
  }
}

export function flowerPlot(d:Drawing,u:number,v:number,z:number,x:number,y:number){
  block(d,u,v,.32,.32,z,.55,[0xb5aa8d,0xb5aa8d,0x9a947e],0)
  for(const side of [-1,1]){
    block(d,u,v+side*.33,.35,.018,z,1.05,stone,.4)
    block(d,u+side*.33,v,.018,.33,z,1.05,stone,.4)
    for(const offset of [-.17,.17])d.line([[u+offset,v+side*.313,z+1.06],[u+offset,v+side*.348,z+1.06]],.3,0x9ca88f)
  }
  const colors=[0xc78374,0xd2b871,0xb49bc0,0xd6a1a1]
  for(let i=0;i<7;i++){
    const t=i*2.4,r=i===0?0:.14+hash(x+i,y)*.09
    const a=u+Math.cos(t)*r,b=v+Math.sin(t)*r
    const color=colors[Math.floor(hash(x*3+i,y*2)*colors.length)]!
    for(let j=0;j<5;j++)leaf(d,a,b,z+.6,t+j*Math.PI*2/5,1.3)
    for(let j=0;j<3;j++){
      const angle=t+j*Math.PI*2/3
      blossom(d,a+Math.cos(angle)*.037,b+Math.sin(angle)*.037,z+.55,color,angle)
    }
  }
}

/** Edged gravel follows existing path connections. The entrance remains open. */
export function gravelWalk(d:Drawing,u:number,v:number,z:number,joins:ReadonlyArray<{dx:number;dy:number;end:number}>,x:number,y:number){
  const w=.2,gravel=0xe7dfcb
  d.face(square(u,v,w,z+.03),gravel,0)
  for(const {dx,dy,end} of joins){
    const q=(along:number,across:number,h=z+.04):Vertex=>[u+dx*along-dy*across,v+dy*along+dx*across,h]
    if(end>0){
      d.face([q(w,-w),q(end,-w),q(end,w),q(w,w)],gravel,0)
      for(const side of [-1,1]){
        const c=q((w+end)/2,side*(w+.013))
        block(d,c[0],c[1],dx?(end-w)/2:.013,dy?(end-w)/2:.013,z,.55,stone,.3)
        for(let t=w+.13;t<end;t+=.16)d.line([q(t,side*w,z+.56),q(t,side*(w+.026),z+.56)],.25,0x9caa91)
      }
    }else{
      const c=q(w+.013,0)
      block(d,c[0],c[1],dx?.013:w+.026,dy?.013:w+.026,z,.55,stone,.3)
    }
  }
  // Small gravel grains sit on the walking surface, including joined arms.
  for(let i=0;i<15;i++){
    const a=-.46+hash(x*11+i,y*3)*.92,b=-.46+hash(y*7+i,x*2)*.92
    const center=Math.abs(a)<w-.02&&Math.abs(b)<w-.02
    const arm=joins.some(j=>j.end>0&&a*j.dx+b*j.dy>0&&a*j.dx+b*j.dy<j.end-.02&&Math.abs(-a*j.dy+b*j.dx)<w-.03)
    if(!center&&!arm)continue
    d.box(u+a,v+b,.007,.011,z+.04,.13,i%3?0xd3c9b0:0xf0eadb,0xbdb49f,0xb2aa95,0)
  }
}
