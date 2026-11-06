import math,numpy as np
from calc import gear
def outline(m,z,n=40):
    g=gear(m,z);T=g['T'];rho=g['rho']
    pr=g['on'](g['rf']);pt=g['on'](g['ra'])
    a0=math.atan2(pr[1]-T[1],pr[0]-T[0]);b0=math.atan2(pt[1]-T[1],pt[0]-T[0])
    fl=[(T[0]+rho*math.cos(a0+(b0-a0)*i/n),T[1]+rho*math.sin(a0+(b0-a0)*i/n)) for i in range(n+1)]
    ang=lambda p:math.atan2(p[0],p[1]);pitch=2*math.pi/z;pts=[]
    rot=lambda p,a:(p[0]*math.cos(a)+p[1]*math.sin(a),-p[0]*math.sin(a)+p[1]*math.cos(a))
    for k in range(z):
        c=k*pitch
        for i in range(17):
            a=-ang(pr)+2*ang(pr)*i/16;pts.append(rot((g['rf']*math.sin(a),g['rf']*math.cos(a)),c))
        pts+=[rot(p,c) for p in fl[1:]]
        A0=ang(pt);A1=pitch-A0
        for i in range(1,33):
            a=A0+(A1-A0)*i/32;pts.append(rot((g['ra']*math.sin(a),g['ra']*math.cos(a)),c))
        pts+=[rot((-p[0],p[1]),c+pitch) for p in fl[::-1][1:]]
    return np.array(pts),g
def area(P):
    x,y=P[:,0],P[:,1];return abs(np.dot(x,np.roll(y,-1))-np.dot(y,np.roll(x,-1)))/2
def inside(P,X,Y):
    r=np.zeros(X.shape,bool);x1,y1=P[:,0],P[:,1];x2,y2=np.roll(x1,-1),np.roll(y1,-1)
    for a,b,c,d in zip(x1,y1,x2,y2):
        m=((b>Y)!=(d>Y));
        with np.errstate(divide='ignore',invalid='ignore'): xx=(c-a)*(Y-b)/(d-b)+a
        r^=m&(X<xx)
    return r
def R(P,deg,t=(0,0)):
    a=math.radians(deg);c,s=math.cos(a),math.sin(a);return np.c_[P[:,0]*c-P[:,1]*s+t[0],P[:,0]*s+P[:,1]*c+t[1]]
if __name__=='__main__':
    P,g=outline(2,20);A=area(P);print('area',A,'disco',math.pi*22**2)
    h=0.02;xs=np.arange(-8,8,h);ys=np.arange(16,24,h);X,Y=np.meshgrid(xs,ys)
    mx=0;worst=None
    for t in np.linspace(0,18,19):
        a=inside(R(P,t),X,Y);
        for off in [9]:
            b=inside(R(R(P,180+off-t),0,(0,40)),X,Y) if False else inside(R(P,180+off-t,(0,40)),X,Y)
            i=(a&b).sum()*h*h
            if i>mx:mx=i;worst=t
    print('sovrapposizione massima mm2',round(mx,4),'a t',worst)
    H=math.pi*36;
    # cava: rettangolo x+-2,y 0..7.8 fuori dal cerchio R6
    N=200000;xx=np.linspace(-2,2,N);top=7.8-np.sqrt(36-xx**2);cav=np.trapezoid(top,xx) if hasattr(np,'trapezoid') else np.trapz(top,xx)
    print('cava fuori dal foro mm2',cav)
    V=(A-H-cav)*12/1000;print('V senza foro',A*12/1000,'V finale cm3',V,'massa g C40',V*7.85)
    # scostamento vero dall'evolvente
    inv=lambda t:math.tan(t)-t;rb=g['rb'];T=g['T'];mxe=[]
    for i in range(0,41):
        r_=rb+(g['ra']-rb)*i/40;t=math.acos(rb/r_);an=math.pi/40+inv(t)-inv(math.radians(20))
        e=math.hypot(r_*math.sin(an)-T[0],r_*math.cos(an)-T[1])-g['rho'];mxe.append((round(r_,2),round(e,4)))
    print(mxe[::8])
