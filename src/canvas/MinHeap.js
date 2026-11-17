export default class MinHeap {
 constructor(compare){this.compare=compare;this.values=[];}
 get length(){return this.values.length;}
 push(value){const a=this.values;let i=a.length;a.push(value);while(i){const parent=(i-1)>>1;if(this.compare(a[parent],value)<=0)break;a[i]=a[parent];i=parent;}a[i]=value;}
 pop(){const a=this.values,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&this.compare(a[child+1],a[child])<0)child++;if(this.compare(last,a[child])<=0)break;a[i]=a[child];i=child;}a[i]=last;}return first;}
}
