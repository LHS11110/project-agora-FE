// Extend a quiet-period deadline without cancelling/allocating a timer per event.
export default class CameraIdleTask {
  constructor(callback, delay, {now=()=>performance.now(),schedule=(callback,delay)=>setTimeout(callback,delay),cancel=id=>clearTimeout(id)}={}) {
    Object.assign(this,{callback,delay,now,schedule,cancelTimer:cancel});this.timer=null;this.deadline=0;
  }
  touch(){this.deadline=this.now()+this.delay;if(this.timer===null)this.timer=this.schedule(()=>this.check(),this.delay);}
  check(){this.timer=null;const remaining=this.deadline-this.now();if(remaining>0)this.timer=this.schedule(()=>this.check(),remaining);else this.callback();}
  cancel(){if(this.timer!==null)this.cancelTimer(this.timer);this.timer=null;}
}
